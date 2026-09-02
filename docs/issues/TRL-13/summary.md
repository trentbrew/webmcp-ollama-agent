# TRL-13 — Inject content scripts into already-open tabs on install/startup

**Labels:** `webmcp`, `enhancement` · **Complements:** TRL-12

## Goal

After extension install, update, or browser startup, already-open http(s) tabs get `mcp-main` (MAIN) and `mcp-bridge` (ISOLATED) via `chrome.scripting.executeScript` so WebMCP tools appear without a manual page reload.

## Out of scope

- `chrome.storage.session` persistence for panel subscriptions (TRL-12 panel-side reconnect).
- Cold-start spec detail beyond injection parity (see TRL-18).

## Implementation contract

| File | Change |
| --- | --- |
| `src/background/inject.ts` | `injectExistingTabs()` — query http(s) tabs, inject both bundles per world |
| `src/background/index.ts` | Call `injectExistingTabs` on `onInstalled` + `onStartup` |
| `src/content/mcp-main.ts` | `__webmcpMainLoaded` idempotency guard |
| `src/content/mcp-bridge.ts` | `__webmcpBridgeLoaded` idempotency guard |
| `public/manifest.json` | `scripting` permission + `http://*/*`, `https://*/*` host_permissions |
| `src/background/inject.test.ts` | Unit tests with faked `chrome.scripting` / `chrome.tabs` |

## Acceptance criteria

```text
test: pnpm check (suite: check)
test: pnpm test (suite: unit — includes inject.test.ts)
test: grep injectExistingTabs in src/background/index.ts (onInstalled + onStartup)
test: grep __webmcpMainLoaded and __webmcpBridgeLoaded guards
test: manifest scripting + host_permissions node check
test: npm run build
```

## Manual verify

1. Open `test-page/index.html` in a tab (do not reload after step 2).
2. Load/reload extension at `chrome://extensions`.
3. Open side panel MCP tab — tools from the open page should appear without reloading the page.
