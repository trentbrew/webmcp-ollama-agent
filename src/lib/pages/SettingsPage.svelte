<script lang="ts">
  import { theme, toggleTheme } from '../stores/theme';
  import { layoutMode, setLayoutMode } from '../stores/layout';
  import { Moon, Sun, Bell, Volume2, Palette, Shield, Layout, MessageCircle } from '../icons';
  import Icon from '../components/Icon.svelte';
  import { chatSettings, resetInferenceOption, resetInferenceOptions, setInferenceOption, setKeepThinkingOpen } from '../chat/settings.svelte';
  import { DEFAULT_INFERENCE_OPTIONS, type InferenceOptions } from '../ai/config';

  let notifications = $state(true);
  let soundEnabled = $state(false);
  let autoSave = $state(true);

  const inferenceFields: Array<{
    key: keyof InferenceOptions;
    label: string;
    min: number;
    max: number;
    step: number;
    hint: string;
  }> = [
    { key: 'temperature', label: 'Temperature', min: 0, max: 2, step: 0.05, hint: 'Higher = more random.' },
    { key: 'top_p', label: 'Top P', min: 0, max: 1, step: 0.05, hint: 'Nucleus sampling cutoff.' },
    { key: 'top_k', label: 'Top K', min: 0, max: 100, step: 1, hint: 'Candidate token pool size.' },
    { key: 'num_predict', label: 'Max output tokens', min: -1, max: 8192, step: 32, hint: '-1 = unlimited.' },
    { key: 'repeat_penalty', label: 'Repeat penalty', min: 0.8, max: 2, step: 0.05, hint: 'Discourages repetition.' },
  ];
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center gap-3">
    <Icon icon={Shield} size={32} class="text-primary" />
    <div>
      <h1 class="text-3xl font-bold">Settings</h1>
      <p class="text-sm opacity-70">Customize your extension preferences</p>
    </div>
  </div>

  <!-- Theme Settings -->
  <div class="card thread-card">
    <div class="card-body">
      <h2 class="card-title">
        <Icon icon={Palette} size={24} />
        Appearance
      </h2>

      <div class="form-control">
        <label class="label cursor-pointer">
          <span class="label-text">Theme</span>
          <div class="flex items-center gap-3">
            <Icon icon={$theme === 'light' ? Sun : Moon} size={20} />
            <input
              type="checkbox"
              class="toggle toggle-primary"
              checked={$theme === 'dark'}
              onchange={toggleTheme}
            />
          </div>
        </label>
      </div>

      <div class="divider"></div>

      <div class="alert alert-info">
        <Icon icon={Moon} size={20} />
        <span>Current theme: <strong class="capitalize">{$theme}</strong></span>
      </div>
    </div>
  </div>

  <!-- Notifications Settings -->
  <div class="card thread-card">
    <div class="card-body">
      <h2 class="card-title">
        <Icon icon={Bell} size={24} />
        Notifications
      </h2>

      <div class="form-control">
        <label class="label cursor-pointer">
          <span class="label-text">Enable notifications</span>
          <input
            type="checkbox"
            class="toggle toggle-secondary"
            bind:checked={notifications}
          />
        </label>
      </div>

      <div class="form-control">
        <label class="label cursor-pointer">
          <span class="label-text">Sound effects</span>
          <input
            type="checkbox"
            class="toggle toggle-accent"
            bind:checked={soundEnabled}
            disabled={!notifications}
          />
        </label>
      </div>
    </div>
  </div>

  <!-- General Settings -->
  <div class="card thread-card">
    <div class="card-body">
      <h2 class="card-title">General</h2>

      <div class="form-control">
        <label class="label cursor-pointer">
          <span class="label-text">Auto-save preferences</span>
          <input
            type="checkbox"
            class="toggle toggle-success"
            bind:checked={autoSave}
          />
        </label>
      </div>

      <div class="divider"></div>

      <div class="form-control w-full">
        <label class="label" for="language-select">
          <span class="label-text">Default language</span>
        </label>
        <select id="language-select" class="select select-bordered w-full">
          <option selected>English</option>
          <option>Spanish</option>
          <option>French</option>
          <option>German</option>
        </select>
      </div>
    </div>
  </div>

  <!-- Layout Settings -->
  <div class="card thread-card">
    <div class="card-body">
      <h2 class="card-title">
        <Icon icon={Layout} size={24} />
        Layout Mode
      </h2>

      <div class="form-control">
        <label class="label cursor-pointer">
          <span class="label-text">Layout style</span>
          <div class="join">
            <button
              class="btn join-item {$layoutMode === 'dock'
                ? 'btn-primary'
                : 'btn-ghost'}"
              onclick={() => setLayoutMode('dock')}
            >
              Dock
            </button>
            <button
              class="btn join-item {$layoutMode === 'panes'
                ? 'btn-primary'
                : 'btn-ghost'}"
              onclick={() => setLayoutMode('panes')}
            >
              Panes
            </button>
          </div>
        </label>
      </div>

      <div class="divider"></div>

      <div class="alert alert-info">
        <Icon icon={Layout} size={20} />
        <span
          >Current layout: <strong class="capitalize">{$layoutMode}</strong
          ></span
        >
      </div>
    </div>
  </div>

  <!-- Inference Settings -->
  <div class="card thread-card">
    <div class="card-body">
      <h2 class="card-title">
        <Icon icon={MessageCircle} size={24} />
        Inference
      </h2>
      <p class="text-sm opacity-70 -mt-2">Sampling parameters sent with every Ollama request.</p>

      <div class="form-control">
        <label class="label cursor-pointer">
          <span class="label-text">Keep reasoning expanded after reply</span>
          <input
            type="checkbox"
            class="toggle toggle-primary"
            checked={chatSettings.keepThinkingOpen}
            onchange={(event) => setKeepThinkingOpen((event.currentTarget as HTMLInputElement).checked)}
          />
        </label>
        <span class="label-text-alt opacity-60 px-1">When off, the “Thinking” block collapses once the response finishes.</span>
      </div>

      <div class="divider my-1"></div>

      {#each inferenceFields as field (field.key)}
        {@const isDefault = chatSettings.inference[field.key] === DEFAULT_INFERENCE_OPTIONS[field.key]}
        <div class="form-control w-full">
          <label class="label" for={`inference-${field.key}`}>
            <span class="label-text">{field.label}</span>
            <span class="label-text-alt tabular-nums flex items-center gap-1">
              {chatSettings.inference[field.key]}
              {#if !isDefault}
                <button
                  type="button"
                  class="link link-hover opacity-50 hover:opacity-100"
                  title={`Reset to default (${DEFAULT_INFERENCE_OPTIONS[field.key]})`}
                  onclick={() => resetInferenceOption(field.key)}
                >reset</button>
              {/if}
            </span>
          </label>
          <input
            id={`inference-${field.key}`}
            type="range"
            class="range range-primary range-sm thread-range"
            min={field.min}
            max={field.max}
            step={field.step}
            value={chatSettings.inference[field.key]}
            title="Double-click to reset to default"
            oninput={(event) => setInferenceOption(field.key, Number((event.currentTarget as HTMLInputElement).value))}
            ondblclick={() => resetInferenceOption(field.key)}
          />
          <span class="label-text-alt opacity-60">{field.hint} Double-click the slider to reset (default {DEFAULT_INFERENCE_OPTIONS[field.key]}).</span>
        </div>
      {/each}

      <div class="card-actions justify-end mt-2">
        <button class="btn btn-sm btn-outline" onclick={() => resetInferenceOptions()}>Reset to defaults</button>
      </div>
    </div>
  </div>

  <!-- Actions -->
  <div class="card thread-card">
    <div class="card-body">
      <h2 class="card-title">Data Management</h2>
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-outline btn-primary">Export Data</button>
        <button class="btn btn-outline btn-secondary">Import Settings</button>
        <button class="btn btn-outline btn-error">Clear Cache</button>
      </div>
    </div>
  </div>
</div>
