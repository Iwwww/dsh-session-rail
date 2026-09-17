/**
 * Dev-only: capture the README previews from a real client rendering the
 * fictional fixture home, and fail loudly if any real data leaks into them.
 *
 * Usage: `DSH_BIN=... PLAYWRIGHT_CORE=... node tools/screenshots.mjs`
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { dismissOverlays, loadPlaywright, startHarness, warmSessions } from "./harness.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const docs = join(repoRoot, "docs");
/** Strings that must never reach a published preview. */
const FORBIDDEN = ["co-watch", "trackfile", "chohis", "chohosh", "Hi3559V200", "mikhail", "/home/mikhail"];

const harness = await startHarness({ repoRoot, build: process.env.SKIP_FIXTURE !== "1" });
const { chromium, executablePath } = await loadPlaywright();
const browser = await chromium.launch({ executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1180, height: 860 }, deviceScaleFactor: 2, locale: "en-US" });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message.slice(0, 200)));

try {
	mkdirSync(docs, { recursive: true });
	await page.goto(harness.url, { waitUntil: "domcontentloaded" });
	await page.waitForTimeout(7000);
	await dismissOverlays(page);
	await warmSessions(page);
	await dismissOverlays(page);

	// Expanded sidebar: the standard browser, untouched by this plugin.
	await page.screenshot({ path: join(docs, "wide.png"), clip: { x: 0, y: 0, width: 340, height: 470 } });

	// Collapsed rail: brand, New session, Search, Chats, then the pinned foot.
	await page.locator('button[aria-label="Collapse sidebar"]').first().click();
	await page.waitForTimeout(1200);
	await page.screenshot({ path: join(docs, "rail.png"), clip: { x: 0, y: 0, width: 62, height: 260 } });

	// The flyout, with the current project open and its statuses and times.
	await page.locator('button[aria-label="Chats"]').first().click();
	await page.waitForTimeout(900);
	await page.screenshot({ path: join(docs, "flyout.png"), clip: { x: 0, y: 0, width: 430, height: 470 } });

	const text = await page.evaluate(() => document.body.innerText);
	const leaks = FORBIDDEN.filter((needle) => text.includes(needle));
	if (leaks.length > 0) throw new Error(`preview leak check failed: ${leaks.join(", ")}`);
	if (pageErrors.length > 0) throw new Error(`page errors: ${pageErrors.join(" | ")}`);
	process.stdout.write("previews written to docs/ (wide.png, rail.png, flyout.png); no leaks found\n");
} finally {
	await browser.close();
	harness.stop();
}
