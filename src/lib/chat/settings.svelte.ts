import { DEFAULT_INFERENCE_OPTIONS, DEFAULT_OLLAMA_MODEL } from '../ai/config';
import { configureOllamaBridge, listOllamaModels } from '../ai/ollama';
import { loadChatSettings, persistChatSettings } from './persistence';
import { getDisplayedChatSession, persistSession } from './sessions.svelte';

const persisted = loadChatSettings();

export const chatSettings = $state({
  model: persisted.model,
  baseUrl: persisted.baseUrl,
  inference: { ...DEFAULT_INFERENCE_OPTIONS, ...persisted.inference },
  exposeToolsToAgent: persisted.exposeToolsToAgent,
  keepThinkingOpen: persisted.keepThinkingOpen,
});

export function setKeepThinkingOpen(value: boolean) {
  chatSettings.keepThinkingOpen = value;
}

export function setInferenceOption<K extends keyof typeof chatSettings.inference>(
  key: K,
  value: (typeof chatSettings.inference)[K],
) {
  chatSettings.inference[key] = value;
}

export function resetInferenceOptions() {
  Object.assign(chatSettings.inference, DEFAULT_INFERENCE_OPTIONS);
}

/** Reset a single inference parameter to its shipped default (e.g. on double-click). */
export function resetInferenceOption<K extends keyof typeof chatSettings.inference>(key: K) {
  chatSettings.inference[key] = DEFAULT_INFERENCE_OPTIONS[key];
}

export function setExposeToolsToAgent(value: boolean) {
  chatSettings.exposeToolsToAgent = value;
}

export const chatModelCatalog = $state({
  available: [persisted.model || DEFAULT_OLLAMA_MODEL] as string[],
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

export function syncChatPersistence() {
  persistChatSettings({
    model: chatSettings.model,
    baseUrl: chatSettings.baseUrl,
    inference: chatSettings.inference,
    exposeToolsToAgent: chatSettings.exposeToolsToAgent,
    keepThinkingOpen: chatSettings.keepThinkingOpen,
  });

  const session = getDisplayedChatSession();
  if (session && !('archiveId' in session)) {
    persistSession(session);
  }
}
