# dsh-session-rail

A searchable flyout for switching between workspaces and recent sessions in the DeepSeek Harness web client.

<img src="docs/flyout.png" alt="Session rail flyout" width="480">

## Install

From npm:

```sh
dsh plugin --profile web add dsh-session-rail
```

From GitHub:

```sh
dsh plugin --profile web add https://github.com/Iwwww/dsh-session-rail
```

Reload the page after installation.

## Development

Development tools are separate from plugin runtime dependencies and are not installed for plugin users. Browser tests and screenshot generation require a DSH CLI, `zstd`, `playwright-core`, and Chromium. Run static checks with `npm run check`; run the browser smoke test with `node tools/smoke.mjs`.
