<script lang="ts">
  import {
    ChevronLeft,
    CheckCircle2,
    Play,
    RotateCw,
    Wrench,
    XCircle,
  } from '../../icons';
  import {
    FAILURE_LABELS,
    FAILURE_REMEDIES,
    resultStatus,
    type Attempt,
    type CaseResult,
    type EvalCase,
  } from '../../evals/protocol';
  import { describeDrift, hasDrift } from '../../evals/surface';
  import { summarizeExpected } from '../../evals/format';
  import { replaySetupStep } from '../../evals/store.svelte';

  let {
    evalCase,
    result,
    busy = false,
    onback,
    onedit,
    onrun,
    ondelete,
    onopentool,
    onacceptdrift,
  }: {
    evalCase: EvalCase;
    result: CaseResult | undefined;
    busy?: boolean;
    onback: () => void;
    onedit: () => void;
    onrun: () => void;
    ondelete: () => void;
    onopentool: (name: string) => void;
    onacceptdrift: () => void;
  } = $props();

  type AttemptGroup = {
    key: string;
    attempts: Attempt[];
    representative: Attempt;
  };

  const status = $derived(resultStatus(result));

  const groups = $derived.by<AttemptGroup[]>(() => {
    const byKey = new Map<string, AttemptGroup>();
    for (const attempt of result?.attempts ?? []) {
      const key = `${attempt.verdict.pass}|${attempt.verdict.failure ?? ''}|${attempt.verdict.detail ?? ''}`;
      const existing = byKey.get(key);
      if (existing) existing.attempts.push(attempt);
      else byKey.set(key, { key, attempts: [attempt], representative: attempt });
    }
    return [...byKey.values()].sort(
      (a, b) =>
        Number(a.representative.verdict.pass) - Number(b.representative.verdict.pass) ||
        b.attempts.length - a.attempts.length,
    );
  });

  const driftLines = $derived(result?.drift ? describeDrift(result.drift) : []);

  let replaying = $state<number | null>(null);

  async function replay(index: number) {
    replaying = index;
    await replaySetupStep(evalCase.setup[index]);
    replaying = null;
  }

  function short(value: unknown): string {
    const text = JSON.stringify(value);
    if (text === undefined) return 'undefined';
    return text.length > 120 ? `${text.slice(0, 117)}…` : text;
  }
</script>

