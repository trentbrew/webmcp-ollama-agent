<script lang="ts">
  import { onMount } from 'svelte';
  import { theme, initializeTheme } from './lib/stores/theme';
  import { currentPage } from './lib/stores/navigation';
  import { layoutMode } from './lib/stores/layout';

  import Nav from './lib/components/Nav.svelte';
  import LayoutWrapper from './lib/components/LayoutWrapper.svelte';
  import ChatComposer from './lib/components/chat/ChatComposer.svelte';
  import QuestionnaireDock from './lib/components/chat/QuestionnaireDock.svelte';
  import { ShellPageHost } from './lib/components/shell';
  import { loadAvailableModels } from './lib/chat/settings.svelte';
  import { initChatSessionTracking } from './lib/chat.svelte';
  import { initBrowserContextTracking, browserContext } from './lib/browser/context.svelte';
  import { initMcpTracking } from './lib/webmcp/store.svelte';
  import { checkAutoSync } from './lib/theme/pageTheme.svelte';

  import ChatPage from './lib/pages/ChatPage.svelte';
  import { getPageShellMeta } from './lib/components/shell';

  onMount(() => {
    initializeTheme();
    void loadAvailableModels();
    initBrowserContextTracking();
    initMcpTracking();
    void initChatSessionTracking();
  });

  $effect(() => {
    void browserContext.activeTab?.id;
    void browserContext.activeTab?.url;
    checkAutoSync();
  });

  const shellMeta = $derived(getPageShellMeta($currentPage));
</script>

<div class="h-screen bg-base-300" data-theme={$theme}>
  <div class="flex flex-col h-full">
    {#if $layoutMode === 'panes'}
      <main class="flex-1 min-h-0">
        <LayoutWrapper />
      </main>
    {:else}
      <main class="flex-1 min-h-0 overflow-hidden">
        {#if $currentPage === 'chat'}
          <ChatPage showComposer={false} />
        {:else if shellMeta}
          <ShellPageHost page={$currentPage} />
        {/if}
      </main>
      <QuestionnaireDock />
      <ChatComposer onSend={() => currentPage.set('chat')} />
      <Nav />
    {/if}
  </div>
</div>
