import { DEFAULT_INFERENCE_OPTIONS, DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL, type InferenceOptions } from '../ai/config';
import { configureOllamaBridge, listOllamaModels } from '../ai/ollama';
import type { UIMessage } from '../ai/protocol';
import { loadPersistedChat, persistChat } from './persistence';

const persisted = loadPersistedChat();

export const chatSettings = $state({
  model: persisted.model || DEFAULT_OLLAMA_MODEL,
  baseUrl: persisted.baseUrl || DEFAULT_OLLAMA_BASE_URL,
  inference: { ...DEFAULT_INFERENCE_OPTIONS, ...persisted.inference },
  exposeToolsToAgent: persisted.exposeToolsToAgent ?? true,
  keepThinkingOpen: persisted.keepThinkingOpen ?? true,
});

export function setKeepThinkingOpen(value: boolean) {
  chatSettings.keepThinkingOpen = value;
}

export function setInferenceOption<K extends keyof InferenceOptions>(key: K, value: InferenceOptions[K]) {
  chatSettings.inference[key] = value;
}

export function resetInferenceOptions() {
  Object.assign(chatSettings.inference, DEFAULT_INFERENCE_OPTIONS);
}

/** Reset a single inference parameter to its shipped default (e.g. on double-click). */
export function resetInferenceOption<K extends keyof InferenceOptions>(key: K) {
  chatSettings.inference[key] = DEFAULT_INFERENCE_OPTIONS[key];
}

export function setExposeToolsToAgent(value: boolean) {
  chatSettings.exposeToolsToAgent = value;
}

export const chatModelCatalog = $state({
  available: [DEFAULT_OLLAMA_MODEL] as string[],
  unavailable: false,
  error: null as string | null,
});

let modelsLoaded = $state(false);

export function setChatModel(model: string) {
  chatSettings.model = model;
}

export function setOllamaBaseUrl(baseUrl: string) {
  chatSettings.baseUrl = baseUrl.replace(/\/+$/, '');
  void configureOllamaBridge(chatSettings.baseUrl);
  modelsLoaded = false;
  void loadAvailableModels(true);
}

export async function loadAvailableModels(force = false) {
  if (modelsLoaded && !force) return;

  try {
    const data = await listOllamaModels(chatSettings.baseUrl);
    const models = data.models?.filter(Boolean) ?? [];
    chatModelCatalog.unavailable = Boolean(data.unavailable);
    chatModelCatalog.error = data.error ?? null;

    if (models.length > 0) {
      chatModelCatalog.available = models;
      if (!models.includes(chatSettings.model)) {
        chatSettings.model = models.includes(DEFAULT_OLLAMA_MODEL)
          ? DEFAULT_OLLAMA_MODEL
          : (models[0] ?? DEFAULT_OLLAMA_MODEL);
      }
    } else if (!chatModelCatalog.available.includes(chatSettings.model)) {
      chatModelCatalog.available = [chatSettings.model];
    }
  } catch {
    chatModelCatalog.unavailable = true;
    if (!chatModelCatalog.available.includes(chatSettings.model)) {
      chatModelCatalog.available = [chatSettings.model, ...chatModelCatalog.available];
    }
  } finally {
    modelsLoaded = true;
  }
}

export function syncChatPersistence(messages: UIMessage[]) {
  persistChat(
    chatSettings.model,
    messages,
    chatSettings.baseUrl,
    chatSettings.inference,
    chatSettings.exposeToolsToAgent,
    chatSettings.keepThinkingOpen,
  );
}
