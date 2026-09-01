---
version: alpha
name: WebMCP — Per-tab chat sessions
description: Design artifact for TRL-6 — multi-tab transcript persistence, resume picker, MCP-aware empty state
source:
  tool: greenfield
  mock: docs/artifacts/chat_sessions_mockup.html
colors:
  background: "oklch(var(--b1))"
  surface: "oklch(var(--b2))"
  text: "oklch(var(--bc))"
  text-muted: "oklch(var(--bc) / 0.65)"
  primary: "oklch(var(--p))"
  success: "oklch(var(--su))"
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
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
components:
  composer:
    backgroundColor: "color-mix(in oklab, currentColor 3%, transparent)"
    borderColor: "color-mix(in oklab, currentColor 12%, transparent)"
    borderRadius: "{rounded.lg}"
    padding: "{spacing.sm}"
  suggestionRow:
    backgroundColor: "color-mix(in oklab, currentColor 4%, transparent)"
    borderColor: "color-mix(in oklab, currentColor 12%, transparent)"
    borderRadius: "{rounded.md}"
---

# Design: Per-tab chat sessions + resume picker

**Status:** Design complete (handoff to Architect)  
**Parent:** TRL-6  
**Mock:** [chat_sessions_mockup.html](./chat_sessions_mockup.html)

---

## Overview

WebMCP sidepanel chat must feel **tab-native**: each browser tab owns its transcript; switching tabs switches context without losing history. Users resume conversations via `/resume` (session picker) or by activating the source tab. Closed tabs archive to a detached read/write view. Empty chat surfaces MCP-aware starter prompts when page tools are available.

**Posture:** Craftpunk thread language — flat surfaces, 1px borders, no drop shadows, `--chat-font-size` density. Sign-off on **existing implementation** on `main` with gap notes for architect.

## Colors

Inherit daisyUI theme tokens (`--b1`, `--bc`, `--p`, `--su`). Active MCP tools use `{colors.success}` on empty-state radar icon. Composer focus ring uses `{colors.primary}` at 50% opacity. Archived sessions show muted label suffix `(archived)` in picker copy.

## Typography

Chat body and composer use `--chat-font-size: 0.8125rem`. Context bar uses 0.6875rem semibold title + muted host. Empty state title 1.25rem / 500; suggestion labels 0.8125rem semibold.

## Layout

```
┌─────────────────────────────────────┐
│ Nav                                 │
├─────────────────────────────────────┤
│ ChatTranscript (scroll)             │
│   OR ChatEmptyState (centered)      │
├─────────────────────────────────────┤
│ ChatComposer                        │
│  ┌ context: tab title · host · N ─┐ │
│  ┌ session picker / slash menu   ─┐ │
│  ┌ textarea                       ─┐ │
│  └ actions: attach · model · send ─┘ │
└─────────────────────────────────────┘
```

Sidepanel width ~360–420px; empty state max-width 28rem centered.

## Elevation & Depth

Inset hierarchy only: composer `border 1px`, suggestion rows `border 1px`, scrim `rgba(0,0,0,0.35)` full-bleed behind picker/model menus. No box-shadow on chat surfaces.

## Shapes

Composer outer radius 0.75rem; suggestion rows 0.5rem; focus-visible outline 2px primary with 2px offset (global `.chat-composer :focus-visible`).

## Components

| Component | Anatomy | States | Maps to codebase |
| --------- | ------- | ------ | ---------------- |
| Context bar | icon + title + host + tab count | no-tab / active / streaming | `ChatComposer.svelte` `.chat-composer__context` |
| Session picker | listbox above textarea | open / empty / keyboard highlight | `ChatComposer` + `composerUi.sessionPickerOpen` |
| Slash menu | listbox (mutually exclusive w/ picker) | open / filtered | `ChatComposer` + `composerTriggers` |
| Empty state | icon + title + subtitle + suggestion grid | tools-ready / detected / fallback | `ChatEmptyState.svelte` |
| Detached archive banner | (gap) show when viewing archived session | read/write | **Architect:** transcript header chip |

## Interaction matrix

| Input | States | Output |
| ----- | ------ | ------ |
| User chats on tab A | active tab = A | Messages persist to `CHAT_TABS_KEY` for tabId A |
| User switches to tab B | B has history | Transcript loads B messages; A persisted |
| User types `/resume` + Enter | picker closed → open | `requestSessionPicker()`; list other tabs + archives |
| Picker: click open tab row | row selected | `chrome.tabs.update(tabId)`; picker closes; draft cleared |
| Picker: click archive row | archive exists | `chatSessionState.detached` set; transcript shows archive |
| Picker: ↑↓ + Enter | keyboard nav | Same as click; `sessionPickerIndex` wraps |
| Picker: Escape / scrim click | picker open | `closeSessionPicker()` |
| `/new` | any | `newChatForActiveTab()` — fresh transcript for current tab |
| `/reset` | any | Clear current displayed session |
| Tab closed with messages | extension runtime | Archive to `CHAT_ARCHIVE_KEY` (max 20) |
| Empty state suggestion click | not busy | `sendChatMessage({ text: prompt })` |
| Streaming on tab A | busy | Empty suggestions disabled; composer busy border beam |

## Accessibility

- **Focus order:** Nav → transcript (scroll) → composer context (informative) → textarea → action buttons → picker options when open.
- **Labels:** Session picker `role="listbox"` `aria-label="Resume conversation"`; options `role="option"` `aria-selected`; scrim `aria-label="Close session picker"`.
- **Motion:** `prefers-reduced-motion: reduce` — disable BorderBeam animation on busy composer; disable shimmer on status labels (existing `app.css` pattern).
- **Live regions:** Streaming status in toolbar; no live region on picker (static list).

## Do's and Don'ts

**Do**

- Keep session picker visually identical to slash/tool suggestion rows (shared `.chat-composer__suggestion` pattern).
- Show message count + hostname in picker secondary line.
- Exclude current active tab from resumable list.

**Don't**

- Open session picker and slash menu simultaneously (`sessionPickerOpen` blocks `menuOpen`).
- Auto-switch transcript when another tab streams (only on explicit resume or tab activate).
- Cloud-sync archives in this wedge.

## Open for Architect

- **Detached archive header:** Add transcript chip/banner when `chatSessionState.detached` — title, host, "Archived" badge, dismiss → return to active tab session.
- **E2e AC:** Extension load → chat tab A → switch tab B → `/resume` → pick A → assert message visible.
- **Persistence tests:** Unit tests for `listResumableSessions` sort order (updatedAt desc).
- **Help page:** Document `/resume`, `/new`, per-tab behavior in `HelpPage.svelte`.
- **Minor:** Uncommitted `sessions.svelte.ts` null-coalescing fixes should land with impl.

## Handoff checklist

- [x] `docs/artifacts/chat_sessions_design.md` (this file)
- [x] `docs/artifacts/chat_sessions_mockup.html`
- [x] Interaction matrix + a11y complete
- [x] Component map to `ChatComposer`, `ChatEmptyState`, `sessions.svelte.ts`
