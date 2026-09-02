# TRL-19 — Composer toolbar — model picker + discovered pulse

**Labels:** `impl`, `webmcp`, `chat`

## Goal

Reorder the chat composer action row so the model picker sits immediately after the paperclip attachment control, and give the discovered-tools pill a distinct green treatment with a subtle `chat-composer-discovered-pulse` animation when page tools are present.

## Motivation

The composer toolbar was crowded and the model control was easy to miss. Moving the picker next to attachments matches common chat UX (model + attach cluster). A pulsing discovered pill signals that the active tab exposed new MCP tools without opening the tools menu.

## Scope (v1)

| Layer | Deliverable |
| --- | --- |
| UI | `ChatComposer.svelte` — model block before built-in / discovered tool pills |
| Visual | `.chat-composer__tools-pill.is-discovered` green styling + `@keyframes chat-composer-discovered-pulse` |

**Out of scope:** tools menu content, slash triggers, empty-state suggestions (TRL-16).

## Acceptance criteria

```text
test: pnpm check (suite: check)
test: pnpm test (suite: unit)
test: model picker before tools pills (line-order shell check on ChatComposer.svelte)
test: grep -q chat-composer-discovered-pulse src/lib/components/chat/ChatComposer.svelte
```

## Manual verify

1. Open the side panel on a tab with WebMCP page tools registered.
2. Confirm model dropdown appears directly right of the paperclip.
3. Confirm the discovered pill is green and gently pulses when `discoveredTools.length > 0`.

## Dependencies

- `src/lib/components/chat/ChatComposer.svelte`
