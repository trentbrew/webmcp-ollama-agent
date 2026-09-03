<script lang="ts">
  import { CheckCircle2, XCircle } from '../../icons';
  import type { ToolCallTrace } from '../../webmcp/protocol';

  let { traces }: { traces: ToolCallTrace[] } = $props();

  const sorted = $derived([...traces].reverse());

  function formatTime(ts: number) {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(ts));
  }
</script>

{#if sorted.length === 0}
  <p class="trace-empty">No tool calls yet.</p>
{:else}
  <div class="trace-log">
    {#each sorted as trace (`${trace.id}:${trace.startedAt}`)}
      <div
        class="trace-entry"
        class:is-error={!trace.ok}
        class:is-pending={trace.pending}
      >
        <div class="trace-entry__row">
          {#if trace.pending}
            <span
              class="trace-entry__icon trace-entry__icon--pending"
              aria-hidden="true">…</span
            >
          {:else if trace.ok}
            <CheckCircle2
              size={12}
              class="trace-entry__icon trace-entry__icon--ok"
            />
          {:else}
            <XCircle
              size={12}
              class="trace-entry__icon trace-entry__icon--err"
            />
          {/if}
          <span class="trace-entry__name">{trace.toolName}</span>
          <span class="trace-entry__source">{trace.source}</span>
          <span class="trace-entry__time">{formatTime(trace.startedAt)}</span>
          <span class="trace-entry__duration"
            >{trace.pending
              ? 'running…'
              : `${Math.round(trace.durationMs)}ms`}</span
          >
        </div>
        <pre class="trace-entry__args">args: {JSON.stringify(trace.args)}</pre>
        {#if trace.pending}
          <pre
            class="trace-entry__result trace-entry__result--pending">in progress…</pre>
        {:else if trace.ok}
          <pre class="trace-entry__result">{JSON.stringify(trace.result)}</pre>
        {:else}
          <pre
            class="trace-entry__result trace-entry__result--error">{trace.error}</pre>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .trace-empty {
    padding: 0.75rem 0;
    opacity: 0.5;
    font-size: 0.75rem;
    text-align: center;
  }

  .trace-log {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .trace-entry {
    padding: 0.5rem 0.625rem;
    border: 1px solid color-mix(in oklab, currentColor 10%, transparent);
    border-radius: 0.5rem;
    font-size: 0.6875rem;
  }

  .trace-entry.is-error {
    border-color: color-mix(in oklab, oklch(var(--er)) 35%, transparent);
  }

  .trace-entry.is-pending {
    border-color: color-mix(in oklab, oklch(var(--p)) 35%, transparent);
    opacity: 0.85;
  }

  .trace-entry__row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-bottom: 0.25rem;
  }

  :global(.trace-entry__icon--ok) {
    color: oklch(var(--su, var(--p)));
  }

  .trace-entry__icon--pending {
    color: oklch(var(--p));
    font-weight: 700;
    line-height: 1;
  }

  :global(.trace-entry__icon--err) {
    color: oklch(var(--er));
  }

  .trace-entry__name {
    font-weight: 600;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .trace-entry__source {
    padding: 0 0.375rem;
    border-radius: 999px;
    background: color-mix(in oklab, currentColor 10%, transparent);
    font-size: 0.5625rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.75;
  }

  .trace-entry__time,
  .trace-entry__duration {
    margin-left: auto;
    opacity: 0.5;
    font-variant-numeric: tabular-nums;
  }

  .trace-entry__duration {
    margin-left: 0.375rem;
  }

  .trace-entry__args,
  .trace-entry__result {
    margin: 0.125rem 0 0;
    overflow-x: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.6875rem;
    white-space: pre-wrap;
    word-break: break-word;
    opacity: 0.7;
  }

  .trace-entry__result--error {
    color: oklch(var(--er));
    opacity: 1;
  }

  .trace-entry__result--pending {
    opacity: 0.55;
    font-style: italic;
  }
</style>
