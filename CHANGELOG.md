# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-17

First release.

### Added

- A **Chats** row in the collapsed sidebar rail that opens a searchable flyout of
  workspaces and their recent sessions; the row exists only while the rail is
  collapsed, so the expanded sidebar stays exactly as shipped.
- Rail shaping: the requested order (brand, New session, Search, Chats, foot) via
  a flex `order` swap, and the region's **Add workspace** header row hidden in the
  rail only.
- Flyout behaviour: the current session's project opens by default, one project at
  a time with hover-swap and click-to-collapse, a frozen open height, proximity
  closing (24 px / 420 ms) and short enter/exit animations honouring
  `prefers-reduced-motion`.
- Row content: the sidebar's session statuses (waiting for an answer, running,
  completed) plus the active-Schedule marker.
- Search: the host content index with snippets, debounced and cancelled like the
  sidebar's own search, merged with local title and project matches.
- Actions: new session in a project, and fork, rename (with a dialog) and archive
  on a session row.
- Keyboard and assistive support: the list is a `tree` with arrow/Home/End
  navigation, Enter activation, Escape close, `aria-activedescendant`, and
  `aria-haspopup`/`aria-expanded` on the rail row.
- Localisation: Simplified Chinese (the key-set source of truth), English, and a
  Russian language pack.
- A `dsh.bundle` patch, so `dsh plugin --profile web add dsh-session-rail`
  activates the row without a hand-written profile patch.

### Notes

- Content search is opt-in in DSH: the shipped `web` profile configures the
  session-query index with `openAt: never`. The README documents the one-line
  profile override; without it the flyout filters by name and says so.
