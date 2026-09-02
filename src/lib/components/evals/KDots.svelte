<script lang="ts">
  import type { CaseResult } from '../../evals/protocol';

  let {
    result,
    runs = 3,
  }: { result: CaseResult | undefined; runs?: number } = $props();

  const dots = $derived.by(() => {
    if (!result || result.attempts.length === 0) {
      return Array.from({ length: runs }, () => 'unrun' as const);
    }
    return result.attempts.map((attempt) =>
      attempt.verdict.pass ? ('pass' as const) : ('fail' as const),
    );
  });

  const label = $derived(
    result && result.runCount > 0
      ? `${result.passCount} of ${result.runCount} runs passed`
      : 'Not run yet',
  );
</script>

<span class="kdots" title={label} aria-label={label}>
  {#each dots as state, index (index)}
    <span class="kdots__dot kdots__dot--{state}"></span>
  {/each}
</span>

<style>
  .kdots {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.1875rem;
  }

  .kdots__dot {
    width: 0.4375rem;
    height: 0.4375rem;
    border-radius: 999px;
  }

  .kdots__dot--pass {
    background: oklch(var(--su));
  }

  .kdots__dot--fail {
    background: oklch(var(--er));
  }

  .kdots__dot--unrun {
    border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
    background: transparent;
  }
</style>
