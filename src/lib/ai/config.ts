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

When you need the user to pick from known options or supply specific values before calling a page tool, use the ask_user tool with a structured questionnaire instead of asking in plain text. Infer values from the user's message first; pass inferred values as default on each item so the user can confirm or edit. Only include items that are genuinely ambiguous (aim for 1–2 items, not a long blank form). Prefer choice lists for enums (sizes, styles, yes/no) and input fields for freeform values (counts, names, dates). Use validation on date and number fields when the page tool requires constraints. Keep questionnaires short (1–4 items).`;

const CHAT_LANGUAGE_INSTRUCTIONS: Record<ChatLanguage, string | null> = {
  en: null,
  es: 'Respond in Spanish (español).',
  fr: 'Respond in French (français).',
  de: 'Respond in German (Deutsch).',
};

/** @deprecated Use buildChatSystemPrompt — kept for tests and direct imports. */
export const CHAT_SYSTEM_PROMPT = CHAT_SYSTEM_PROMPT_BASE;

export function buildChatSystemPrompt(language: ChatLanguage = DEFAULT_CHAT_LANGUAGE): string {
  const instruction = CHAT_LANGUAGE_INSTRUCTIONS[language];
  return instruction ? `${CHAT_SYSTEM_PROMPT_BASE}\n\n${instruction}` : CHAT_SYSTEM_PROMPT_BASE;
}

export function isChatLanguage(value: unknown): value is ChatLanguage {
  return value === 'en' || value === 'es' || value === 'fr' || value === 'de';
}
