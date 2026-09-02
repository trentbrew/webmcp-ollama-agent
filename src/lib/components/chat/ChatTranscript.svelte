<script lang="ts">
  import { chatSessionState, getChat } from '../../chat.svelte';
  import { currentPage } from '../../stores/navigation';
  import type { UIMessage } from '../../ai/protocol';
  import ChatMessage from './ChatMessage.svelte';

  const chat = $derived.by(() => {
    chatSessionState.activeTabId;
    chatSessionState.detached;
    const session = getChat();
    void session.messages.length;
    void session.status;
    return session;
  });

  const messages = $derived(chat.messages);

  /**
   * Group a flat message list into turns. A turn starts at a user message and
   * includes every message that follows it (assistant replies) until the next
   * user message. This lets a user prompt stick to the top of the thread while
   * you scroll through its own reply.
   */
  const turns = $derived.by(() => {
    const grouped: UIMessage[][] = [];
    for (const message of messages) {
      if (message.role === 'user' || grouped.length === 0) {
        grouped.push([message]);
      } else {
        grouped[grouped.length - 1].push(message);
      }
    }
    return grouped;
  });

  let viewport: HTMLDivElement | undefined;
  let stickToBottom = $state(true);

  function isAtBottom() {
    if (!viewport) return true;
    return (
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 48
    );
  }

  function handleScroll() {
    stickToBottom = isAtBottom();
  }

  $effect(() => {
    // Track message content and status so autoscroll fires on streaming deltas too.
    void messages.length;
    void messages.at(-1)?.parts.length;
    void chat.status;
    if (!viewport || !stickToBottom) return;
    queueMicrotask(() => {
      viewport?.scrollTo({ top: viewport.scrollHeight });
    });
  });

  $effect(() => {
    if ($currentPage !== 'chat') return;
    stickToBottom = true;
    queueMicrotask(() => {
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    });
  });
</script>

<div class="chat-thread-scroll" bind:this={viewport} onscroll={handleScroll}>
  <div class="chat-thread-messages">
    {#each turns as turn (turn[0].id)}
      <div class="chat-turn">
        {#each turn as message (message.id)}
          {#if message.role === 'user'}
            <div class="chat-turn-user">
              <ChatMessage
                {message}
                messages={chat.messages}
                chatStatus={chat.status}
              />
            </div>
          {:else}
            <ChatMessage
              {message}
              messages={chat.messages}
              chatStatus={chat.status}
            />
          {/if}
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .chat-thread-scroll {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .chat-thread-messages {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    width: 100%;
    max-width: 48rem;
    margin: 0 auto;
    padding: 1rem 16px 4rem;
  }

  .chat-turn {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }

  /* Keep each user prompt pinned to the top of the thread while its reply
     scrolls underneath. The sticky element's containing block is `.chat-turn`,
     so the prompt releases once the whole turn has scrolled past. */
  .chat-turn-user {
    position: sticky;
    top: 0;
    z-index: 20;
  }
</style>
