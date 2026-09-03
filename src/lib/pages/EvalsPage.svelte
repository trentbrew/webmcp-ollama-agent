<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ClipboardCopy,
    ClipboardPaste,
    FlaskConical,
    Play,
    Plus,
    Square,
  } from '../icons';
  import CaseCard from '../components/evals/CaseCard.svelte';
  import CaseDetail from '../components/evals/CaseDetail.svelte';
  import CaseEditor from '../components/evals/CaseEditor.svelte';
  import { navigateTo } from '../stores/navigation';
  import { initMcpTracking, mcpState } from '../webmcp/store.svelte';
  import { resultStatus, type EvalCase } from '../evals/protocol';
  import { hasDrift, isBlockingDrift } from '../evals/surface';
  import { flattenExpected } from '../evals/scoring';
  import {
    acceptDrift,
    cancelRun,
    caseFromTrace,
    currentOrigin,
    evalState,
    exportCasesJson,
    importCasesJson,
    newCaseDraft,
    pageTools,
    removeCase,
    runAllForOrigin,
    runCases,
    saveCase,
    setAllowWrites,
    setMode,
    setRuns,
  } from '../evals/store.svelte';

  onMount(() => {
    initMcpTracking();
  });

  type View =
    | { name: 'list' }
    | { name: 'detail'; id: string }
    | { name: 'edit'; draft: EvalCase };

  let view = $state<View>({ name: 'list' });
  let importOpen = $state(false);
  let importText = $state('');
  let notice = $state<string | null>(null);

  const origin = $derived(currentOrigin());
  const tools = $derived(pageTools());
  const cases = $derived(
    evalState.cases
      .filter((entry) => entry.origin === origin)
      .sort((a, b) => a.createdAt - b.createdAt),
  );
  const running = $derived(evalState.running);

  const tally = $derived.by(() => {
    let pass = 0;
    let fail = 0;
    let drift = 0;
    for (const entry of cases) {
      const result = evalState.results[entry.id];
      const status = resultStatus(result);
      if (status === 'pass') pass += 1;
      else if (status === 'fail' || status === 'flaky') fail += 1;
      const names = flattenExpected(entry.expected).map(
        (leaf) => leaf.functionName,
      );
      if (hasDrift(result?.drift) && isBlockingDrift(result?.drift, names))
        drift += 1;
    }
    return { pass, fail, drift };
  });

  const activeCase = $derived.by(() => {
    const current = view;
    if (current.name !== 'detail') return undefined;
    return evalState.cases.find((entry) => entry.id === current.id);
  });

  function openNew() {
    view = { name: 'edit', draft: newCaseDraft() };
  }

  function openFromTrace() {
    const latest = mcpState.traces.at(-1);
    view = {
      name: 'edit',
      draft: latest ? caseFromTrace(latest) : newCaseDraft(),
    };
  }

  function handleSave(next: EvalCase) {
    saveCase(next);
    view = { name: 'detail', id: next.id };
  }

  function handleDelete(id: string) {
    removeCase(id);
    view = { name: 'list' };
  }

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportCasesJson(origin));
      notice = `Copied ${cases.length} case${cases.length === 1 ? '' : 's'} as JSON.`;
    } catch {
      notice = 'Could not reach the clipboard.';
    }
  }

  function applyImport() {
    try {
      const { added, skipped } = importCasesJson(importText);
      notice = `Imported ${added} case${added === 1 ? '' : 's'}${skipped ? `, skipped ${skipped}` : ''}.`;
      importText = '';
      importOpen = false;
    } catch (error) {
      notice = error instanceof Error ? error.message : 'Import failed.';
    }
  }
</script>

