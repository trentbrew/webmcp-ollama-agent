---
version: alpha
name: WebMCP — Trace waterfall: turn-anchored axis + TurnStats
description: Design artifact for TRL-36 ext — re-anchor trace waterfall to per-turn bands, add optional TurnStats (tokens/thinking/ops) to trace stream
source:
  tool: greenfield
  mock: docs/artifacts/trace_waterfall_turnstats_mockup.html
colors:
  background: "oklch(var(--b1))"
  surface: "oklch(var(--b2))"
  surface-raised: "oklch(var(--b3))"
  text: "oklch(var(--bc))"
  text-muted: "oklch(var(--bc) / 0.65)"
  primary: "oklch(var(--p))"
  success: "oklch(var(--su))"
  error: "oklch(var(--er))"
  border: "oklch(var(--bc) / 0.14)"
typography:
  body:
    fontFamily: system-ui, sans-serif
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: system-ui, sans-serif
    fontSize: 11px
    fontWeight: 600
    letterSpacing: 0.02em
  bar:
    fontFamily: system-ui, sans-serif
    fontSize: 10px
    fontWeight: 500
rounded:
  sm: 4px
  md: 8px
  lg: 12px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
components:
  turnBand:
    backgroundColor: "color-mix(in oklab, currentColor 3%, transparent)"
    borderColor: "color-mix(in oklab, currentColor 12%, transparent)"
    borderRadius: "{rounded.md}"
    padding: "{spacing.sm}"
  toolBar:
    backgroundColor: "oklch(var(--p) / 0.55)"
    textColor: "oklch(var(--pc, var(--bc)))"
    borderRadius: "{rounded.sm}"
    height: 18px
  manualBar:
    backgroundColor: "oklch(var(--su) / 0.45)"
    textColor: "oklch(var(--suc, var(--bc)))"
    borderRadius: "{rounded.sm}"
    height: 18px
---

# Design: Trace waterfall — turn-anchored axis + TurnStats

**Status:** Design complete (handoff to Architect)  
**Parent:** TRL-36 (trace-transparency extension)  
**Mock:** [trace_waterfall_turnstats_mockup.html](./trace_waterfall_turnstats_mockup.html)

---

## Overview

