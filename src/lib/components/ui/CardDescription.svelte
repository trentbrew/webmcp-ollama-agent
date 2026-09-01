<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../../cn';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className = '', children }: Props = $props();
</script>

<p class={cn('text-xs text-base-content/60', className)}>
  {#if children}
    {@render children()}
  {/if}
</p>
