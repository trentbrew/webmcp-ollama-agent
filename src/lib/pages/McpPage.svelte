<script lang="ts">
  import { onMount } from 'svelte';
  import McpLogo from '../components/icons/McpLogo.svelte';
  import ToolCard from '../components/mcp/ToolCard.svelte';
  import { initMcpTracking, mcpState } from '../webmcp/store.svelte';

  onMount(() => {
    initMcpTracking();
  });

  const detected = $derived(mcpState.state?.detected ?? false);
  const tools = $derived(mcpState.state?.tools ?? []);
  const invokableCount = $derived(
    tools.filter((tool) => tool.invokable).length,
  );
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

  <div class="mcp-page__body">
    {#if tools.length === 0}
      <div class="mcp-page__empty">
        <McpLogo size={26} class="mcp-page__empty-icon" />
        <p class="mcp-page__empty-title">
          {detected ? 'No tools registered yet' : 'No WebMCP page detected'}
        </p>
        <p class="mcp-page__empty-subtitle">
          {detected
            ? 'This page exposes document.modelContext but has not registered any tools.'
            : 'Navigate to a page that registers WebMCP tools via document.modelContext to see them here.'}
        </p>
      </div>
    {:else}
      <div class="mcp-page__list">
        {#each tools as tool (tool.name)}
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

  .mcp-page__body {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    padding: 0.625rem;
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
</style>
