// Shared types for the WebMCP bridge: page (MAIN world) <-> content relay (isolated world)
// <-> background <-> side panel. Mirrors the naming/shape conventions in `lib/ai/protocol.ts`.

export type WebMcpToolAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
};

export type WebMcpToolSummary = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  annotations?: WebMcpToolAnnotations;
  origin: string;
  /** Captured via our registerTool wrapper (can be invoked) vs. only seen through getTools() metadata. */
  invokable: boolean;
};

export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug' | 'exception';

export type ConsoleEntry = {
  id: string;
  tabId: number;
  level: ConsoleLevel;
  args: string[];
  timestamp: number;
};

export type TabMcpState = {
  tabId: number;
  url: string | null;
  /** document.modelContext (or navigator.modelContext) exists on the page. */
  detected: boolean;
  tools: WebMcpToolSummary[];
  updatedAt: number;
};

// ---- Page (MAIN world) <-> content bridge (isolated world), via window.postMessage ----

export const WEBMCP_PAGE_SOURCE = 'webmcp-ext-page';
export const WEBMCP_BRIDGE_SOURCE = 'webmcp-ext-bridge';

export type PageRequest =
  | { source: typeof WEBMCP_BRIDGE_SOURCE; type: 'list-tools'; requestId: string }
  | { source: typeof WEBMCP_BRIDGE_SOURCE; type: 'call-tool'; requestId: string; name: string; args: unknown };

export type PageResponse =
  | { source: typeof WEBMCP_PAGE_SOURCE; type: 'ready'; detected: boolean }
  | { source: typeof WEBMCP_PAGE_SOURCE; type: 'tools'; requestId?: string; detected: boolean; tools: WebMcpToolSummary[] }
  | {
      source: typeof WEBMCP_PAGE_SOURCE;
      type: 'tool-result';
      requestId: string;
      ok: boolean;
      result?: unknown;
      error?: string;
      durationMs: number;
    }
  | {
      source: typeof WEBMCP_PAGE_SOURCE;
      type: 'console-entry';
      level: ConsoleLevel;
      args: string[];
      timestamp: number;
    };

// ---- Content bridge (isolated world) <-> background, via chrome.runtime.connect ----

export const WEBMCP_TAB_PORT = 'webmcp-tab';
export const WEBMCP_PANEL_PORT = 'webmcp-panel';

export type BridgeToBackground =
  | { type: 'state'; detected: boolean; tools: WebMcpToolSummary[] }
  | { type: 'tool-result'; requestId: string; ok: boolean; result?: unknown; error?: string; durationMs: number }
  | { type: 'console-entry'; level: ConsoleLevel; args: string[]; timestamp: number };

export type BackgroundToBridge =
  | { type: 'call-tool'; requestId: string; name: string; args: unknown }
  | { type: 'list-tools' };

// ---- Side panel <-> background, via chrome.runtime.connect ----

export type ToolCallTrace = {
  id: string;
  tabId: number;
  toolName: string;
  origin: string;
  args: unknown;
  result?: unknown;
  error?: string;
  ok: boolean;
  startedAt: number;
  durationMs: number;
  source: 'manual' | 'agent';
};

export type PanelToBackground =
  | { type: 'subscribe'; tabId: number }
  | { type: 'nav-summary'; activeTabId: number }
  | { type: 'call-tool'; requestId: string; tabId: number; name: string; args: unknown; source: 'manual' | 'agent' }
  | { type: 'record-trace'; trace: ToolCallTrace };

export type BackgroundToPanel =
  | { type: 'tab-state'; state: TabMcpState }
  | { type: 'nav-summary'; toolCount: number; traceCount: number }
  | { type: 'trace-snapshot'; tabId: number; traces: ToolCallTrace[] }
  | { type: 'trace-appended'; trace: ToolCallTrace }
  | { type: 'call-tool-result'; requestId: string; ok: boolean; result?: unknown; error?: string }
  | { type: 'console-snapshot'; tabId: number; entries: ConsoleEntry[] }
  | { type: 'console-appended'; entry: ConsoleEntry };
