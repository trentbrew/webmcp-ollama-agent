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

  const visible = $derived(hasReasoning || streaming);
  const label = $derived(streaming ? 'Thinking…' : doneLabel);

  let open = $state(false);
  let prevStreaming = false;

  $effect(() => {
    if (streaming) {
      open = true;
    } else if (prevStreaming) {
      open = chatSettings.keepThinkingOpen;
    }
    prevStreaming = streaming;
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
      <span class="chat-thinking-label" class:shimmer={streaming}>{label}</span>
      <ChevronDown
        size={13}
        class={`chat-thinking-chevron${open ? ' is-open' : ''}`}
      />
    </button>
    {#if open && (hasReasoning || streaming)}
      <div
        class="chat-thinking-content"
        class:is-streaming={streaming}
        transition:slide={{ duration: 220, easing: cubicOut }}
      >
        {#if hasReasoning}
          <div class="chat-markdown">{@html html}</div>
        {:else if streaming}
          <span class="chat-thinking-placeholder shimmer"
            >Waiting for model reasoning…</span
          >
        {/if}
        {#if streaming && hasReasoning}
          <span class="chat-thinking-cursor" aria-hidden="true">▍</span>
        {/if}
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

  .chat-thinking-content.is-streaming {
    color: oklch(var(--bc) / 0.82);
  }

  .chat-thinking-placeholder {
    opacity: 0.55;
    font-style: italic;
  }

  .chat-thinking-cursor {
    display: inline-block;
    margin-left: 1px;
    animation: chat-thinking-cursor-blink 1s step-start infinite;
  }

  @keyframes chat-thinking-cursor-blink {
    50% {
      opacity: 0;
    }
  }
</style>
