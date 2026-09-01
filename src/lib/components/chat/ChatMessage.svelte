<script lang="ts">
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { Check, Copy, File as FileIcon } from '../../icons';
  import {
    formatMessageTime,
    getActiveAssistantStatusLabel,
    getMessageCompletionTime,
    getMessageReasoning,
    getReasoningDurationSeconds,
    getMessageText,
    getMessageTimestamp,
    isMessageStreaming,
  } from '../../ai/messages';
  import type { ChatStatus, UIMessage } from '../../ai/protocol';
  import { renderMarkdown } from '../../chat/markdown';
  import ThinkingBlock from './ThinkingBlock.svelte';
  import ToolCallCard from './ToolCallCard.svelte';

  let {
    message,
    messages = [] as UIMessage[],
    chatStatus = 'ready' as ChatStatus,
  }: {
    message: UIMessage;
    messages?: UIMessage[];
    chatStatus?: ChatStatus;
  } = $props();

  const text = $derived(getMessageText(message));
  const reasoning = $derived(getMessageReasoning(message));
  const reasoningDuration = $derived(getReasoningDurationSeconds(message));
  const files = $derived(message.parts.filter((part) => part.type === 'file'));
  const toolResult = $derived(
    message.parts.find((part) => part.type === 'tool-result'),
  );
  const streaming = $derived(isMessageStreaming(message, chatStatus, messages));
  const isUser = $derived(message.role === 'user');
  const isAssistant = $derived(message.role === 'assistant');
  const isTool = $derived(message.role === 'tool');
  const workingLabel = $derived(
    isAssistant
      ? getActiveAssistantStatusLabel(message, messages, chatStatus)
      : null,
  );
  const completionTime = $derived(
    isAssistant
      ? getMessageCompletionTime(message)
      : getMessageTimestamp(message),
  );
  const timeLabel = $derived(
    completionTime && !workingLabel ? formatMessageTime(completionTime) : null,
  );
  const showCopy = $derived(isAssistant && Boolean(text) && !streaming);
  const showMeta = $derived(
    Boolean(workingLabel) || Boolean(timeLabel) || showCopy,
  );
  const html = $derived(text ? renderMarkdown(text) : '');

  let copied = $state(false);

  async function copyResponse() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      // Clipboard unavailable.
    }
  }
</script>

<div class="chat-message" in:fly={{ y: 8, duration: 220, easing: cubicOut }}>
  {#if isAssistant}
    <ThinkingBlock
      text={reasoning}
      {streaming}
      durationSeconds={reasoningDuration}
    />
  {/if}

  {#snippet metaRow()}
    <div class="chat-message-meta">
      {#if showCopy}
        <button
          type="button"
          class="chat-message-copy"
          aria-label={copied ? 'Copied response' : 'Copy response'}
          onclick={() => void copyResponse()}
        >
          {#if copied}
            <Check size={12} />
          {:else}
            <Copy size={12} />
          {/if}
        </button>
      {/if}
      {#if workingLabel}
        <span
          class="chat-message-status shimmer"
          role="status"
          aria-live="polite">{workingLabel}</span
        >
      {:else if timeLabel}
        <time
          class="chat-message-time"
          class:chat-message-time--user={isUser}
          datetime={new Date(completionTime!).toISOString()}>{timeLabel}</time
        >
      {/if}
    </div>
  {/snippet}

  <!-- User meta sits above the prompt; assistant meta moves below its final response. -->
  {#if showMeta && isUser}
    {@render metaRow()}
  {/if}

  <div
    class="chat-message-bubble"
    class:chat-message-bubble--user={isUser}
    class:chat-message-bubble--assistant={isAssistant || isTool}
    class:chat-message-bubble--streaming={streaming}
  >
    {#if isTool && toolResult?.type === 'tool-result'}
      <ToolCallCard
        toolName={toolResult.toolName}
        args={toolResult.args}
        result={toolResult.result}
        error={toolResult.error}
      />
    {/if}

    {#if files.length > 0}
      <div class="chat-message-files">
        {#each files as file, index (file.url + (file.filename ?? index))}
          <div class="chat-message-file">
            {#if file.mediaType.startsWith('image/')}
              <img
                src={file.url}
                alt={file.filename ?? 'Attachment'}
                class="chat-message-file-thumb"
              />
            {:else}
              <FileIcon size={12} />
            {/if}
            <span class="truncate">{file.filename ?? 'Attachment'}</span>
          </div>
        {/each}
      </div>
    {/if}

    {#if text}
      {#if isUser}
        <span class="chat-message-user-text">{text}</span>
      {:else}
        <div class="chat-markdown">{@html html}</div>
      {/if}
    {/if}

    {#if streaming && text}
      <span class="chat-message-cursor" aria-hidden="true">▍</span>
    {/if}
  </div>

  {#if showMeta && !isUser}
    {@render metaRow()}
  {/if}
</div>

<style>
  .chat-message {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    width: 100%;
  }

  .chat-message-meta {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    min-height: 18px;
    padding: 0 2px;
    align-self: flex-start;
  }

  .chat-message-time {
    font-size: var(--chat-font-size, 0.8125rem);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
    color: oklch(var(--bc) / 0.5);
  }

  .chat-message-status {
    font-size: var(--chat-font-size, 0.8125rem);
    font-weight: 500;
    letter-spacing: 0.01em;
    color: oklch(var(--bc) / 0.5);
  }

  /* User timestamps stay hidden until the message (or turn) is hovered. */
  .chat-message-time--user {
    opacity: 0;
    transition: opacity 160ms ease;
  }

  .chat-message:hover .chat-message-time--user,
  :global(.chat-turn-user:hover) .chat-message-time--user,
  .chat-message-time--user:focus-visible {
    opacity: 1;
  }

  .chat-message-copy {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: oklch(var(--bc) / 0.5);
    cursor: pointer;
    transition:
      color 120ms ease,
      background 120ms ease;
  }

  .chat-message-copy:hover {
    color: oklch(var(--bc));
    background: oklch(var(--bc) / 0.08);
  }

  .chat-message-copy:focus-visible {
    outline: 2px solid oklch(var(--p));
    outline-offset: 1px;
  }

  .chat-message-bubble {
    width: 100%;
    box-sizing: border-box;
    padding: 0.75rem;
    font-size: var(--chat-font-size, 0.8125rem);
    line-height: 1.5;
    border-radius: 0.25rem;
    transition:
      border-color 160ms ease,
      background 160ms ease;
  }

  .chat-message-bubble--user {
    border: 1px solid oklch(var(--bc) / 0.14);
    background: oklch(var(--b1));
  }

  .chat-message-bubble--assistant {
    border: none;
    background: transparent;
    padding-left: 0;
    padding-right: 0;
  }

  .chat-message-bubble--streaming {
    opacity: 0.92;
  }

  .chat-message-user-text {
    display: block;
    width: 100%;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .chat-message-cursor {
    display: inline-block;
    margin-left: 1px;
    animation: chat-cursor-blink 1s step-start infinite;
  }

  @keyframes chat-cursor-blink {
    50% {
      opacity: 0;
    }
  }

  .chat-message-files {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.375rem;
  }

  .chat-message-file {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid oklch(var(--bc) / 0.14);
    border-radius: 0.375rem;
    font-size: 0.75rem;
  }

  .chat-message-file-thumb {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.25rem;
    object-fit: cover;
  }
</style>
