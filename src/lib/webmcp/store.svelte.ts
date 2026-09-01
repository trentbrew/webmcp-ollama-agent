import {
  WEBMCP_PANEL_PORT,
  type BackgroundToPanel,
  type ConsoleEntry,
  type PanelToBackground,
  type TabMcpState,
  type ToolCallTrace,
} from './protocol';

export const mcpState = $state({
  tabId: null as number | null,
  tabUrl: null as string | null,
  state: null as TabMcpState | null,
  traces: [] as ToolCallTrace[],
  console: [] as ConsoleEntry[],
  connected: false,
});

let port: chrome.runtime.Port | undefined;
let initialized = false;
const pendingRuns = new Map<string, { resolve: (value: { ok: boolean; result?: unknown; error?: string }) => void }>();

function appendTraceInMemory(trace: ToolCallTrace) {
  const withoutDuplicate = mcpState.traces.filter((entry) => entry.id !== trace.id);
  mcpState.traces = [...withoutDuplicate, trace].slice(-200);
}

function isExtensionRuntime() {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
}

function connect() {
  if (!isExtensionRuntime() || port) return;

  port = chrome.runtime.connect({ name: WEBMCP_PANEL_PORT });
  mcpState.connected = true;

  port.onMessage.addListener((message: BackgroundToPanel) => {
    if (message.type === 'tab-state') {
      if (message.state.tabId === mcpState.tabId) mcpState.state = message.state;
      return;
    }
    if (message.type === 'trace-snapshot') {
      if (message.tabId === mcpState.tabId) mcpState.traces = message.traces;
      return;
    }
    if (message.type === 'trace-appended') {
      if (message.trace.tabId === mcpState.tabId) appendTraceInMemory(message.trace);
      return;
    }
    if (message.type === 'console-snapshot') {
      if (message.tabId === mcpState.tabId) mcpState.console = message.entries;
      return;
    }
    if (message.type === 'console-appended') {
      if (message.entry.tabId === mcpState.tabId) mcpState.console = [...mcpState.console, message.entry];
      return;
    }
    if (message.type === 'call-tool-result') {
      const pending = pendingRuns.get(message.requestId);
      if (pending) {
        pendingRuns.delete(message.requestId);
        pending.resolve({ ok: message.ok, result: message.result, error: message.error });
      }
    }
  });

  port.onDisconnect.addListener(() => {
    port = undefined;
    mcpState.connected = false;
  });
}

function send(message: PanelToBackground) {
  connect();
  port?.postMessage(message);
}

async function subscribeToActiveTab() {
  if (!isExtensionRuntime()) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  mcpState.tabId = tab.id;
  mcpState.tabUrl = tab.url ?? null;
  mcpState.traces = [];
  mcpState.console = [];
  send({ type: 'subscribe', tabId: tab.id });
}

export function initMcpTracking() {
  if (!isExtensionRuntime() || initialized) return;
  initialized = true;

  void subscribeToActiveTab();

  chrome.tabs.onActivated.addListener(() => {
    void subscribeToActiveTab();
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId !== mcpState.tabId) return;
    if (changeInfo.url) mcpState.tabUrl = changeInfo.url;
    else if (tab.url) mcpState.tabUrl = tab.url;
    if (changeInfo.status === 'complete') {
      send({ type: 'subscribe', tabId });
    }
  });
}

export async function appendLocalTrace(trace: ToolCallTrace): Promise<void> {
  appendTraceInMemory(trace);

  if (!isExtensionRuntime()) return;
  send({ type: 'record-trace', trace });
}

export function runTool(name: string, args: unknown, source: 'manual' | 'agent' = 'manual'): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  if (mcpState.tabId == null) {
    return Promise.resolve({ ok: false, error: 'No tab selected.' });
  }

  const requestId = crypto.randomUUID();
  const tabId = mcpState.tabId;

  return new Promise((resolve) => {
    pendingRuns.set(requestId, { resolve });
    send({ type: 'call-tool', requestId, tabId, name, args, source });
  });
}
