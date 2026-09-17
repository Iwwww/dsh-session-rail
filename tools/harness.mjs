/**
 * Dev-only harness: boot the real web client against a fictional `DSH_HOME`
 * with this plugin installed, and hand back its tokenized URL.
 *
 * Nothing here ships with the package. It exists so `tools/smoke.mjs` (browser
 * assertions) and `tools/screenshots.mjs` (README previews) can drive a genuine
 * harness instead of a mock, while never touching the developer's own sessions.
 *
 * Requirements: a `dsh` binary (`DSH_BIN` or PATH), and `playwright-core` for the
 * callers (`PLAYWRIGHT_CORE` or the module name), plus a Chromium binary
 * (`CHROMIUM`, default `/usr/bin/chromium`).
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildFixtureHome, DEFAULT_FIXTURE_HOME } from "./fixture-home.mjs";

/** Profile name created inside the fixture home. */
const PROFILE = "preview";
/** How long to wait for the "dsh web: http://..." line. */
const BOOT_TIMEOUT_MS = 120000;

/**
 * Spawn one `dsh web` for a home and resolve once it prints its URL.
 * @param options - dsh binary, home, profile and extra app arguments.
 * @returns the running child and its URL.
 */
function bootWeb(options) {
	// Launcher flags must precede the app arguments: the first token the launcher
	// does not recognize starts the app's own argv.
	const args = ["--profile", options.profile, ...(options.launcher ?? []), "--port", "0", "--no-open"];
	const child = spawn(options.dsh, args, {
		cwd: options.cwd,
		env: { ...process.env, DSH_HOME: options.home },
		stdio: ["ignore", "pipe", "pipe"]
	});
	return new Promise((resolve, reject) => {
		let out = "";
		const timer = setTimeout(() => {
			child.kill("SIGTERM");
			reject(new Error(`dsh web did not print a URL in ${BOOT_TIMEOUT_MS}ms\n${out}`));
		}, BOOT_TIMEOUT_MS);
		const onData = (chunk) => {
			out += String(chunk);
			const match = /http:\/\/127\.0\.0\.1:\d+\/\?token=\S+/.exec(out);
			if (match === null) return;
			clearTimeout(timer);
			resolve({ child, url: match[0], log: out });
		};
		child.stdout.on("data", onData);
		child.stderr.on("data", onData);
		child.on("exit", (code) => {
			clearTimeout(timer);
			reject(new Error(`dsh web exited early with ${code}\n${out}`));
		});
	});
}

/**
 * Build the fixture home, create the profile there, install this package and
 * boot the client.
 * @param options - `repoRoot`, optional `home`, `dsh`, `build`.
 * @returns the URL, the home, and a stop function.
 */
export async function startHarness(options) {
	const dsh = options.dsh ?? process.env.DSH_BIN ?? "dsh";
	const home = options.home ?? DEFAULT_FIXTURE_HOME;
	const repoRoot = options.repoRoot;
	if (options.build !== false) buildFixtureHome({ home, dsh });

	// First boot creates the profile from the shipped template; the plugin is
	// installed afterwards so the second boot composes it from the start, which is
	// exactly the path a user takes.
	if (!existsSync(join(home, "profiles", PROFILE, "package.json"))) {
		const first = await bootWeb({ dsh, home, profile: PROFILE, cwd: repoRoot, launcher: ["--from-default-profile", "web"] });
		first.child.kill("SIGTERM");
		await new Promise((resolve) => setTimeout(resolve, 1500));
	}

	// The shipped web profile disables the opt-in content index (`openAt: never`),
	// so the fixture turns it on: the smoke test must exercise real content search.
	writeFileSync(
		join(home, "profiles", PROFILE, "cordis.patch.yml"),
		"# Dev fixture only: enable the opt-in full-text index for the smoke test.\n- id: session-query-sqlite\n  config:\n    path: ':memory:'\n    openAt: first-search\n"
	);

	execFileSync(dsh, ["plugin", "--profile", PROFILE, "add", `link:${repoRoot}`], {
		cwd: repoRoot,
		env: { ...process.env, DSH_HOME: home },
		stdio: "pipe"
	});

	const second = await bootWeb({ dsh, home, profile: PROFILE, cwd: repoRoot });
	const stop = () => {
		second.child.kill("SIGTERM");
	};
	return { url: second.url, home, profile: PROFILE, stop };
}

