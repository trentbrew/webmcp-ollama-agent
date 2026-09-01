<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../../cn';

  type BadgeVariant = 'default' | 'outline' | 'secondary' | 'primary' | 'success' | 'error';

  interface Props {
    variant?: BadgeVariant;
    class?: string;
    children?: Snippet;
  }

  let { variant = 'default', class: className = '', children }: Props = $props();

  const variantClasses: Record<BadgeVariant, string> = {
    default: 'bg-primary text-primary-content border-transparent',
    outline: 'border border-base-content/20 text-base-content bg-transparent',
    secondary: 'bg-base-content/10 text-base-content border-transparent',
    primary: 'bg-primary text-primary-content border-transparent',
    success: 'bg-success text-success-content border-transparent',
    error: 'bg-error text-error-content border-transparent',
  };
</script>

<span
  class={cn(
    'inline-flex items-center rounded px-1.5 py-0.5 text-[0.65rem] font-medium',
    variantClasses[variant],
    className,
  )}
>
  {#if children}
    {@render children()}
  {/if}
</span>
