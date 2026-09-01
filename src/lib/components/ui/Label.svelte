<script lang="ts">
  import { cn } from '../../cn';

  interface Props {
    class?: string;
    for?: string;
    children?: import('svelte').Snippet;
  }

  let { class: className = '', for: htmlFor, children }: Props = $props();
</script>

<label class={cn('text-sm font-medium leading-none', className)} for={htmlFor}>
  {#if children}
    {@render children()}
  {/if}
</label>
