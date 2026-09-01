<script lang="ts">
  import { HorizonLayout } from 'horizon-layout';
  import type { LayoutConfig, NodeConfig, TabGroupConfig, Id } from 'horizon-layout';
  import { SvelteMap } from 'svelte/reactivity';
  import '../styles/horizon-layout.css';

  import { currentPage, type PageType } from '../stores/navigation';
  import { Activity, HelpCircle, MessageCircle, Radar, Settings } from '../icons';

  import ChatPage from '../pages/ChatPage.svelte';
  import { ShellPageHost } from './shell';

  const TAB_ORDER: PageType[] = ['chat', 'mcp', 'traces', 'settings', 'help'];

  const pageTitles: Record<string, string> = {
    chat: 'Chat',
    mcp: 'MCP',
    traces: 'Traces',
    settings: 'Settings',
    help: 'Help',
  };

  const SHELL_PAGES = new Set<PageType>(['mcp', 'traces', 'settings', 'help']);

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

  let lastSyncedPage: PageType = $currentPage;

  function isTabGroup(node: NodeConfig | undefined): node is TabGroupConfig {
    return !!node && 'tabs' in node;
  }

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

{#snippet shellSnippet(page: PageType)}
  <div class="pane-fill"><ShellPageHost {page} /></div>
{/snippet}

{#snippet mcpSnippet()}
  {@render shellSnippet('mcp')}
{/snippet}

{#snippet tracesSnippet()}
  {@render shellSnippet('traces')}
{/snippet}

{#snippet settingsSnippet()}
  {@render shellSnippet('settings')}
{/snippet}

{#snippet helpSnippet()}
  {@render shellSnippet('help')}
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
