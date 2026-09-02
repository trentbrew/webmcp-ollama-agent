import { DEFAULT_INFERENCE_OPTIONS, DEFAULT_OLLAMA_MODEL, MAX_CUSTOM_INSTRUCTIONS_LENGTH } from '../ai/config';
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
  language: persisted.language,
  customInstructions: persisted.customInstructions,
});

export function setKeepThinkingOpen(value: boolean) {
  chatSettings.keepThinkingOpen = value;
  persistChatSettings({ ...chatSettings, inference: { ...chatSettings.inference } });
}

export function setChatLanguage(language: typeof chatSettings.language) {
  chatSettings.language = language;
  persistChatSettings({ ...chatSettings, inference: { ...chatSettings.inference } });
}

export function setCustomInstructions(value: string) {
  chatSettings.customInstructions = value.slice(0, MAX_CUSTOM_INSTRUCTIONS_LENGTH);
  persistChatSettings({ ...chatSettings, inference: { ...chatSettings.inference } });
}

export function resetCustomInstructions() {
  chatSettings.customInstructions = '';
  persistChatSettings({ ...chatSettings, inference: { ...chatSettings.inference } });
}

export function setInferenceOption<K extends keyof typeof chatSettings.inference>(
  key: K,
  value: (typeof chatSettings.inference)[K],
) {
  chatSettings.inference[key] = value;
  persistChatSettings({ ...chatSettings, inference: { ...chatSettings.inference } });
}

export function resetInferenceOptions() {
  Object.assign(chatSettings.inference, DEFAULT_INFERENCE_OPTIONS);
  persistChatSettings({ ...chatSettings, inference: { ...chatSettings.inference } });
}

/** Reset a single inference parameter to its shipped default (e.g. on double-click). */
export function resetInferenceOption<K extends keyof typeof chatSettings.inference>(key: K) {
  chatSettings.inference[key] = DEFAULT_INFERENCE_OPTIONS[key];
  persistChatSettings({ ...chatSettings, inference: { ...chatSettings.inference } });
}

export function setExposeToolsToAgent(value: boolean) {
  chatSettings.exposeToolsToAgent = value;
  persistChatSettings({ ...chatSettings, inference: { ...chatSettings.inference } });
}

export const chatModelCatalog = $state({
  available: [persisted.model || DEFAULT_OLLAMA_MODEL] as string[],
  unavailable: false,
  error: null as string | null,
});

let modelsLoaded = $state(false);

export function setChatModel(model: string) {
  chatSettings.model = model;
  persistChatSettings({ ...chatSettings, inference: { ...chatSettings.inference } });
}

export function setOllamaBaseUrl(baseUrl: string) {
  chatSettings.baseUrl = baseUrl.replace(/\/+$/, '');
  persistChatSettings({ ...chatSettings, inference: { ...chatSettings.inference } });
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
    language: chatSettings.language,
    customInstructions: chatSettings.customInstructions,
  });

  const session = getDisplayedChatSession();
  if (session && !('archiveId' in session)) {
    persistSession(session);
  }
}
