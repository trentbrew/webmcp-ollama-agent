<script lang="ts">
  import { cn } from '../../cn';

  interface Props {
    class?: string;
    orientation?: 'horizontal' | 'vertical';
  }

  let { class: className = '', orientation = 'horizontal' }: Props = $props();
</script>

<hr
  class={cn(
    'shrink-0 border-0 border-base-content/10',
    orientation === 'horizontal' ? 'h-px w-full border-t' : 'h-full w-px border-l',
    className,
  )}
/>
