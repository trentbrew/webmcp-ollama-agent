# TRL-3 — Pi runtime smoke scripts

**Spec child:** TRL-4 · **Parent:** TRL-1 (closed) · **Pathway:** B from TRL-1 ship

## Goal

Headless verification that Pi transport bindings work against shared hook libs — without launching the Pi TUI. Closes the "Future:" stubs in `pi-compat.md`.

## Scripts to ship

### `~/.cursor/scripts/pi-lane-smoke.mjs`

Clone `opencode-lane-smoke.mjs` with these deltas:

| Field | OpenCode | Pi |
| --- | --- | --- |
| Binding prefix | `opencode:smoke-<id>` | `pi:smoke-<id>` |
| Log prefix | `[opencode-lane-smoke]` | `[pi-lane-smoke]` |
| Shared import | `trellis-session-lane.mjs` | same |

**Behavior:**

1. Resolve workspace (arg or `cwd`), find `.trellis/` root — exit 2 if missing
2. `ensureSessionLaneForTab({ conversationId: bindingKey, workspace, profile: 'misc' })`
3. Assert `lane.laneId` non-null — exit 1 on fail
4. `loadSessionBinding(bindingKey)` — log binding JSON
5. Exit 0 on success

**Usage:**

```bash
node ~/.cursor/scripts/pi-lane-smoke.mjs [workspace]
```

### `~/.cursor/scripts/pi-pipeline-smoke.mjs`

Clone `opencode-pipeline-smoke.mjs` with these deltas:

| Field | OpenCode | Pi |
| --- | --- | --- |
| Session id | `opencode:pipeline-smoke-*` | `pi:pipeline-smoke-*` |
| `transport` in binding | `opencode` | `pi` |
| Log prefix | `[opencode-pipeline-smoke]` | `[pi-pipeline-smoke]` |

**Behavior (three paths, same as OpenCode):**

1. **Followup** — seed binding with `pipeline_auto: true`, HANDOFF envelope strategist→architect, `runPipelineStop` → expect `type: 'followup'`, message contains `auto handoff` + `architect`
2. **Pause** — reset binding, DECISION envelope → expect `type: 'paused'` + recap
3. **Decision** — paused binding, `tryPipelineDecision({ conversationId, prompt: 'A — ship it' })` → `handled: true`, `last_decision.pathway` saved

Cleanup: unlink temp binding file on success (keep on failure for inspection).

**Usage:**

```bash
node ~/.cursor/scripts/pi-pipeline-smoke.mjs
```

## Doc update

`~/.cursor/docs/pi-compat.md` — replace commented Future block under "Smoke (no TUI):" with:

```bash
node ~/.cursor/scripts/pi-lane-smoke.mjs /path/to/trellis-repo
node ~/.cursor/scripts/pi-pipeline-smoke.mjs
```

Also add both scripts to **Manager** skill `pi-compat` table (smoke row).

## Out of scope

- Live Pi TUI / RPC integration test
- Extension `agent_settled` end-to-end (requires running Pi process)
- MCP bridge

## Acceptance criteria

```text
test: pi-lane-smoke.mjs exists and runs against webmcp spoke
test: pi-pipeline-smoke.mjs exists and exits 0
test: pi-compat.md documents both commands
test: pi-sync-smoke.mjs still exits 0 (no regression)
```

## Dependencies

| Reference | Path |
| --- | --- |
| Lane smoke template | `~/.cursor/scripts/opencode-lane-smoke.mjs` |
| Pipeline smoke template | `~/.cursor/scripts/opencode-pipeline-smoke.mjs` |
| Pipeline core | `~/.trellis/pipeline-core/pipeline-run.mjs` |
| Decision lib | `trellis-pipeline-decision-lib.mjs` |

## Verify (executor)

```bash
node ~/.cursor/scripts/pi-lane-smoke.mjs .
node ~/.cursor/scripts/pi-pipeline-smoke.mjs
node ~/.cursor/scripts/pi-sync-smoke.mjs
trellis issue check TRL-4
```
