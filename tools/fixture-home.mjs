/**
 * Build a throwaway `DSH_HOME` full of fictional workspaces and sessions.
 *
 * The README previews must show the real plugin rendering with no real data, so
 * rather than mocking the UI this builds a genuine harness home: the sessions are
 * written by `dsh --profile headless` from fictional prompts (which is what gives
 * them a real `session/title` event), then rewritten in place to force the exact
 * display title and to spread the timestamps over a natural-looking history.
 *
 * Usage: `node tools/fixture-home.mjs [home]`
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { zstdCompressSync } from "node:zlib";

/**
 * Fictional workspaces, each with the sessions that seed it.
 *
 * Each `prompt` is written so that its first words *are* the wanted title: the
 * host derives a fallback title from the first human message, and the fixture
 * must show the exact strings the previews promise no matter which derivation
 * path a deployment takes. The single long prompt exists to prove that content
 * search matches text the title never contains.
 */
export const FIXTURE_WORKSPACES = [
	{
		id: "1f0a5a4e-6f0e-4a1f-9d0e-2f4b7c9a1e01",
		title: "acme-web",
		slug: "acme-web",
		sessions: [
			{ title: "Fix the flaky login test", prompt: "Fix the flaky login test", age: 7 },
			{ title: "Add a dark mode toggle", prompt: "Add a dark mode toggle", age: 55 },
			{ title: "Document the release checklist", prompt: "Document the release checklist", age: 190 },
			{ title: "Refactor the settings form", prompt: "Refactor the settings form", age: 300 },
			{ title: "Investigate the slow dashboard query", prompt: "Investigate the slow", age: 1500 },
			{ title: "Draft onboarding copy", prompt: "Draft onboarding copy", age: 2900 }
		]
	},
	{
		id: "2b7c6d5f-8a1b-4c2d-8e3f-4a5b6c7d8e02",
		title: "orion-api",
		slug: "orion-api",
		sessions: [
			{ title: "Harden the webhook retry path", prompt: "Harden the webhook retry path", age: 2600 },
			{ title: "Explain how the rate limiter", prompt: "Explain how the rate limiter budget is computed for bursty tenants", age: 3100 },
			{ title: "Add structured request logs", prompt: "Add structured request logs", age: 5400 }
		]
	},
	{
		id: "3c8d7e6a-9b2c-4d3e-9f4a-5b6c7d8e9f03",
		title: "design-system",
		slug: "design-system",
		sessions: [
			{ title: "Extract button tokens", prompt: "Extract button tokens", age: 7300 },
			{ title: "Review the spacing scale", prompt: "Review the spacing scale", age: 9000 }
		]
	},
	{
		// Older than every other workspace on purpose: it must fall outside the three
		// most recent, which is what the smoke test asserts and what keeps the README
		// preview showing exactly three groups.
		id: "4d9e8f7b-ac3d-4e4f-8a5b-6c7d8e9fa004",
		title: "billing-portal",
		slug: "billing-portal",
		sessions: [
			{ title: "Reconcile the invoice totals", prompt: "Reconcile the invoice totals", age: 11000 },
			{ title: "Retire the legacy price table", prompt: "Retire the legacy price", age: 13000 }
		]
	}
];

/** Root the fixture workspaces' directories live under. */
export const FIXTURE_ROOT = join("/tmp", "dsh-session-rail-fixture");

/** Harness home the generated sessions and registry are written to. */
export const DEFAULT_FIXTURE_HOME = join(FIXTURE_ROOT, "home");

/**
 * Encode a working directory the way the jsonl persistence does: strip the
 * leading slash, turn the remaining separators into dashes, wrap in `--`.
 * @param cwd - absolute working directory.
 * @returns the session directory name.
 */
