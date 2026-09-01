<script lang="ts">
  import type { ToolCallTrace } from '../../webmcp/protocol';
  import { buildWaterfall, formatWaterfallDuration } from '../../webmcp/waterfall';

  let { traces }: { traces: ToolCallTrace[] } = $props();

  const layout = $derived(buildWaterfall(traces));
  const rowHeight = 22;
</script>

{#if layout.spans.length === 0}
  <p class="waterfall-empty">No tool calls yet.</p>
{:else}
  <div class="waterfall" style={`height: ${layout.laneCount * rowHeight + 8}px`}>
    {#each layout.spans as span (span.id)}
      <div
        class="waterfall-span"
        class:is-error={!span.ok}
        class:is-agent={span.source === 'agent'}
        style={`left: ${(span.startMs / layout.totalMs) * 100}%; width: ${Math.max((span.durationMs / layout.totalMs) * 100, 0.5)}%; top: ${span.lane * rowHeight}px;`}
        title={`${span.label} — ${formatWaterfallDuration(span.durationMs)}${span.ok ? '' : ' (error)'}`}
      >
        <span class="waterfall-span__label">{span.label}</span>
      </div>
    {/each}
  </div>
  <div class="waterfall-axis">
    <span>0ms</span>
    <span>{formatWaterfallDuration(layout.totalMs)}</span>
  </div>
{/if}

<style>
  .waterfall-empty {
    padding: 0.75rem 0;
    opacity: 0.5;
    font-size: 0.75rem;
    text-align: center;
  }

  .waterfall {
    position: relative;
    width: 100%;
    min-height: 22px;
  }

  .waterfall-span {
    position: absolute;
    display: flex;
    align-items: center;
    height: 18px;
    padding: 0 0.375rem;
    overflow: hidden;
    border-radius: 0.25rem;
    background: oklch(var(--p) / 0.55);
    color: oklch(var(--pc, var(--bc)));
    font-size: 0.625rem;
    white-space: nowrap;
    cursor: default;
  }

  .waterfall-span.is-agent {
    background: oklch(var(--s, var(--p)) / 0.55);
  }

  .waterfall-span.is-error {
    background: oklch(var(--er) / 0.6);
  }

  .waterfall-span__label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .waterfall-axis {
    display: flex;
    justify-content: space-between;
    margin-top: 0.25rem;
    font-size: 0.625rem;
    opacity: 0.5;
  }
</style>
