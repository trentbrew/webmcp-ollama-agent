<script lang="ts">
  import { onMount } from 'svelte';
  import { theme, initializeTheme } from './lib/stores/theme';
  import { currentPage } from './lib/stores/navigation';
  import { layoutMode } from './lib/stores/layout';

  import ThemeController from './lib/components/ThemeController.svelte';
  import Nav from './lib/components/Nav.svelte';
  import LayoutWrapper from './lib/components/LayoutWrapper.svelte';
  import ChatComposer from './lib/components/chat/ChatComposer.svelte';
  import { loadAvailableModels } from './lib/chat/settings.svelte';
  import { initChatSessionTracking } from './lib/chat.svelte';
  import { initBrowserContextTracking } from './lib/browser/context.svelte';
  import { initMcpTracking } from './lib/webmcp/store.svelte';

  // Pages
  import HomePage from './lib/pages/HomePage.svelte';
  import ChatPage from './lib/pages/ChatPage.svelte';
  import McpPage from './lib/pages/McpPage.svelte';
  import TracesPage from './lib/pages/TracesPage.svelte';
  import TrellisPage from './lib/pages/TrellisPage.svelte';
  import SettingsPage from './lib/pages/SettingsPage.svelte';
  import HelpPage from './lib/pages/HelpPage.svelte';
  import ComponentsDemo from './lib/pages/ComponentsDemo.svelte';

  onMount(() => {
    initializeTheme();
    // Composer is persistent in dock mode, so make sure the model catalog is
    // ready even before the chat page has been visited.
    void loadAvailableModels();
    initBrowserContextTracking();
    initMcpTracking();
    void initChatSessionTracking();
  });
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
        {:else if $currentPage === 'mcp'}
          <McpPage />
        {:else if $currentPage === 'traces'}
          <TracesPage />
        {:else}
          <div class="h-full overflow-y-auto p-4">
            <!-- Theme Switcher -->
            <div class="flex justify-end mb-4">
              <ThemeController />
            </div>

            <!-- Page Content -->
            <div class="max-w-4xl mx-auto">
              {#if $currentPage === 'home'}
                <HomePage />
              {:else if $currentPage === 'trellis'}
                <TrellisPage />
              {:else if $currentPage === 'settings'}
                <SettingsPage />
              {:else if $currentPage === 'help'}
                <HelpPage />
              {:else if $currentPage === 'components'}
                <ComponentsDemo />
              {/if}
            </div>
          </div>
        {/if}
      </main>

      <!-- Persistent chat input, available on every page -->
      <ChatComposer onSend={() => currentPage.set('chat')} />

      <!-- Navigation -->
      <Nav />
    {/if}
  </div>
</div>
