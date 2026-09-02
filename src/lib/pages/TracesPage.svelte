<script lang="ts">
  import { onMount } from 'svelte';
  import { Activity } from '../icons';
  import Waterfall from '../components/mcp/Waterfall.svelte';
  import { initMcpTracking, mcpState } from '../webmcp/store.svelte';

  onMount(() => {
    initMcpTracking();
  });

  const traces = $derived(mcpState.traces);
  const isEmpty = $derived(traces.length === 0);
  const detected = $derived(mcpState.state?.detected ?? false);
</script>

<div class="traces-page">
  <div class="traces-page__status">
    <span
      class="traces-page__dot"
      class:is-active={!isEmpty}
      class:is-inactive={isEmpty}
    ></span>
    {#if isEmpty}
      <span>No tool calls on this tab</span>
    {:else}
      <span
        >{traces.length} tool call{traces.length === 1 ? '' : 's'} recorded</span
      >
    {/if}
  </div>

  <div class="traces-page__body">
    {#if isEmpty}
      <div class="traces-page__empty">
        <Activity size={26} class="traces-page__empty-icon" />
        <p class="traces-page__empty-title">No tool calls yet</p>
        <p class="traces-page__empty-subtitle">
          {#if detected}
            Run a tool from the MCP tab or let the agent invoke page tools in
            chat. Each call appears here as a timeline.
          {:else}
            Navigate to a page with WebMCP tools, then invoke them manually or
            via the agent to see traces here.
          {/if}
        </p>
      </div>
    {:else}
      <Waterfall {traces} />
    {/if}
  </div>
</div>

<style>
  .traces-page {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
  }

  .traces-page__status {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
    border-bottom: 1px solid color-mix(in oklab, currentColor 12%, transparent);
    font-size: 0.75rem;
  }

  .traces-page__dot {
    width: 0.5rem;
    height: 0.5rem;
    flex-shrink: 0;
    border-radius: 999px;
  }

  .traces-page__dot.is-active {
    background: oklch(var(--su));
  }

  .traces-page__dot.is-inactive {
    background: color-mix(in oklab, currentColor 30%, transparent);
  }

  .traces-page__body {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    padding: 0.625rem;
  }

  .traces-page__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 100%;
    padding: 1.5rem;
    text-align: center;
  }

  :global(.traces-page__empty-icon) {
    opacity: 0.5;
  }

  .traces-page__empty-title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 500;
  }

  .traces-page__empty-subtitle {
    margin: 0;
    max-width: 20rem;
    font-size: 0.75rem;
    line-height: 1.5;
    opacity: 0.65;
  }
</style>
