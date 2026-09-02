# TRL-18 — Spec: Cold-start content script injection

**Parent:** TRL-13 (closed) · **Labels:** `spec`

## Goal

Formalize the cold-start injection contract that TRL-13 implements: programmatic injection of `mcp-main` (MAIN) and `mcp-bridge` (ISOLATED) into already-open http(s) tabs on extension install/update and browser startup.

## Reconciliation (2026-09-01)

TRL-13 shipped with review PASS (TRL-22). All TRL-18 spec AC pass against the promoted tree — **no separate impl wedge required**. TRL-18 closes as spec satisfied by parent impl.

## Architecture

```mermaid
flowchart LR
  SW[Service worker] -->|onInstalled / onStartup| Inject[injectExistingTabs]
  Inject -->|tabs.query http(s)| Tabs[Open tabs]
  Inject -->|executeScript MAIN| Main[mcp-main.js]
  Inject -->|executeScript ISOLATED| Bridge[mcp-bridge.js]
  Main -->|__webmcpMainLoaded guard| Page[Page realm]
  Bridge -->|__webmcpBridgeLoaded guard| Ext[Extension realm]
```

## Implementation contract (satisfied by TRL-13)

| File | Requirement |
| --- | --- |
| `src/background/inject.ts` | Batch inject both bundles per tab |
| `src/background/index.ts` | Hooks on `onInstalled` + `onStartup` |
| `src/content/mcp-main.ts` | `__webmcpMainLoaded` idempotency |
| `src/content/mcp-bridge.ts` | `__webmcpBridgeLoaded` idempotency |
| `public/manifest.json` | `scripting` + http(s) `host_permissions` |
| `src/background/inject.test.ts` | Unit tests with faked chrome APIs |

## Acceptance criteria

```text
test: pnpm check
test: pnpm test
test: npm run build
test: manifest scripting + host_permissions node check
test: grep injectExistingTabs src/background/index.ts
test: grep __webmcpMainLoaded src/content/mcp-main.ts
test: grep __webmcpBridgeLoaded src/content/mcp-bridge.ts
test: test -f src/background/inject.test.ts
```

## Out of scope

- Duplicate impl track — covered by TRL-13
- Playwright e2e for MV3 side panel (manual verify in TRL-13 summary)

## Deps map

| Dependency | Status |
| --- | --- |
| TRL-13 impl | ✅ closed |
| TRL-12 panel reconnect | ✅ complementary |
