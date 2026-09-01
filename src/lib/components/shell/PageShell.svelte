<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import type { PageVariant } from './types';
  import { VARIANT_CONFIG } from './types';
  import PageHeader from './PageHeader.svelte';
  import PageBody from './PageBody.svelte';
  import { cn } from '../../cn';

  interface Props {
    variant?: PageVariant;
    title?: string;
    description?: string;
    icon?: Component;
    class?: string;
    hideHeader?: boolean;
    actions?: Snippet;
    toolbar?: Snippet;
    children?: Snippet;
  }

  let {
    variant = 'settings',
    title = '',
    description,
    icon,
    class: className = '',
    hideHeader = false,
    actions,
    toolbar,
    children,
  }: Props = $props();

  const config = $derived(VARIANT_CONFIG[variant]);
  const showHeader = $derived(!hideHeader && config.showHeader && Boolean(title));
</script>

<div class={cn('page-shell flex flex-col h-full min-h-0', className)}>
  {#if showHeader}
    <PageHeader {title} {description} {icon} {actions} {toolbar} />
  {/if}
  <PageBody {variant}>
    {#if children}
      {@render children()}
    {/if}
  </PageBody>
</div>
