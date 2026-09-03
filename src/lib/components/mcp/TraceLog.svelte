<script lang="ts">
  import { CheckCircle2, ChevronRight, XCircle } from '../../icons';
  import type { ToolCallTrace } from '../../webmcp/protocol';
  import { highlightJson } from '../../jsonHighlight';

  let { traces }: { traces: ToolCallTrace[] } = $props();

  // Chronological (oldest top, newest bottom) to match the chat thread,
  // so bottom-anchored autoscroll reveals the latest call.
  const sorted = $derived([...traces].sort((a, b) => a.startedAt - b.startedAt));

  function formatTime(ts: number) {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(ts));
  }

  function compact(value: unknown): string {
    if (value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
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
        {#if trace.pending}
          <pre
            class="trace-entry__result trace-entry__result--pending">in progress…</pre>
        {:else}
          <details class="trace-detail">
            <summary class="trace-detail__summary">
              <ChevronRight size={12} class="trace-detail__chevron" />
              <span class="trace-detail__label">args</span>
              <span class="trace-detail__preview">{compact(trace.args)}</span>
            </summary>
            <pre
              class="trace-detail__code trace-entry__code">{@html highlightJson(
                trace.args,
              )}</pre>
          </details>
          {#if trace.ok}
            <details class="trace-detail">
              <summary class="trace-detail__summary">
                <ChevronRight size={12} class="trace-detail__chevron" />
                <span class="trace-detail__label">result</span>
                <span class="trace-detail__preview">{compact(trace.result)}</span>
              </summary>
              <pre
                class="trace-detail__code trace-entry__code">{@html highlightJson(
                  trace.result,
                )}</pre>
            </details>
          {:else if trace.error}
            <pre
              class="trace-entry__result trace-entry__result--error">{trace.error}</pre>
          {/if}
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

  .trace-detail {
    margin-top: 0.125rem;
  }

  .trace-detail__summary {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.25rem;
    margin: 0 -0.25rem;
    border-radius: 0.25rem;
    cursor: pointer;
    list-style: none;
    min-width: 0;
  }

  .trace-detail__summary::-webkit-details-marker {
    display: none;
  }

  .trace-detail__summary::marker {
    content: '';
  }

  .trace-detail__summary:hover {
    background: color-mix(in oklab, currentColor 6%, transparent);
  }

  :global(.trace-detail__chevron) {
    flex-shrink: 0;
    opacity: 0.5;
    transition: transform 0.15s ease;
  }

  .trace-detail[open] :global(.trace-detail__chevron) {
    transform: rotate(90deg);
  }

  .trace-detail__label {
    flex-shrink: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    opacity: 0.55;
  }

  .trace-detail__preview {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    opacity: 0.45;
  }

  .trace-detail__code,
  .trace-entry__result {
    margin: 0.125rem 0 0;
    overflow-x: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.6875rem;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .trace-detail__code {
    padding: 0.375rem 0.5rem 0.375rem 1.375rem;
    border-radius: 0.375rem;
    background: color-mix(in oklab, currentColor 6%, transparent);
  }

  .trace-detail__code :global(.json-key) {
    color: oklch(var(--p));
  }

  .trace-detail__code :global(.json-string) {
    color: oklch(var(--su));
  }

  .trace-detail__code :global(.json-number) {
    color: oklch(var(--wa));
  }

  .trace-detail__code :global(.json-boolean) {
    color: oklch(var(--in));
  }

  .trace-detail__code :global(.json-null) {
    color: oklch(var(--bc) / 0.55);
    font-style: italic;
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
