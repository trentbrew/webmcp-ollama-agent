<script lang="ts">
  import { MENU_ITEMS } from '../constants/menu';
  import { currentPage } from '../stores/navigation';
  import { navIndicators } from '../stores/navIndicators.svelte';
  import { mcpState } from '../webmcp/store.svelte';
  import { isChatBusy } from '../chat.svelte';
  import Icon from './Icon.svelte';
  import Button from './ui/Button.svelte';
  import { Loader, MessageCircle } from '../icons';

  const busy = $derived(isChatBusy());
  const onChatPage = $derived($currentPage === 'chat');

  const mcpBadge = $derived(
    (mcpState.state?.tools.length ?? 0) + navIndicators.otherTabsToolCount,
  );
  const traceBadge = $derived(
    mcpState.traces.length + navIndicators.otherTabsTraceCount,
  );

  function getPageForMenuItem(label: string): string {
    return label.toLowerCase();
  }

  function badgeForLabel(label: string): number {
    if (label === 'MCP') return mcpBadge;
    if (label === 'Traces') return traceBadge;
    return 0;
  }

  function showChatLoader(): boolean {
    return busy;
  }

  function showChatUnreadDot(): boolean {
    return !busy && navIndicators.chatUnread && !onChatPage;
  }
</script>

<aside
  class="flex-shrink-0 h-12 bg-base-300 px-3 w-full border-t border-base-content/10"
>
  <nav class="flex flex-row gap-1 justify-center items-center h-full">
    {#each MENU_ITEMS as item}
      {@const isActive = getPageForMenuItem(item.label) === $currentPage}
      {@const badge = badgeForLabel(item.label)}
      <Button
        variant={isActive ? 'secondary' : 'ghost'}
        size="icon"
        onclick={item.action}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
        class={isActive
          ? 'nav-tab--active bg-base-content/10 relative'
          : 'relative'}
      >
        {#if item.label === 'Chat'}
          {#if showChatLoader()}
            <Icon icon={Loader} size={18} class="text-current animate-spin" />
          {:else if showChatUnreadDot()}
            <span
              class="inline-block size-[10px] rounded-full bg-success"
              aria-label="Agent finished — new activity"
            ></span>
          {:else}
            <Icon icon={MessageCircle} size={18} class="text-current" />
          {/if}
        {:else}
          <Icon icon={item.icon} size={18} class="text-current" />
        {/if}
        {#if badge > 0}
          <span
            class="nav-badge absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 rounded-full bg-primary text-primary-content text-[0.6rem] font-semibold leading-4 text-center"
            aria-label="{badge} {item.label === 'MCP'
              ? 'tools'
              : 'traces'} on other tabs"
          >
            {badge > 99 ? '99+' : badge}
          </span>
        {/if}
        <span class="sr-only">{item.label}</span>
      </Button>
    {/each}
  </nav>
</aside>

<style>
  :global(.nav-tab--active) {
    box-shadow: inset 0 2px 0 0 oklch(var(--bc));
  }
</style>
