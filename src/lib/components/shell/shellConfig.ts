import type { Component } from 'svelte';
import type { PageType } from '../../stores/navigation';
import type { PageVariant } from './types';
import {
  HelpCircle,
  Home,
  Layers,
  Radar,
  Settings,
  Activity,
} from '../../icons';

export interface PageShellMeta {
  variant: PageVariant;
  title: string;
  description?: string;
  icon?: Component;
}

export const PAGE_SHELL_CONFIG: Partial<Record<PageType, PageShellMeta>> = {
  home: {
    variant: 'prose',
    title: 'Home',
    description: 'WebMCP extension overview',
    icon: Home,
  },
  settings: {
    variant: 'settings',
    title: 'Settings',
    description: 'Customize your extension preferences',
    icon: Settings,
  },
  help: {
    variant: 'prose',
    title: 'Help & Support',
    description: 'Get answers to your questions',
    icon: HelpCircle,
  },
  facts: {
    variant: 'browse',
    title: 'Facts',
    description: 'Local-first graph kernel in this side panel',
    icon: Layers,
  },
  mcp: {
    variant: 'fullBleed',
    title: 'MCP',
    description: 'WebMCP tools on the active tab',
    icon: Radar,
  },
  traces: {
    variant: 'fullBleed',
    title: 'Traces',
    description: 'Tool call waterfall and console',
    icon: Activity,
  },
  components: {
    variant: 'settings',
    title: 'Components',
    description: 'Shell UI primitive showcase',
    icon: Settings,
  },
};

export function getPageShellMeta(page: PageType): PageShellMeta | undefined {
  return PAGE_SHELL_CONFIG[page];
}
