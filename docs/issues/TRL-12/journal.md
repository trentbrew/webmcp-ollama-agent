# TRL-12 journal

## 2026-09-01 — Impl

- `store.svelte.ts`: `onDisconnect` now calls `scheduleResubscribe()` (300ms debounce)
  when `initialized`; re-sends `subscribe` for `mcpState.tabId`, else falls back to
  `subscribeToActiveTab()`.
- `store.reconnect.test.ts`: fakes `chrome.runtime.connect` (recording ports),
  `chrome.tabs.query` → tab 42, and shims `$state` as identity — `store.svelte.ts`
  is loaded by plain-node vitest with no Svelte compile step, so the rune is not
  otherwise defined. The reconnect path only touches plain properties, so the shim
  does not weaken the assertion.

## 2026-09-01 — Red observed (regression proof)

Per `docs/issues/README.md`, the fix was stashed and the test run against pre-fix
`store.svelte.ts`:

```
$ git stash push -- src/lib/webmcp/store.svelte.ts
$ pnpm test src/lib/webmcp/store.reconnect.test.ts

 × mcp panel store — SW-restart reconnect (TRL-12) > reconnects and re-subscribes
   to the active tab when the port disconnects
   → expected "spy" to be called 2 times, but got 1 times

 Test Files  1 failed (1)
```

The test covers the bug, not the fix.

## 2026-09-01 — Green

```
$ git stash pop
$ pnpm test

 ✓ src/lib/webmcp/store.reconnect.test.ts (1 test) 27ms
 ✓ src/lib/chat/sessions.test.ts (3 tests) 2ms
 ✓ src/lib/trellis/tools.test.ts (16 tests) 80ms
 Test Files  3 passed (3)   Tests  20 passed (20)

$ pnpm check
 svelte-check found 0 errors and 2 warnings in 2 files
```

The 2 warnings are pre-existing (`src/lib/Counter.svelte:2`, `src/lib/components/Icon.svelte:20`)
and untouched by this wedge.

## 2026-09-01 — Harness

- `.trellis/tests.json` previously declared an `e2e` suite as `npx playwright test`
  with Playwright not installed, and a `browser-smoke` suite whose `stepsFile`
  did not exist. Both were repointed to runners that exist; `needs-e2e` and
  `review.e2e` now resolve to `browser-smoke`.
- `.gitignore` narrowed from `.trellis/` to `.trellis/*` with negations, so the
  test manifest and browser suite travel with the repo while the kernel db,
  op-log, lanes, and worktrees stay local.
- `justfile`: added `unit`, `smoke`, and `verify` recipes so each rung of the
  evidence ladder is one command. The pre-existing `test` recipe (rebuild + open
  Chrome) is left alone and relabelled as rung 4, manual.
- `CONTRIBUTING.md` "Testing Your Changes" now points at this practice.

## Open

- **Live-tab suite not yet run.** `trellis browser verify browser-smoke` needs the
  desk relay up and `test-page/index.html` as the active tab. Not executed in this
  session — the AC stands unproven and the wedge should not close on it.
- **Manual side-panel verification not yet recorded.** Build, reload at
  `chrome://extensions/`, let the SW idle out, register a tool, confirm it lands
  without a reload. That observation belongs here before close.
