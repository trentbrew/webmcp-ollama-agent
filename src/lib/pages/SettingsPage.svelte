<script lang="ts">
  import { theme, setTheme } from '../stores/theme';
  import { layoutMode, setLayoutMode } from '../stores/layout';
  import { Moon, Sun, Palette, Layout, MessageCircle } from '../icons';
  import Icon from '../components/Icon.svelte';
  import ThemeController from '../components/ThemeController.svelte';
  import { pageThemeState, setAutoMatch } from '../theme/pageTheme.svelte';
  import {
    chatSettings,
    resetInferenceOption,
    resetInferenceOptions,
    setInferenceOption,
    setKeepThinkingOpen,
  } from '../chat/settings.svelte';
  import { DEFAULT_INFERENCE_OPTIONS, type InferenceOptions } from '../ai/config';
  import { PageSection } from '../components/shell';
  import {
    Button,
    Label,
    Separator,
    Slider,
    Switch,
  } from '../components/ui';

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

<div class="space-y-3">
  <PageSection title="Appearance">
    {#snippet actions()}
      <ThemeController
        autoMatch={pageThemeState.autoMatch}
        onToggleAutoMatch={setAutoMatch}
      />
    {/snippet}

    <div class="shell-setting-row">
      <Label>Dark mode</Label>
      <div class="flex items-center gap-2">
        <Icon icon={$theme === 'light' ? Sun : Moon} size={16} class="opacity-60" />
        <Switch
          checked={$theme === 'dark'}
          onchange={(event) => setTheme((event.currentTarget as HTMLInputElement).checked ? 'dark' : 'light')}
        />
      </div>
    </div>
    <p class="shell-setting-hint mt-2">
      Current theme: <span class="capitalize font-medium">{$theme}</span>. Use the palette control to pick from 32 themes or match the active page.
    </p>
  </PageSection>

  <PageSection title="Notifications">
    <div class="space-y-3">
      <div class="shell-setting-row">
        <Label>Enable notifications</Label>
        <Switch bind:checked={notifications} />
      </div>
      <div class="shell-setting-row">
        <Label>Sound effects</Label>
        <Switch bind:checked={soundEnabled} disabled={!notifications} />
      </div>
    </div>
  </PageSection>

  <PageSection title="General">
    <div class="space-y-3">
      <div class="shell-setting-row">
        <Label>Auto-save preferences</Label>
        <Switch bind:checked={autoSave} />
      </div>
      <Separator />
      <div class="space-y-1.5">
        <Label for="language-select">Default language</Label>
        <select
          id="language-select"
          class="flex h-8 w-full rounded border border-base-content/20 bg-base-100 px-2.5 text-xs"
        >
          <option selected>English</option>
          <option>Spanish</option>
          <option>French</option>
          <option>German</option>
        </select>
      </div>
    </div>
  </PageSection>

  <PageSection title="Layout mode">
    <div class="shell-setting-row">
      <Label>Layout style</Label>
      <div class="inline-flex rounded border border-base-content/15 p-0.5">
        <Button
          variant={$layoutMode === 'dock' ? 'default' : 'ghost'}
          size="sm"
          onclick={() => setLayoutMode('dock')}
        >
          Dock
        </Button>
        <Button
          variant={$layoutMode === 'panes' ? 'default' : 'ghost'}
          size="sm"
          onclick={() => setLayoutMode('panes')}
        >
          Panes
        </Button>
      </div>
    </div>
    <p class="shell-setting-hint mt-2">
      Current layout: <span class="capitalize font-medium">{$layoutMode}</span>
    </p>
  </PageSection>

  <PageSection title="Inference" description="Sampling parameters sent with every Ollama request.">
    <div class="space-y-3">
      <div class="shell-setting-row">
        <div>
          <Label>Keep reasoning expanded</Label>
          <p class="shell-setting-hint">Collapse the Thinking block when the response finishes.</p>
        </div>
        <Switch
          checked={chatSettings.keepThinkingOpen}
          onchange={(event) => setKeepThinkingOpen((event.currentTarget as HTMLInputElement).checked)}
        />
      </div>

      <Separator />

      {#each inferenceFields as field (field.key)}
        {@const isDefault = chatSettings.inference[field.key] === DEFAULT_INFERENCE_OPTIONS[field.key]}
        <div class="space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <Label for={`inference-${field.key}`}>{field.label}</Label>
            <span class="text-xs tabular-nums text-base-content/60 flex items-center gap-1">
              {chatSettings.inference[field.key]}
              {#if !isDefault}
                <button
                  type="button"
                  class="text-primary hover:underline"
                  title={`Reset to default (${DEFAULT_INFERENCE_OPTIONS[field.key]})`}
                  onclick={() => resetInferenceOption(field.key)}
                >
                  reset
                </button>
              {/if}
            </span>
          </div>
          <Slider
            id={`inference-${field.key}`}
            min={field.min}
            max={field.max}
            step={field.step}
            value={chatSettings.inference[field.key]}
            title="Double-click to reset to default"
            oninput={(event) => setInferenceOption(field.key, Number((event.currentTarget as HTMLInputElement).value))}
            ondblclick={() => resetInferenceOption(field.key)}
          />
          <p class="shell-setting-hint">
            {field.hint} Double-click to reset (default {DEFAULT_INFERENCE_OPTIONS[field.key]}).
          </p>
        </div>
      {/each}

      <div class="flex justify-end pt-1">
        <Button variant="outline" size="sm" onclick={() => resetInferenceOptions()}>
          Reset to defaults
        </Button>
      </div>
    </div>
  </PageSection>

  <PageSection title="Data management">
    <div class="flex flex-wrap gap-2">
      <Button variant="outline" size="sm">Export data</Button>
      <Button variant="outline" size="sm">Import settings</Button>
      <Button variant="destructive" size="sm">Clear cache</Button>
    </div>
  </PageSection>
</div>
