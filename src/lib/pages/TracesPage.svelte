<script lang="ts">
  import { onMount } from 'svelte';
  import Waterfall from '../components/mcp/Waterfall.svelte';
  import { initMcpTracking, mcpState } from '../webmcp/store.svelte';

  onMount(() => {
    initMcpTracking();
  });

  const isEmpty = $derived(mcpState.traces.length === 0);
</script>

<div class="traces-page">
  <div class="traces-page__body" class:is-empty={isEmpty}>
    <Waterfall traces={mcpState.traces} />
  </div>
</div>

<style>
  .traces-page {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
  }

  .traces-page__body {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    padding: 0.625rem;
  }

  .traces-page__body.is-empty {
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
