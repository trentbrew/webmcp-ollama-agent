# Clarify-then-act (imperative WebMCP)

When the extension agent calls **write** page tools (`spawn_prop`, `set_entity_field`, …), it must **clarify before acting** if required parameters are missing or ambiguous.

## Decision tree

| Situation | Action |
| --------- | ------ |
| Read-only tool (`readOnlyHint`) | Call immediately |
| Write tool + all required params explicit in user message | Call page tool directly |
| Write tool + missing/ambiguous required field | Call `ask_user` first (1–4 items, inferred defaults) |
| Page tool returned `Error:` | `ask_user` on the failing field, then retry |
| User deferral ("surprise me") | Act with safe defaults |

## Playlab example — spawn_prop

**Ambiguous:** *"Add a red box near the center"*

1. Agent optionally calls `list_assets` (read-only — no questionnaire)
2. Agent calls `ask_user` with mesh / position / color defaults
3. User confirms in **QuestionnaireDock**
4. Agent calls `spawn_prop` with structured answers

**Explicit:** *"Spawn primitive:box at 0,2,0"* → direct `spawn_prop`, no dock.

## Anti-patterns

- Asking *"What position did you want?"* in prose instead of `ask_user`
- Calling `spawn_prop` with placeholder mesh when user said "something cool"
- Extended thinking loops without `ask_user` or a page tool

## Implementation

- Prompt: `src/lib/ai/config.ts` (`Clarify-then-act for page WebMCP tools`)
- Heuristic: `src/lib/webmcp/clarifyPolicy.ts` (`shouldClarifyBeforeWrite`)
- Loop guard: `src/lib/chat.svelte.ts` (nudge after 2 failed write calls)

Cross-link: [Playlab tool manifest](https://github.com/turtle-tech/museum-oss/blob/main/docs/webmcp-tools.md) (museum-oss)