<div class="case-detail">
  <div class="case-detail__bar">
    <button type="button" class="case-detail__back" onclick={onback}>
      <ChevronLeft size={14} />
      Cases
    </button>
    {#if result && status !== 'unrun'}
      <span class="case-detail__rate case-detail__rate--{status}">
        {result.passCount}/{result.runCount} pass
      </span>
    {/if}
    <button
      type="button"
      class="case-detail__action semantic-pill semantic-pill--neutral"
      onclick={onedit}>Edit</button
    >
    <button
      type="button"
      class="case-detail__action semantic-pill semantic-pill--success"
      disabled={busy}
      onclick={onrun}
    >
      <Play size={10} />
      {busy ? 'Running…' : 'Run'}
    </button>
  </div>

  <div class="case-detail__body">
    <p class="case-detail__prompt">{evalCase.prompt}</p>
    <p class="case-detail__expected">
      expects {summarizeExpected(evalCase.expected)}
      <span class="case-detail__mode">· args: {evalCase.argMatch}</span>
    </p>

    {#if result}
      <p class="case-detail__ran">
        Last run on <strong>{result.model}</strong> in {result.mode} mode.
      </p>
    {/if}

    {#if hasDrift(result?.drift)}
      <div class="case-detail__drift">
        <p class="case-detail__drift-title">⌁ Tool surface drift</p>
        <ul class="case-detail__drift-list">
          {#each driftLines as line (line)}
            <li>{line}</li>
          {/each}
        </ul>
        <p class="case-detail__drift-note">
          The page's tools changed since this case was written, so the result may
          not mean what it says.
        </p>
        <button
          type="button"
          class="semantic-pill semantic-pill--neutral"
          onclick={onacceptdrift}
        >
          Re-capture surface
        </button>
      </div>
    {/if}

    {#if evalCase.setup.length > 0}
      <div class="case-detail__section">
        <p class="case-detail__section-title">Prelude — runs with no model</p>
        <div class="case-detail__chips">
          {#each evalCase.setup as step, index (index)}
            <button
              type="button"
              class="case-detail__chip"
              disabled={replaying === index}
              title="Replay this step against the page"
              onclick={() => void replay(index)}
            >
              <RotateCw size={9} />
              {step.functionName}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if !result || result.attempts.length === 0}
      <p class="case-detail__unrun">
        Not run yet. Press Run to grade this case against the live page.
      </p>
    {:else}
      {#each groups as group (group.key)}
        {@const verdict = group.representative.verdict}
        <div class="verdict" class:is-pass={verdict.pass}>
          <div class="verdict__head">
            {#if verdict.pass}
              <CheckCircle2 size={12} class="verdict__icon verdict__icon--ok" />
              <span class="verdict__label">Pass</span>
            {:else}
              <XCircle size={12} class="verdict__icon verdict__icon--err" />
              <span class="verdict__label"
                >{verdict.failure
                  ? FAILURE_LABELS[verdict.failure]
                  : 'Fail'}</span
              >
            {/if}
            <span class="verdict__count"
              >{group.attempts.length} run{group.attempts.length === 1
                ? ''
                : 's'}</span
            >
          </div>

          {#if verdict.detail}
            <p class="verdict__detail">{verdict.detail}</p>
          {/if}

          {#if !verdict.pass}
            <div class="verdict__calls">
              <div class="verdict__col">
                <span class="verdict__col-label">expected</span>
                <code>{verdict.expectedNames.join(' → ') || '—'}</code>
              </div>
              <div class="verdict__col">
                <span class="verdict__col-label">actual</span>
                <code class="is-actual"
                  >{verdict.actualNames.join(' → ') || 'nothing'}</code
                >
              </div>
            </div>
          {/if}

          {#if verdict.mismatches.length > 0}
            <div class="verdict__mismatches">
              {#each verdict.mismatches as mismatch (mismatch.path)}
                <div class="verdict__mismatch">
                  <code class="verdict__path">{mismatch.path}</code>
                  <span class="verdict__want">{short(mismatch.expected)}</span>
                  <span class="verdict__arrow">←</span>
                  <span class="verdict__got">{short(mismatch.actual)}</span>
                </div>
              {/each}
            </div>
          {/if}

          {#if group.representative.calls.length > 0}
            <details class="verdict__raw">
              <summary>calls</summary>
              {#each group.representative.calls as call, index (index)}
                <pre class="verdict__raw-line">{call.functionName}({JSON.stringify(
                    call.arguments,
                  )}){call.ok === false ? ` ✕ ${call.error ?? ''}` : ''}</pre>
              {/each}
            </details>
          {:else if group.representative.content}
            <details class="verdict__raw">
              <summary>model said</summary>
              <p class="verdict__prose">{group.representative.content}</p>
            </details>
          {/if}

          {#if !verdict.pass && verdict.failure}
            <p class="verdict__remedy">{FAILURE_REMEDIES[verdict.failure]}</p>
          {/if}

          {#if !verdict.pass}
            <div class="verdict__links">
              {#each [...new Set([...verdict.expectedNames, ...verdict.actualNames])] as name (name)}
                <button
                  type="button"
                  class="verdict__link"
                  onclick={() => onopentool(name)}
                >
                  <Wrench size={9} />
                  {name}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    {/if}

    <button type="button" class="case-detail__delete" onclick={ondelete}>
      Delete case
    </button>
  </div>
</div>

<style>
  .case-detail {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
  }

  .case-detail__bar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.625rem;
    border-bottom: 1px solid color-mix(in oklab, currentColor 12%, transparent);
  }

  .case-detail__back {
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

  .case-detail__back:hover {
    opacity: 1;
  }

  .case-detail__rate {
    margin-left: auto;
    font-size: 0.6875rem;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .case-detail__rate--pass {
    color: oklch(var(--su));
  }

  .case-detail__rate--fail {
    color: oklch(var(--er));
  }

  .case-detail__rate--flaky {
    color: oklch(var(--wa));
  }

  .case-detail__action {
    gap: 0.1875rem;
  }

  .case-detail__body {
    display: flex;
    flex: 1 1 0;
    min-height: 0;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    padding: 0.625rem;
  }

  .case-detail__prompt {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .case-detail__expected {
    margin: 0;
    opacity: 0.7;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.6875rem;
  }

  .case-detail__mode {
    opacity: 0.7;
  }

  .case-detail__ran,
  .case-detail__unrun {
    margin: 0;
    opacity: 0.6;
    font-size: 0.6875rem;
  }

  .case-detail__drift {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
    padding: 0.5rem;
    border: 1px solid color-mix(in oklab, oklch(var(--wa)) 40%, transparent);
    border-radius: 0.5rem;
    background: color-mix(in oklab, oklch(var(--wa)) 8%, transparent);
    font-size: 0.6875rem;
  }

  .case-detail__drift-title {
    margin: 0;
    color: oklch(var(--wa));
    font-weight: 600;
  }

  .case-detail__drift-list {
    margin: 0;
    padding-left: 1rem;
  }

  .case-detail__drift-note {
    margin: 0;
    opacity: 0.75;
  }

  .case-detail__section-title {
    margin: 0 0 0.25rem;
    opacity: 0.6;
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .case-detail__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .case-detail__chip {
    display: inline-flex;
    align-items: center;
    gap: 0.1875rem;
    padding: 0.125rem 0.5rem;
    border: 1px solid color-mix(in oklab, currentColor 18%, transparent);
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.625rem;
    cursor: pointer;
  }

  .case-detail__chip:hover:not(:disabled) {
    border-color: color-mix(in oklab, currentColor 35%, transparent);
  }

  .verdict {
    display: flex;
    flex-direction: column;
    gap: 0.3125rem;
    padding: 0.5rem 0.625rem;
    border: 1px solid color-mix(in oklab, oklch(var(--er)) 30%, transparent);
    border-radius: 0.5rem;
    font-size: 0.6875rem;
  }

  .verdict.is-pass {
    border-color: color-mix(in oklab, oklch(var(--su)) 30%, transparent);
  }

  .verdict__head {
    display: flex;
    align-items: center;
    gap: 0.3125rem;
  }

  :global(.verdict__icon--ok) {
    color: oklch(var(--su));
  }

  :global(.verdict__icon--err) {
    color: oklch(var(--er));
  }

  .verdict__label {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-size: 0.625rem;
  }

  .verdict__count {
    margin-left: auto;
    opacity: 0.55;
    font-variant-numeric: tabular-nums;
  }

  .verdict__detail {
    margin: 0;
    opacity: 0.85;
    line-height: 1.4;
  }

  .verdict__calls {
    display: flex;
    flex-direction: column;
    gap: 0.1875rem;
    padding: 0.375rem 0.5rem;
    border-radius: 0.375rem;
    background: color-mix(in oklab, currentColor 6%, transparent);
  }

  .verdict__col {
    display: flex;
    gap: 0.375rem;
  }

  .verdict__col-label {
    flex-shrink: 0;
    width: 3.75rem;
    opacity: 0.5;
  }

  .verdict__col code {
    overflow-wrap: anywhere;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .verdict__col code.is-actual {
    color: oklch(var(--er));
  }

  .verdict__mismatches {
    display: flex;
    flex-direction: column;
    gap: 0.1875rem;
  }

  .verdict__mismatch {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.3125rem;
  }

  .verdict__path {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-weight: 600;
  }

  .verdict__want {
    color: oklch(var(--su));
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .verdict__arrow {
    opacity: 0.4;
  }

  .verdict__got {
    color: oklch(var(--er));
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    overflow-wrap: anywhere;
  }

  .verdict__raw summary {
    opacity: 0.55;
    cursor: pointer;
  }

  .verdict__raw-line {
    margin: 0.1875rem 0 0;
    overflow-x: auto;
    opacity: 0.75;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.625rem;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .verdict__prose {
    margin: 0.1875rem 0 0;
    opacity: 0.75;
    line-height: 1.4;
  }

  .verdict__remedy {
    margin: 0;
    padding-top: 0.3125rem;
    border-top: 1px solid color-mix(in oklab, currentColor 10%, transparent);
    opacity: 0.7;
    line-height: 1.4;
  }

  .verdict__links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .verdict__link {
    display: inline-flex;
    align-items: center;
    gap: 0.1875rem;
    padding: 0;
    border: none;
    background: transparent;
    color: oklch(var(--p));
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.625rem;
    cursor: pointer;
  }

  .verdict__link:hover {
    text-decoration: underline;
  }

  .case-detail__delete {
    align-self: flex-start;
    margin-top: 0.25rem;
    padding: 0;
    border: none;
    background: transparent;
    color: oklch(var(--er));
    opacity: 0.7;
    font-size: 0.6875rem;
    cursor: pointer;
  }

  .case-detail__delete:hover {
    opacity: 1;
  }
</style>
