import {
  DEFAULT_CHAT_LANGUAGE,
  DEFAULT_INFERENCE_OPTIONS,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  isChatLanguage,
  type ChatLanguage,
  type InferenceOptions,
} from '../ai/config';
import type { UIMessage } from '../ai/protocol';

export const CHAT_STORAGE_KEY = 'webmcp:chat-transcript:v1';
export const CHAT_SETTINGS_KEY = 'webmcp:chat-settings:v1';
export const CHAT_TABS_KEY = 'webmcp:chat-tabs:v1';
export const CHAT_ARCHIVE_KEY = 'webmcp:chat-archive:v1';

const ARCHIVE_MAX = 20;

export type ChatSettings = {
  model: string;
  baseUrl: string;
  inference: InferenceOptions;
  exposeToolsToAgent: boolean;
  keepThinkingOpen: boolean;
  language: ChatLanguage;
  customInstructions: string;
};

export type PersistedTabChat = {
  messages: UIMessage[];
  url: string | null;
  title: string | null;
  updatedAt: number;
};

export type ArchivedChatSession = {
  id: string;
  tabId: number;
  url: string | null;
  title: string | null;
  messages: UIMessage[];
  closedAt: number;
};

export type ResumableOpenTab = {
  kind: 'open';
  tabId: number;
  title: string | null;
  url: string | null;
  messageCount: number;
  updatedAt: number;
};

export type ResumableArchive = {
  kind: 'archive';
  id: string;
  tabId: number;
  title: string | null;
  url: string | null;
  messageCount: number;
  closedAt: number;
};

export type ResumableSession = ResumableOpenTab | ResumableArchive;

/** @deprecated Use loadChatSettings — kept for migration. */
export type PersistedChat = ChatSettings & { messages: UIMessage[] };

function defaultSettings(): ChatSettings {
  return {
    model: DEFAULT_OLLAMA_MODEL,
    baseUrl: DEFAULT_OLLAMA_BASE_URL,
    inference: { ...DEFAULT_INFERENCE_OPTIONS },
    exposeToolsToAgent: true,
    keepThinkingOpen: true,
    language: DEFAULT_CHAT_LANGUAGE,
    customInstructions: '',
  };
}

function parseSettings(parsed: Partial<ChatSettings>): ChatSettings {
  return {
    model: typeof parsed.model === 'string' ? parsed.model : DEFAULT_OLLAMA_MODEL,
    baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : DEFAULT_OLLAMA_BASE_URL,
    inference: { ...DEFAULT_INFERENCE_OPTIONS, ...parsed.inference },
    exposeToolsToAgent: typeof parsed.exposeToolsToAgent === 'boolean' ? parsed.exposeToolsToAgent : true,
    keepThinkingOpen: typeof parsed.keepThinkingOpen === 'boolean' ? parsed.keepThinkingOpen : true,
    language: isChatLanguage(parsed.language) ? parsed.language : DEFAULT_CHAT_LANGUAGE,
    customInstructions:
      typeof parsed.customInstructions === 'string' ? parsed.customInstructions : '',
  };
}

export function loadChatSettings(): ChatSettings {
  try {
    const raw = localStorage.getItem(CHAT_SETTINGS_KEY);
    if (raw) {
      return parseSettings(JSON.parse(raw) as Partial<ChatSettings>);
    }

    const legacy = localStorage.getItem(CHAT_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as Partial<PersistedChat>;
      const settings = parseSettings(parsed);
      persistChatSettings(settings);
      return settings;
    }

    return defaultSettings();
  } catch {
    return defaultSettings();
  }
}