The Traces tab waterfall currently lays every tool call on one global wall-clock axis
(`buildWaterfall` in `src/lib/webmcp/waterfall.ts`). A single long agent turn — or a
long tool-to-tool gap — inflates `totalMs`, so quick 200–400ms tool calls render at
sub-1% width: invisible slivers. The fix **re-anchors the axis to the agent turn** and
adds an optional `TurnStats` layer so each turn reads as a bounded band ("agent worked
here for X s, used N tokens, ran M tools, wrote K ops") with its own internal time
scale. Manual calls get a shallow "Manual" band.

**Posture:** Craftpunk thread language — flat surfaces, 1px borders, no drop shadows,
`--chat-font-size` density. Extends the in-flight TRL-36 trace-transparency work
(TraceLog, pending spans, viz wrapper) rather than replacing it.

## Colors

Inherit daisyUI theme tokens (`--b1`, `--b2`, `--b3`, `--bc`, `--p`, `--su`, `--er`).
Agent tool bars use `{colors.primary}`; manual bars use `{colors.success}`; error bars
use `{colors.error}`. Turn bands use a subtle `currentColor`-mix surface so the
hierarchy stays flat. Pending bars are `{colors.primary}` at reduced opacity with a
dashed border and a 1.4s opacity pulse. Turn headers use `{colors.text}` for the model /
tokens label and `{colors.text-muted}` for timings.

## Typography

Bar labels use 10px / 500. Turn-band headers use 11px semibold for the model · label and
10px muted for timing. Token/kpi strip uses 11px muted with the counts in 12px / 500.
Body still inherits `--chat-font-size: 0.8125rem`.

## Layout

```
┌─────────────────────────────────────────┐
│ status: 9 tool calls · 4 turns          │  ← TracesPage__status
├─────────────────────────────────────────┤
│ [TurnStatCard: model · ⟳ thinking · ☰]   │  ← optional rollup card (native)
│ ┌ Turn band ──────────────────────────┐ │
│ │ ▸ Turn 3 · qwen3:8b · 124m in · 21s │ │  ← turn header row
│ │ ┌ gerund timeline ────────────────┐ │ │
│ │ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ (thinking span) │ │ │
│ │ │ ▉▉▉▉▉ trellis_query   (412ms)    │ │ │
│ │ │ ▉▉▉ mcp_call          (186ms)    │ │ │
│ │ └─────────────────────────────────┘ │ │
│ └──────────────────────────────────────┘│
│ ┌ Turn band ──────────────────────────┐ │
│ │ ▸ Turn 2 · qwen3:8b · 2 tools · 4s  │ │
│ │ └─ (bars, own internal scale)        │ │
│ └──────────────────────────────────────┘│
│ ┌ Manual band ────────────────────────┐ │
│ │ ▸ Read entity · 96ms                │ │
│ └──────────────────────────────────────┘│
├─────────────────────────────────────────┤
│ TraceLog (detailed list)                 │
└─────────────────────────────────────────┘
```

Sidepanel ~360–420px. Bands stack top (newest) to bottom (oldest). Each band's internal
axis is the **turn** span — never the global elapsed span — so tool bars keep readable
width regardless of thinking duration or inter-tool gaps.

## Elevation & Depth

Inset hierarchy only: turn band `border 1px`, each band enclosed but not elevated. No
box-shadow. The thinking sub-span is a softer, hatched/dashed fill inside the band so the
visual weight stays on the tool bars.

## Shapes

Band outer radius `{rounded.md}` (0.5rem). Tool bars `{rounded.sm}` (4px), height 18px
(`rowHeight`). Pending pulse matches existing `Waterfall.svelte` keyframe.

## Components

| Component | Anatomy | States | Maps to codebase |
| --------- | ------- | ------ | ---------------- |
| Turn band | header row + internal bar timeline | idle / pending / done(error) | `Waterfall.svelte` + `waterfall.ts` (`buildWaterfall → WaterfallBand[]`) |
| Turn header | `▸` caret, "Turn N", model, timing | — | `Waterfall.svelte` band header |
| Tool bar | label + duration, width ∝ duration/bandTotal | ok / pending / error / agent·manual | `Waterfall.svelte` `.waterfall-span` |
| Thinking span | leading muted span in band, `thinkingMs` | — | new sub-span in band |
| TurnStatCard | model, token counts, ops delta, thinkingMs | empty → hidden | `TracesPage.svelte` |
| TraceLog | per-tool detail rows | — | `TraceLog.svelte` (unchanged) |

## Interaction matrix

| Input | States | Output |
| ----- | ------ | ------ |
| Agent runs a turn (LLM request starts) | `turns` grows, `turnId` known | New turn band appended; header shows model |
| `streamChat` done chunk arrives | `done` + eval counts | Turn band finalized: token counts, `thinkingMs`, ops delta |
| Tool runs during a turn | track `startedAt`/`durationMs` | Tool bar appended to that turn's band, own internal scale |
| Tool finishes / errors | ok vs error | Band bar color flips; pending pulse stops |
| Manual tool call (no turn) | `source: 'manual'` | "Manual" band; success-color bars |
| User switches tab | new tabId | Bands + card reset to that tab's stream |
| Wide / narrow panel | — | Bands stack; bars keep min-width 4px + tooltip |

## Accessibility

- **Focus order:** Nav → status → waterfall cards/bands (informative, non-interactive) → TraceLog rows (interactive on click) → other panel controls.
- **Labels:** Each band header is a real heading (`<h3>`), full label visible; tool bars are `aria-hidden` (redundant with TraceLog) unless hover-tooltip — ensure title/aria-label always describes tool name + duration.
- **Color is not the only signal:** error bars carry a `⚠` prefix glyph, not only `{colors.error}`.
- **Motion:** `prefers-reduced-motion: reduce` — disable `waterfall-pending-pulse` on pending bars.

## Do's and Don'ts

**Do**

- Key each band's axis to its own turn span (the fix). Never scale a tool bar against the global elapsed span.
- Group only within a turn; keep manual calls in a distinct band.
- Show the thinking sub-span so "agent worked here" is visible even with zero tools.

**Don't**

- Let one long turn or gap crush sibling tool bars — this is the bug being fixed.
- Auto-navigate to the Traces tab (that's the separate follow-agent toggle, out of scope).
- Attribute token counts to a single tool call (they belong to the turn).

## Open for Architect

- **Turn boundary source:** tie `turnId` to the Ollama LLM request (`options.requestId` in `streamOllamaChat`, `src/lib/ai/ollama.ts`) so a turn is exactly one `/api/chat` pass. `ToolCallTrace` gains optional `turnId?: string` (`protocol.ts:84`). Manual calls omit it.
- **Token capture:** extend `OllamaPortOutbound` `'done'` (`protocol.ts:112`) with `model`, `promptEvalCount`, `evalCount`, `evalDuration`, `totalDuration`. Populate in the background `streamChat` done-chunk handler (`src/background/webmcp.ts:231`) — the Ollama `done` chunk already carries `prompt_eval_count`/`eval_count`.
- **Ops delta:** `TurnStats.opCountDelta` = `kernel.getBackend().getOpCount()` before/after the turn (see `src/lib/webmcp/tools.ts`, `kernel.svelte.ts`).
- **State:** add `turns: TurnStats[]` to `mcpState` (`store.svelte.ts`) + `turn-snapshot`/`turn-appended` background→panel messages, mirroring the existing trace plumbing.
- **Design decision (confirm):** per-turn bands (recommended, chosen path) vs. single global axis with a `min-width` floor. Bands are the "re-anchor" Fix A; the floor alone is the stopgap. Recommend bands.

## Handoff checklist

- [x] `docs/artifacts/trace_waterfall_turnstats_design.md` (this file)
- [x] `docs/artifacts/trace_waterfall_turnstats_mockup.html`
- [x] Interaction matrix + a11y complete
- [x] Component map to `Waterfall.svelte`, `waterfall.ts`, `TracesPage.svelte`, `store.svelte.ts`
