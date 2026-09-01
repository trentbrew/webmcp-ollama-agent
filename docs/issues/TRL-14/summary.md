# TRL-14 — Structured agent questionnaires (`ask_user`)

**Labels:** `proposal`, `needs-design`, `needs-e2e`, `webmcp`, `chat`

## Goal

Replace free-text clarifying questions in the agent chat with a structured multi-step questionnaire UI, inspired by [shadcn Questionnaire](https://ui.shadcn.com/docs/components/base/questionnaire). The agent calls a builtin `ask_user` tool; the side panel renders choices and inputs; answers resume the tool loop as structured JSON.

## Motivation

WebMCP page tools (e.g. pizza demo `set_pizza_size`) often need enum choices and numeric fields. Today the model asks in prose and parses replies like `"large. 4 ppl."` — fragile and slow. Structured UI improves reliability and AX.

## Scope (v1)

| Layer | Deliverable |
| --- | --- |
| Protocol | `ChatQuestionnairePart` on assistant messages |
| Builtin tool | `ask_user({ items })` — blocks turn until submit |
| UI | `QuestionnaireCard.svelte` — step-through, skip, multi-select, freeform input |
| Agent prompt | Prefer `ask_user` over prose when choices are known |
| Status | `awaiting-input` while questionnaire is open |

**Out of scope (v2):** auto-generate questionnaires from page tool `inputSchema` enums.

## Acceptance criteria

```text
test: pnpm check
test: pnpm test (includes questionnaire.test.ts)
test: ask_user registered in BUILTIN_TOOLS
test: QuestionnaireCard renders in ChatMessage for questionnaire parts
test: submitQuestionnaireAnswers resumes agent tool loop
```

## Manual verify

1. Open WebMCP pizza demo tab with tools exposed
2. Ask agent to order a pizza
3. Agent should call `ask_user` with size choices + people input
4. Submit questionnaire → agent calls `set_pizza_size` with structured args

## Dependencies

- `src/lib/ai/protocol.ts`
- `src/lib/chat.svelte.ts`
- `src/lib/components/chat/ChatMessage.svelte`