/**
 * Dismiss the shell's first-run welcome notice, which renders as a masked modal
 * over a fresh `DSH_HOME` and would otherwise swallow every pointer event.
 * @param page - the Playwright page, already loaded.
 */
export async function dismissOverlays(page) {
	// A fresh home raises the API-key onboarding. The fixture pre-acknowledges it,
	// so this is a fallback: retry because the modal can arrive after the first
	// paint, and because a rejected form keeps it open.
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const mask = page.locator('[role="presentation"] [class*="mask"]:visible');
		const dialog = page.locator('[role="presentation"] [class*="dialog"]');
		if ((await mask.count()) === 0) {
			await page.waitForTimeout(attempt === 0 ? 2500 : 800);
			if ((await mask.count()) === 0 && (await dialog.count()) === 0) return true;
		}
		const buttons = page.locator('[role="presentation"] button');
		let dismissed = false;
		for (const wording of [/later/i, /skip/i, /not now/i, /позже/i, /稍后/i]) {
			const match = page.locator('[role="presentation"] button', { hasText: wording });
			if ((await match.count()) > 0) {
				await match.first().click({ timeout: 5000 }).catch(() => {});
				dismissed = true;
				break;
			}
		}
		if (!dismissed) {
			const close = page.locator('[role="presentation"] button[aria-label]');
			if ((await close.count()) > 0) await close.first().click({ timeout: 5000 }).catch(() => {});
			else if ((await buttons.count()) > 0) await buttons.first().click({ timeout: 5000 }).catch(() => {});
		}
		await page.waitForTimeout(700);
		if ((await mask.count()) === 0) return true;
		await page.keyboard.press("Escape");
		await page.waitForTimeout(500);
		if ((await mask.count()) === 0) return true;
	}
	return false;
}

/**
 * Open every listed Session once.
 *
 * The host derives a list row's title from the Session's projection cache, which
 * is written when the Session is projected — so a home whose logs were produced
 * by another process shows project basenames until each Session has been opened
 * once. Previewing or asserting titles in the fixture therefore warms them first.
 * @param page - the Playwright page, already loaded and past the overlays.
 * @param limit - safety cap on sessions to open.
 * @returns how many rows were opened.
 */
export async function warmSessions(page, limit = 80) {
	// Expand every group first, so one pass over the rows covers them all.
	const groups = page.locator('[class*="projectRow"]');
	const groupCount = await groups.count();
	for (let index = 0; index < groupCount; index += 1) {
		const group = groups.nth(index);
		if (!(await group.isVisible().catch(() => false))) continue;
		if ((await group.getAttribute("aria-expanded")) !== "true") {
			await group.click({ timeout: 4000 }).catch(() => {});
			await page.waitForTimeout(300);
		}
	}
	// A folded group hides its remainder behind a disclosure.
	const more = page.getByText(/show more/i).first();
	if ((await more.count()) > 0 && (await more.isVisible().catch(() => false))) {
		await more.click({ timeout: 4000 }).catch(() => {});
		await page.waitForTimeout(400);
	}
	const rows = page.locator('[class*="sessionRow"]');
	const count = Math.min(await rows.count(), limit);
	let opened = 0;
	for (let index = 0; index < count; index += 1) {
		const row = rows.nth(index);
		if (!(await row.isVisible().catch(() => false))) continue;
		await row.click({ timeout: 4000 }).catch(() => {});
		await page.waitForTimeout(220);
		opened += 1;
	}
	await page.waitForTimeout(1500);
	return opened;
}

/**
 * Resolve `playwright-core` and the Chromium executable.
 * @returns the chromium launcher and the executable path.
 */
export async function loadPlaywright() {
	const configured = process.env.PLAYWRIGHT_CORE ?? "playwright-core";
	const specifier = configured.startsWith("/") ? pathToFileURL(join(configured, "index.mjs")).href : configured;
	const module = await import(specifier).catch(async () => {
		return import(configured.startsWith("/") ? pathToFileURL(join(configured, "index.js")).href : configured);
	}).catch(() => {
		throw new Error(`playwright-core is not resolvable; set PLAYWRIGHT_CORE to its path (tried "${specifier}")`);
	});
	const executablePath = process.env.CHROMIUM ?? "/usr/bin/chromium";
	return { chromium: module.chromium, executablePath };
}