export function persistChatSettings(settings: ChatSettings) {
  try {
    localStorage.setItem(CHAT_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Best-effort persistence only.
  }
}

export function loadTabChats(): Record<string, PersistedTabChat> {
  try {
    const raw = localStorage.getItem(CHAT_TABS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, PersistedTabChat>;
  } catch {
    // fall through to migration
  }
  return {};
}

export function loadTabChat(tabId: number): PersistedTabChat | undefined {
  return loadTabChats()[String(tabId)];
}

export function persistTabChat(tabId: number, data: PersistedTabChat) {
  try {
    const all = loadTabChats();
    all[String(tabId)] = data;
    localStorage.setItem(CHAT_TABS_KEY, JSON.stringify(all));
  } catch {
    // Ignore quota errors.
  }
}

export function removeTabChat(tabId: number) {
  try {
    const all = loadTabChats();
    delete all[String(tabId)];
    localStorage.setItem(CHAT_TABS_KEY, JSON.stringify(all));
  } catch {
    // Best-effort only.
  }
}

export function loadArchivedSessions(): ArchivedChatSession[] {
  try {
    const raw = localStorage.getItem(CHAT_ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ArchivedChatSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistArchivedSessions(sessions: ArchivedChatSession[]) {
  try {
    localStorage.setItem(CHAT_ARCHIVE_KEY, JSON.stringify(sessions.slice(0, ARCHIVE_MAX)));
  } catch {
    // Best-effort only.
  }
}

export function archiveTabSession(
  tabId: number,
  messages: UIMessage[],
  url: string | null,
  title: string | null,
) {
  if (messages.length === 0) return;

  const entry: ArchivedChatSession = {
    id: crypto.randomUUID(),
    tabId,
    url,
    title,
    messages,
    closedAt: Date.now(),
  };

  const archive = loadArchivedSessions().filter((item) => item.tabId !== tabId);
  archive.unshift(entry);
  persistArchivedSessions(archive);
}

export function removeArchivedSession(id: string) {
  persistArchivedSessions(loadArchivedSessions().filter((item) => item.id !== id));
}

export function getArchivedSession(id: string): ArchivedChatSession | undefined {
  return loadArchivedSessions().find((item) => item.id === id);
}

/**
 * Migrate legacy single-transcript storage to the active browser tab on first load.
 */
export function migrateLegacyTranscript(activeTabId: number | null) {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Partial<PersistedChat>;
    const messages = Array.isArray(parsed.messages) ? (parsed.messages as UIMessage[]) : [];
    if (messages.length === 0) {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      return;
    }

    if (activeTabId != null) {
      const existing = loadTabChat(activeTabId);
      if (!existing || existing.messages.length === 0) {
        persistTabChat(activeTabId, {
          messages,
          url: null,
          title: null,
          updatedAt: Date.now(),
        });
      }
    } else {
      archiveTabSession(-1, messages, null, 'Migrated conversation');
    }

    localStorage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    // Best-effort migration.
  }
}

/** @deprecated Use loadChatSettings + per-tab persistence. */
export function loadPersistedChat(): PersistedChat {
  const settings = loadChatSettings();
  return { ...settings, messages: [] };
}

/** @deprecated Use persistChatSettings + persistTabChat. */
export function persistChat(
  model: string,
  messages: UIMessage[],
  baseUrl: string,
  inference: InferenceOptions,
  exposeToolsToAgent: boolean,
  keepThinkingOpen: boolean,
  language: ChatLanguage = DEFAULT_CHAT_LANGUAGE,
) {
  persistChatSettings({
    model,
    baseUrl,
    inference,
    exposeToolsToAgent,
    keepThinkingOpen,
    language,
    customInstructions: loadChatSettings().customInstructions,
  });
}

/** @deprecated Use removeTabChat. */
export function clearPersistedChat() {
  // No-op — tab chats are cleared per tabId.
}

export function sortResumableSessions(results: ResumableSession[]): ResumableSession[] {
  return [...results].sort((a, b) => {
    const aTime = a.kind === 'archive' ? a.closedAt : a.updatedAt;
    const bTime = b.kind === 'archive' ? b.closedAt : b.updatedAt;
    return bTime - aTime;
  });
}

export type ResumableTabInput = {
  id: number;
  title?: string | null;
  url?: string | null;
};

export type ResumableLiveSession = {
  messages: UIMessage[];
  title: string | null;
  url: string | null;
  updatedAt: number;
};

/** Pure assembly used by `listResumableSessions` in sessions.svelte.ts. */
export function gatherResumableSessions(
  activeTabId: number | null,
  tabs: ResumableTabInput[],
  liveByTabId: Record<number, ResumableLiveSession>,
  loadPersisted: (tabId: number) => PersistedTabChat | undefined,
  archives: ArchivedChatSession[],
): ResumableSession[] {
  const results: ResumableSession[] = [];

  for (const tab of tabs) {
    if (tab.id === activeTabId) continue;
    const live = liveByTabId[tab.id];
    const persisted = loadPersisted(tab.id);
    const messageCount = live?.messages.length ?? persisted?.messages.length ?? 0;
    if (messageCount === 0) continue;

    results.push({
      kind: 'open',
      tabId: tab.id,
      title: tab.title ?? live?.title ?? persisted?.title ?? null,
      url: tab.url ?? live?.url ?? persisted?.url ?? null,
      messageCount,
      updatedAt: live?.updatedAt ?? persisted?.updatedAt ?? 0,
    });
  }

  for (const archive of archives) {
    results.push({
      kind: 'archive',
      id: archive.id,
      tabId: archive.tabId,
      title: archive.title,
      url: archive.url,
      messageCount: archive.messages.length,
      closedAt: archive.closedAt,
    });
  }

  return sortResumableSessions(results);
}
