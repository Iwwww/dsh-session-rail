/**
 * Static checks: run with `npm run check`. No dependencies, no browser.
 *
 * The package ships a hand-written browser bundle, so there is no compiler to
 * catch mistakes; these checks are the substitute — they parse every source file,
 * validate the manifest contract the harness reads, and make sure the locale
 * dictionaries stay complete with no stray hard-coded copy in the bundle.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
/**
 * Record one check.
 * @param name - what is checked.
 * @param ok - whether it held.
 * @param detail - extra context on failure.
 */
function check(name, ok, detail) {
	process.stdout.write(`${ok ? "ok  " : "FAIL"} ${name}${ok || detail === undefined ? "" : ` — ${detail}`}\n`);
	if (!ok) failures.push(name);
}

const sources = ["lib/index.js", "lib/client.js", "tools/fixture-home.mjs", "tools/harness.mjs", "tools/smoke.mjs", "tools/screenshots.mjs", "tools/check.mjs"];
for (const file of sources) {
	try {
		execFileSync(process.execPath, ["--check", join(repoRoot, file)], { stdio: "pipe" });
		check(`${file} parses`, true);
	} catch (error) {
		check(`${file} parses`, false, String(error.stderr ?? error.message).split("\n").slice(0, 3).join(" "));
	}
}

const manifest = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
check("manifest is publishable", manifest.private !== true, "private must be absent or false");
check("manifest declares the client half", manifest.dsh?.client?.platform === "web", JSON.stringify(manifest.dsh?.client));
check("manifest declares the bundle patch", manifest.dsh?.bundle?.patch === "./cordis.patch.yml", JSON.stringify(manifest.dsh?.bundle));
check("manifest exports the client entry", manifest.exports?.["./client"]?.default === "./lib/client.js");
check("manifest exports package.json", manifest.exports?.["./package.json"] === "./package.json");
check("manifest has no runtime dependencies", manifest.dependencies === undefined && manifest.peerDependencies === undefined, "keep the install dependency-free");
check("manifest declares a license and repository", typeof manifest.license === "string" && typeof manifest.repository?.url === "string");

const patch = readFileSync(join(repoRoot, "cordis.patch.yml"), "utf8");
check("bundle patch inserts the package row", new RegExp(`name:\\s*'${manifest.name}'`).test(patch) && /id:\s*session-rail/.test(patch));

const client = readFileSync(join(repoRoot, "lib/client.js"), "utf8");
const moduleId = /window\.__ModuleLoader__\.load\(\{\s*\n\s*id:\s*"([^"]+)"/.exec(client)?.[1];
check("browser bundle registers the package id", moduleId === manifest.name, `bundle id ${moduleId} vs package ${manifest.name}`);

/** Keys of one dictionary literal in the bundle. */
function dictionaryKeys(name) {
	const start = client.indexOf(`const ${name} = {`);
	if (start < 0) return null;
	const end = client.indexOf("\n\t\t};", start);
	const body = client.slice(start, end);
	return [...body.matchAll(/^\s{3}(?:"([^"]+)"|([A-Za-z][A-Za-z0-9]*)):/gm)].map((match) => match[1] ?? match[2]);
}
const zh = dictionaryKeys("zh");
const en = dictionaryKeys("en");
const ru = dictionaryKeys("ru");
check("all three dictionaries exist", zh !== null && en !== null && ru !== null);
if (zh !== null && en !== null && ru !== null) {
	const missingEn = zh.filter((key) => !en.includes(key));
	const missingRu = zh.filter((key) => !ru.includes(key));
	check("English covers the zh key set", missingEn.length === 0, missingEn.join(", "));
	check("Russian covers the zh key set", missingRu.length === 0, missingRu.join(", "));
}

// Every user-visible string must come from a dictionary: a Cyrillic or CJK
// literal outside the dictionary blocks is copy that no translator can reach.
const withoutDictionaries = client
	.slice(0, client.indexOf("const zh = {"))
	.concat(client.slice(client.indexOf("\t\t/** Speech-bubble rail glyph")));
// The one justified literal is the language pack's own name: a language picker
// shows every language in its own script, whatever the active locale.
const audited = withoutDictionaries.replace('label: "Русский"', 'label: <language-endonym>');
const strayCyrillic = /["'`][^"'`]*[А-Яа-яЁё][^"'`]*["'`]/.exec(audited);
const strayCjk = /["'`][^"'`]*[\u4e00-\u9fff][^"'`]*["'`]/.exec(audited);
check("no hard-coded Russian or Chinese copy in the bundle", strayCyrillic === null && strayCjk === null, (strayCyrillic ?? strayCjk)?.[0]);
const readmes = ["README.md", "README.ru.md"].map((name) => {
	try {
		return readFileSync(join(repoRoot, name), "utf8");
	} catch {
		return "";
	}
});
check("both READMEs exist", readmes.every((text) => text.length > 0), "README.md and README.ru.md");
check("no personal paths in the bundle or READMEs", !/\/home\/mikhail/.test(client) && readmes.every((text) => !/\/home\/mikhail/.test(text)), "/home/mikhail must not ship");
check("both READMEs show the preview", readmes.every((text) => text.includes("docs/flyout.png")) && readmes.every((text) => text.includes("docs/rail.png")));

process.stdout.write(failures.length === 0 ? "\ncheck: all good\n" : `\ncheck: ${failures.length} failing\n`);
process.exit(failures.length === 0 ? 0 : 1);
