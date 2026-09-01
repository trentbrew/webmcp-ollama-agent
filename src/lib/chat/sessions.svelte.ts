import { backfillMessageTimestamps } from '../ai/messages';
import type { ChatStatus, UIMessage } from '../ai/protocol';
import {
  archiveTabSession,
  getArchivedSession,
  loadArchivedSessions,
  loadTabChat,
  migrateLegacyTranscript,
  persistTabChat,
  removeArchivedSession,
  removeTabChat,
  type ResumableSession,
} from './persistence';

export type TabChatSession = {
  tabId: number;
  messages: UIMessage[];
  status: ChatStatus;
  error: string | null;
  url: string | null;
  title: string | null;
  updatedAt: number;
};

export type DetachedChatSession = {
  archiveId: string;
  tabId: number;
  messages: UIMessage[];
  status: ChatStatus;
  error: string | null;
  url: string | null;
  title: string | null;
  updatedAt: number;
};

export type ResumeTarget =
  | { kind: 'open'; tabId: number }
  | { kind: 'archive'; id: string };

export const chatSessionState = $state({
  activeTabId: null as number | null,
  /** When set, the UI shows this detached archive instead of the active tab session. */
  detached: null as DetachedChatSession | null,
});

const sessions = new Map<number, TabChatSession>();
const abortControllers = new Map<number, AbortController>();

let initialized = false;

function isExtensionRuntime() {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
}

function createEmptySession(tabId: number, url: string | null = null, title: string | null = null): TabChatSession {
  const persisted = loadTabChat(tabId);
  return $state({
    tabId,
    messages: backfillMessageTimestamps(persisted?.messages ?? []),
    status: 'ready' as ChatStatus,
    error: null,
    url: persisted?.url ?? url,
    title: persisted?.title ?? title,
    updatedAt: persisted?.updatedAt ?? Date.now(),
  });
}

export function getChatForTab(tabId: number): TabChatSession {
  let session = sessions.get(tabId);
  if (!session) {
    session = createEmptySession(tabId);
    sessions.set(tabId, session);
  }
  return session;
}

export function getActiveChatSession(): TabChatSession | null {
  if (chatSessionState.detached) return null;
  if (chatSessionState.activeTabId == null) return null;
  return getChatForTab(chatSessionState.activeTabId);
}

/** Returns the session currently shown in the UI — active tab or detached archive. */
export function getDisplayedChatSession(): TabChatSession | DetachedChatSession | null {
  if (chatSessionState.detached) return chatSessionState.detached;
  return getActiveChatSession();
}

export function getAbortController(tabId: number): AbortController | null {
  return abortControllers.get(tabId) ?? null;
}

export function setAbortController(tabId: number, controller: AbortController | null) {
  if (controller) {
    abortControllers.set(tabId, controller);
  } else {
    abortControllers.delete(tabId);
  }
}

export function persistSession(session: TabChatSession | DetachedChatSession) {
  if ('archiveId' in session) return;
  persistTabChat(session.tabId, {
    messages: session.messages,
    url: session.url,
    title: session.title,
    updatedAt: session.updatedAt,
  });
}

export function updateSessionMeta(tabId: number, url?: string | null, title?: string | null) {
  const session = sessions.get(tabId);
  if (!session) return;
  if (url !== undefined) session.url = url;
  if (title !== undefined) session.title = title;
  session.updatedAt = Date.now();
  persistSession(session);
}

function clearDetachedView() {
  chatSessionState.detached = null;
}

