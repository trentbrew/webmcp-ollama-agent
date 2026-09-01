<script lang="ts">
  import { onMount } from 'svelte';
  import { MessageCircleDashed, RotateCw } from '../icons';
  import { chat, isChatBusy, resetChat } from '../chat.svelte';
  import {
    chatSettings,
    loadAvailableModels,
    syncChatPersistence,
  } from '../chat/settings.svelte';
  import ChatTranscript from '../components/chat/ChatTranscript.svelte';
  import ChatComposer from '../components/chat/ChatComposer.svelte';

  // Panes mode embeds its own composer; dock mode uses one persistent composer
  // rendered at the app shell, so it opts out here.
  let { showComposer = true }: { showComposer?: boolean } = $props();

  const messages = $derived(chat.messages);
  const busy = $derived(isChatBusy());
  const streaming = $derived(chat.status === 'streaming');
  const hasError = $derived(chat.status === 'error');

  onMount(() => {
    void loadAvailableModels();
  });

  $effect(() => {
    syncChatPersistence(chat.messages);
  });
</script>

<div class="chat-page">
  <div class="chat-page__toolbar">
    <span class="chat-page__count">{messages.length} messages</span>
    {#if streaming}
      <span class="chat-page__dot" aria-hidden="true">·</span>
      <span class="chat-page__detail">streaming…</span>
    {:else if hasError}
      <span class="chat-page__dot" aria-hidden="true">·</span>
      <span class="chat-page__detail chat-page__detail--error">{chat.error ?? 'error'}</span>
    {/if}
    <button
      type="button"
      class="chat-page__reset"
      aria-label="Reset conversation"
      disabled={busy}
      onclick={() => resetChat()}
    >
      <RotateCw size={13} />
    </button>
  </div>

  {#if messages.length === 0}
    <div class="chat-page__empty">
      <MessageCircleDashed size={28} class="chat-page__empty-icon" />
      <p class="chat-page__empty-title">How can I help?</p>
      <p class="chat-page__empty-subtitle">
        Ask a question or attach a file for context. Replies stream from local Ollama ({chatSettings.model}).
      </p>
    </div>
  {:else}
    <ChatTranscript />
  {/if}

  {#if showComposer}
    <ChatComposer />
  {/if}
</div>

<style>
  .chat-page {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
  }

  .chat-page__toolbar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    border-bottom: 1px solid color-mix(in oklab, currentColor 12%, transparent);
    font-size: 0.6875rem;
    opacity: 0.75;
  }

  .chat-page__count {
    flex-shrink: 0;
  }

  .chat-page__dot {
    opacity: 0.5;
  }

  .chat-page__detail {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chat-page__detail--error {
    color: oklch(var(--er));
    opacity: 1;
  }

  .chat-page__reset {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    margin-left: auto;
    border: none;
    border-radius: 0.375rem;
    background: transparent;
    color: inherit;
    opacity: 0.65;
    cursor: pointer;
  }

  .chat-page__reset:hover:not(:disabled) {
    opacity: 1;
    background: color-mix(in oklab, currentColor 8%, transparent);
  }

  .chat-page__reset:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .chat-page__empty {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    max-width: 22rem;
    margin: 0 auto;
    padding: 1.5rem;
    text-align: center;
  }

  :global(.chat-page__empty-icon) {
    opacity: 0.6;
  }

  .chat-page__empty-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 500;
  }

  .chat-page__empty-subtitle {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.5;
    opacity: 0.65;
  }
</style>
