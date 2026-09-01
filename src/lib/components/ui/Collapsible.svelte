<script lang="ts">
  import { slide } from 'svelte/transition';
  import { ChevronDown } from '../../icons';
  import Icon from '../Icon.svelte';
  import { cn } from '../../cn';
  import type { Snippet } from 'svelte';

  interface Props {
    open?: boolean;
    title: string;
    class?: string;
    children?: Snippet;
  }

  let {
    open = $bindable(false),
    title,
    class: className = '',
    children,
  }: Props = $props();

  function toggle() {
    open = !open;
  }
</script>

<div class={cn('shell-card rounded overflow-hidden', className)}>
  <button
    type="button"
    class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium hover:bg-base-content/5 transition-colors"
    aria-expanded={open}
    onclick={toggle}
  >
    <span>{title}</span>
    <Icon
      icon={ChevronDown}
      size={16}
      class={cn('shrink-0 opacity-60 transition-transform', open && 'rotate-180')}
    />
  </button>
  {#if open}
    <div class="border-t border-base-content/10 px-3 py-2.5 text-sm text-base-content/80" transition:slide={{ duration: 150 }}>
      {#if children}
        {@render children()}
      {/if}
    </div>
  {/if}
</div>
