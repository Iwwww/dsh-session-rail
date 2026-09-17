# dsh-session-rail

A rail chat switcher for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web client: one icon under **New session** opens a searchable flyout of your workspaces and their recent sessions, so switching chats never needs the sidebar expanded.

![The flyout, with the current project open](docs/flyout.png)

The collapsed rail becomes: brand, **New session**, **Search**, **Chats**, then the pinned foot.

![The collapsed rail](docs/rail.png)

## What it does

- **The current session's project opens by default.** Only one project is open at a time: hovering another swaps it in place, clicking the open one closes it.
- **The panel's height is frozen when it opens**, so switching projects scrolls inside a stable box instead of dragging the panel's edge away from your pointer.
- **It closes only when you clearly leave** — more than 24 px outside the row and the panel for longer than 420 ms — and the close plays a short exit animation. Re-entering cancels it.
- **Rows carry the sidebar's statuses**: waiting for an answer, running, completed, and the active-Schedule marker.
- **Search runs the host's content index** next to local title matching, with snippets, debounced and cancelled like the sidebar's own search.
- **A project row offers "new session in this project"**, and a session row offers fork, rename and archive on hover.
- **It is a `tree`**: arrows move, Enter activates, Escape closes, and the search box hands focus to the list on ArrowDown.
- The row exists **only while the rail is collapsed**. A wide sidebar keeps the standard Workspaces browser and its **Add workspace** action untouched.

Collapsed sessions stay hidden, matching the sidebar itself: subagent origins, archived sessions, and the provisional blank New session row.

## Install

```sh
dsh plugin --profile web add dsh-session-rail
```

The package ships its own bundle patch, so the command also adds it to the profile's layer stack — there is no `cordis.patch.yml` edit to make. Reload the page afterwards: the browser boot graph is composed when the page is served.

To remove it:

```sh
dsh plugin --profile web remove dsh-session-rail
```

## Content search is opt-in in DSH

The shipped `web` profile configures the session-query index with `openAt: never`, which disables full-text search deployment-wide — the sidebar's own search says "Content search is temporarily unavailable" for the same reason. This plugin does not change that default. To get content matches and snippets in the flyout, enable the index in your profile patch (`~/.dsh/profiles/web/cordis.patch.yml`):

```yaml
- id: session-query-sqlite
  config:
    path: ':memory:'
    openAt: first-search
```

Without it, the flyout still filters by session and project names and tells you that content search is unavailable.

## Requirements

- DeepSeek Harness `0.1.5-rc.1` or `0.1.6-alpha.1` (both verified end to end).
- Node 22 or newer, for the `dsh` CLI itself.
- No runtime dependencies: the browser half is one hand-written client-module bundle and requires only platform-seeded modules (`react`, `react-dom`, `@deepseek-ai/dsh-client-ui-primitives`).

## Configuration

Everything lives in the constants above the stylesheet in `lib/client.js`:

| Constant | Default | Meaning |
|---|---:|---|
| `MAX_PROJECTS` | 6 | Projects before the "more projects" row |
| `MAX_CHATS` | 5 | Sessions per project before its "more" row |
| `MAX_CHATS_EXPANDED` | 25 | Sessions once that row is used, or while searching |
| `HOVER_OPEN_MS` | 160 | Hover delay before the flyout opens |
| `HOVER_CLOSE_MS` | 420 | Grace period before a pointer that left closes it |
| `CLOSE_MARGIN` | 24 | How far outside the row and panel still counts as inside |
| `SEARCH_DEBOUNCE_MS` | 250 | Debounce before the host content search runs |

## How it works

- The row is registered into `sidebar.panellist`, the global-panel icon list the sidebar shell renders directly under **New session**, and only while `[data-sidebar-collapsed]` is present — so the expanded sidebar is exactly the shipped one.
- The shell renders that list *before* the Workspaces region, so the requested order (Search above Chats) is a flex `order` swap: the region stops growing, the foot keeps the free space, and the row lands between them. The region's header row, which holds **Add workspace**, is hidden in the rail.
- The row button belongs to the shell and calls `selectPanel` on click, so the plugin owns it with a native listener that runs before React's root dispatch. The full-width `main` panel stays registered only so that nothing can throw.
- Everything is found structurally (`data-slot`, sibling order, the action group that does not contain the Search button) rather than by class name or localized label, and every rail adjustment is undone when the sidebar expands. A reshuffled shell degrades to the default order instead of breaking.

## Development

The dev tools need a `dsh` binary (`DSH_BIN`, default `dsh`), the `zstd` CLI, `playwright-core` (`PLAYWRIGHT_CORE`) and a Chromium binary (`CHROMIUM`, default `/usr/bin/chromium`).

```sh
npm run check       # parses every source, validates the manifest and dictionaries
node tools/smoke.mjs       # browser suite against a fictional DSH_HOME
node tools/screenshots.mjs # rebuilds docs/*.png and fails on any leaked real data
```

`tools/fixture-home.mjs` builds the fictional home the last two use: three invented workspaces (`acme-web`, `orion-api`, `design-system`) whose sessions are generated by `dsh --profile headless` from invented prompts, then retitled and spread over a plausible history. Mutating checks (fork, rename, archive, new session) run only there, never against your own `DSH_HOME`.

## License

MIT — see [LICENSE](LICENSE).
