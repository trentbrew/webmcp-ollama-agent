<script lang="ts">
  import type { ConsoleEntry } from '../../webmcp/protocol';

  let { entries }: { entries: ConsoleEntry[] } = $props();

  const sorted = $derived([...entries].reverse());

  function formatTime(ts: number) {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date(ts));
  }
</script>

{#if sorted.length === 0}
  <p class="console-empty">No console output captured yet.</p>
{:else}
  <div class="console-log">
    {#each sorted as entry (entry.id)}
      <div class="console-entry" class:is-error={entry.level === 'error' || entry.level === 'exception'} class:is-warn={entry.level === 'warn'}>
        <span class="console-entry__level">{entry.level}</span>
        <span class="console-entry__time">{formatTime(entry.timestamp)}</span>
        <span class="console-entry__args">{entry.args.join(' ')}</span>
      </div>
    {/each}
  </div>
{/if}

<style>
  .console-empty {
    padding: 0.75rem 0;
    opacity: 0.5;
    font-size: 0.75rem;
    text-align: center;
  }

  .console-log {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.6875rem;
  }

  .console-entry {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0.25rem 0.375rem;
    border-radius: 0.25rem;
  }

  .console-entry.is-warn {
    background: color-mix(in oklab, orange 12%, transparent);
  }

  .console-entry.is-error {
    background: oklch(var(--er) / 0.12);
    color: oklch(var(--er));
  }

  .console-entry__level {
    flex-shrink: 0;
    width: 3.5rem;
    opacity: 0.6;
    text-transform: uppercase;
    font-size: 0.5625rem;
  }

  .console-entry__time {
    flex-shrink: 0;
    opacity: 0.5;
  }

  .console-entry__args {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
</style>
