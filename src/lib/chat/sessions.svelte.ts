import { backfillMessageTimestamps } from '../ai/messages';
import type { ChatStatus, UIMessage } from '../ai/protocol';
import {
  archiveTabSession,
  gatherResumableSessions,
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
  /** Per-tab chat sessions keyed by browser tab id. */
  byTabId: {} as Record<number, TabChatSession>,
});

const abortControllers = new Map<number, AbortController>();

let initialized = false;

function isExtensionRuntime() {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
}

function createEmptySessionData(tabId: number, url: string | null = null, title: string | null = null): TabChatSession {
  const persisted = loadTabChat(tabId);
  return {
    tabId,
    messages: backfillMessageTimestamps(persisted?.messages ?? []),
    status: 'ready',
    error: null,
    url: persisted?.url ?? url,
    title: persisted?.title ?? title,
    updatedAt: persisted?.updatedAt ?? Date.now(),
  };
}

export function getChatForTab(tabId: number): TabChatSession {
  if (!chatSessionState.byTabId[tabId]) {
    chatSessionState.byTabId[tabId] = createEmptySessionData(tabId);
  }
  return chatSessionState.byTabId[tabId];
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
  const session = chatSessionState.byTabId[tabId];
  if (!session) return;
  if (url !== undefined) session.url = url;
  if (title !== undefined) session.title = title;
  session.updatedAt = Date.now();
  persistSession(session);
}

function clearDetachedView() {
  chatSessionState.detached = null;
}

/** Leave detached archive view and return to the active browser tab's session. */
export async function exitDetachedArchive() {
  if (!chatSessionState.detached) return;
  clearDetachedView();
  const tabId = await resolveActiveTabId();
  if (tabId != null) await activateTab(tabId);
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
    if (!chatSessionState.byTabId[tabId] && tabId !== chatSessionState.activeTabId) return;
    updateSessionMeta(
      tabId,
      changeInfo.url ?? tab.url ?? undefined,
      changeInfo.title ?? tab.title ?? undefined,
    );
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    const session = chatSessionState.byTabId[tabId];
    if (session && session.messages.length > 0) {
      archiveTabSession(tabId, session.messages, session.url, session.title);
    }
    abortControllers.get(tabId)?.abort();
    abortControllers.delete(tabId);
    delete chatSessionState.byTabId[tabId];
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
  const session = chatSessionState.byTabId[id];
  if (!session) return false;
  return session.status === 'submitted' || session.status === 'streaming' || session.status === 'awaiting-input';
}

export async function listResumableSessions(): Promise<ResumableSession[]> {
  const activeId = chatSessionState.activeTabId;
  const tabs = isExtensionRuntime()
    ? (await chrome.tabs.query({ currentWindow: true })).flatMap((tab) =>
        tab.id != null ? [{ id: tab.id, title: tab.title, url: tab.url }] : [],
      )
    : [];

  const liveByTabId: Record<number, { messages: TabChatSession['messages']; title: string | null; url: string | null; updatedAt: number }> =
    {};
  for (const [key, session] of Object.entries(chatSessionState.byTabId)) {
    liveByTabId[Number(key)] = session;
  }

  return gatherResumableSessions(
    activeId,
    tabs,
    liveByTabId,
    loadTabChat,
    loadArchivedSessions(),
  );
}

export async function resumeSession(target: ResumeTarget) {
  if (target.kind === 'open') {
    if (!isExtensionRuntime()) return;
    await chrome.tabs.update(target.tabId, { active: true });
    return;
  }

  const archive = getArchivedSession(target.id);
  if (!archive) return;

  chatSessionState.detached = {
    archiveId: archive.id,
    tabId: archive.tabId,
    messages: backfillMessageTimestamps(archive.messages),
    status: 'ready',
    error: null,
    url: archive.url,
    title: archive.title,
    updatedAt: archive.closedAt,
  };
}

export function clearDetachedArchiveOnEdit() {
  if (!chatSessionState.detached) return;
  removeArchivedSession(chatSessionState.detached.archiveId);
}
