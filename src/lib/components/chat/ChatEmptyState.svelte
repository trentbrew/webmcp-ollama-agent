<script lang="ts">
  import { MessageCircleDashed, Radar, Terminal, Wrench } from '../../icons';
  import { isChatBusy, sendChatMessage } from '../../chat.svelte';
  import { chatSettings } from '../../chat/settings.svelte';
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

<div class="chat-empty">
  {#if invokableCount > 0}
    <Radar size={28} class="chat-empty__icon chat-empty__icon--active" />
  {:else}
    <MessageCircleDashed size={28} class="chat-empty__icon" />
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
        class="chat-empty__suggestion"
        disabled={busy}
        onclick={() => void handleSelect(suggestion.prompt)}
      >
        {#if suggestion.id.startsWith('tool:')}
          <Wrench size={14} class="chat-empty__suggestion-icon" />
        {:else}
          <Terminal size={14} class="chat-empty__suggestion-icon" />
        {/if}
        <span class="chat-empty__suggestion-text">
          <span class="chat-empty__suggestion-label">{suggestion.label}</span>
          <span class="chat-empty__suggestion-desc"
            >{suggestion.description}</span
          >
        </span>
      </button>
    {/each}
  </div>
</div>

<style>
  .chat-empty {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    width: 100%;
    max-width: 28rem;
    margin: 0 auto;
    padding: 1.5rem;
    text-align: center;
  }

  :global(.chat-empty__icon) {
    opacity: 0.6;
  }

  :global(.chat-empty__icon--active) {
    opacity: 0.85;
    color: oklch(var(--su));
  }

  .chat-empty__title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 500;
  }

  .chat-empty__subtitle {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.5;
    opacity: 0.65;
  }

  .chat-empty__suggestions {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 0.375rem;
    margin-top: 0.75rem;
    text-align: left;
  }

  .chat-empty__suggestion {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid color-mix(in oklab, currentColor 12%, transparent);
    border-radius: 0.5rem;
    background: color-mix(in oklab, currentColor 4%, transparent);
    color: inherit;
    cursor: pointer;
    transition:
      border-color 150ms ease,
      background 150ms ease;
  }

  .chat-empty__suggestion:hover:not(:disabled) {
    border-color: color-mix(in oklab, currentColor 22%, transparent);
    background: color-mix(in oklab, currentColor 8%, transparent);
  }

  .chat-empty__suggestion:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  :global(.chat-empty__suggestion-icon) {
    flex-shrink: 0;
    margin-top: 0.125rem;
    opacity: 0.65;
  }

  .chat-empty__suggestion-text {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.125rem;
  }

  .chat-empty__suggestion-label {
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .chat-empty__suggestion-desc {
    font-size: 0.75rem;
    line-height: 1.4;
    opacity: 0.65;
  }
</style>
