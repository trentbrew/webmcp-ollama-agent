<script lang="ts">
  import { MENU_ITEMS } from '../constants/menu';
  import { currentPage } from '../stores/navigation';
  import Icon from './Icon.svelte';

  function getPageForMenuItem(label: string): string {
    return label.toLowerCase();
  }
</script>

<aside
  class="flex-shrink-0 h-12 bg-base-300 px-3 w-full border-t border-base-300"
>
  <nav class="flex flex-row gap-2 justify-center items-center h-full">
    {#each MENU_ITEMS as item}
      {@const isActive = getPageForMenuItem(item.label) === $currentPage}
      <button
        class="btn btn-ghost btn-sm btn-square {isActive ? 'btn-active' : ''}"
        onclick={item.action}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon icon={item.icon} size={20} class="text-current" />
        <span class="sr-only">{item.label}</span>
      </button>
    {/each}
  </nav>
</aside>
