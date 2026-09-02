<script lang="ts">
  import { ChevronLeft, Plus, X } from '../../icons';
  import {
    isExpectedLeaf,
    isUnorderedGroup,
    type ArgMatchMode,
    type CaseKind,
    type EvalCase,
    type ExpectedCall,
    type ExpectedNode,
  } from '../../evals/protocol';
  import { flattenExpected } from '../../evals/scoring';
  import type { ToolCallTrace, WebMcpToolSummary } from '../../webmcp/protocol';

  let {
    evalCase,
    tools,
    traces,
    onsave,
    oncancel,
  }: {
    evalCase: EvalCase;
    tools: WebMcpToolSummary[];
    traces: ToolCallTrace[];
    onsave: (next: EvalCase) => void;
    oncancel: () => void;
  } = $props();

  type Row = { functionName: string; argsText: string };

  function toRow(call: ExpectedCall): Row {
    return {
      functionName: call.functionName,
      argsText: JSON.stringify(call.arguments ?? {}, null, 2),
    };
  }

  /**
   * The editor covers the two shapes people actually write by hand: a plain
   * ordered chain, and one order-insensitive group. Anything more nested (from
   * an imported suite) is edited as raw JSON rather than silently flattened.
   */
  function detectShape(expected: ExpectedNode[]): 'ordered' | 'unordered' | 'advanced' {
    if (expected.every(isExpectedLeaf)) return 'ordered';
    if (expected.length === 1 && isUnorderedGroup(expected[0])) {
      return expected[0].unordered.every(isExpectedLeaf) ? 'unordered' : 'advanced';
    }
    return 'advanced';
  }

  const initialShape = detectShape(evalCase.expected);

  let prompt = $state(evalCase.prompt);
  let kind = $state<CaseKind>(evalCase.kind);
  let argMatch = $state<ArgMatchMode>(evalCase.argMatch);
  let unordered = $state(initialShape === 'unordered');
  let advanced = $state(initialShape === 'advanced');
  let advancedText = $state(JSON.stringify(evalCase.expected, null, 2));
  let rows = $state<Row[]>(flattenExpected(evalCase.expected).map(toRow));
  let setupRows = $state<Row[]>(evalCase.setup.map(toRow));
  let error = $state<string | null>(null);

  const toolNames = $derived(tools.map((tool) => tool.name));
  const recentTraces = $derived([...traces].reverse().slice(0, 12));

  function addRow(target: 'expected' | 'setup') {
    const row: Row = { functionName: toolNames[0] ?? '', argsText: '{}' };
    if (target === 'expected') rows = [...rows, row];
    else setupRows = [...setupRows, row];
  }

  function removeRow(target: 'expected' | 'setup', index: number) {
    if (target === 'expected') rows = rows.filter((_, i) => i !== index);
    else setupRows = setupRows.filter((_, i) => i !== index);
  }

  function prefillFromTrace(trace: ToolCallTrace) {
    rows = [
      ...rows,
      {
        functionName: trace.toolName,
        argsText: JSON.stringify(trace.args ?? {}, null, 2),
      },
    ];
  }

  function parseRows(source: Row[], label: string): ExpectedCall[] {
    return source.map((row, index) => {
      if (!row.functionName.trim()) {
        throw new Error(`${label} ${index + 1}: pick a tool.`);
      }
      const text = row.argsText.trim();
      if (!text) return { functionName: row.functionName };
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(`${label} ${index + 1}: arguments are not valid JSON.`);
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`${label} ${index + 1}: arguments must be a JSON object.`);
      }
      return { functionName: row.functionName, arguments: parsed as Record<string, unknown> };
    });
  }

  function handleSave() {
    error = null;

    if (!prompt.trim()) {
      error = 'The prompt is the case — it cannot be empty.';
      return;
    }

    let expected: ExpectedNode[];
    let setup: ExpectedCall[];

    try {
      setup = parseRows(setupRows, 'Prelude step');

      if (advanced) {
        const parsed = JSON.parse(advancedText) as unknown;
        if (!Array.isArray(parsed)) throw new Error('Expected calls must be a JSON array.');
        expected = parsed as ExpectedNode[];
      } else {
        const leaves = parseRows(rows, 'Expected call');
        expected = unordered && leaves.length > 1 ? [{ unordered: leaves }] : leaves;
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'Could not parse this case.';
      return;
    }

    if (expected.length === 0) {
      error = 'Add at least one expected call — there is nothing to grade otherwise.';
      return;
    }

    onsave({
      ...evalCase,
      prompt: prompt.trim(),
      kind,
      argMatch,
      expected,
      setup,
    });
  }
</script>

<div class="editor">
  <div class="editor__bar">
    <button type="button" class="editor__back" onclick={oncancel}>
      <ChevronLeft size={14} />
      Cancel
    </button>
    <button
      type="button"
      class="editor__save semantic-pill semantic-pill--success"
      onclick={handleSave}>Save case</button
    >
  </div>

  <div class="editor__body">
    <label class="editor__field">
      <span class="editor__label">Prompt</span>
      <textarea
        class="editor__textarea"
        rows={3}
        placeholder="add pepperoni"
        bind:value={prompt}
      ></textarea>
    </label>

    <div class="editor__inline">
      <label class="editor__field editor__field--inline">
        <span class="editor__label">Kind</span>
        <select class="editor__select" bind:value={kind}>
          <option value="direct">direct</option>
          <option value="ambiguous">ambiguous</option>
        </select>
      </label>
      <label class="editor__field editor__field--inline">
        <span class="editor__label">Arguments</span>
        <select class="editor__select" bind:value={argMatch}>
          <option value="subset">subset</option>
          <option value="exact">exact</option>
          <option value="ignore">ignore</option>
        </select>
      </label>
    </div>

    <div class="editor__section">
      <div class="editor__section-head">
        <span class="editor__label">Expected calls</span>
        {#if !advanced}
          <button type="button" class="editor__add" onclick={() => addRow('expected')}>
            <Plus size={10} /> add
          </button>
        {/if}
      </div>

      {#if advanced}
        <p class="editor__hint">
          This case uses nested ordered/unordered groups. Editing as raw JSON so
          nothing is lost.
        </p>
        <textarea
          class="editor__textarea editor__textarea--code"
          rows={8}
          spellcheck="false"
          bind:value={advancedText}
        ></textarea>
        <button
          type="button"
          class="editor__toggle"
          onclick={() => {
            rows = flattenExpected(JSON.parse(advancedText || '[]')).map(toRow);
            advanced = false;
          }}>flatten to a simple list</button
        >
      {:else}
        {#each rows as row, index (index)}
          <div class="editor__row">
            <div class="editor__row-head">
              <select class="editor__select editor__select--grow" bind:value={row.functionName}>
                {#each toolNames as name (name)}
                  <option value={name}>{name}</option>
                {/each}
                {#if !toolNames.includes(row.functionName)}
                  <option value={row.functionName}>{row.functionName} (not on page)</option>
                {/if}
              </select>
              <button
                type="button"
                class="editor__remove"
                aria-label="Remove call"
                onclick={() => removeRow('expected', index)}
              >
                <X size={11} />
              </button>
            </div>
            <textarea
              class="editor__textarea editor__textarea--code"
              rows={2}
              spellcheck="false"
              bind:value={row.argsText}
            ></textarea>
          </div>
        {/each}

        {#if rows.length > 1}
          <label class="editor__check">
            <input type="checkbox" bind:checked={unordered} />
            <span>Order does not matter</span>
          </label>
        {/if}
      {/if}
    </div>

    {#if recentTraces.length > 0 && !advanced}
      <div class="editor__section">
        <span class="editor__label">Prefill from a real call</span>
        <div class="editor__traces">
          {#each recentTraces as trace (trace.id)}
            <button
              type="button"
              class="editor__trace"
              class:is-error={!trace.ok}
              title={JSON.stringify(trace.args)}
              onclick={() => prefillFromTrace(trace)}
            >
              {trace.toolName}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="editor__section">
      <div class="editor__section-head">
        <span class="editor__label">Prelude (optional)</span>
        <button type="button" class="editor__add" onclick={() => addRow('setup')}>
          <Plus size={10} /> add
        </button>
      </div>
      <p class="editor__hint">
        Runs before the graded turn with no model in the loop, to drive the page
        into the state you want to test. These calls execute for real.
      </p>
      {#each setupRows as row, index (index)}
        <div class="editor__row">
          <div class="editor__row-head">
            <select class="editor__select editor__select--grow" bind:value={row.functionName}>
              {#each toolNames as name (name)}
                <option value={name}>{name}</option>
              {/each}
              {#if !toolNames.includes(row.functionName)}
                <option value={row.functionName}>{row.functionName} (not on page)</option>
              {/if}
            </select>
            <button
              type="button"
              class="editor__remove"
              aria-label="Remove step"
              onclick={() => removeRow('setup', index)}
            >
              <X size={11} />
            </button>
          </div>
          <textarea
            class="editor__textarea editor__textarea--code"
            rows={2}
            spellcheck="false"
            bind:value={row.argsText}
          ></textarea>
        </div>
      {/each}
    </div>

    {#if error}
      <p class="editor__error">{error}</p>
    {/if}
  </div>
</div>

<style>
  .editor {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
  }

  .editor__bar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.625rem;
    border-bottom: 1px solid color-mix(in oklab, currentColor 12%, transparent);
  }

  .editor__back {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    opacity: 0.7;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .editor__back:hover {
    opacity: 1;
  }

  .editor__body {
    display: flex;
    flex: 1 1 0;
    min-height: 0;
    flex-direction: column;
    gap: 0.625rem;
    overflow-y: auto;
    padding: 0.625rem;
  }

  .editor__field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .editor__field--inline {
    flex: 1 1 0;
  }

  .editor__inline {
    display: flex;
    gap: 0.5rem;
  }

  .editor__label {
    opacity: 0.6;
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .editor__textarea,
  .editor__select {
    width: 100%;
    box-sizing: border-box;
    padding: 0.3125rem 0.5rem;
    border: 1px solid color-mix(in oklab, currentColor 16%, transparent);
    border-radius: 0.375rem;
    background: transparent;
    color: inherit;
    font-size: 0.75rem;
  }

  .editor__textarea {
    resize: vertical;
  }

  .editor__textarea--code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.6875rem;
  }

  .editor__select {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.6875rem;
  }

  .editor__select--grow {
    flex: 1 1 auto;
  }

  .editor__section {
    display: flex;
    flex-direction: column;
    gap: 0.3125rem;
  }

  .editor__section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .editor__add,
  .editor__toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.1875rem;
    padding: 0;
    border: none;
    background: transparent;
    color: oklch(var(--p));
    font-size: 0.6875rem;
    cursor: pointer;
  }

  .editor__toggle {
    align-self: flex-start;
  }

  .editor__hint {
    margin: 0;
    opacity: 0.6;
    font-size: 0.6875rem;
    line-height: 1.4;
  }

  .editor__row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.375rem;
    border: 1px solid color-mix(in oklab, currentColor 10%, transparent);
    border-radius: 0.375rem;
  }

  .editor__row-head {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .editor__remove {
    display: inline-flex;
    flex-shrink: 0;
    padding: 0.125rem;
    border: none;
    background: transparent;
    color: inherit;
    opacity: 0.5;
    cursor: pointer;
  }

  .editor__remove:hover {
    color: oklch(var(--er));
    opacity: 1;
  }

  .editor__check {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.6875rem;
  }

  .editor__traces {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .editor__trace {
    padding: 0.125rem 0.5rem;
    border: 1px solid color-mix(in oklab, currentColor 18%, transparent);
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.625rem;
    cursor: pointer;
  }

  .editor__trace:hover {
    border-color: color-mix(in oklab, currentColor 35%, transparent);
  }

  .editor__trace.is-error {
    color: oklch(var(--er));
  }

  .editor__error {
    margin: 0;
    color: oklch(var(--er));
    font-size: 0.6875rem;
  }
</style>
