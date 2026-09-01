import type { OllamaTool } from '../ai/protocol';
import { browserContext, listBrowserTabs, refreshBrowserContext } from './context.svelte';
import { samplePageTheme } from '../theme/sampler';
import { buildPageTheme } from '../theme/buildTheme';
import {
  pageThemeState,
  syncFromTab,
  applyPageTheme,
  clearPageTheme,
  setAutoMatch,
} from '../theme/pageTheme.svelte';
import type { SampledPage } from '../theme/sampler';

type ToolResult = { ok: boolean; result?: unknown; error?: string };

export const BROWSER_TOOL_NAMES = {
  currentTab: 'browser_current_tab',
  listTabs: 'browser_list_tabs',
  samplePageTheme: 'browser_sample_page_theme',
  applyPageTheme: 'browser_apply_page_theme',
  clearPageTheme: 'browser_clear_page_theme',
  setAutoMatchPageTheme: 'browser_set_auto_match_page_theme',
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
      parameters: { type: 'object', properties: {} },
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
  {
    type: 'function',
    function: {
      name: BROWSER_TOOL_NAMES.samplePageTheme,
      description: 'Sample the active tab\'s live-DOM palette: area-weighted computed styles, CSS custom properties, border radii, and font stacks. Returns the raw sample plus a scored PageTheme object.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: BROWSER_TOOL_NAMES.applyPageTheme,
      description: 'Apply the most recently sampled page theme\'s CSS variables to the extension panel\'s root element, overriding the active daisyUI theme. No-op if no page theme has been sampled.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: BROWSER_TOOL_NAMES.clearPageTheme,
      description: 'Remove page-theme CSS variables from the panel root and restore the named daisyUI theme.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: BROWSER_TOOL_NAMES.setAutoMatchPageTheme,
      description: 'Enable or disable auto-match: when on, re-syncs the page theme whenever the active tab changes.',
      parameters: {
        type: 'object',
        properties: { enabled: { type: 'boolean', description: 'Enable auto-match.' } },
        required: ['enabled'],
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

      case BROWSER_TOOL_NAMES.samplePageTheme: {
        await refreshBrowserContext();
        const tabId = browserContext.activeTab?.id;
        if (!tabId) return { ok: false, error: 'No active tab' };
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: samplePageTheme,
        }) as unknown as [{ result: SampledPage }];
        const pageTheme = buildPageTheme(result);
        return { ok: true, result: { sample: result, pageTheme } };
      }

      case BROWSER_TOOL_NAMES.applyPageTheme:
        applyPageTheme();
        return { ok: true, result: { applied: !!pageThemeState.pageTheme } };

      case BROWSER_TOOL_NAMES.clearPageTheme:
        clearPageTheme();
        return { ok: true, result: { cleared: true } };

      case BROWSER_TOOL_NAMES.setAutoMatchPageTheme:
        setAutoMatch(Boolean(input.enabled));
        return {
          ok: true,
          result: { autoMatch: pageThemeState.autoMatch },
        };

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
