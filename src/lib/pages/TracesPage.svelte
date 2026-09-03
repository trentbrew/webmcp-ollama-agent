<script lang="ts">
  import { onMount } from 'svelte';
  import { Activity } from '../icons';
  import Waterfall from '../components/mcp/Waterfall.svelte';
  import TraceLog from '../components/mcp/TraceLog.svelte';
  import { initMcpTracking, mcpState } from '../webmcp/store.svelte';
  import { getChat } from '../chat.svelte';

  onMount(() => {
    initMcpTracking();
  });

  const traces = $derived(mcpState.traces);
  const isEmpty = $derived(traces.length === 0);
  const detected = $derived(mcpState.state?.detected ?? false);
  const chat = $derived(getChat());
  const isAgentWorking = $derived(
    chat.status === 'streaming' || chat.status === 'submitted',
  );

  let scrollBody: HTMLDivElement | undefined;
  let stickToBottom = $state(true);

  function isAtBottom() {
    if (!scrollBody) return true;
    return (
      scrollBody.scrollHeight - scrollBody.scrollTop - scrollBody.clientHeight <
      48
    );
  }

  function handleScroll() {
    stickToBottom = isAtBottom();
  }

  $effect(() => {
    // Track trace list growth and in-flight updates so autoscroll fires
    // as calls stream in, mirroring the chat thread behavior.
    void traces.length;
    void traces.at(-1)?.durationMs;
    void traces.at(-1)?.pending;
    void isAgentWorking;
    if (!scrollBody || !stickToBottom) return;
    queueMicrotask(() => {
      scrollBody?.scrollTo({ top: scrollBody.scrollHeight });
    });
  });
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

  <div class="traces-page__body" bind:this={scrollBody} onscroll={handleScroll}>
    {#if isEmpty}
      {#if isAgentWorking}
        <div
          class="traces-page__loading"
          role="status"
          aria-label="Waiting for tool calls"
        >
          {#each [0, 1, 2] as i (i)}
            <div class="trace-skeleton" aria-hidden="true">
              <div class="trace-skeleton__row">
                <span class="trace-skeleton__dot"></span>
                <span class="trace-skeleton__bar trace-skeleton__bar--name"
                ></span>
                <span class="trace-skeleton__bar trace-skeleton__bar--time"
                ></span>
              </div>
              <div class="trace-skeleton__bar trace-skeleton__bar--line"></div>
              <div
                class="trace-skeleton__bar trace-skeleton__bar--line trace-skeleton__bar--short"
              ></div>
            </div>
          {/each}
          <p class="traces-page__empty-subtitle">
            Agent is thinking — tool calls will stream here as they run.
          </p>
        </div>
      {:else}
        <div class="traces-page__empty surface-dot-matrix">
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
      {/if}
    {:else}
      <div class="traces-page__viz">
        <Waterfall {traces} />
      </div>
      <TraceLog {traces} />
    {/if}
  </div>
</div>

<style>
  .traces-page {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
    background: #101010;
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
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .traces-page__viz {
    flex-shrink: 0;
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

  .traces-page__loading {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .traces-page__loading .traces-page__empty-subtitle {
    text-align: center;
    padding: 0.5rem 1.5rem 0;
  }

  .trace-skeleton {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.5rem 0.625rem;
    border: 1px solid color-mix(in oklab, currentColor 10%, transparent);
    border-radius: 0.5rem;
    animation: trace-skeleton-pulse 1.6s ease-in-out infinite;
  }

  .trace-skeleton:nth-child(2) {
    animation-delay: 0.2s;
  }

  .trace-skeleton:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes trace-skeleton-pulse {
    50% {
      opacity: 0.45;
    }
  }

  .trace-skeleton__row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .trace-skeleton__dot {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    border-radius: 999px;
    background: color-mix(in oklab, currentColor 14%, transparent);
  }

  .trace-skeleton__bar {
    height: 0.625rem;
    border-radius: 999px;
    background: color-mix(in oklab, currentColor 12%, transparent);
  }

  .trace-skeleton__bar--name {
    width: 7rem;
  }

  .trace-skeleton__bar--time {
    width: 3.5rem;
    margin-left: auto;
  }

  .trace-skeleton__bar--line {
    height: 0.5625rem;
  }

  .trace-skeleton__bar--short {
    width: 55%;
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
