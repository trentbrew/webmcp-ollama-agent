---
version: alpha
name: WebMCP — Empty-state dot-matrix backdrop
description: Design artifact for TRL-36 ext — a subtle, theme-aware dot matrix behind all empty-state surfaces
source:
  tool: greenfield
  preview: docs/artifacts/empty_state_dot_matrix_preview.html
colors:
  background: "oklch(var(--b1))"
  surface: "oklch(var(--b2))"
  text: "oklch(var(--bc))"
  dot: "color-mix(in oklab, currentColor 8%, transparent)"
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
rounded:
  sm: 4px
  md: 8px
  lg: 12px
spacing:
  dotMatrix:
    dot: 1px
    grid: 12px
components:
  emptySurface:
    backgroundColor: "oklch(var(--b1))"
    dotColor: "{colors.dot}"
    dotSize: "1px"
    gridSize: "12px"
---

# Design: Empty-state dot-matrix backdrop

**Status:** Design complete (token-only; HTML mock skipped per rule — see preview)  
**Parent:** TRL-36 (shell surfaces)  
**Preview:** [empty_state_dot_matrix_preview.html](./empty_state_dot_matrix_preview.html)

---

## Overview

All WebMCP empty-state pages share a calm, near-black surface: a centered icon,
one title line, a muted subtitle, and optionally action pills. That surface is
large and uniform — a single flat field. The dot matrix adds a **subtle,
non-interactive ambient texture** so the empty state reads as "designed and
alive" rather than "blank," without competing with the centered content.

**Boundaries:** empty states only. The matrix must be faint enough that the
icon/title/subtitle remains the clear focal point, and it must be **theme-aware**
(adapts to light/dark via `currentColor`).

## Colors

`{colors.dot}` = `color-mix(in oklab, currentColor 8%, transparent)`. Because it
uses `currentColor`, it inherits `{colors.text}` from the shell surface and works
on both light and dark themes without a second token. Never seat it at >10%
opacity — the goal is texture, not pattern-recognition.

## Typography

Unchanged. The dot matrix is a background layer only; it does not affect the
empty-state text hierarchy (title `1.125rem/500`, subtitle `0.8125rem`,
`{colors.text-muted}`).

## Layout

```
┌──────────────────────────────────────┐
│   ·   ·   ·   ·   ·   ·   ·   ·   ·   │  ← dot grid (12px, 1px dots)
│   ·   ·   ·   ·   ·   ·   ·   ·   ·   │
│   ·   ·      [ icon ]      ·   ·   ·   │
│   ·   ·     Title line     ·   ·   ·   │   ◄ radial-mask fade toward center
│   ·   ·     Subtitle       ·   ·   ·   │     keeps content zone clean
│   ·   ·  [ pill ][ pill ]  ·   ·   ·   │
│   ·   ·   ·   ·   ·   ·   ·   ·   ·   │
└──────────────────────────────────────┘
```

Full-surface grid; a `radial-gradient` mask fades the matrix toward the center so
the icon/title zone stays clean, leaving subtle density toward the edges.

## Elevation & Depth

The matrix is a **flat background pattern** — no shadow, no raised surface. It
sits directly on the shell `{colors.background}`. Density is controlled purely by
opacity + the radial mask; there is no inset/plate behind the matrix.

## Shapes

Dots are `1px` circles (`border-radius` implied by `radial-gradient`). Grid pitch
`12px`. No other shape language changes; empty-state icon/title/card radii are
unchanged.

## Components

| Component | Anatomy | States | Maps to codebase |
| --------- | ------- | ------ | ---------------- |
| Empty surface (dot matrix) | full-bleed `radial-gradient` dot grid, radial fade mask | static | shared utility (see Open for Architect — apply to `.chat-empty`, `.traces-page__empty`, `.mcp-page__empty`, `.evals-page__empty`) |

## Interaction matrix

| Input | States | Output |
| ----- | ------ | ------ |
| Page empty | surface shown | Dot matrix renders (static) |
| Page non-empty | content present | Matrix only on empty state; never on populated content |
| Theme light/dark | — | Matrix color follows `currentColor` |
| `prefers-reduced-motion` | reduce | No change — static, no animation |

## Accessibility

- **Non-interactive / decorative:** the matrix is a CSS background, never in the
  accessibility tree. Content unaffected.
- **Contrast:** at ≤8% opacity it does not measurably reduce text contrast;
  verify title/subtitle contrast with the matrix present in both themes.
- **Motion:** static by design — no animation, so `prefers-reduced-motion` needs
  no override (documented as N/A).
- **Guard:** do not apply the matrix behind interactive content (suggestion
  pills) unless opacity is kept low enough not to distract; empty state pill
  contrast was spot-checked in the preview.

## Do's and Don'ts

**Do**

- Single shared utility class so all four empty states stay visually identical.
- Keep the radial center-fade so the icon/title zone is clean.
- Theme via `currentColor` (one token, both themes).

**Don't**

- Apply to non-empty/populated content.
- Exceed ~10% opacity or use a larger dot that reads as polka dots.
- Add animation or hover intent to the matrix.

## Open for Architect

- **Shared utility:** add a CSS class (e.g. `.surface-dot-matrix`) in the shell
  stylesheet that sets `background-image: radial-gradient(color-mix(in oklab,
  currentColor 8%, transparent) 1px, transparent 1px); background-size: 12px
  12px;` plus a `-webkit-mask-image` / `mask-image: radial-gradient(ellipse at
  center, transparent 40%, rgba(0,0,0,0.9) 100%)`.
- **Apply to:** `.chat-empty` (ChatEmptyState.svelte:35), `.traces-page__empty`
  (TracesPage.svelte:34), `.mcp-page__empty` (McpPage.svelte:47),
  `.evals-page__empty` (EvalsPage.svelte:238).
- **Verify:** dot contrast/visibility in both `light` and `dark` daisyUI themes;
  ensure it does not appear behind populated content.

## Handoff checklist

- [x] Token + pattern spec (this file)
- [x] Self-contained preview (HTML mock skipped — token-only wedge)
- [x] Interaction matrix + a11y complete
- [x] Component map to the 4 empty-state containers
