<script lang="ts">
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { ChevronRight, Wrench } from '../../icons';

  let {
    toolName,
    args,
    result = undefined,
    error = undefined,
    running = false,
  }: {
    toolName: string;
    args?: unknown;
    result?: unknown;
    error?: string;
    running?: boolean;
  } = $props();

  type Status = 'running' | 'success' | 'error';

  const status = $derived<Status>(error ? 'error' : running ? 'running' : 'success');
  const badgeLabel = $derived(status === 'running' ? 'running' : status === 'error' ? 'failed' : 'ok');

  function stringify(value: unknown): string {
    if (value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  function inline(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  const summary = $derived(inline(args));
  const argsText = $derived(stringify(args));
  const bodyText = $derived(error ?? stringify(result));
  const hasDetail = $derived(Boolean(argsText || bodyText));

  let open = $state(false);
</script>

<div class={`tool-call-row tool-call-row--${status}`}>
  <button
    type="button"
    class="tool-call-row-trigger"
    aria-expanded={open}
    disabled={!hasDetail}
    onclick={() => (open = !open)}
  >
    <ChevronRight size={14} class={`tool-call-row-chevron${open ? ' is-open' : ''}`} />
    <Wrench size={13} class={`tool-call-row-icon tool-call-row-icon--${status}`} />
    <span class="tool-call-row-main">
      <span class="tool-call-row-title">
        <span class="tool-call-row-name">{toolName}</span>
        <span class={`tool-call-row-badge tool-call-row-badge--${status}`}>{badgeLabel}</span>
      </span>
      {#if summary}
        <span class="tool-call-row-summary" title={summary}>{summary}</span>
      {/if}
    </span>
  </button>

  {#if open && hasDetail}
    <div class="tool-call-row-detail" transition:slide={{ duration: 200, easing: cubicOut }}>
      {#if argsText}
        <div class="tool-call-row-detail-label">Arguments</div>
        <pre class="tool-call-row-detail-pre">{argsText}</pre>
      {/if}
      {#if bodyText}
        <div class="tool-call-row-detail-label">{error ? 'Error' : 'Result'}</div>
        <pre class="tool-call-row-detail-pre" class:is-error={Boolean(error)}>{bodyText}</pre>
      {/if}
    </div>
  {/if}
</div>

<style>
  .tool-call-row {
    margin: 0.35rem 0;
    border: 1px solid oklch(var(--bc) / 0.18);
    border-left-width: 2px;
    border-left-color: oklch(var(--bc) / 0.18);
    border-radius: 0.25rem;
    background: oklch(var(--b1));
    overflow: hidden;
  }

  .tool-call-row--running {
    border-left-color: oklch(var(--wa));
  }

  .tool-call-row--success {
    border-left-color: oklch(var(--su));
  }

  .tool-call-row--error {
    border-left-color: oklch(var(--er));
    background: color-mix(in oklab, oklch(var(--er)) 6%, oklch(var(--b1)));
  }

  .tool-call-row-trigger {
    display: flex;
    align-items: flex-start;
    gap: 0.45rem;
    width: 100%;
    padding: 0.45rem 0.6rem;
    border: none;
    background: transparent;
    color: oklch(var(--bc));
    font-size: 0.78rem;
    text-align: left;
    cursor: pointer;
  }

  .tool-call-row-trigger:disabled {
    cursor: default;
  }

  .tool-call-row-main {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .tool-call-row-title {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }

  .tool-call-row-name {
    flex-shrink: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-weight: 500;
  }

  .tool-call-row-badge {
    flex-shrink: 0;
    padding: 0 0.35rem;
    border-radius: 999px;
    font-size: 0.6rem;
    line-height: 1.4;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .tool-call-row-badge--running {
    color: oklch(var(--wa));
    background: oklch(var(--wa) / 0.15);
  }

  .tool-call-row-badge--success {
    color: oklch(var(--su));
    background: oklch(var(--su) / 0.15);
  }

  .tool-call-row-badge--error {
    color: oklch(var(--er));
    background: oklch(var(--er) / 0.15);
  }

  .tool-call-row-summary {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.68rem;
    line-height: 1.35;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: oklch(var(--bc) / 0.55);
  }

  :global(.tool-call-row-chevron) {
    flex-shrink: 0;
    margin-top: 0.1rem;
    color: oklch(var(--bc) / 0.55);
    transition: transform 0.15s ease;
  }

  :global(.tool-call-row-chevron.is-open) {
    transform: rotate(90deg);
  }

  :global(.tool-call-row-icon) {
    flex-shrink: 0;
    margin-top: 0.1rem;
  }

  :global(.tool-call-row-icon--running) {
    color: oklch(var(--wa));
  }

  :global(.tool-call-row-icon--success) {
    color: oklch(var(--su));
  }

  :global(.tool-call-row-icon--error) {
    color: oklch(var(--er));
  }

  .tool-call-row-detail {
    padding: 0.4rem 0.65rem 0.6rem 1.75rem;
    border-top: 1px solid oklch(var(--bc) / 0.14);
  }

  .tool-call-row-detail-label {
    margin: 0.35rem 0 0.15rem;
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: oklch(var(--bc) / 0.45);
  }

  .tool-call-row-detail-label:first-child {
    margin-top: 0;
  }

  .tool-call-row-detail-pre {
    margin: 0;
    font-size: 0.68rem;
    line-height: 1.45;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: oklch(var(--bc) / 0.7);
    white-space: pre-wrap;
    word-break: break-word;
    overflow-x: auto;
  }

  .tool-call-row-detail-pre.is-error {
    color: oklch(var(--er));
  }
</style>