async function resolveActiveTabId(): Promise<number | null> {
  if (!isExtensionRuntime()) return null;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function activateTab(tabId: number) {
  chatSessionState.activeTabId = tabId;
  clearDetachedView();
  getChatForTab(tabId);
}

export async function initChatSessionTracking() {
  if (!isExtensionRuntime() || initialized) return;
  initialized = true;

  const tabId = await resolveActiveTabId();
  migrateLegacyTranscript(tabId);
  if (tabId != null) {
    await activateTab(tabId);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) updateSessionMeta(tabId, tab.url ?? null, tab.title ?? null);
  }

  chrome.tabs.onActivated.addListener((info) => {
    void activateTab(info.tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!sessions.has(tabId) && tabId !== chatSessionState.activeTabId) return;
    updateSessionMeta(
      tabId,
      changeInfo.url ?? tab.url ?? undefined,
      changeInfo.title ?? tab.title ?? undefined,
    );
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    const session = sessions.get(tabId);
    if (session && session.messages.length > 0) {
      archiveTabSession(tabId, session.messages, session.url, session.title);
    }
    abortControllers.get(tabId)?.abort();
    abortControllers.delete(tabId);
    sessions.delete(tabId);
    removeTabChat(tabId);

    if (chatSessionState.activeTabId === tabId) {
      chatSessionState.activeTabId = null;
      void resolveActiveTabId().then((next) => {
        if (next != null) void activateTab(next);
      });
    }
  });
}

function abortTab(tabId: number) {
  abortControllers.get(tabId)?.abort();
  abortControllers.delete(tabId);
}

export function newChatForActiveTab() {
  const tabId = chatSessionState.activeTabId;
  if (tabId == null) return;

  clearDetachedView();
  const session = getChatForTab(tabId);
  if (session.messages.length > 0) {
    archiveTabSession(tabId, session.messages, session.url, session.title);
  }

  abortTab(tabId);
  session.messages = [];
  session.status = 'ready';
  session.error = null;
  session.updatedAt = Date.now();
  persistSession(session);
}

export function resetChatForActiveTab() {
  if (chatSessionState.detached) {
    abortControllers.get(-1)?.abort();
    abortControllers.delete(-1);
    chatSessionState.detached = null;
    return;
  }

  const tabId = chatSessionState.activeTabId;
  if (tabId == null) return;

  abortTab(tabId);
  const session = getChatForTab(tabId);
  session.messages = [];
  session.status = 'ready';
  session.error = null;
  session.updatedAt = Date.now();
  removeTabChat(tabId);
}

/** @deprecated Use resetChatForActiveTab */
export function resetChat() {
  resetChatForActiveTab();
}

export function isChatBusy(tabId?: number): boolean {
  if (chatSessionState.detached) {
    return chatSessionState.detached.status === 'submitted' || chatSessionState.detached.status === 'streaming';
  }

  const id = tabId ?? chatSessionState.activeTabId;
  if (id == null) return false;
  const session = sessions.get(id);
  if (!session) return false;
  return session.status === 'submitted' || session.status === 'streaming';
}

export async function listResumableSessions(): Promise<ResumableSession[]> {
  const results: ResumableSession[] = [];
  const activeId = chatSessionState.activeTabId;

  if (isExtensionRuntime()) {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    for (const tab of tabs) {
      if (tab.id == null || tab.id === activeId) continue;
      const live = sessions.get(tab.id);
      const persisted = loadTabChat(tab.id);
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
  }

  for (const archive of loadArchivedSessions()) {
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

  return results;
}

export async function resumeSession(target: ResumeTarget) {
  if (target.kind === 'open') {
    if (!isExtensionRuntime()) return;
    await chrome.tabs.update(target.tabId, { active: true });
    return;
  }

  const archive = getArchivedSession(target.id);
  if (!archive) return;

  chatSessionState.detached = $state({
    archiveId: archive.id,
    tabId: archive.tabId,
    messages: backfillMessageTimestamps(archive.messages),
    status: 'ready' as ChatStatus,
    error: null,
    url: archive.url,
    title: archive.title,
    updatedAt: archive.closedAt,
  });
}

export function clearDetachedArchiveOnEdit() {
  if (!chatSessionState.detached) return;
  removeArchivedSession(chatSessionState.detached.archiveId);
}
