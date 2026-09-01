export type BrowserTabContext = {
  id: number;
  windowId: number;
  index: number;
  active: boolean;
  highlighted: boolean;
  pinned: boolean;
  title: string | null;
  url: string | null;
  favIconUrl: string | null;
  audible: boolean;
  discarded: boolean;
};

export const browserContext = $state({
  status: 'idle' as 'idle' | 'ready' | 'error',
  error: null as string | null,
  activeTab: null as BrowserTabContext | null,
  currentWindowTabs: [] as BrowserTabContext[],
  updatedAt: 0,
});

let initialized = false;

function isExtensionRuntime() {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
}

export function initBrowserContextTracking() {
  if (!isExtensionRuntime() || initialized) return;
  initialized = true;

  void refreshBrowserContext();

  chrome.tabs.onActivated.addListener(() => {
    void refreshBrowserContext();
  });
  chrome.tabs.onUpdated.addListener(() => {
    void refreshBrowserContext();
  });
  chrome.tabs.onCreated.addListener(() => {
    void refreshBrowserContext();
  });
  chrome.tabs.onRemoved.addListener(() => {
    void refreshBrowserContext();
  });
  chrome.tabs.onMoved.addListener(() => {
    void refreshBrowserContext();
  });
}

export async function refreshBrowserContext(): Promise<void> {
  if (!isExtensionRuntime()) return;

  try {
    const currentWindowTabs = await chrome.tabs.query({ currentWindow: true });
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabs = currentWindowTabs.map(tabToContext);

    browserContext.status = 'ready';
    browserContext.error = null;
    browserContext.activeTab = active ? tabToContext(active) : tabs.find((tab) => tab.active) ?? null;
    browserContext.currentWindowTabs = tabs;
    browserContext.updatedAt = Date.now();
  } catch (error) {
    browserContext.status = 'error';
    browserContext.error = error instanceof Error ? error.message : String(error);
  }
}

export async function listBrowserTabs(allWindows = false): Promise<BrowserTabContext[]> {
  if (!isExtensionRuntime()) return [];
  const tabs = await chrome.tabs.query(allWindows ? {} : { currentWindow: true });
  return tabs.map(tabToContext);
}

function tabToContext(tab: chrome.tabs.Tab): BrowserTabContext {
  return {
    id: tab.id ?? -1,
    windowId: tab.windowId,
    index: tab.index,
    active: Boolean(tab.active),
    highlighted: Boolean(tab.highlighted),
    pinned: Boolean(tab.pinned),
    title: tab.title ?? null,
    url: tab.url ?? null,
    favIconUrl: tab.favIconUrl ?? null,
    audible: Boolean(tab.audible),
    discarded: Boolean(tab.discarded),
  };
}
