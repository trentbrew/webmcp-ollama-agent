<script lang="ts">
  import { cn } from '../../cn';

  interface Props {
    checked?: boolean;
    disabled?: boolean;
    class?: string;
    id?: string;
    onchange?: (event: Event) => void;
  }

  let {
    checked = $bindable(false),
    disabled = false,
    class: className = '',
    id,
    onchange,
  }: Props = $props();
</script>

<label class={cn('inline-flex items-center cursor-pointer', disabled && 'opacity-50 cursor-not-allowed', className)}>
  <input type="checkbox" role="switch" class="sr-only" {id} bind:checked {disabled} {onchange} />
  <span
    class={cn(
      'relative h-5 w-9 rounded-full transition-colors',
      checked ? 'bg-primary' : 'bg-base-content/20',
    )}
    aria-hidden="true"
  >
    <span
      class={cn(
        'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-base-100 transition-transform',
        checked && 'translate-x-4',
      )}
    ></span>
  </span>
</label>
