<script lang="ts">
  import { onMount } from 'svelte';
  import { RotateCw, X } from '../icons';
  import {
    chatSessionState,
    exitDetachedArchive,
    getChat,
    isChatBusy,
    resetChat,
  } from '../chat.svelte';
  import {
    loadAvailableModels,
    syncChatPersistence,
  } from '../chat/settings.svelte';
  import { browserContext } from '../browser/context.svelte';
  import ChatEmptyState from '../components/chat/ChatEmptyState.svelte';
  import ChatTranscript from '../components/chat/ChatTranscript.svelte';
  import ChatComposer from '../components/chat/ChatComposer.svelte';

  // Panes mode embeds its own composer; dock mode uses one persistent composer
  // rendered at the app shell, so it opts out here.
  let { showComposer = true }: { showComposer?: boolean } = $props();

  const chat = $derived.by(() => {
    chatSessionState.activeTabId;
    chatSessionState.detached;
    const session = getChat();
    void session.messages.length;
    void session.status;
    void session.error;
    return session;
  });

  const messages = $derived(chat.messages);
  const busy = $derived(isChatBusy());
  const streaming = $derived(chat.status === 'streaming');
  const hasError = $derived(chat.status === 'error');

  const activeTab = $derived(browserContext.activeTab);
  const isDetached = $derived(chatSessionState.detached != null);
  const toolbarTitle = $derived(
    isDetached
      ? chat.title || hostFromUrl(chat.url) || 'Archived conversation'
      : activeTab?.title || hostFromUrl(activeTab?.url) || 'No active tab',
  );
  const toolbarHost = $derived(
    isDetached ? hostFromUrl(chat.url) : hostFromUrl(activeTab?.url),
  );

  function hostFromUrl(url: string | null | undefined): string {
    if (!url) return '';
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  onMount(() => {
    void loadAvailableModels();
  });

  $effect(() => {
    void chat.messages.length;
    void chatSessionState.activeTabId;
    void chatSessionState.detached;
    syncChatPersistence();
  });
</script>

<div class="chat-page">
  <div class="chat-page__toolbar">
    {#if !isDetached && activeTab?.favIconUrl}
      <img class="chat-page__favicon" src={activeTab.favIconUrl} alt="" />
    {/if}
    <span class="chat-page__title truncate" title={toolbarTitle}
      >{toolbarTitle}</span
    >
    {#if toolbarHost}
      <span class="chat-page__host truncate">{toolbarHost}</span>
    {/if}
    {#if isDetached}
      <span class="chat-page__badge">archived</span>
      <button
        type="button"
        class="chat-page__dismiss"
        aria-label="Return to active tab"
        disabled={busy}
        onclick={() => void exitDetachedArchive()}
      >
        <X size={12} />
      </button>
    {/if}
    <span class="chat-page__count"
      >{messages.length} msg{messages.length === 1 ? '' : 's'}</span
    >
    {#if streaming}
      <span class="chat-page__dot" aria-hidden="true">·</span>
      <span class="chat-page__detail">streaming…</span>
    {:else if hasError}
      <span class="chat-page__dot" aria-hidden="true">·</span>
      <span class="chat-page__detail chat-page__detail--error"
        >{chat.error ?? 'error'}</span
      >
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
    <ChatEmptyState />
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
    color: oklch(var(--bc));
    background-color: oklch(var(--b3));
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
    background: transparent;
  }

  .chat-page__favicon {
    width: 0.875rem;
    height: 0.875rem;
    flex-shrink: 0;
    border-radius: 0.125rem;
  }

  .chat-page__title {
    min-width: 0;
    max-width: 10rem;
    font-weight: 600;
    color: oklch(var(--bc) / 0.85);
  }

  .chat-page__host {
    min-width: 0;
    max-width: 6rem;
    opacity: 0.7;
  }

  .chat-page__badge {
    flex-shrink: 0;
    padding: 0.0625rem 0.375rem;
    border-radius: 999px;
    background: color-mix(in oklab, currentColor 10%, transparent);
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .chat-page__dismiss {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border: none;
    border-radius: 0.25rem;
    background: transparent;
    color: inherit;
    opacity: 0.65;
    cursor: pointer;
  }

  .chat-page__dismiss:hover:not(:disabled) {
    opacity: 1;
    background: color-mix(in oklab, currentColor 8%, transparent);
  }

  .chat-page__dismiss:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .chat-page__count {
    flex-shrink: 0;
    margin-left: auto;
    font-variant-numeric: tabular-nums;
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
</style>
