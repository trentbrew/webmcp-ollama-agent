## 2026-09-01 — Impl + verify

- `injectExistingTabs` in `src/background/inject.ts`; wired on `onInstalled` / `onStartup` in `index.ts`.
- Idempotency guards in `mcp-main.ts` / `mcp-bridge.ts`.
- Manifest: `scripting` + broad http(s) `host_permissions`.
- Added `src/background/inject.test.ts` (3 tests, faked chrome APIs).
- Wired executable Trellis AC for `trellis issue check TRL-13`.
