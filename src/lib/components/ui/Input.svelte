<script lang="ts">
  import { cn } from '../../cn';

  interface Props {
    type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
    value?: string | number;
    placeholder?: string;
    disabled?: boolean;
    class?: string;
    id?: string;
    name?: string;
    required?: boolean;
    oninput?: (e: Event) => void;
  }

  let {
    type = 'text',
    value = $bindable(''),
    placeholder = '',
    disabled = false,
    class: className = '',
    id,
    name,
    required = false,
    oninput,
    ...rest
  }: Props = $props();
</script>

<input
  {type}
  bind:value
  {placeholder}
  {disabled}
  {id}
  {name}
  {required}
  {oninput}
  class={cn(
    'flex h-8 w-full rounded border border-base-content/20 bg-base-100 px-2.5 text-xs',
    'placeholder:text-base-content/40',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    'disabled:cursor-not-allowed disabled:opacity-50',
    className,
  )}
  {...rest}
/>