{#if view.name === 'edit'}
  <CaseEditor
    evalCase={view.draft}
    {tools}
    traces={mcpState.traces}
    onsave={handleSave}
    oncancel={() => (view = { name: 'list' })}
  />
{:else if view.name === 'detail' && activeCase}
  <CaseDetail
    evalCase={activeCase}
    result={evalState.results[activeCase.id]}
    busy={running?.currentCaseId === activeCase.id}
    onback={() => (view = { name: 'list' })}
    onedit={() => (view = { name: 'edit', draft: activeCase })}
    onrun={() => void runCases([activeCase.id])}
    ondelete={() => handleDelete(activeCase.id)}
    onopentool={() => navigateTo('mcp')}
    onacceptdrift={() => acceptDrift(activeCase.id)}
  />
{:else}
  <div class="evals-page">
    <div class="evals-page__status">
      <span
        class="evals-page__dot"
        class:is-active={cases.length > 0}
        class:is-inactive={cases.length === 0}
      ></span>
      {#if running}
        <span
          >Running {running.done + 1}/{running.total} · attempt {running.attempt}/{running.attempts}</span
        >
        <button type="button" class="evals-page__cancel" onclick={cancelRun}>
          <Square size={9} />
          Stop
        </button>
      {:else if cases.length === 0}
        <span>No eval cases for this origin</span>
      {:else}
        <span>
          {cases.length} case{cases.length === 1 ? '' : 's'} · {tally.pass} pass
          · {tally.fail}
          fail{tally.drift ? ` · ${tally.drift} drift` : ''}
        </span>
      {/if}
    </div>

    <div class="evals-page__toolbar">
      <div class="evals-page__modes" role="group" aria-label="Run mode">
        <button
          type="button"
          class="evals-page__mode"
          class:is-active={evalState.settings.mode === 'dry-run'}
          title="Grade the model's proposed call without dispatching it"
          onclick={() => setMode('dry-run')}>dry-run</button
        >
        <button
          type="button"
          class="evals-page__mode"
          class:is-active={evalState.settings.mode === 'execute'}
          title="Run the full agent loop with real tool dispatch"
          onclick={() => setMode('execute')}>execute</button
        >
      </div>

      <label class="evals-page__runs">
        <span>runs</span>
        <input
          type="number"
          min="1"
          max="10"
          value={evalState.settings.runs}
          oninput={(event) => setRuns(Number(event.currentTarget.value))}
        />
      </label>

      <button
        type="button"
        class="evals-page__run-all semantic-pill semantic-pill--success"
        disabled={cases.length === 0 || Boolean(running)}
        onclick={() => void runAllForOrigin(origin)}
      >
        <Play size={10} />
        Run all
      </button>
    </div>

    {#if evalState.settings.mode === 'execute'}
      <label class="evals-page__writes">
        <input
          type="checkbox"
          checked={evalState.settings.allowWrites}
          onchange={(event) => setAllowWrites(event.currentTarget.checked)}
        />
        <span>
          Dispatch write tools for real. Off by default — a suite fires every
          call against the page that is open right now.
        </span>
      </label>
    {/if}

    {#if evalState.lastError}
      <p class="evals-page__error">{evalState.lastError}</p>
    {/if}
    {#if notice}
      <p class="evals-page__notice">{notice}</p>
    {/if}

    <div class="evals-page__body">
      {#if cases.length === 0}
        <div class="evals-page__empty surface-dot-matrix">
          <FlaskConical size={26} class="evals-page__empty-icon" />
          <p class="evals-page__empty-title">No cases yet</p>
          <p class="evals-page__empty-subtitle">
            {#if tools.length === 0}
              Open a page that registers WebMCP tools, then write a case here to
              check the model picks the right one.
            {:else}
              {tools.length} tool{tools.length === 1 ? '' : 's'} on this page. A
              case is a prompt plus the call it should produce — run it {evalState
                .settings.runs} times and read the pass rate, not a checkmark.
            {/if}
          </p>
          <div class="evals-page__empty-actions">
            <button
              type="button"
              class="semantic-pill semantic-pill--success"
              onclick={openNew}
            >
              <Plus size={10} /> New case
            </button>
            {#if mcpState.traces.length > 0}
              <button
                type="button"
                class="semantic-pill semantic-pill--neutral"
                onclick={openFromTrace}
              >
                From last trace
              </button>
            {/if}
          </div>
        </div>
      {:else}
        <div class="evals-page__list">
          {#each cases as entry (entry.id)}
            <CaseCard
              evalCase={entry}
              result={evalState.results[entry.id]}
              runs={evalState.settings.runs}
              busy={running?.currentCaseId === entry.id}
              onopen={() => (view = { name: 'detail', id: entry.id })}
              onrun={() => void runCases([entry.id])}
            />
          {/each}
        </div>

        <div class="evals-page__actions">
          <button type="button" class="evals-page__link" onclick={openNew}>
            <Plus size={10} /> New case
          </button>
          {#if mcpState.traces.length > 0}
            <button
              type="button"
              class="evals-page__link"
              onclick={openFromTrace}
            >
              From last trace
            </button>
          {/if}
          <button
            type="button"
            class="evals-page__link"
            onclick={() => void copyExport()}
          >
            <ClipboardCopy size={10} /> Export
          </button>
          <button
            type="button"
            class="evals-page__link"
            onclick={() => (importOpen = !importOpen)}
          >
            <ClipboardPaste size={10} /> Import
          </button>
        </div>
      {/if}

      {#if importOpen}
        <div class="evals-page__import">
          <p class="evals-page__import-hint">
            Paste a suite in Chrome's eval format — an array of
            <code>{'{ messages, expectedCall }'}</code> or a file exported here.
          </p>
          <textarea
            class="evals-page__import-text"
            rows={5}
            spellcheck="false"
            bind:value={importText}
          ></textarea>
          <button
            type="button"
            class="semantic-pill semantic-pill--success"
            disabled={!importText.trim()}
            onclick={applyImport}>Import</button
          >
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .evals-page {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
    background: #101010;
  }

  .evals-page__status {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
    border-bottom: 1px solid color-mix(in oklab, currentColor 12%, transparent);
    font-size: 0.75rem;
  }

  .evals-page__dot {
    width: 0.5rem;
    height: 0.5rem;
    flex-shrink: 0;
    border-radius: 999px;
  }

  .evals-page__dot.is-active {
    background: oklch(var(--su));
  }

  .evals-page__dot.is-inactive {
    background: color-mix(in oklab, currentColor 30%, transparent);
  }

  .evals-page__cancel {
    display: inline-flex;
    align-items: center;
    gap: 0.1875rem;
    margin-left: auto;
    padding: 0;
    border: none;
    background: transparent;
    color: oklch(var(--er));
    font-size: 0.6875rem;
    cursor: pointer;
  }

  .evals-page__toolbar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4375rem 0.625rem;
    border-bottom: 1px solid color-mix(in oklab, currentColor 8%, transparent);
  }

  .evals-page__modes {
    display: inline-flex;
    overflow: hidden;
    border: 1px solid color-mix(in oklab, currentColor 16%, transparent);
    border-radius: 999px;
  }

  .evals-page__mode {
    padding: 0.125rem 0.5rem;
    border: none;
    background: transparent;
    color: inherit;
    opacity: 0.6;
    font-size: 0.625rem;
    cursor: pointer;
  }

  .evals-page__mode.is-active {
    background: color-mix(in oklab, currentColor 14%, transparent);
    opacity: 1;
  }

  .evals-page__runs {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    opacity: 0.7;
    font-size: 0.625rem;
  }

  .evals-page__runs input {
    width: 2.5rem;
    padding: 0.125rem 0.25rem;
    border: 1px solid color-mix(in oklab, currentColor 16%, transparent);
    border-radius: 0.25rem;
    background: transparent;
    color: inherit;
    font-size: 0.6875rem;
  }

  .evals-page__run-all {
    gap: 0.1875rem;
    margin-left: auto;
  }

  .evals-page__writes {
    display: flex;
    flex-shrink: 0;
    align-items: flex-start;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    border-bottom: 1px solid color-mix(in oklab, currentColor 8%, transparent);
    background: color-mix(in oklab, oklch(var(--wa)) 8%, transparent);
    font-size: 0.625rem;
    line-height: 1.4;
  }

  .evals-page__error,
  .evals-page__notice {
    flex-shrink: 0;
    margin: 0;
    padding: 0.375rem 0.625rem;
    font-size: 0.6875rem;
  }

  .evals-page__error {
    color: oklch(var(--er));
  }

  .evals-page__notice {
    opacity: 0.7;
  }

  .evals-page__body {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    padding: 0.625rem;
  }

  .evals-page__list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .evals-page__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding-top: 0.625rem;
  }

  .evals-page__link {
    display: inline-flex;
    align-items: center;
    gap: 0.1875rem;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    opacity: 0.6;
    font-size: 0.6875rem;
    cursor: pointer;
  }

  .evals-page__link:hover {
    opacity: 1;
  }

  .evals-page__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 100%;
    padding: 1.5rem;
    text-align: center;
  }

  :global(.evals-page__empty-icon) {
    opacity: 0.5;
  }

  .evals-page__empty-title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 500;
  }

  .evals-page__empty-subtitle {
    margin: 0;
    max-width: 20rem;
    font-size: 0.75rem;
    line-height: 1.5;
    opacity: 0.65;
  }

  .evals-page__empty-actions {
    display: flex;
    gap: 0.375rem;
    margin-top: 0.25rem;
  }

  .evals-page__import {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.375rem;
    margin-top: 0.625rem;
    padding-top: 0.625rem;
    border-top: 1px solid color-mix(in oklab, currentColor 10%, transparent);
  }

  .evals-page__import-hint {
    margin: 0;
    opacity: 0.65;
    font-size: 0.6875rem;
    line-height: 1.4;
  }

  .evals-page__import-text {
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
</style>
