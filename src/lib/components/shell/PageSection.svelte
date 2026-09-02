<script lang="ts">
  import type { Snippet } from 'svelte';
  import Card from '../ui/Card.svelte';
  import CardHeader from '../ui/CardHeader.svelte';
  import CardTitle from '../ui/CardTitle.svelte';
  import CardDescription from '../ui/CardDescription.svelte';
  import CardContent from '../ui/CardContent.svelte';
  import { cn } from '../../cn';

  interface Props {
    title?: string;
    description?: string;
    class?: string;
    children?: Snippet;
    actions?: Snippet;
  }

  let {
    title,
    description,
    class: className = '',
    children,
    actions,
  }: Props = $props();
</script>

<Card class={cn('shell-card', className)}>
  {#if title || description || actions}
    <CardHeader
      class="flex-row items-start justify-between gap-2 space-y-0 pb-3"
    >
      <div class="space-y-1">
        {#if title}
          <CardTitle>{title}</CardTitle>
        {/if}
        {#if description}
          <CardDescription>{description}</CardDescription>
        {/if}
      </div>
      {#if actions}
        <div class="flex items-center gap-1 shrink-0">
          {@render actions()}
        </div>
      {/if}
    </CardHeader>
  {/if}
  <CardContent class={title || description ? '' : 'pt-4'}>
    {#if children}
      {@render children()}
    {/if}
  </CardContent>
</Card>
