<script lang="ts">
  import DOMPurify from 'dompurify';
  import { ChevronDown, Play } from '../../icons';
  import type { WebMcpToolSummary } from '../../webmcp/protocol';
  import { highlightJson } from '../../jsonHighlight';
  import { runTool } from '../../webmcp/store.svelte';

  let { tool }: { tool: WebMcpToolSummary } = $props();

  let schemaOpen = $state(false);
  let runOpen = $state(false);
  let argsDraft = $state('{}');
  let argsError = $state<string | null>(null);
  let running = $state(false);
  let lastResult = $state<{
    ok: boolean;
    result?: unknown;
    error?: string;
  } | null>(null);

  type ParamInfo = { name: string; required: boolean };

  const params = $derived.by<ParamInfo[]>(() => {
    const schema = tool.inputSchema as
      | { properties?: Record<string, unknown>; required?: string[] }
      | undefined;
    const properties = schema?.properties;
    if (!properties || typeof properties !== 'object') return [];
    const required = new Set(Array.isArray(schema?.required) ? schema.required : []);
    return Object.keys(properties).map((name) => ({
      name,
      required: required.has(name),
    }));
  });

  const signature = $derived(`${tool.name}(${params.map((p) => p.name).join(', ')})`);

  const readOnly = $derived(tool.annotations?.readOnlyHint === true);

  const schemaHtml = $derived(
    DOMPurify.sanitize(highlightJson(tool.inputSchema ?? {}), {
      ALLOWED_TAGS: ['span'],
      ALLOWED_ATTR: ['class'],
    }),
  );

  const resultHtml = $derived(
    lastResult?.ok && lastResult.result !== undefined
      ? DOMPurify.sanitize(highlightJson(lastResult.result), {
          ALLOWED_TAGS: ['span'],
          ALLOWED_ATTR: ['class'],
        })
      : null,
  );

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
    <span class="tool-card__signature">{signature}</span>
    {#if readOnly}
      <span class="tool-card__badge">READ-ONLY</span>
    {/if}
  </div>

  <p class="tool-card__description">{tool.description}</p>

  {#if params.length > 0}
    <div class="tool-card__params">
      {#each params as param (param.name)}
        <span class="tool-card__param">
          {param.name}{#if param.required}<span class="tool-card__required">*</span>{/if}
        </span>
      {/each}
    </div>
  {/if}

  <div class="tool-card__actions">
    <button
      type="button"
      class="tool-card__link"
      onclick={() => (schemaOpen = !schemaOpen)}
    >
      <ChevronDown
        size={11}
        class={`tool-card__chevron${schemaOpen ? ' is-open' : ''}`}
      />
      schema
    </button>
    <button
      type="button"
      class="tool-card__run-btn semantic-pill semantic-pill--success"
      disabled={!tool.invokable}
      title={tool.invokable
        ? 'Run this tool'
        : 'Not invokable — only seen via page metadata'}
      onclick={() => (runOpen = !runOpen)}
    >
      <Play size={11} />
      Run
    </button>
  </div>

  {#if schemaOpen}
    <pre class="tool-card__schema tool-card__code">{@html schemaHtml}</pre>
  {/if}

  {#if runOpen}
    <div class="tool-card__run">
      <textarea
        class="tool-card__args"
        rows={3}
        bind:value={argsDraft}
        spellcheck="false"
      ></textarea>
      {#if argsError}
        <p class="tool-card__error">{argsError}</p>
      {/if}
      <button
        type="button"
        class="tool-card__submit semantic-pill semantic-pill--success"
        disabled={running}
        onclick={() => void handleRun()}
      >
        {running ? 'Running…' : 'Invoke'}
      </button>
      {#if lastResult}
        {#if lastResult.ok && resultHtml}
          <pre
            class="tool-card__result tool-card__code">{@html resultHtml}</pre>
        {:else}
          <pre class="tool-card__result is-error">{lastResult.error}</pre>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .tool-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem 0.875rem;
    border: 1px solid color-mix(in oklab, currentColor 10%, transparent);
    border-radius: 0.625rem;
    background: color-mix(in oklab, currentColor 3%, transparent);
  }

  .tool-card__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .tool-card__signature {
    overflow-wrap: anywhere;
    font-size: 0.8125rem;
    font-weight: 600;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .tool-card__badge {
    flex-shrink: 0;
    padding: 0.0625rem 0.4375rem;
    border: 1px solid color-mix(in oklab, oklch(var(--in, var(--p))) 40%, transparent);
    border-radius: 999px;
    background: color-mix(in oklab, oklch(var(--in, var(--p))) 14%, transparent);
    color: oklch(var(--in, var(--p)));
    font-size: 0.5625rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .tool-card__description {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.45;
    opacity: 0.7;
  }

  .tool-card__params {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .tool-card__param {
    padding: 0.0625rem 0.5rem;
    border-radius: 0.375rem;
    background: color-mix(in oklab, currentColor 8%, transparent);
    color: oklch(var(--p));
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.6875rem;
  }

  .tool-card__required {
    margin-left: 0.0625rem;
    color: oklch(var(--wa));
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
  }

  .tool-card__submit {
    align-self: flex-start;
    padding: 0.25rem 0.625rem;
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

  .tool-card__code :global(.json-key) {
    color: oklch(var(--p));
  }

  .tool-card__code :global(.json-string) {
    color: oklch(var(--su));
  }

  .tool-card__code :global(.json-number) {
    color: oklch(var(--wa));
  }

  .tool-card__code :global(.json-boolean) {
    color: oklch(var(--in));
  }

  .tool-card__code :global(.json-null) {
    color: oklch(var(--bc) / 0.55);
    font-style: italic;
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
</style>
