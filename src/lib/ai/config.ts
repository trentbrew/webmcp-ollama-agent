export const DEFAULT_OLLAMA_MODEL = 'llama3.2:latest';
export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

export type InferenceOptions = {
  temperature: number;
  top_p: number;
  top_k: number;
  num_ctx: number;
  num_predict: number;
  repeat_penalty: number;
};

export const DEFAULT_INFERENCE_OPTIONS: InferenceOptions = {
  temperature: 0.7,
  top_p: 0.9,
  top_k: 40,
  // Ollama defaults to 4096 when unset, which silently truncates a large tool
  // payload -- tools and the user turn fall out of the window and the model
  // answers in prose instead of calling. Size for a full page tool surface.
  num_ctx: 16384,
  num_predict: 4096,
  repeat_penalty: 1.1,
};

/**
 * Past this many tools, small local models stop selecting reliably: they emit
 * prose, or refuse. Above the cap we drop the per-tool clarify preamble to cut
 * repeated tokens and the bias toward asking over acting.
 */
export const CLARIFY_PREAMBLE_TOOL_CAP = 24;

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

Act-then-clarify for page WebMCP tools:
- Read-only tools (readOnlyHint): call immediately — never ask first.
- Write tools: call them on your first turn with your best inferred arguments. Choose reasonable values for anything the user left unspecified — placement, size, color, count, name and style are your call, not theirs. An action the user can undo beats a question.
- When you do not know which values a tool accepts, call the read-only tool that lists them (assets, types, entities, page state) and then act. Discovery is one cheap call; speculating about it in your reasoning is not.
- Missing or ambiguous optional parameters are never a reason to ask. Neither is not knowing exactly what the user pictured.
- Example: "spawn a tree" with a spawn tool available — list the meshes if you need a ref, pick one, spawn it. Do not ask where, how big, or which variant.
- After a page tool Error, read the error, correct the arguments yourself, and retry. Ask only if the error says the choice is genuinely the user's.
- Do not use extended thinking as a substitute for calling a tool. If you are reasoning about what the user might mean, stop and call something.

Ask the user only when acting would be unsafe: the action is destructive or hard to undo (deleting, overwriting, sending, publishing, paying), or it needs knowledge only they have and no tool exposes.

When you do ask, call the ask_user tool (via tool_calls, never as code or prose) with a structured questionnaire instead of asking in plain text. Infer values from the user's message first; pass inferred values as default on each item so the user confirms or edits rather than filling in a blank form. Only include items that are genuinely ambiguous (aim for 1–2 items, 4 at most). Prefer choice lists for enums (sizes, styles, yes/no) and input fields for freeform values (counts, names, dates). Use validation on date and number fields when the page tool requires constraints. Never transcribe a tool's required parameter names/types into the UI as a blank form; that makes a worse form, not a clarification. When the missing value is free-form user knowledge you cannot enumerate and no tool exposes it, reply with one short question in plain prose instead of a schema-shaped questionnaire.`;

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
