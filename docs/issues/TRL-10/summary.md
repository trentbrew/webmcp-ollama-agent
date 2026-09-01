# TRL-10 — Pi pathway decision handler parity

**Parent:** TRL-1 · **Pathway:** B from TRL-8 ship (standing epic decision)

## Problem

Pi `trellis-lanes` called non-existent `parseHumanPathwayReply` / `buildDecisionEnvelopeContext` on human pathway replies after pipeline `DECISION`, causing:

```
helpers.parseHumanPathwayReply is not a function
```

OpenCode adapter correctly uses `tryPipelineDecision` from `trellis-pipeline-decision-lib.mjs`.

## Hotfix (already applied)

`~/.pi/agent/extensions/trellis-lanes/index.ts`:

- `loadHelpers()` exports `tryPipelineDecision`
- `input` handler calls `tryPipelineDecision({ conversationId, prompt })` and transforms prompt with `additional_context` when handled

## Wedge scope (formalize)

| Deliverable | Notes |
| --- | --- |
| `pi-compat.md` | Document `tryPipelineDecision` in input/decision row; note OpenCode parity |
| `pi-sync-smoke.mjs` | Optional grep: extension must reference `tryPipelineDecision`, must not reference `parseHumanPathwayReply` |
| Verify | `pi-pipeline-smoke.mjs` decision path still exit 0 |

## Out of scope

- Live Pi TUI e2e
- webmcp product changes

## Acceptance criteria

```text
grep tryPipelineDecision in extension
!grep parseHumanPathwayReply in extension
pi-pipeline-smoke + pi-sync-smoke exit 0
pi-compat documents decision flow
```
