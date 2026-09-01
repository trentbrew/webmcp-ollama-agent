<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../../cn';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className = '', children }: Props = $props();
</script>

<h3 class={cn('text-sm font-semibold leading-none tracking-tight', className)}>
  {#if children}
    {@render children()}
  {/if}
</h3>
