import {
  WEBMCP_PANEL_PORT,
  WEBMCP_TAB_PORT,
  type BackgroundToBridge,
  type BackgroundToPanel,
  type BridgeToBackground,
  type ConsoleEntry,
  type PanelToBackground,
  type TabMcpState,
  type ToolCallTrace,
} from '../lib/webmcp/protocol';

const TRACE_LIMIT = 200;
const CONSOLE_LIMIT = 300;
const CALL_TIMEOUT_MS = 35_000;

const tabStates = new Map<number, TabMcpState>();
const tabPorts = new Map<number, chrome.runtime.Port>();
const traces = new Map<number, ToolCallTrace[]>();
const consoleEntries = new Map<number, ConsoleEntry[]>();
const panelSubscriptions = new Map<chrome.runtime.Port, number>();

type PendingCall = {
  panelPort: chrome.runtime.Port;
  tabId: number;
  toolName: string;
  origin: string;
  args: unknown;
  startedAt: number;
  source: 'manual' | 'agent';
  timeout: ReturnType<typeof setTimeout>;
};
const pendingCalls = new Map<string, PendingCall>();

function emptyState(tabId: number, url: string | null): TabMcpState {
  return { tabId, url, detected: false, tools: [], updatedAt: Date.now() };
}

function stateFor(tabId: number, url: string | null): TabMcpState {
  let state = tabStates.get(tabId);
  if (!state) {
    state = emptyState(tabId, url);
    tabStates.set(tabId, state);
  }
  return state;
}

function stateKey(tabId: number) {
  return `webmcp:state:${tabId}`;
}

// The MV3 service worker loses all in-memory maps when it spins down. Persist the
// per-tab state so a panel that subscribes after a SW restart gets the real tool
// list instead of an empty state (while the retained toolbar badge shows a count).
function persistState(tabId: number, state: TabMcpState) {
  try {
    void chrome.storage.session.set({ [stateKey(tabId)]: state });
  } catch {
    // Best-effort persistence only.
  }
}

async function loadState(tabId: number): Promise<TabMcpState | undefined> {
  const cached = tabStates.get(tabId);
  if (cached) return cached;
  try {
    const key = stateKey(tabId);
    const stored = await chrome.storage.session.get(key);
    const state = stored[key] as TabMcpState | undefined;
    if (state) {
      tabStates.set(tabId, state);
      updateBadge(tabId, state);
    }
    return state;
  } catch {
    return undefined;
  }
}

function updateBadge(tabId: number, state: TabMcpState) {
  if (!state.detected) {
    void chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }
  const count = state.tools.length;
  void chrome.action.setBadgeText({ tabId, text: count > 0 ? String(count) : '·' });
  void chrome.action.setBadgeBackgroundColor({ tabId, color: count > 0 ? '#16a34a' : '#71717a' });
  persistState(tabId, state);
}

function pushToPanels(tabId: number, message: BackgroundToPanel) {
  for (const [port, subscribedTabId] of panelSubscriptions) {
    if (subscribedTabId !== tabId) continue;
    try {
      port.postMessage(message);
    } catch {
      panelSubscriptions.delete(port);
    }
  }
}

async function loadTraces(tabId: number): Promise<ToolCallTrace[]> {
  const cached = traces.get(tabId);
  if (cached) return cached;
  try {
    const key = `webmcp:traces:${tabId}`;
    const stored = await chrome.storage.session.get(key);
    const list = (stored[key] as ToolCallTrace[] | undefined) ?? [];
    traces.set(tabId, list);
    return list;
  } catch {
    const list: ToolCallTrace[] = [];
    traces.set(tabId, list);
    return list;
  }
}

function persistTraces(tabId: number, list: ToolCallTrace[]) {
  try {
    void chrome.storage.session.set({ [`webmcp:traces:${tabId}`]: list });
  } catch {
    // Best-effort persistence only.
  }
}

async function appendTrace(entry: ToolCallTrace) {
  const list = await loadTraces(entry.tabId);
  list.push(entry);
  while (list.length > TRACE_LIMIT) list.shift();
  persistTraces(entry.tabId, list);
  pushToPanels(entry.tabId, { type: 'trace-appended', trace: entry });
}

function clearTab(tabId: number, url: string | null) {
  tabStates.set(tabId, emptyState(tabId, url));
  traces.set(tabId, []);
  consoleEntries.set(tabId, []);
  persistTraces(tabId, []);
  updateBadge(tabId, tabStates.get(tabId)!);
  pushToPanels(tabId, { type: 'tab-state', state: tabStates.get(tabId)! });
  pushToPanels(tabId, { type: 'trace-snapshot', tabId, traces: [] });
  pushToPanels(tabId, { type: 'console-snapshot', tabId, entries: [] });
}

function appendConsoleEntry(tabId: number, entry: ConsoleEntry) {
  const list = consoleEntries.get(tabId) ?? [];
  list.push(entry);
  while (list.length > CONSOLE_LIMIT) list.shift();
  consoleEntries.set(tabId, list);
  pushToPanels(tabId, { type: 'console-appended', entry });
}

function resolvePendingCall(requestId: string, ok: boolean, result: unknown, error: string | undefined, durationMs: number) {
  const pending = pendingCalls.get(requestId);
  if (!pending) return;
  pendingCalls.delete(requestId);
  clearTimeout(pending.timeout);

  try {
    pending.panelPort.postMessage({ type: 'call-tool-result', requestId, ok, result, error } satisfies BackgroundToPanel);
  } catch {
    // Panel closed before the result arrived -- still record the trace below.
  }

  void appendTrace({
    id: requestId,
    tabId: pending.tabId,
    toolName: pending.toolName,
    origin: pending.origin,
    args: pending.args,
    result,
    error,
    ok,
    startedAt: pending.startedAt,
    durationMs,
    source: pending.source,
  });
}

