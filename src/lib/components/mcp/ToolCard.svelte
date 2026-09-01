<script lang="ts">
  import { ChevronDown, Play } from '../../icons';
  import type { WebMcpToolSummary } from '../../webmcp/protocol';
  import { runTool } from '../../webmcp/store.svelte';

  let { tool }: { tool: WebMcpToolSummary } = $props();

  let schemaOpen = $state(false);
  let runOpen = $state(false);
  let argsDraft = $state('{}');
  let argsError = $state<string | null>(null);
  let running = $state(false);
  let lastResult = $state<{ ok: boolean; result?: unknown; error?: string } | null>(null);

  async function handleRun() {
    let args: unknown;
    try {
      args = argsDraft.trim() ? JSON.parse(argsDraft) : {};
      argsError = null;
    } catch (error) {
      argsError = error instanceof Error ? error.message : 'Invalid JSON';
      return;
    }

    running = true;
    lastResult = null;
    lastResult = await runTool(tool.name, args, 'manual');
    running = false;
  }
</script>

<div class="tool-card">
  <div class="tool-card__header">
    <div class="tool-card__title-row">
      <span class="tool-card__name">{tool.title || tool.name}</span>
      {#if !tool.invokable}
        <span class="tool-card__badge tool-card__badge--muted">metadata only</span>
      {/if}
    </div>
    <p class="tool-card__description">{tool.description}</p>
  </div>

  <div class="tool-card__actions">
    <button type="button" class="tool-card__link" onclick={() => (schemaOpen = !schemaOpen)}>
      <ChevronDown size={11} class={`tool-card__chevron${schemaOpen ? ' is-open' : ''}`} />
      schema
    </button>
    <button
      type="button"
      class="tool-card__run-btn"
      disabled={!tool.invokable}
      title={tool.invokable ? 'Run this tool' : 'Not invokable — only seen via page metadata'}
      onclick={() => (runOpen = !runOpen)}
    >
      <Play size={11} />
      Run
    </button>
  </div>

  {#if schemaOpen}
    <pre class="tool-card__schema">{JSON.stringify(tool.inputSchema ?? {}, null, 2)}</pre>
  {/if}

  {#if runOpen}
    <div class="tool-card__run">
      <textarea class="tool-card__args" rows={3} bind:value={argsDraft} spellcheck="false"></textarea>
      {#if argsError}
        <p class="tool-card__error">{argsError}</p>
      {/if}
      <button type="button" class="tool-card__submit" disabled={running} onclick={() => void handleRun()}>
        {running ? 'Running…' : 'Invoke'}
      </button>
      {#if lastResult}
        <pre class="tool-card__result" class:is-error={!lastResult.ok}>{lastResult.ok
            ? JSON.stringify(lastResult.result, null, 2)
            : lastResult.error}</pre>
      {/if}
    </div>
  {/if}
</div>

<style>
  .tool-card {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.625rem;
    border: 1px solid color-mix(in oklab, currentColor 12%, transparent);
    border-radius: 0.5rem;
  }

  .tool-card__title-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .tool-card__name {
    font-size: 0.8125rem;
    font-weight: 600;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .tool-card__badge {
    padding: 0.0625rem 0.375rem;
    border-radius: 999px;
    font-size: 0.625rem;
    font-weight: 500;
  }

  .tool-card__badge--muted {
    background: color-mix(in oklab, currentColor 10%, transparent);
    opacity: 0.7;
  }

  .tool-card__description {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.4;
    opacity: 0.75;
  }

  .tool-card__actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .tool-card__link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border: none;
    background: transparent;
    color: inherit;
    opacity: 0.6;
    font-size: 0.6875rem;
    cursor: pointer;
  }

  .tool-card__link:hover {
    opacity: 1;
  }

  :global(.tool-card__chevron) {
    transition: transform 150ms ease;
  }

  :global(.tool-card__chevron.is-open) {
    transform: rotate(180deg);
  }

  .tool-card__run-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-left: auto;
    padding: 0.1875rem 0.5rem;
    border: 1px solid color-mix(in oklab, currentColor 16%, transparent);
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font-size: 0.6875rem;
    cursor: pointer;
  }

  .tool-card__run-btn:hover:not(:disabled) {
    background: color-mix(in oklab, currentColor 8%, transparent);
  }

  .tool-card__run-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .tool-card__schema,
  .tool-card__result {
    margin: 0;
    padding: 0.5rem;
    overflow-x: auto;
    border-radius: 0.375rem;
    background: color-mix(in oklab, currentColor 6%, transparent);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.6875rem;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .tool-card__result.is-error {
    color: oklch(var(--er));
    background: color-mix(in oklab, oklch(var(--er)) 10%, transparent);
  }

  .tool-card__run {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding-top: 0.25rem;
    border-top: 1px solid color-mix(in oklab, currentColor 10%, transparent);
  }

  .tool-card__args {
    width: 100%;
    box-sizing: border-box;
    padding: 0.375rem 0.5rem;
    border: 1px solid color-mix(in oklab, currentColor 16%, transparent);
    border-radius: 0.375rem;
    background: transparent;
    color: inherit;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.6875rem;
    resize: vertical;
  }

  .tool-card__error {
    margin: 0;
    color: oklch(var(--er));
    font-size: 0.6875rem;
  }

  .tool-card__submit {
    align-self: flex-start;
    padding: 0.25rem 0.625rem;
    border: none;
    border-radius: 999px;
    background: color-mix(in oklab, currentColor 14%, transparent);
    color: inherit;
    font-size: 0.6875rem;
    cursor: pointer;
  }

  .tool-card__submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
