import {
  WEBMCP_PANEL_PORT,
  type BackgroundToPanel,
  type ConsoleEntry,
  type PanelToBackground,
  type TabMcpState,
  type ToolCallTrace,
} from './protocol';
import { isValidTrace, normalizeTrace, normalizeTraces } from './traces';

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
  if (!isValidTrace(trace)) return;
  const normalized = normalizeTrace(trace);
  const withoutDuplicate = mcpState.traces.filter((entry) => entry.id !== normalized.id);
  mcpState.traces = [...withoutDuplicate, normalized].slice(-200);
}

export function appendPendingTrace(
  requestId: string,
  tabId: number,
  toolName: string,
  args: unknown,
  source: 'manual' | 'agent',
) {
  const tool = mcpState.state?.tools.find((entry) => entry.name === toolName);
  appendTraceInMemory({
    id: requestId,
    tabId,
    toolName,
    origin: tool?.origin ?? mcpState.tabUrl ?? 'unknown',
    args,
    ok: true,
    startedAt: Date.now(),
    durationMs: 0,
    source,
    pending: true,
  });
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
      if (message.tabId === mcpState.tabId) mcpState.traces = normalizeTraces(message.traces);
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
    // The MV3 service worker spins down when idle, taking the port -- and the
    // background's in-memory panelSubscriptions map -- with it. Without an active
    // subscription the background pushes tool-state updates to nobody, so newly
    // registered page tools never reach the panel until a tab event re-subscribes
    // (which is why reloading the page "fixes" it). Reconnect and re-subscribe so
    // pushed updates keep flowing across SW restarts without a manual reload.
    if (initialized) scheduleResubscribe();
  });
}

let resubscribeTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleResubscribe() {
  if (resubscribeTimer) return;
  resubscribeTimer = setTimeout(() => {
    resubscribeTimer = undefined;
    if (mcpState.tabId != null) {
      // Re-open the port and re-register this tab's subscription with the
      // freshly-woken background, then pull the current state/traces/console.
      send({ type: 'subscribe', tabId: mcpState.tabId });
    } else {
      void subscribeToActiveTab();
    }
  }, 300);
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
  // Clear stale tool/detection state from the previous tab until the background
  // pushes fresh state for this tab.
  mcpState.state = {
    tabId: tab.id,
    url: tab.url ?? null,
    detected: false,
    tools: [],
    updatedAt: Date.now(),
  };
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

  appendPendingTrace(requestId, tabId, name, args, source);

  return new Promise((resolve) => {
    pendingRuns.set(requestId, { resolve });
    send({ type: 'call-tool', requestId, tabId, name, args, source });
  });
}
