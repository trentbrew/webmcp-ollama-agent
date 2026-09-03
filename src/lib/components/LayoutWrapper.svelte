<script lang="ts">
  import { HorizonLayout } from 'horizon-layout';
  import type {
    LayoutConfig,
    NodeConfig,
    SplitConfig,
    TabGroupConfig,
    Id,
  } from 'horizon-layout';
  import { SvelteMap } from 'svelte/reactivity';
  import '../styles/horizon-layout.css';

  import { currentPage, type PageType } from '../stores/navigation';
  import { get } from 'svelte/store';
  import {
    Activity,
    FlaskConical,
    HelpCircle,
    MessageCircle,
    Settings,
  } from '../icons';
  import McpLogo from './icons/McpLogo.svelte';

  import ChatPage from '../pages/ChatPage.svelte';
  import { ShellPageHost } from './shell';

  const TAB_ORDER: PageType[] = [
    'chat',
    'mcp',
    'traces',
    'evals',
    'settings',
    'help',
  ];
  const SECONDARY_TABS = [
    'mcp',
    'traces',
    'evals',
    'settings',
    'help',
  ] as const satisfies readonly PageType[];

  /** Side panel width at which chat pins left and tools/settings stack right. */
  const WIDE_BREAKPOINT_PX = 560;
  const DEFAULT_SPLIT = 0.56;

  const pageTitles: Record<string, string> = {
    chat: 'Chat',
    mcp: 'MCP',
    traces: 'Traces',
    evals: 'Evals',
    settings: '',
    help: '',
  };

  const views = new SvelteMap<
    Id,
    { title: string; snippet: any; tabControls?: any[] }
  >([
    [
      'chat',
      { title: pageTitles.chat, snippet: chatSnippet, tabControls: [tabIcon] },
    ],
    [
      'mcp',
      { title: pageTitles.mcp, snippet: mcpSnippet, tabControls: [tabIcon] },
    ],
    [
      'traces',
      {
        title: pageTitles.traces,
        snippet: tracesSnippet,
        tabControls: [tabIcon],
      },
    ],
    [
      'evals',
      {
        title: pageTitles.evals,
        snippet: evalsSnippet,
        tabControls: [tabIcon],
      },
    ],
    [
      'settings',
      {
        title: pageTitles.settings,
        snippet: settingsSnippet,
        tabControls: [tabIcon],
      },
    ],
    [
      'help',
      { title: pageTitles.help, snippet: helpSnippet, tabControls: [tabIcon] },
    ],
  ]);

  let layoutEl: HTMLDivElement | undefined = $state();
  let isWide = $state(false);
  let splitPoint = $state(DEFAULT_SPLIT);
  let lastSecondaryPage = $state<PageType>('mcp');
  let wasWide = false;

  let config = $state<LayoutConfig>({
    root: buildNarrowRoot(get(currentPage)),
  });

  let lastSyncedPage: PageType = $currentPage;

  function isTabGroup(node: NodeConfig | undefined): node is TabGroupConfig {
    return !!node && 'tabs' in node;
  }

  function isSplit(node: NodeConfig | undefined): node is SplitConfig {
    return !!node && 'direction' in node;
  }

  function buildNarrowRoot(page: PageType): TabGroupConfig {
    return {
      tabs: TAB_ORDER as [Id, ...Id[]],
      activeTabIndex: Math.max(0, TAB_ORDER.indexOf(page)),
    };
  }

  function buildWideRoot(secondaryPage: PageType, split: number): SplitConfig {
    const idx = SECONDARY_TABS.indexOf(
      secondaryPage as (typeof SECONDARY_TABS)[number],
    );
    return {
      direction: 'horizontal',
      views: [
        { tabs: ['chat'], activeTabIndex: 0 },
        {
          tabs: SECONDARY_TABS as unknown as [Id, ...Id[]],
          activeTabIndex: idx >= 0 ? idx : 0,
        },
      ],
      splitPoints: [split],
    };
  }

  function findTabGroupWith(
    node: NodeConfig | undefined,
    pageId: Id,
  ): TabGroupConfig | undefined {
    if (!node) return undefined;
    if (isTabGroup(node)) {
      return node.tabs.includes(pageId) ? node : undefined;
    }
    if (isSplit(node)) {
      for (const child of node.views) {
        const found = findTabGroupWith(child, pageId);
        if (found) return found;
      }
    }
    return undefined;
  }

  function findSecondaryTabGroup(
    node: NodeConfig | undefined,
  ): TabGroupConfig | undefined {
    if (!node) return undefined;
    if (isTabGroup(node)) {
      return node.tabs.includes('mcp') ? node : undefined;
    }
    if (isSplit(node)) {
      for (const child of node.views) {
        const found = findSecondaryTabGroup(child);
        if (found) return found;
      }
    }
    return undefined;
  }

  function secondaryActivePage(
    node: NodeConfig | undefined,
  ): PageType | undefined {
    const group = findSecondaryTabGroup(node);
    if (!group) return undefined;
    return group.tabs[group.activeTabIndex] as PageType | undefined;
  }

  function activeViewId(node: NodeConfig | undefined): PageType | undefined {
    if (!node) return undefined;
    if (isTabGroup(node)) {
      return node.tabs[node.activeTabIndex] as PageType | undefined;
    }
    if (isSplit(node)) {
      for (const child of node.views) {
        const id = activeViewId(child);
        if (id) return id;
      }
    }
    return undefined;
  }

  /**
   * Crossing the breakpoint swaps `config.root` between a TabGroupConfig and a
   * SplitConfig. Those have disjoint shapes, so `isWide` and the new root must
   * land in the same synchronous tick — if a render sees the new width with the
   * old root (or vice versa) horizon-layout's TabGroup reads `config.tabs` off a
   * split node and throws "Cannot read properties of undefined (reading
   * 'undefined')". The `{#key isWide}` below then rebuilds the subtree rather
   * than re-rendering panes against a node of the other shape.
   */
  function applyWidth(next: boolean) {
    if (next === wasWide) {
      isWide = next;
      return;
    }
    wasWide = next;
    isWide = next;
    const page = get(currentPage);

    if (next) {
      const secondary =
        page === 'chat'
          ? lastSecondaryPage
          : SECONDARY_TABS.includes(page as (typeof SECONDARY_TABS)[number])
            ? page
            : lastSecondaryPage;
      if (page !== 'chat') lastSecondaryPage = page;
      config = { ...config, root: buildWideRoot(secondary, splitPoint) };
    } else {
      config = { ...config, root: buildNarrowRoot(page) };
    }
    lastSyncedPage = page;
  }

  $effect(() => {
    const el = layoutEl;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      applyWidth(entry.contentRect.width >= WIDE_BREAKPOINT_PX);
    });
    observer.observe(el);
    applyWidth(el.clientWidth >= WIDE_BREAKPOINT_PX);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (isWide && isSplit(config.root)) {
      splitPoint = config.root.splitPoints[0] ?? splitPoint;
    }
  });

  $effect(() => {
    const page = $currentPage;
    if (page === lastSyncedPage) return;

    if (isWide) {
      if (page !== 'chat') {
        lastSecondaryPage = page;
        const group = findSecondaryTabGroup(config.root);
        if (group) {
          const idx = group.tabs.indexOf(page);
          if (idx !== -1 && group.activeTabIndex !== idx) {
            group.activeTabIndex = idx;
          }
        }
      }
    } else {
      const group = findTabGroupWith(config.root, page);
      if (group) {
        const idx = group.tabs.indexOf(page);
        if (idx !== -1 && group.activeTabIndex !== idx) {
          group.activeTabIndex = idx;
        }
      }
    }
    lastSyncedPage = page;
  });

  $effect(() => {
    if (isWide) {
      const secondary = secondaryActivePage(config.root);
      if (secondary && secondary !== lastSyncedPage) {
        lastSyncedPage = secondary;
        currentPage.set(secondary);
      }
      return;
    }

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
    {:else if id === 'mcp'}<McpLogo size={14} variant="muted" />
    {:else if id === 'traces'}<Activity size={14} />
    {:else if id === 'evals'}<FlaskConical size={14} />
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

{#snippet evalsSnippet()}
  {@render shellSnippet('evals')}
{/snippet}

{#snippet settingsSnippet()}
  {@render shellSnippet('settings')}
{/snippet}

{#snippet helpSnippet()}
  {@render shellSnippet('help')}
{/snippet}

<div
  class="layout-wrapper"
  class:layout-wrapper--wide={isWide}
  bind:this={layoutEl}
>
  {#key isWide}
    <HorizonLayout bind:config {views} />
  {/key}
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

  :global(.horizon-layout-tabgroup__tab-title:empty) {
    display: none;
  }

  :global(
      .horizon-layout-tabgroup__tab:has(
          .horizon-layout-tabgroup__tab-title:empty
        )
    ) {
    flex: 0 0 2.25rem;
  }

  /* Wide: chat is always visible — hide its redundant single-tab bar. */
  .layout-wrapper--wide
    :global(
      .horizon-layout-split__pane:first-child .horizon-layout-tabgroup__tab-bar
    ) {
    display: none;
  }
</style>
