# TRL-3 journal

## 2026-09-01 — Architect spec (TRL-4)

**Hop:** strategist → architect → executor  
**Decision:** Pathway B from TRL-1 ship — runtime smokes for `pi:` namespace.

**Spec child TRL-4** created with 6 machine AC mirroring parent TRL-3:

1. `pi-lane-smoke.mjs` exists + runs against webmcp spoke
2. `pi-pipeline-smoke.mjs` exists + exits 0 (followup / pause / decision paths)
3. `pi-compat.md` documents both commands (replace Future stubs)
4. `pi-sync-smoke.mjs` regression

**Delta from OpenCode templates:** binding prefix `pi:` + `transport: "pi"`; log prefixes `[pi-*-smoke]`.

**Out of scope:** live Pi TUI, `agent_settled` e2e, MCP bridge.

**Check at handoff:** 2/6 AC passing (scripts not yet landed — expected).

## 2026-09-01 — Executor impl (TRL-4)

**Hop:** architect → executor → reviewer

Landed `pi-lane-smoke.mjs` + `pi-pipeline-smoke.mjs` (clone OpenCode with `pi:` namespace).
Updated `pi-compat.md` verify section + manager skill smoke row.
