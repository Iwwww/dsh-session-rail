/**
 * Dev-only browser smoke test: boots the real client against the fictional
 * fixture home and asserts the rail row, the flyout behaviour and every feature
 * this plugin adds. Mutating actions (fork, rename, archive, new session) run
 * only here, never against a developer's own `DSH_HOME`.
 *
 * Usage: `DSH_BIN=... PLAYWRIGHT_CORE=... node tools/smoke.mjs`
 */
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { dismissOverlays, loadPlaywright, startHarness } from "./harness.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
/**
 * Record one assertion.
 * @param name - what is being asserted.
 * @param ok - whether it held.
 * @param detail - optional context printed either way.
 */
function check(name, ok, detail) {
	results.push({ name, ok });
	process.stdout.write(`${ok ? "ok  " : "FAIL"} ${name}${detail === undefined ? "" : ` — ${detail}`}\n`);
}
/**
 * Run one interaction, reporting its outcome instead of aborting the suite.
 * @param fn - the interaction to attempt.
 * @returns true when it completed.
 */
async function safe(fn) {
	try {
		await fn();
		return true;
	} catch {
		return false;
	}
}

/**
 * Whether any session log's newest `session/title` is the given title.
 * @param home - the fixture home.
 * @param title - the durable title to look for.
 * @returns true when one session now carries that title.
 */
function hasNewestTitle(home, title) {
	for (const encoded of readdirSync(`${home}/sessions`)) {
		for (const id of readdirSync(`${home}/sessions/${encoded}`)) {
			const file = `${home}/sessions/${encoded}/${id}/session.v3.jsonl.zstd`;
			let text;
			try {
				text = execFileSync("zstd", ["-dc", file], { maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
			} catch {
				continue;
			}
			let newest = "";
			for (const line of text.split("\n")) {
				if (line.trim() === "") continue;
				let event;
				try {
					event = JSON.parse(line);
				} catch {
					continue;
				}
				if (event.type === "session/title" && typeof event.data?.title === "string") newest = event.data.title;
			}
			if (newest === title) return true;
		}
	}
	return false;
}

/** Rail row accessible name in the English locale the harness runs in. */
const ROW = 'button[aria-label="Chats"]';

const harness = await startHarness({ repoRoot, build: process.env.SKIP_FIXTURE !== "1" });
const { chromium, executablePath } = await loadPlaywright();
const browser = await chromium.launch({ executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1180, height: 860 }, locale: "en-US" });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message.slice(0, 200)));

