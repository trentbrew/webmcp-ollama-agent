<script lang="ts">
  import { onMount } from 'svelte';
  import { ExternalLink, Search, X } from '../icons';
  import McpLogo from '../components/icons/McpLogo.svelte';
  import ToolCard from '../components/mcp/ToolCard.svelte';
  import { initMcpTracking, mcpState } from '../webmcp/store.svelte';

  const WEBMCP_DOCS_URL = 'https://developer.chrome.com/docs/ai/webmcp';

  onMount(() => {
    initMcpTracking();
  });

  const detected = $derived(mcpState.state?.detected ?? false);
  const tools = $derived(mcpState.state?.tools ?? []);
  const invokableCount = $derived(
    tools.filter((tool) => tool.invokable).length,
  );

  let query = $state('');

  const filteredTools = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    const haystack = (tool: (typeof tools)[number]) =>
      `${tool.name} ${tool.title ?? ''} ${tool.description}`.toLowerCase();
    return tools.filter((tool) => haystack(tool).includes(q));
  });
  const isFiltering = $derived(query.trim().length > 0);
  const noMatches = $derived(tools.length > 0 && filteredTools.length === 0);
</script>

<div class="mcp-page">
  <div class="mcp-page__status">
    <span
      class="mcp-page__dot"
      class:is-active={detected}
      class:is-inactive={!detected}
    ></span>
    {#if detected}
      <span
        >WebMCP active — {tools.length} tool{tools.length === 1 ? '' : 's'} ({invokableCount}
        invokable)</span
      >
    {:else}
      <span>WebMCP not detected on this tab</span>
    {/if}
  </div>

  {#if tools.length > 0}
    <div class="mcp-page__search">
      <Search size={13} class="mcp-page__search-icon" />
      <input
        class="mcp-page__search-input"
        type="search"
        placeholder="Search tools…"
        aria-label="Search tools"
        bind:value={query}
      />
      {#if isFiltering}
        <button
          type="button"
          class="mcp-page__search-clear"
          aria-label="Clear search"
          onclick={() => (query = '')}
        >
          <X size={12} />
        </button>
      {/if}
    </div>
  {/if}

  <div class="mcp-page__body">
    {#if tools.length > 0}
      <div class="mcp-page__section-head">
        <span class="mcp-page__section-title">Registered tools</span>
        <span class="mcp-page__count">
          {isFiltering ? `${filteredTools.length}/${tools.length}` : tools.length}
        </span>
      </div>
    {/if}

    {#if tools.length === 0}
      <div class="mcp-page__empty surface-dot-matrix">
        <McpLogo size={26} class="mcp-page__empty-icon" />
        <p class="mcp-page__empty-title">
          {detected ? 'No tools registered yet' : 'No WebMCP page detected'}
        </p>
        <p class="mcp-page__empty-subtitle">
          {detected
            ? 'This page exposes document.modelContext but has not registered any tools.'
            : 'Navigate to a page that registers WebMCP tools via document.modelContext to see them here.'}
        </p>
        <a
          class="mcp-page__empty-link"
          href={WEBMCP_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn more
          <ExternalLink size={11} />
        </a>
      </div>
    {:else if noMatches}
      <div class="mcp-page__empty surface-dot-matrix">
        <Search size={26} class="mcp-page__empty-icon" />
        <p class="mcp-page__empty-title">No matching tools</p>
        <p class="mcp-page__empty-subtitle">
          No tool name or description matches "{query.trim()}". Try a different
          search.
        </p>
      </div>
    {:else}
      <div class="mcp-page__list">
        {#each filteredTools as tool (tool.name)}
          <ToolCard {tool} />
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .mcp-page {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
    background: #101010;
  }

  .mcp-page__status {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
    border-bottom: 1px solid color-mix(in oklab, currentColor 12%, transparent);
    font-size: 0.75rem;
  }

  .mcp-page__dot {
    width: 0.5rem;
    height: 0.5rem;
    flex-shrink: 0;
    border-radius: 999px;
  }

  .mcp-page__dot.is-active {
    background: oklch(var(--su));
  }

  .mcp-page__dot.is-inactive {
    background: color-mix(in oklab, currentColor 30%, transparent);
  }

  .mcp-page__search {
    position: relative;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    border-bottom: 1px solid color-mix(in oklab, currentColor 12%, transparent);
  }

  :global(.mcp-page__search-icon) {
    flex-shrink: 0;
    opacity: 0.4;
  }

  .mcp-page__search-input {
    flex: 1 1 0;
    min-width: 0;
    border: none;
    background: transparent;
    color: inherit;
    font-size: 0.75rem;
    outline: none;
  }

  .mcp-page__search-input::placeholder {
    opacity: 0.4;
  }

  .mcp-page__search-clear {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    padding: 0.125rem;
    border: none;
    background: transparent;
    color: inherit;
    opacity: 0.5;
    cursor: pointer;
    transition: opacity 120ms ease;
  }

  .mcp-page__search-clear:hover {
    opacity: 0.9;
  }

  .mcp-page__body {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    padding: 0.625rem;
    background: #101010;
  }

  .mcp-page__section-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .mcp-page__section-title {
    opacity: 0.5;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .mcp-page__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.125rem;
    height: 1.125rem;
    padding: 0 0.3125rem;
    border-radius: 999px;
    background: color-mix(in oklab, oklch(var(--su)) 18%, transparent);
    color: oklch(var(--su));
    font-size: 0.625rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .mcp-page__list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .mcp-page__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 100%;
    padding: 1.5rem;
    text-align: center;
  }

  :global(.mcp-page__empty-icon) {
    opacity: 0.5;
  }

  .mcp-page__empty-title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 500;
  }

  .mcp-page__empty-subtitle {
    margin: 0;
    max-width: 20rem;
    font-size: 0.75rem;
    line-height: 1.5;
    opacity: 0.65;
  }

  .mcp-page__empty-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.125rem;
    font-size: 0.75rem;
    color: inherit;
    opacity: 0.33;
    text-decoration: none;
    transition: opacity 150ms ease;
  }

  .mcp-page__empty-link:hover {
    opacity: 0.85;
  }
</style>
