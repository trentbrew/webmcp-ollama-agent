export const DEFAULT_OLLAMA_MODEL = 'gemma4';
export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

export type InferenceOptions = {
  temperature: number;
  top_p: number;
  top_k: number;
  num_predict: number;
  repeat_penalty: number;
};

export const DEFAULT_INFERENCE_OPTIONS: InferenceOptions = {
  temperature: 0.7,
  top_p: 0.9,
  top_k: 40,
  num_predict: 4096,
  repeat_penalty: 1.1,
};

/** Guards against a model that keeps calling tools in a loop without ever finishing. */
export const MAX_TOOL_ITERATIONS = 6;

export type ChatLanguage = 'en' | 'es' | 'fr' | 'de';

export const DEFAULT_CHAT_LANGUAGE: ChatLanguage = 'en';

export const CHAT_LANGUAGE_OPTIONS: ReadonlyArray<{ value: ChatLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
];

const CHAT_SYSTEM_PROMPT_BASE = `You are a helpful coding assistant embedded in a Chrome side panel. Help users think through problems, write and debug code, and understand the page they are working with. Be concise, practical, and specific. Prefer Svelte 5 runes and modern web patterns when suggesting code. Do not use emojis in your responses.

When you need the user to pick from known options or supply specific values before calling a page tool, call the ask_user tool (via tool_calls, never as code or prose) with a structured questionnaire instead of asking in plain text. Infer values from the user's message first; pass inferred values as default on each item so the user can confirm or edit. Only include items that are genuinely ambiguous (aim for 1–2 items, not a long blank form). Prefer choice lists for enums (sizes, styles, yes/no) and input fields for freeform values (counts, names, dates). Use validation on date and number fields when the page tool requires constraints. Keep questionnaires short (1–4 items).

Clarify-then-act for page WebMCP tools:
- Read-only tools (readOnlyHint): call immediately — never ask_user first.
- Write tools: infer from the user's message; if any required parameter is missing or ambiguous, call ask_user with inferred defaults before the page tool. Never ask in prose.
- After a page tool Error, call ask_user to confirm the corrected field, then retry.
- Do not use extended thinking as a substitute for ask_user on ambiguous writes.`;

const CHAT_TOOL_FIRST_INSTRUCTION = `Tools are available for this conversation. Prefer calling tools over guessing, simulating, or bootstrapping your own solution. When a tool can read page state, inspect logs, or perform an action, call it immediately instead of describing manual steps, writing placeholder code, or asking the user to run commands you could invoke yourself. Use webmcp_console and webmcp_trace when you need live page or trace context before answering. Reach for page WebMCP tools eagerly when they match the user's goal — do not reimplement what an exposed tool already does.`;

const CHAT_LANGUAGE_INSTRUCTIONS: Record<ChatLanguage, string | null> = {
  en: null,
  es: 'Respond in Spanish (español).',
  fr: 'Respond in French (français).',
  de: 'Respond in German (Deutsch).',
};

/** @deprecated Use buildChatSystemPrompt — kept for tests and direct imports. */
export const CHAT_SYSTEM_PROMPT = CHAT_SYSTEM_PROMPT_BASE;

/** Soft cap for user-supplied instructions appended to the base system prompt. */
export const MAX_CUSTOM_INSTRUCTIONS_LENGTH = 1000;

export type ChatSystemPromptOptions = {
  toolNames?: readonly string[];
  customInstructions?: string;
};

export function buildChatSystemPrompt(
  language: ChatLanguage = DEFAULT_CHAT_LANGUAGE,
  options: ChatSystemPromptOptions = {},
): string {
  const sections = [CHAT_SYSTEM_PROMPT_BASE];

  if (options.toolNames?.length) {
    sections.push(
      `${CHAT_TOOL_FIRST_INSTRUCTION}\n\nAvailable tools (${options.toolNames.length}): ${options.toolNames.join(', ')}.`,
    );
  }

  const instruction = CHAT_LANGUAGE_INSTRUCTIONS[language];
  if (instruction) sections.push(instruction);

  const custom = options.customInstructions?.trim();
  if (custom) sections.push(custom);

  return sections.join('\n\n');
}

export function isChatLanguage(value: unknown): value is ChatLanguage {
  return value === 'en' || value === 'es' || value === 'fr' || value === 'de';
}
