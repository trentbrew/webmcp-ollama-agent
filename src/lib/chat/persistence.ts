import { DEFAULT_INFERENCE_OPTIONS, DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL, type InferenceOptions } from '../ai/config';
import type { UIMessage } from '../ai/protocol';

export const CHAT_STORAGE_KEY = 'webmcp:chat-transcript:v1';

export type PersistedChat = {
  model: string;
  baseUrl: string;
  messages: UIMessage[];
  inference: InferenceOptions;
  exposeToolsToAgent: boolean;
  keepThinkingOpen: boolean;
};

function defaults(): PersistedChat {
  return {
    model: DEFAULT_OLLAMA_MODEL,
    baseUrl: DEFAULT_OLLAMA_BASE_URL,
    messages: [],
    inference: { ...DEFAULT_INFERENCE_OPTIONS },
    exposeToolsToAgent: true,
    keepThinkingOpen: true,
  };
}

export function loadPersistedChat(): PersistedChat {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return defaults();

    const parsed = JSON.parse(raw) as Partial<PersistedChat>;
    return {
      model: typeof parsed.model === 'string' ? parsed.model : DEFAULT_OLLAMA_MODEL,
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : DEFAULT_OLLAMA_BASE_URL,
      messages: Array.isArray(parsed.messages) ? (parsed.messages as UIMessage[]) : [],
      inference: { ...DEFAULT_INFERENCE_OPTIONS, ...parsed.inference },
      exposeToolsToAgent: typeof parsed.exposeToolsToAgent === 'boolean' ? parsed.exposeToolsToAgent : true,
      keepThinkingOpen: typeof parsed.keepThinkingOpen === 'boolean' ? parsed.keepThinkingOpen : true,
    };
  } catch {
    return defaults();
  }
}

export function persistChat(
  model: string,
  messages: UIMessage[],
  baseUrl: string,
  inference: InferenceOptions,
  exposeToolsToAgent: boolean,
  keepThinkingOpen: boolean,
) {
  try {
    const payload: PersistedChat = { model, messages, baseUrl, inference, exposeToolsToAgent, keepThinkingOpen };
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota errors — transcript stays in memory for the session.
  }
}

export function clearPersistedChat() {
  localStorage.removeItem(CHAT_STORAGE_KEY);
}
