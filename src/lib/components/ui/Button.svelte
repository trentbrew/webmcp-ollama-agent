<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../../cn';

  type ButtonVariant =
    | 'default'
    | 'outline'
    | 'ghost'
    | 'destructive'
    | 'secondary'
    | 'primary'
    | 'accent'
    | 'error'
    | 'neutral';
  type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

  interface Props {
    variant?: ButtonVariant;
    size?: ButtonSize;
    disabled?: boolean;
    class?: string;
    onclick?: (event: MouseEvent) => void;
    type?: 'button' | 'submit' | 'reset';
    children?: Snippet;
    [key: string]: unknown;
  }

  let {
    variant = 'default',
    size = 'md',
    disabled = false,
    class: className = '',
    onclick,
    type = 'button',
    children,
    ...rest
  }: Props = $props();

  const normalizedVariant = $derived(
    ({
      primary: 'default',
      accent: 'secondary',
      error: 'destructive',
      neutral: 'ghost',
    } as Record<string, ButtonVariant>)[variant] ?? variant,
  );

  const variantClasses: Record<ButtonVariant, string> = {
    default: 'bg-primary text-primary-content hover:bg-primary/90 border border-transparent',
    outline: 'border border-base-content/20 bg-transparent hover:bg-base-content/5',
    ghost: 'bg-transparent hover:bg-base-content/8 border border-transparent',
    destructive: 'bg-error text-error-content hover:bg-error/90 border border-transparent',
    secondary: 'bg-base-content/8 hover:bg-base-content/12 border border-transparent',
    primary: 'bg-primary text-primary-content hover:bg-primary/90 border border-transparent',
    accent: 'bg-base-content/8 hover:bg-base-content/12 border border-transparent',
    error: 'bg-error text-error-content hover:bg-error/90 border border-transparent',
    neutral: 'bg-transparent hover:bg-base-content/8 border border-transparent',
  };

  const sizeClasses: Record<ButtonSize, string> = {
    xs: 'h-6 px-2 text-[0.65rem] rounded',
    sm: 'h-7 px-2.5 text-xs rounded',
    md: 'h-8 px-3 text-xs rounded',
    lg: 'h-9 px-4 text-sm rounded',
    icon: 'h-8 w-8 p-0 rounded',
  };

  const classes = $derived(
    cn(
      'inline-flex items-center justify-center gap-1.5 font-medium transition-colors',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
      'disabled:pointer-events-none disabled:opacity-50',
      variantClasses[normalizedVariant],
      sizeClasses[size],
      className,
    ),
  );
</script>

<button {type} class={classes} {disabled} {onclick} {...rest}>
  {#if children}
    {@render children()}
  {/if}
</button>
