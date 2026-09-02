<script lang="ts">
  import { ChevronRight, Loader, Play } from '../../icons';
  import { summarizeExpected } from '../../evals/format';
  import {
    dominantFailure,
    resultStatus,
    FAILURE_LABELS,
    type CaseResult,
    type EvalCase,
  } from '../../evals/protocol';
  import { describeDrift, hasDrift, isBlockingDrift } from '../../evals/surface';
  import { flattenExpected } from '../../evals/scoring';
  import KDots from './KDots.svelte';

  let {
    evalCase,
    result,
    runs,
    busy = false,
    onopen,
    onrun,
  }: {
    evalCase: EvalCase;
    result: CaseResult | undefined;
    runs: number;
    busy?: boolean;
    onopen: () => void;
    onrun: () => void;
  } = $props();

  const status = $derived(resultStatus(result));
  const failure = $derived(dominantFailure(result));
  const expectedNames = $derived(
    flattenExpected(evalCase.expected).map((leaf) => leaf.functionName),
  );
  const blockingDrift = $derived(
    hasDrift(result?.drift) && isBlockingDrift(result?.drift, expectedNames),
  );
  const driftSummary = $derived(
    result?.drift ? describeDrift(result.drift).join(' · ') : '',
  );
</script>

<div class="case-card" class:is-busy={busy}>
  <button type="button" class="case-card__main" onclick={onopen}>
    <span class="case-card__row">
      {#if busy}
        <Loader size={12} class="case-card__spinner" />
      {:else}
        <KDots {result} {runs} />
      {/if}
      <span class="case-card__prompt">{evalCase.prompt || 'Untitled case'}</span>
      <ChevronRight size={13} class="case-card__chevron" />
    </span>

    <span class="case-card__expected">
      {summarizeExpected(evalCase.expected) || 'no expected calls'}
    </span>

    {#if blockingDrift}
      <span class="case-card__drift">⌁ surface drift — {driftSummary}</span>
    {/if}
  </button>

  <div class="case-card__footer">
    <span class="case-card__tag">{evalCase.kind}</span>
    {#if evalCase.setup.length > 0}
      <span class="case-card__tag">{evalCase.setup.length}-step prelude</span>
    {/if}
    {#if status !== 'unrun' && result}
      <span class="case-card__rate case-card__rate--{status}">
        {result.passCount}/{result.runCount}
      </span>
    {/if}
    {#if failure}
      <span class="case-card__failure">{FAILURE_LABELS[failure]}</span>
    {/if}
    <button
      type="button"
      class="case-card__run semantic-pill semantic-pill--success"
      disabled={busy}
      title="Run this case"
      onclick={onrun}
    >
      <Play size={10} />
      Run
    </button>
  </div>
</div>

<style>
  .case-card {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.5rem 0.625rem;
    border: 1px solid color-mix(in oklab, currentColor 12%, transparent);
    border-radius: 0.5rem;
  }

  .case-card.is-busy {
    border-color: color-mix(in oklab, oklch(var(--p)) 45%, transparent);
  }

  .case-card__main {
    display: flex;
    flex-direction: column;
    gap: 0.1875rem;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .case-card__row {
    display: flex;
    align-items: center;
    gap: 0.4375rem;
  }

  :global(.case-card__spinner) {
    flex-shrink: 0;
    color: oklch(var(--p));
    animation: case-card-spin 1s linear infinite;
  }

  @keyframes case-card-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .case-card__prompt {
    flex: 1 1 auto;
    overflow: hidden;
    font-size: 0.8125rem;
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  :global(.case-card__chevron) {
    flex-shrink: 0;
    opacity: 0.35;
  }

  .case-card__expected {
    display: block;
    overflow: hidden;
    opacity: 0.7;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.6875rem;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .case-card__drift {
    display: block;
    overflow: hidden;
    color: oklch(var(--wa));
    font-size: 0.625rem;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .case-card__footer {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.625rem;
  }

  .case-card__tag {
    padding: 0 0.375rem;
    border-radius: 999px;
    background: color-mix(in oklab, currentColor 10%, transparent);
    opacity: 0.75;
  }

  .case-card__rate {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .case-card__rate--pass {
    color: oklch(var(--su));
  }

  .case-card__rate--fail {
    color: oklch(var(--er));
  }

  .case-card__rate--flaky {
    color: oklch(var(--wa));
  }

  .case-card__failure {
    overflow: hidden;
    opacity: 0.7;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .case-card__run {
    gap: 0.1875rem;
    margin-left: auto;
    flex-shrink: 0;
  }
</style>
