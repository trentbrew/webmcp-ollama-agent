<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../../cn';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className = '', children }: Props = $props();
</script>

<div class={cn('flex flex-col space-y-1 p-4 pb-0', className)}>
  {#if children}
    {@render children()}
  {/if}
</div>