export function encodeCwd(cwd) {
	const body = cwd.replace(/^\//, "").replace(/\//g, "-");
	const escaped = body.replace(/[^A-Za-z0-9._-]/g, (character) => "~" + character.codePointAt(0).toString(16).padStart(4, "0"));
	return "--" + escaped + "--";
}

/**
 * Read a session log. The file is a zstd stream made of several concatenated
 * frames (the host requires the first frame to hold exactly the header line), and
 * `zlib.zstdDecompressSync` stops after the first frame, so the CLI does the
 * decoding.
 * @param file - absolute path of `session.v3.jsonl.zstd`.
 * @returns the decoded JSONL text.
 */
function readSessionLog(file) {
	return execFileSync("zstd", ["-dc", file], { maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
}

/**
 * Give one generated session its display title and its place in the fixture
 * history.
 *
 * The title is forced, then every timestamp in the log is shifted so its newest
 * event lands exactly `ageMinutes` before now. Shifting is the only way to set the
 * recency: the list's `updatedAt` follows the newest event, so appending an older
 * frame leaves the session looking "just now". The file keeps the two-frame shape
 * the reader requires (header, then everything else).
 * @param file - absolute path of `session.v3.jsonl.zstd`.
 * @param title - display title to force.
 * @param ageMinutes - how long before now the session should look last updated.
 */
function setSessionFixture(file, title, ageMinutes) {
	const events = readSessionLog(file)
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => JSON.parse(line));
	let newest = 0;
	let maxSeq = 0;
	let titleEvent = null;
	let firstUserSeq = null;
	for (const event of events) {
		if (typeof event.time === "number") newest = Math.max(newest, event.time);
		if (typeof event.seq === "number") maxSeq = Math.max(maxSeq, event.seq);
		if (event.type === "session/title") titleEvent = event;
		if (event.type === "user/message" && firstUserSeq === null && typeof event.seq === "number") firstUserSeq = event.seq;
	}
	if (firstUserSeq === null) throw new Error(`fixture session ${file} has no user message; its title would be ignored`);
	if (titleEvent === null) {
		titleEvent = {
			type: "session/title",
			seq: maxSeq + 1,
			time: newest,
			data: { title, messageSeqs: [firstUserSeq], source: { kind: "fallback" } }
		};
		events.push(titleEvent);
	} else {
		titleEvent.data = Object.assign({}, titleEvent.data, { title });
	}
	const target = Date.now() - ageMinutes * 60 * 1000;
	const delta = target - newest;
	const lines = events.map((event) => {
		if (typeof event.time === "number") event.time += delta;
		if (event.type === "session" && typeof event.createdAt === "number") event.createdAt += delta;
		return JSON.stringify(event);
	});
	const headerFrame = zstdCompressSync(Buffer.from(lines[0] + "\n", "utf8"));
	const bodyFrame = zstdCompressSync(Buffer.from(lines.slice(1).join("\n") + "\n", "utf8"));
	writeFileSync(file, Buffer.concat([headerFrame, bodyFrame]));
}

/**
 * Publish a session's title the way a warm host would.
 *
 * A cold session shows its project basename until the host has projected it, and
 * the host only projects a session that gets opened — which the fixture must not
 * do, because opening appends events and destroys the recency it just set. Writing
 * the one projection row the list reads keeps titles correct with no browser and no
 * activity in the log.
 * @param home - the fixture home.
 * @param id - session id.
 * @param file - that session's log.
 * @param title - the display title to publish.
 */
function writeProjectionCache(home, id, file, title) {
	const events = readSessionLog(file)
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => JSON.parse(line));
	const header = events[0];
	let maxSeq = 0;
	for (const event of events) {
		if (typeof event.seq === "number") maxSeq = Math.max(maxSeq, event.seq);
	}
	const dir = join(home, "storages", "session_projcache", "sessions");
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(dir, id + ".json"),
		JSON.stringify({
			version: 7,
			record: {
				identity: {
					formatVersion: 3,
					createdAt: header.createdAt,
					cwd: header.cwd,
					isSeeded: false,
					inheritedEventCount: 0
				},
				rows: { title: { ver: 1, seq: maxSeq, val: title } }
			}
		}) + "\n"
	);
}

/**
 * Build the fixture home from scratch.
 * @param options - target home and the dsh binary to generate sessions with.
 * @returns the created workspace registry rows.
 */
