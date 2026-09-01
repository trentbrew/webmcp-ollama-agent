<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../../cn';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className = '', children }: Props = $props();
</script>

<div class={cn('p-4 pt-0', className)}>
  {#if children}
    {@render children()}
  {/if}
</div>
