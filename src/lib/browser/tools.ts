import type { OllamaTool } from '../ai/protocol';
import { browserContext, listBrowserTabs, refreshBrowserContext } from './context.svelte';

type ToolResult = { ok: boolean; result?: unknown; error?: string };

export const BROWSER_TOOL_NAMES = {
  currentTab: 'browser_current_tab',
  listTabs: 'browser_list_tabs',
} as const;

const BROWSER_TOOL_NAME_SET = new Set<string>(Object.values(BROWSER_TOOL_NAMES));

export function isBrowserTool(name: string): boolean {
  return BROWSER_TOOL_NAME_SET.has(name);
}

export const BROWSER_TOOLS: OllamaTool[] = [
  {
    type: 'function',
    function: {
      name: BROWSER_TOOL_NAMES.currentTab,
      description: 'Read the active Chrome tab context: title, URL, window id, and tab state. Read-only.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: BROWSER_TOOL_NAMES.listTabs,
      description: 'List Chrome tabs, defaulting to the current window. Read-only.',
      parameters: {
        type: 'object',
        properties: {
          allWindows: { type: 'boolean', description: 'When true, include tabs from all Chrome windows. Defaults to false.' },
          limit: { type: 'number', description: 'Maximum tabs to return. Defaults to 20, capped at 100.' },
        },
      },
    },
  },
];

export async function runBrowserTool(name: string, args: unknown): Promise<ToolResult> {
  try {
    const input = args && typeof args === 'object' && !Array.isArray(args) ? (args as Record<string, unknown>) : {};

    switch (name) {
      case BROWSER_TOOL_NAMES.currentTab:
        await refreshBrowserContext();
        return {
          ok: true,
          result: {
            activeTab: browserContext.activeTab,
            tabCount: browserContext.currentWindowTabs.length,
            updatedAt: browserContext.updatedAt,
          },
        };

      case BROWSER_TOOL_NAMES.listTabs: {
        const tabs = await listBrowserTabs(Boolean(input.allWindows));
        const limit = clampLimit(input.limit, 20, 100);
        return {
          ok: true,
          result: {
            tabs: tabs.slice(0, limit),
            count: Math.min(tabs.length, limit),
            total: tabs.length,
            scope: input.allWindows ? 'all_windows' : 'current_window',
          },
        };
      }

      default:
        return { ok: false, error: `Unhandled browser tool "${name}".` };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function clampLimit(value: unknown, defaultLimit: number, maxLimit: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultLimit;
  return Math.max(1, Math.min(maxLimit, Math.floor(value)));
}
