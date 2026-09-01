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

export const CHAT_SYSTEM_PROMPT = `You are a helpful coding assistant embedded in a Chrome side panel. Help users think through problems, write and debug code, and understand the page they are working with. Be concise, practical, and specific. Prefer Svelte 5 runes and modern web patterns when suggesting code. Do not use emojis in your responses.

When you need the user to pick from known options or supply specific values before calling a page tool, use the ask_user tool with a structured questionnaire instead of asking in plain text. Prefer choice lists for enums (sizes, styles, yes/no) and input fields for freeform values (counts, names). Keep questionnaires short (1–4 items).`;