function failPendingCallsForTab(tabId: number, message: string) {
  for (const [requestId, pending] of pendingCalls) {
    if (pending.tabId !== tabId) continue;
    resolvePendingCall(requestId, false, undefined, message, Date.now() - pending.startedAt);
  }
}

function handleTabPortMessage(tabId: number, message: BridgeToBackground) {
  if (message.type === 'state') {
    const existing = tabStates.get(tabId);
    const state: TabMcpState = {
      tabId,
      url: existing?.url ?? null,
      detected: message.detected,
      tools: message.tools,
      updatedAt: Date.now(),
    };
    tabStates.set(tabId, state);
    updateBadge(tabId, state);
    pushToPanels(tabId, { type: 'tab-state', state });
    return;
  }

  if (message.type === 'tool-result') {
    resolvePendingCall(message.requestId, message.ok, message.result, message.error, message.durationMs);
    return;
  }

  if (message.type === 'console-entry') {
    appendConsoleEntry(tabId, {
      id: crypto.randomUUID(),
      tabId,
      level: message.level,
      args: message.args,
      timestamp: message.timestamp,
    });
  }
}

function handlePanelMessage(port: chrome.runtime.Port, message: PanelToBackground) {
  if (message.type === 'subscribe') {
    panelSubscriptions.set(port, message.tabId);
    void loadState(message.tabId).then((loaded) => {
      const state = loaded ?? tabStates.get(message.tabId) ?? emptyState(message.tabId, null);
      try {
        port.postMessage({ type: 'tab-state', state } satisfies BackgroundToPanel);
      } catch {
        // Panel closed already.
      }
    });
    void loadTraces(message.tabId).then((list) => {
      try {
        port.postMessage({ type: 'trace-snapshot', tabId: message.tabId, traces: list } satisfies BackgroundToPanel);
      } catch {
        // Panel closed already.
      }
    });
    try {
      port.postMessage({
        type: 'console-snapshot',
        tabId: message.tabId,
        entries: consoleEntries.get(message.tabId) ?? [],
      } satisfies BackgroundToPanel);
    } catch {
      // Panel closed already.
    }
    return;
  }

  if (message.type === 'call-tool') {
    const bridgePort = tabPorts.get(message.tabId);
    const state = tabStates.get(message.tabId);
    const tool = state?.tools.find((entry) => entry.name === message.name);

    if (!bridgePort || !tool) {
      const error = !bridgePort ? 'No WebMCP bridge connected for that tab (try reloading the page).' : `Unknown tool "${message.name}".`;
      port.postMessage({
        type: 'call-tool-result',
        requestId: message.requestId,
        ok: false,
        error,
      } satisfies BackgroundToPanel);
      void appendTrace({
        id: message.requestId,
        tabId: message.tabId,
        toolName: message.name,
        origin: tool?.origin ?? state?.url ?? 'unknown',
        args: message.args,
        error,
        ok: false,
        startedAt: Date.now(),
        durationMs: 0,
        source: message.source,
      });
      return;
    }

    const timeout = setTimeout(() => {
      const pending = pendingCalls.get(message.requestId);
      resolvePendingCall(message.requestId, false, undefined, 'Tool call timed out.', pending ? Date.now() - pending.startedAt : CALL_TIMEOUT_MS);
    }, CALL_TIMEOUT_MS);

    pendingCalls.set(message.requestId, {
      panelPort: port,
      tabId: message.tabId,
      toolName: message.name,
      origin: tool.origin,
      args: message.args,
      startedAt: Date.now(),
      source: message.source,
      timeout,
    });

    try {
      bridgePort.postMessage({ type: 'call-tool', requestId: message.requestId, name: message.name, args: message.args } satisfies BackgroundToBridge);
    } catch {
      resolvePendingCall(message.requestId, false, undefined, 'Failed to reach the page bridge.', Date.now() - (pendingCalls.get(message.requestId)?.startedAt ?? Date.now()));
    }
  }

  if (message.type === 'record-trace') {
    void appendTrace(message.trace);
  }
}

export function initWebMcp() {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === WEBMCP_TAB_PORT) {
      const tabId = port.sender?.tab?.id;
      if (tabId == null) {
        port.disconnect();
        return;
      }

      tabPorts.set(tabId, port);
      stateFor(tabId, port.sender?.tab?.url ?? null);

      port.onMessage.addListener((message: BridgeToBackground) => handleTabPortMessage(tabId, message));
      port.onDisconnect.addListener(() => {
        if (tabPorts.get(tabId) === port) tabPorts.delete(tabId);
        failPendingCallsForTab(tabId, 'Page bridge disconnected.');
      });
      return;
    }

    if (port.name === WEBMCP_PANEL_PORT) {
      port.onMessage.addListener((message: PanelToBackground) => handlePanelMessage(port, message));
      port.onDisconnect.addListener(() => {
        panelSubscriptions.delete(port);
      });
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    tabStates.delete(tabId);
    traces.delete(tabId);
    consoleEntries.delete(tabId);
    tabPorts.delete(tabId);
    void chrome.storage.session.remove([`webmcp:traces:${tabId}`, stateKey(tabId)]);
    failPendingCallsForTab(tabId, 'Tab closed.');
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (typeof changeInfo.url !== 'string') return;
    clearTab(tabId, changeInfo.url);
    failPendingCallsForTab(tabId, 'Page navigated away.');
  });
}
