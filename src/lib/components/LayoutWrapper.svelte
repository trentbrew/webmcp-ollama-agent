<script lang="ts">
  import { HorizonLayout } from 'horizon-layout';
  import type { LayoutConfig, NodeConfig, TabGroupConfig, Id } from 'horizon-layout';
  import { SvelteMap } from 'svelte/reactivity';
  import '../styles/horizon-layout.css';

  import { currentPage, type PageType } from '../stores/navigation';
  import { Activity, HelpCircle, MessageCircle, Radar, Settings } from '../icons';

  import ChatPage from '../pages/ChatPage.svelte';
  import McpPage from '../pages/McpPage.svelte';
  import TracesPage from '../pages/TracesPage.svelte';
  import SettingsPage from '../pages/SettingsPage.svelte';
  import HelpPage from '../pages/HelpPage.svelte';

  // Ordered list of pages that appear as tabs in the docking layout.
  const TAB_ORDER: PageType[] = ['chat', 'mcp', 'traces', 'settings', 'help'];

  const pageTitles: Record<string, string> = {
    chat: 'Chat',
    mcp: 'MCP',
    traces: 'Traces',
    settings: 'Settings',
    help: 'Help',
  };

  const views = new SvelteMap<Id, { title: string; snippet: any; tabControls?: any[] }>([
    ['chat', { title: pageTitles.chat, snippet: chatSnippet, tabControls: [tabIcon] }],
    ['mcp', { title: pageTitles.mcp, snippet: mcpSnippet, tabControls: [tabIcon] }],
    ['traces', { title: pageTitles.traces, snippet: tracesSnippet, tabControls: [tabIcon] }],
    ['settings', { title: pageTitles.settings, snippet: settingsSnippet, tabControls: [tabIcon] }],
    ['help', { title: pageTitles.help, snippet: helpSnippet, tabControls: [tabIcon] }],
  ]);

  let config = $state<LayoutConfig>({
    root: {
      tabs: TAB_ORDER as [Id, ...Id[]],
      activeTabIndex: Math.max(0, TAB_ORDER.indexOf($currentPage)),
    },
  });

  // Guard against feedback loops between the two syncing effects.
  let lastSyncedPage: PageType = $currentPage;

  function isTabGroup(node: NodeConfig | undefined): node is TabGroupConfig {
    return !!node && 'tabs' in node;
  }

  /** Depth-first search for the tab group that currently owns `pageId`. */
  function findTabGroupWith(node: NodeConfig | undefined, pageId: Id): TabGroupConfig | undefined {
    if (!node) return undefined;
    if (isTabGroup(node)) {
      return node.tabs.includes(pageId) ? node : undefined;
    }
    for (const child of node.views) {
      const found = findTabGroupWith(child, pageId);
      if (found) return found;
    }
    return undefined;
  }

  /** Resolve the active view id from the (first) root tab group. */
  function activeViewId(node: NodeConfig | undefined): PageType | undefined {
    if (!node) return undefined;
    if (isTabGroup(node)) {
      return node.tabs[node.activeTabIndex] as PageType | undefined;
    }
    for (const child of node.views) {
      const id = activeViewId(child);
      if (id) return id;
    }
    return undefined;
  }

  // navigation store -> layout: activate the tab for the current page.
  $effect(() => {
    const page = $currentPage;
    if (page === lastSyncedPage) return;
    const group = findTabGroupWith(config.root, page);
    if (group) {
      const idx = group.tabs.indexOf(page);
      if (idx !== -1 && group.activeTabIndex !== idx) {
        group.activeTabIndex = idx;
      }
    }
    lastSyncedPage = page;
  });

  // layout -> navigation store: when the user clicks/keys a tab, navigate.
  $effect(() => {
    const active = activeViewId(config.root);
    if (active && active !== lastSyncedPage) {
      lastSyncedPage = active;
      currentPage.set(active);
    }
  });
</script>

{#snippet tabIcon(id: Id)}
  <span class="pane-tab-icon">
    {#if id === 'chat'}<MessageCircle size={14} />
    {:else if id === 'mcp'}<Radar size={14} />
    {:else if id === 'traces'}<Activity size={14} />
    {:else if id === 'settings'}<Settings size={14} />
    {:else if id === 'help'}<HelpCircle size={14} />
    {/if}
  </span>
{/snippet}
{#snippet chatSnippet()}
  <div class="pane-fill"><ChatPage /></div>
{/snippet}
{#snippet mcpSnippet()}
  <div class="pane-fill"><McpPage /></div>
{/snippet}
{#snippet tracesSnippet()}
  <div class="pane-fill"><TracesPage /></div>
{/snippet}
{#snippet settingsSnippet()}
  <div class="pane-scroll"><SettingsPage /></div>
{/snippet}
{#snippet helpSnippet()}
  <div class="pane-scroll"><HelpPage /></div>
{/snippet}

<div class="layout-wrapper">
  <HorizonLayout bind:config {views} />
</div>

<style>
  .layout-wrapper {
    height: 100%;
    width: 100%;
  }

  .pane-fill {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .pane-scroll {
    height: 100%;
    overflow-y: auto;
    padding: 1rem;
  }

  /* Put the per-tab icon (rendered via tabControls) before the label. */
  :global(.horizon-layout-tabgroup__tab-controls) {
    order: 0;
  }

  :global(.horizon-layout-tabgroup__tab-title) {
    order: 1;
  }

  .pane-tab-icon {
    display: inline-flex;
    align-items: center;
    opacity: 0.75;
  }

  :global(.horizon-layout-tabgroup__tab--active) .pane-tab-icon {
    opacity: 1;
  }
</style>
