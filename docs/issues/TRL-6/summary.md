# TRL-6 — Per-tab chat sessions + resume picker

**Design:** TRL-7 · **Spec:** TRL-8 · **Labels:** `needs-design`, `needs-e2e`

## Goal

Tab-native chat in the WebMCP sidepanel: per-tab transcript persistence, `/resume` session picker, archive-on-close, MCP-aware empty state. **Implementation largely on `main`** — wedge closes design gaps and adds tests + docs.

## Design artifacts

| Artifact | Path |
| --- | --- |
| Design spec | `docs/artifacts/chat_sessions_design.md` |
| HTML mock | `docs/artifacts/chat_sessions_mockup.html` |

## Already shipped (verify, do not rewrite)

| Module | Responsibility |
| --- | --- |
| `sessions.svelte.ts` | Per-tab state, `initChatSessionTracking`, `listResumableSessions`, `resumeSession`, archive on `tabs.onRemoved` |
| `persistence.ts` | `CHAT_TABS_KEY`, `CHAT_ARCHIVE_KEY`, `archiveTabSession` |
| `ChatComposer.svelte` | Context bar, session picker, `/resume` via `requestSessionPicker()` |
| `ChatEmptyState.svelte` | MCP tool suggestions |
| `ChatPage.svelte` | Toolbar with archived badge when detached |
| `slashCommands.ts` | `/new`, `/resume`, `/reset` |

## Gaps (executor scope)

### 1. Detached archive dismiss

When `chatSessionState.detached` is set, toolbar shows `archived` badge but no dismiss.

**Spec:** Export `clearDetachedView` as `exitDetachedArchive()` from `sessions.svelte.ts`. Add toolbar button in `ChatPage.svelte` (`aria-label="Return to active tab"`) that calls it and re-activates current browser tab session.

### 2. Help page docs

Add FAQ or commands section to `HelpPage.svelte` covering:

- Per-tab transcripts (switching tabs switches chat)
- `/new` — fresh conversation for current tab
- `/resume` — open session picker for other tabs + archives
- `/reset` — clear current session

### 3. Unit tests — `src/lib/chat/sessions.test.ts`

Test pure persistence helpers (import from `persistence.ts`) and/or extract sort helper:

- `listResumableSessions` results sorted by `updatedAt` descending (mock `chrome.tabs.query` + localStorage fixtures)
- Archive entries include `(archived)` label path via `sessionLabel` logic (optional composer test)

Minimum: 3 vitest cases, all pass via `pnpm test`.

### 4. Minor fixes

Land any pending `sessions.svelte.ts` null-coalescing / type fixes if `pnpm check` fails.

## E2e (deferred)

No Playwright harness in spoke yet. **Manual verify** (reviewer documents in PASS):

1. Load unpacked extension → open sidepanel Chat
2. Send message on tab A → switch to tab B → send different message
3. `/resume` → pick tab A → transcript shows A messages
4. Close tab A with messages → `/resume` → archive row appears → resume detached view → dismiss returns to active tab

Follow-up wedge: add `@playwright/test` + `e2e/chat-sessions.spec.ts`.

## Acceptance criteria

```text
test: pnpm check
test: pnpm test (includes sessions.test.ts)
test: HelpPage documents /resume and /new
test: ChatPage dismiss for detached archive
test: grep listResumableSessions in sessions.test.ts
```

## Dependencies

| File | Role |
| --- | --- |
| `docs/artifacts/chat_sessions_design.md` | Interaction matrix (source of truth) |
| `src/lib/chat/sessions.svelte.ts` | Session kernel |
| `src/lib/chat/persistence.ts` | Storage keys |

## Verify (executor)

```bash
pnpm check
pnpm test
trellis issue check TRL-8
```
