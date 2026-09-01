<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { PageVariant } from './types';
  import { VARIANT_CONFIG } from './types';
  import { cn } from '../../cn';

  interface Props {
    variant: PageVariant;
    class?: string;
    children?: Snippet;
  }

  let { variant, class: className = '', children }: Props = $props();

  const config = $derived(VARIANT_CONFIG[variant]);
  const bodyClass = $derived(
    cn(
      'page-shell__body flex-1 min-h-0',
      config.scroll ? 'overflow-y-auto' : 'overflow-hidden flex flex-col',
      config.padding,
      className,
    ),
  );
</script>

<div class={bodyClass}>
  {#if children}
    {@render children()}
  {/if}
</div>
