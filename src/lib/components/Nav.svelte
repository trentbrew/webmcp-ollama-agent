<script lang="ts">
  import { MENU_ITEMS } from '../constants/menu';
  import { currentPage } from '../stores/navigation';
  import Icon from './Icon.svelte';
  import Button from './ui/Button.svelte';

  function getPageForMenuItem(label: string): string {
    return label.toLowerCase();
  }
</script>

<aside class="flex-shrink-0 h-12 bg-base-300 px-3 w-full border-t border-base-content/10">
  <nav class="flex flex-row gap-1 justify-center items-center h-full">
    {#each MENU_ITEMS as item}
      {@const isActive = getPageForMenuItem(item.label) === $currentPage}
      <Button
        variant={isActive ? 'secondary' : 'ghost'}
        size="icon"
        onclick={item.action}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
        class={isActive ? 'bg-base-content/10' : ''}
      >
        <Icon icon={item.icon} size={18} class="text-current" />
        <span class="sr-only">{item.label}</span>
      </Button>
    {/each}
  </nav>
</aside>
