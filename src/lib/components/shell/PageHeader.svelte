<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import Icon from '../Icon.svelte';
  import { cn } from '../../cn';

  interface Props {
    title: string;
    description?: string;
    icon?: Component;
    class?: string;
    actions?: Snippet;
    toolbar?: Snippet;
  }

  let {
    title,
    description,
    icon,
    class: className = '',
    actions,
    toolbar,
  }: Props = $props();
</script>

<header
  class={cn(
    'page-shell__header shrink-0 border-b border-base-content/10',
    className,
  )}
>
  <div
    class="flex items-start justify-between gap-2 px-3 py-2.5 min-h-[var(--shell-header-height)]"
  >
    <div class="flex items-start gap-2 min-w-0">
      <!-- {#if icon}
        <Icon {icon} size={18} class="text-primary shrink-0 mt-0.5" />
      {/if} -->
      <div class="min-w-0">
        <h1 class="text-base font-semibold tracking-tight truncate">{title}</h1>
        {#if description}
          <p class="text-xs text-base-content/60 mt-0.5 leading-snug">
            {description}
          </p>
        {/if}
      </div>
    </div>
    {#if actions}
      <div class="flex items-center gap-1 shrink-0">
        {@render actions()}
      </div>
    {/if}
  </div>
  {#if toolbar}
    <div class="px-3 pb-2 border-t border-base-content/5">
      {@render toolbar()}
    </div>
  {/if}
</header>