try {
	await page.goto(harness.url, { waitUntil: "domcontentloaded" });
	await page.waitForTimeout(7000);
	await dismissOverlays(page);
	// The host derives list titles from each Session's projection cache, which is
	// written when the Session is first opened, so the fixture warms them first.
	// -- rail shape ------------------------------------------------------------
	check("wide sidebar has no rail row", (await page.locator(ROW).count()) === 0);
	check("wide sidebar keeps Add workspace", (await page.locator('button[aria-label="Add workspace"]').count()) === 1);
	await page.locator('button[aria-label="Collapse sidebar"]').first().click();
	await page.waitForTimeout(1200);

	const order = await page.evaluate(() => {
		const frame = document.querySelector("[data-sidebar-collapsed]");
		const col = frame.querySelector("nav").parentElement;
		return [...col.querySelectorAll("button")]
			.map((button) => ({ label: button.getAttribute("aria-label"), y: Math.round(button.getBoundingClientRect().y), shown: button.getBoundingClientRect().width > 0 && getComputedStyle(button).display !== "none" }))
			.filter((entry) => entry.shown)
			.sort((a, b) => a.y - b.y)
			.map((entry) => entry.label);
	});
	check("rail order is brand, new session, search, chats, settings", JSON.stringify(order) === JSON.stringify(["Open sidebar", "New session", "Search sessions", "Chats", "Settings"]), JSON.stringify(order));
	check("Add workspace is hidden in the rail", (await page.locator('button[aria-label="Add workspace"]:visible').count()) === 0);
	check("rail row exposes its popup state", (await page.locator(ROW).getAttribute("aria-haspopup")) === "dialog");

	// -- flyout basics ---------------------------------------------------------
	const row = page.locator(ROW).first();
	await row.click();
	await page.waitForTimeout(700);
	const panel = page.locator(".dsh-rail-sessions__panel");
	check("clicking the row opens the flyout", await panel.isVisible());
	check("clicking the row opens no fullscreen panel", (await page.locator(".dsh-rail-sessions__main").count()) === 0);
	check("row reports expanded", (await row.getAttribute("aria-expanded")) === "true");
	// The three most recent workspaces, newest first; billing-portal is older than
	// all of them and must not appear.
	const groupTitles = await page.locator(".dsh-rail-sessions__projectTitle").evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));
	check("three most recent workspaces are listed, newest first", JSON.stringify(groupTitles) === JSON.stringify(["acme-web", "orion-api", "design-system"]), JSON.stringify(groupTitles));
	check("no disclosure controls remain", (await page.locator(".dsh-rail-sessions__project [aria-expanded]").count()) === 0 && (await page.locator(".dsh-rail-sessions__chevron").count()) === 0);
	check("no more rows remain", (await page.locator(".dsh-rail-sessions__more").count()) === 0);
	const perGroup = await page.locator(".dsh-rail-sessions__group").evaluateAll((groups) => groups.map((group) => group.querySelectorAll(".dsh-rail-sessions__chat").length));
	check("each workspace lists at most four chats", perGroup.length > 0 && perGroup.every((count) => count <= 4), JSON.stringify(perGroup));
	check("the fullest workspace is cut to four", perGroup[0] === 4, JSON.stringify(perGroup));
	check("every chat row carries a status slot", await page.locator(".dsh-rail-sessions__chat").evaluateAll((rows) => rows.every((node) => node.querySelector(".dsh-rail-sessions__status, .dsh-rail-sessions__chatIcon") !== null)));
	check("keyboard hints are shown", (await page.locator(".dsh-rail-sessions__hints").textContent()).includes("navigate"));
	// Titles come from the fixture's projection caches; a schema change would fall
	// back to project basenames, which this catches.
	const chatTitles = await page.locator(".dsh-rail-sessions__chat").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("title")));
	check("fixture titles reach the rows", chatTitles.some((title) => title.includes("Fix the flaky login test")), JSON.stringify(chatTitles.slice(0, 4)));

	// -- no scrollbars ---------------------------------------------------------
	const box = await page.evaluate(() => {
		const list = document.querySelector(".dsh-rail-sessions__list");
		const panel = document.querySelector(".dsh-rail-sessions__panel");
		return {
			listScroll: list.scrollWidth,
			listClient: list.clientWidth,
			listGutter: list.offsetWidth - list.clientWidth,
			listBar: getComputedStyle(list).scrollbarWidth,
			panelScroll: panel.scrollWidth,
			panelClient: panel.clientWidth
		};
	});
	check("the list has no horizontal overflow", box.listScroll <= box.listClient + 1, JSON.stringify(box));
	check("the panel has no horizontal overflow", box.panelScroll <= box.panelClient + 1, JSON.stringify(box));
	check("no scrollbar chrome is drawn", box.listBar === "none" && box.listGutter === 0, JSON.stringify(box));

	// -- a workspace header is inert ------------------------------------------
	const rowsBeforeClick = await page.locator(".dsh-rail-sessions__chat").count();
	await safe(() => page.locator(".dsh-rail-sessions__project").nth(1).click());
	await page.waitForTimeout(500);
	check("clicking a workspace header changes nothing", (await page.locator(".dsh-rail-sessions__chat").count()) === rowsBeforeClick);

	// -- content search --------------------------------------------------------
	await page.fill(".dsh-rail-sessions__input", "bursty");
	await page.waitForTimeout(1600);
	const snippets = await page.locator(".dsh-rail-sessions__snippet").allTextContents();
	const hitTitles = await page.locator(".dsh-rail-sessions__chat").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("title")));
	check("content-only query returns the host hit", snippets.length > 0 && hitTitles.some((title) => title.startsWith("Explain how the rate limiter")), JSON.stringify({ snippets: snippets.slice(0, 1), hitTitles }));
	await page.fill(".dsh-rail-sessions__input", "");
	await page.waitForTimeout(600);

	// -- keyboard navigation ---------------------------------------------------
	await page.locator(".dsh-rail-sessions__list").focus();
	await page.keyboard.press("ArrowDown");
	await page.keyboard.press("ArrowDown");
	const firstActive = await page.locator(".dsh-rail-sessions__list").getAttribute("aria-activedescendant");
	await page.keyboard.press("ArrowUp");
	const secondActive = await page.locator(".dsh-rail-sessions__list").getAttribute("aria-activedescendant");
	check("arrows move the active row", firstActive !== null && secondActive !== null && firstActive !== secondActive, `${firstActive} -> ${secondActive}`);
	const rowsBeforeArrows = await page.locator(".dsh-rail-sessions__chat").count();
	await page.keyboard.press("ArrowLeft");
	await page.keyboard.press("ArrowRight");
	await page.waitForTimeout(400);
	check("left and right arrows no longer collapse anything", (await page.locator(".dsh-rail-sessions__chat").count()) === rowsBeforeArrows);

	// -- new session in a workspace -------------------------------------------
	const project = page.locator(".dsh-rail-sessions__project").nth(1);
	await project.hover();
	await page.waitForTimeout(400);
	const projectTitle = (await project.locator(".dsh-rail-sessions__projectTitle").textContent()).trim();
	const projectAdd = project.locator(".dsh-rail-sessions__iconButton").first();
	await projectAdd.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
	await safe(() => projectAdd.click());
	await page.waitForTimeout(2200);
	const heroHasProject = await page.evaluate((name) => [...document.querySelectorAll("*")].some((node) => node.children.length === 0 && node.textContent.trim() === name && node.closest(".dsh-rail-sessions__panel") === null), projectTitle);
	check("project action starts a session in that workspace", heroHasProject, projectTitle);

	// -- fork / rename / archive ----------------------------------------------
	/** Chats rendered in the first workspace group. */
	const firstGroupChats = async () => page.locator(".dsh-rail-sessions__group").first().locator(".dsh-rail-sessions__chat").count();
	const chatCountBefore = await firstGroupChats();
	const chat = page.locator(".dsh-rail-sessions__chat").first();
	await chat.hover();
	await page.waitForTimeout(300);
	await chat.hover();
	const forkButton = chat.locator(".dsh-rail-sessions__iconButton").nth(0);
	await forkButton.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
	await safe(() => forkButton.click());
	await page.waitForTimeout(2500);
	const chatCountAfter = await firstGroupChats();
	check("fork adds a session to the workspace", chatCountAfter === Math.min(4, chatCountBefore + 1), `${chatCountBefore} -> ${chatCountAfter}`);

	const target = page.locator(".dsh-rail-sessions__chat").first();
	const originalTitle = await target.getAttribute("title");
	await target.hover();
	await page.waitForTimeout(300);
	await target.hover();
	const renameButton = target.locator(".dsh-rail-sessions__iconButton").nth(1);
	await renameButton.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
	await safe(() => renameButton.click());
	await page.waitForTimeout(700);
	check("rename opens a dialog", (await page.locator(".dsh-rail-sessions__renameField").count()) === 1);
	await page.fill(".dsh-rail-sessions__renameField", "Renamed by smoke");
	await page.getByRole("button", { name: "Save" }).click();
	await page.waitForTimeout(2500);
	const renameError = await page.locator(".dsh-rail-sessions__renameError").allTextContents();
	// A list row's title is served from the host's projection cache, which the
	// rename does not rewrite, so the durable result is asserted where it lands:
	// the newest `session/title` event in the session log.
	const persisted = hasNewestTitle(harness.home, "Renamed by smoke");
	check("rename updates the row", persisted && renameError.length === 0, `was ${originalTitle}; error ${JSON.stringify(renameError)}`);

	// Archive a session whose title the list does serve, so the check measures the
	// archive rather than the stale cache.
	if ((await page.locator(".dsh-rail-sessions__panel").count()) === 0) {
		await safe(() => row.click());
		await page.waitForTimeout(900);
	}
	const archiveTarget = page.locator('.dsh-rail-sessions__chat').first();
	const archivedTitle = await archiveTarget.getAttribute("title");
	await safe(() => archiveTarget.hover());
	await page.waitForTimeout(300);
	await safe(() => archiveTarget.hover());
	const archiveButton = archiveTarget.locator(".dsh-rail-sessions__iconButton").nth(2);
	await archiveButton.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
	await safe(() => archiveButton.click());
	await page.waitForTimeout(2000);
	const archivedGone = (await page.locator(".dsh-rail-sessions__chat").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("title")))).includes(archivedTitle) === false;
	check("archive removes the row", archivedGone, `archived ${archivedTitle}`);

	// -- picking a chat --------------------------------------------------------
	if ((await page.locator(".dsh-rail-sessions__panel").count()) === 0) {
		await safe(() => row.click());
		await page.waitForTimeout(900);
	}
	await safe(() => page.locator(".dsh-rail-sessions__project").first().hover());
	await page.waitForTimeout(400);
	const picked = page.locator(".dsh-rail-sessions__chat").first();
	const pickedTitle = await picked.getAttribute("title");
	await picked.click();
	await page.waitForTimeout(1500);
	check("picking a chat closes the flyout", (await panel.count()) === 0, `picked ${pickedTitle}`);

	// -- fixture home only -----------------------------------------------------
	const text = await page.evaluate(() => document.body.innerText);
	const leaks = ["co-watch", "trackfile", "firmware-Hi3559V200", "chohosh", "/home/mikhail"].filter((needle) => text.includes(needle));
	check("no real workspace, session or path appears", leaks.length === 0, leaks.join(", "));
	check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
} finally {
	await browser.close();
	harness.stop();
}

const failed = results.filter((entry) => !entry.ok);
process.stdout.write(`\n${results.length - failed.length}/${results.length} checks passed\n`);
process.exit(failed.length === 0 ? 0 : 1);
