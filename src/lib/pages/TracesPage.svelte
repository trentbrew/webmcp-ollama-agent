<script lang="ts">
  import { onMount } from 'svelte';
  import Waterfall from '../components/mcp/Waterfall.svelte';
  import TraceLog from '../components/mcp/TraceLog.svelte';
  import ConsoleLog from '../components/mcp/ConsoleLog.svelte';
  import { initMcpTracking, mcpState } from '../webmcp/store.svelte';

  let view: 'waterfall' | 'console' = $state('waterfall');

  onMount(() => {
    initMcpTracking();
  });
</script>

<div class="traces-page">
  <div class="traces-page__tabs">
    <button type="button" class="traces-page__tab" class:is-active={view === 'waterfall'} onclick={() => (view = 'waterfall')}>
      Waterfall ({mcpState.traces.length})
    </button>
    <button type="button" class="traces-page__tab" class:is-active={view === 'console'} onclick={() => (view = 'console')}>
      Console ({mcpState.console.length})
    </button>
  </div>

  <div class="traces-page__body">
    {#if view === 'waterfall'}
      <div class="traces-page__section">
        <Waterfall traces={mcpState.traces} />
      </div>
      <div class="traces-page__section">
        <TraceLog traces={mcpState.traces} />
      </div>
    {:else}
      <ConsoleLog entries={mcpState.console} />
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

  .traces-page__tabs {
    display: flex;
    flex-shrink: 0;
    gap: 0.25rem;
    padding: 0.375rem 0.625rem 0;
    border-bottom: 1px solid color-mix(in oklab, currentColor 12%, transparent);
  }

  .traces-page__tab {
    padding: 0.25rem 0.625rem;
    border: none;
    border-radius: 999px 999px 0 0;
    background: transparent;
    color: inherit;
    opacity: 0.55;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .traces-page__tab.is-active {
    opacity: 1;
    background: color-mix(in oklab, currentColor 8%, transparent);
    font-weight: 600;
  }

  .traces-page__body {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    padding: 0.625rem;
  }

  .traces-page__section {
    margin-bottom: 1rem;
  }

  .traces-page__section:last-child {
    margin-bottom: 0;
  }
</style>
