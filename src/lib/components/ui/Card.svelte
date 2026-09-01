<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../../cn';

  interface Props {
    class?: string;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { class: className = '', children, ...rest }: Props = $props();
</script>

<div class={cn('shell-card rounded text-base-content', className)} {...rest}>
  {#if children}
    {@render children()}
  {/if}
</div>
