<script lang="ts">
  import { fade } from 'svelte/transition';
  let { label }: { label: string } = $props();
</script>

<div
  class="chat-status"
  role="status"
  aria-live="polite"
  in:fade={{ duration: 180 }}
>
  <span class="chat-status__dot"></span>
  <span class="chat-status__label shimmer">{label}</span>
</div>

<style>
  .chat-status {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.125rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .chat-status__dot {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 999px;
    background: currentColor;
    opacity: 0.6;
    animation: chat-status-pulse 1.2s ease-in-out infinite;
  }

  @keyframes chat-status-pulse {
    0%,
    100% {
      opacity: 0.3;
      transform: scale(0.85);
    }
    50% {
      opacity: 0.9;
      transform: scale(1);
    }
  }
</style>
