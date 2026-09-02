<script lang="ts">
  // Shown in place of the normal empty state when the model host can't be reached.
  // Without this the panel looks broken on first run: the composer accepts a message,
  // the request fails somewhere in the background, and nothing explains that the
  // extension expects a model running locally. That's also the first thing a Web Store
  // reviewer sees on a machine with no Ollama installed.
  import { ExternalLink, PlugZap, RotateCw } from '../../icons';
  import { DEFAULT_OLLAMA_MODEL } from '../../ai/config';
  import {
    chatModelCatalog,
    chatSettings,
    loadAvailableModels,
  } from '../../chat/settings.svelte';

  const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download';

  let checking = $state(false);

  async function retry() {
    if (checking) return;
    checking = true;
    try {
      await loadAvailableModels(true);
    } finally {
      checking = false;
    }
  }
</script>

<div class="ollama-offline">
  <PlugZap size={24} class="ollama-offline__icon" />

  <p class="ollama-offline__title">Ollama isn't running</p>
  <p class="ollama-offline__subtitle">
    Chat and tool calls run through a model on your own machine. Nothing is sent
    to a server.
  </p>

  <ol class="ollama-offline__steps">
    <li>
      <a
        class="ollama-offline__link"
        href={OLLAMA_DOWNLOAD_URL}
        target="_blank"
        rel="noreferrer noopener"
      >
        Install Ollama
        <ExternalLink size={11} />
      </a>
    </li>
    <li>
      Pull a model:
      <code class="ollama-offline__code">ollama pull {DEFAULT_OLLAMA_MODEL}</code>
    </li>
    <li>Come back and retry.</li>
  </ol>

  <button
    type="button"
    class="ollama-offline__retry"
    disabled={checking}
    onclick={() => void retry()}
  >
    <RotateCw size={12} class={checking ? 'ollama-offline__spin' : undefined} />
    {checking ? 'Checking…' : 'Retry'}
  </button>

  <p class="ollama-offline__detail">
    Tried <code>{chatSettings.baseUrl}</code>
    {#if chatModelCatalog.error}
      · {chatModelCatalog.error}
    {/if}
  </p>
  <p class="ollama-offline__detail ollama-offline__detail--hint">
    Pointing at a different host? Change it in Settings.
  </p>
</div>

<style>
  .ollama-offline {
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

  :global(.ollama-offline__icon) {
    opacity: 0.7;
    color: oklch(var(--wa, var(--bc)));
  }

  .ollama-offline__title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 500;
  }

  .ollama-offline__subtitle {
    margin: 0;
    max-width: 22rem;
    font-size: 0.8125rem;
    line-height: 1.45;
    opacity: 0.6;
  }

  .ollama-offline__steps {
    display: flex;
    flex-direction: column;
    gap: 0.3125rem;
    margin: 0.5rem 0 0;
    padding: 0;
    list-style: none;
    counter-reset: step;
    font-size: 0.75rem;
    line-height: 1.5;
    opacity: 0.85;
  }

  .ollama-offline__steps li {
    counter-increment: step;
  }

  .ollama-offline__steps li::before {
    content: counter(step) '.';
    margin-right: 0.375rem;
    opacity: 0.45;
  }

  .ollama-offline__link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .ollama-offline__code,
  .ollama-offline__detail code {
    padding: 0.0625rem 0.3125rem;
    border-radius: 0.25rem;
    background: color-mix(in oklab, currentColor 9%, transparent);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.6875rem;
  }

  .ollama-offline__retry {
    display: inline-flex;
    align-items: center;
    gap: 0.3125rem;
    margin-top: 0.75rem;
    padding: 0.25rem 0.625rem;
    border: 1px solid color-mix(in oklab, currentColor 18%, transparent);
    border-radius: 999px;
    background: color-mix(in oklab, currentColor 6%, transparent);
    color: inherit;
    font-size: 0.6875rem;
    line-height: 1.2;
    cursor: pointer;
    transition:
      border-color 150ms ease,
      background 150ms ease;
  }

  .ollama-offline__retry:hover:not(:disabled) {
    border-color: color-mix(in oklab, currentColor 28%, transparent);
    background: color-mix(in oklab, currentColor 10%, transparent);
  }

  .ollama-offline__retry:disabled {
    opacity: 0.5;
    cursor: progress;
  }

  :global(.ollama-offline__spin) {
    animation: ollama-offline-spin 900ms linear infinite;
  }

  @keyframes ollama-offline-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .ollama-offline__detail {
    margin: 0.625rem 0 0;
    font-size: 0.6875rem;
    line-height: 1.4;
    opacity: 0.45;
  }

  .ollama-offline__detail--hint {
    margin-top: 0.25rem;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.ollama-offline__spin) {
      animation: none;
    }
  }
</style>
