<script lang="ts">
  import { cn } from '../../cn';

  interface Props {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    class?: string;
    id?: string;
    title?: string;
    oninput?: (event: Event) => void;
    ondblclick?: (event: MouseEvent) => void;
  }

  let {
    value = $bindable(0),
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    class: className = '',
    id,
    title,
    oninput,
    ondblclick,
  }: Props = $props();
</script>

<input
  type="range"
  {id}
  {min}
  {max}
  {step}
  {disabled}
  {title}
  bind:value
  {oninput}
  {ondblclick}
  class={cn(
    'shell-slider w-full h-1.5 cursor-ew-resize appearance-none rounded-full',
    'bg-base-content/15 accent-primary',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    className,
  )}
/>
