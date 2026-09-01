<script lang="ts">
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { Brain, ChevronDown } from '../../icons';
  import { renderMarkdown } from '../../chat/markdown';
  import { formatThoughtDuration } from '../../ai/messages';
  import { chatSettings } from '../../chat/settings.svelte';

  let {
    text = '',
    streaming = false,
    durationSeconds = null,
  }: {
    text?: string;
    streaming?: boolean;
    durationSeconds?: number | null;
  } = $props();

  const doneLabel = $derived(
    durationSeconds != null
      ? formatThoughtDuration(durationSeconds)
      : 'Thought',
  );

  const trimmed = $derived(text.trim());
  const hasReasoning = $derived(Boolean(trimmed));
  const html = $derived(trimmed ? renderMarkdown(trimmed) : '');

  const visible = $derived(!streaming && hasReasoning);

  // Collapsed by default. On completion, follows the persisted "keep thinking open" preference.
  let open = $state(false);
  let wasStreaming = streaming;

  $effect(() => {
    if (streaming) {
      open = true;
    } else if (wasStreaming && !streaming) {
      open = chatSettings.keepThinkingOpen;
    }
    wasStreaming = streaming;
  });
</script>

{#if visible}
  <div class="chat-thinking">
    <button
      type="button"
      class="chat-thinking-trigger"
      aria-expanded={open}
      onclick={() => (open = !open)}
    >
      <Brain size={14} class="chat-thinking-brain" />
      <span class="chat-thinking-label">{doneLabel}</span>
      <ChevronDown
        size={13}
        class={`chat-thinking-chevron${open ? ' is-open' : ''}`}
      />
    </button>
    {#if open && hasReasoning}
      <div
        class="chat-thinking-content"
        transition:slide={{ duration: 220, easing: cubicOut }}
      >
        <div class="chat-markdown">{@html html}</div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .chat-thinking {
    width: 100%;
    margin-top: 8px;
  }

  /* Borderless, background-less accordion — label + chevron sit together. */
  .chat-thinking-trigger {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 0;
    border: none;
    background: transparent;
    color: oklch(var(--bc) / 0.55);
    font-size: var(--chat-font-size, 0.8125rem);
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition: color 120ms ease;
  }

  .chat-thinking-trigger:hover {
    color: oklch(var(--bc) / 0.8);
  }

  .chat-thinking-trigger:focus-visible {
    outline: 2px solid oklch(var(--p));
    outline-offset: 2px;
    border-radius: 2px;
  }

  .chat-thinking-label {
    min-width: 0;
  }

  :global(.chat-thinking-brain) {
    flex-shrink: 0;
    color: oklch(var(--bc) / 0.5);
  }

  :global(.chat-thinking-chevron) {
    flex-shrink: 0;
    color: oklch(var(--bc) / 0.5);
    transition: transform 160ms ease;
  }

  :global(.chat-thinking-chevron.is-open) {
    transform: rotate(180deg);
  }

  .chat-thinking-content {
    padding: 6px 0 2px 20px;
    color: oklch(var(--bc) / 0.7);
    font-size: var(--chat-font-size, 0.8125rem);
    line-height: 1.5;
  }
</style>
