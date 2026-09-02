<script lang="ts">
  import { MessageCircleDashed } from '../../icons';
  import McpLogo from '../icons/McpLogo.svelte';
  import { isChatBusy, sendChatMessage } from '../../chat.svelte';
  import OllamaOffline from './OllamaOffline.svelte';
  import { chatModelCatalog, chatSettings } from '../../chat/settings.svelte';
  import {
    buildChatSuggestions,
    emptyStateSubtitle,
  } from '../../chat/suggestions';
  import { mcpState } from '../../webmcp/store.svelte';

  const pageTools = $derived(mcpState.state?.tools ?? []);
  const detected = $derived(mcpState.state?.detected ?? false);
  const invokableCount = $derived(
    pageTools.filter((tool) => tool.invokable).length,
  );
  const suggestions = $derived(buildChatSuggestions(pageTools, { detected }));
  const subtitle = $derived(
    emptyStateSubtitle(invokableCount, detected, chatSettings.model),
  );
  const busy = $derived(isChatBusy());

  async function handleSelect(prompt: string) {
    if (busy) return;
    await sendChatMessage({ text: prompt });
  }
</script>

<!-- With no reachable model host the suggestion pills are dead ends -- every one of them
     sends a message that can only fail -- so the offline state replaces them entirely. -->
{#if chatModelCatalog.unavailable}
  <OllamaOffline />
{:else}
  <div class="chat-empty">
    {#if invokableCount > 0}
      <McpLogo size={24} class="chat-empty__icon chat-empty__icon--active" />
    {:else}
      <MessageCircleDashed size={24} class="chat-empty__icon" />
    {/if}

    <p class="chat-empty__title">
      {#if invokableCount > 0}
        {invokableCount} tool{invokableCount === 1 ? '' : 's'} ready
      {:else if detected}
        WebMCP detected
      {:else}
        How can I help?
      {/if}
    </p>

    <p class="chat-empty__subtitle">{subtitle}</p>

    <div
      class="chat-empty__suggestions"
      role="group"
      aria-label="Suggested prompts"
    >
      {#each suggestions as suggestion (suggestion.id)}
        <button
          type="button"
          class="semantic-pill"
          class:semantic-pill--neutral={suggestion.variant === 'default'}
          class:semantic-pill--success={suggestion.variant === 'tool'}
          disabled={busy}
          onclick={() => void handleSelect(suggestion.prompt)}
        >
          {suggestion.label}
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .chat-empty {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    max-width: 32rem;
    margin: 0 auto;
    padding: 1.25rem 1.5rem 2rem;
    text-align: center;
  }

  :global(.chat-empty__icon) {
    opacity: 0.55;
  }

  :global(.chat-empty__icon--active) {
    opacity: 0.85;
  }

  .chat-empty__title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 500;
  }

  .chat-empty__subtitle {
    margin: 0;
    max-width: 22rem;
    font-size: 0.8125rem;
    line-height: 1.45;
    opacity: 0.6;
  }

  .chat-empty__suggestions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.875rem;
  }
</style>