export function buildFixtureHome(options = {}) {
	const home = options.home ?? DEFAULT_FIXTURE_HOME;
	const dsh = options.dsh ?? process.env.DSH_BIN ?? "dsh";
	rmSync(home, { recursive: true, force: true });
	mkdirSync(join(home, "sessions"), { recursive: true });
	mkdirSync(join(home, "storages"), { recursive: true });

	const registry = {};
	const workspaceIds = [];
	for (const workspace of FIXTURE_WORKSPACES) {
		// Sessions live directly in the workspace directory: the host accounts a
		// session to a Workspace by its cwd, so a nested directory would drop it out
		// of every group.
		const root = join(FIXTURE_ROOT, workspace.slug);
		rmSync(root, { recursive: true, force: true });
		mkdirSync(root, { recursive: true });
		const sessionIds = [];
		for (const session of workspace.sessions) {
			const before = new Set(listSessionIds(home));
			// The run fails on the missing model credential by design; the session log
			// is written before that point.
			try {
				execFileSync(dsh, ["--profile", "headless", session.prompt], {
					cwd: root,
					env: { ...process.env, DSH_HOME: home },
					stdio: "pipe"
				});
			} catch {
				/* expected: no API key in a fixture home */
			}
			const created = listSessionIds(home).filter((id) => !before.has(id));
			if (created.length !== 1) throw new Error(`expected one new session for "${session.title}", found ${created.length}`);
			const id = created[0];
			const log = findSessionLog(home, id);
			setSessionFixture(log, session.title, session.age);
			writeProjectionCache(home, id, log, session.title);
			sessionIds.push(id);
		}
		workspaceIds.push(workspace.id);
		registry[workspace.id] = {
			path: root,
			title: workspace.title,
			sessionIds,
			createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
			updatedAt: new Date().toISOString()
		};
	}

	// Pre-acknowledge the shell's first-run notice and plant a dummy provider
	// credential: without one, every Session open re-raises the masked API-key
	// onboarding, which would block both the screenshots and the browser tests.
	// The value is deliberately fake — the fixture never calls a model.
	writeFileSync(join(home, "settings.yaml"), "ui-onboarding:\n  welcomeNoticeVersion: 2026-08-13.1\n");
	writeFileSync(join(home, ".credentials.yaml"), "version: 1\nrecords: {}\nrefs:\n  DEEPSEEK_API_KEY: fixture-not-a-real-key\n", { mode: 0o600 });

	writeFileSync(
		join(home, "storages", "workspace.json"),
		JSON.stringify(
			{
				unit: { name: "workspace", version: 2 },
				global: { initialized: true, workspaceIds, archivedSessionIds: [] },
				tables: { workspaces: registry }
			},
			null,
			2
		) + "\n"
	);
	return { home, registry };
}

/**
 * List every session id in the home, wherever the host encoded its cwd.
 * @param home - the fixture home.
 * @returns session ids currently on disk.
 */
function listSessionIds(home) {
	const ids = [];
	let encoded;
	try {
		encoded = readdirSync(join(home, "sessions"));
	} catch {
		return ids;
	}
	for (const name of encoded) ids.push(...listSessionDirs(join(home, "sessions", name)));
	return ids;
}

/**
 * Resolve one session's log file by id, without re-deriving the cwd encoding.
 * @param home - the fixture home.
 * @param id - session id.
 * @returns absolute path of `session.v3.jsonl.zstd`.
 */
function findSessionLog(home, id) {
	for (const name of readdirSync(join(home, "sessions"))) {
		const candidate = join(home, "sessions", name, id, "session.v3.jsonl.zstd");
		try {
			readdirSync(join(home, "sessions", name, id));
			return candidate;
		} catch {
			/* keep looking */
		}
	}
	throw new Error(`session log for ${id} not found`);
}

/**
 * List the session directories under one encoded cwd directory.
 * @param dir - the encoded session directory, or a path that does not exist yet.
 * @returns the session ids it currently holds.
 */
function listSessionDirs(dir) {
	try {
		return readdirSync(dir);
	} catch {
		return [];
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const home = process.argv[2] ?? DEFAULT_FIXTURE_HOME;
	const result = buildFixtureHome({ home });
	const sessions = Object.values(result.registry).reduce((total, entry) => total + entry.sessionIds.length, 0);
	process.stdout.write(`fixture home: ${result.home} (${Object.keys(result.registry).length} workspaces, ${sessions} sessions)\n`);
}
