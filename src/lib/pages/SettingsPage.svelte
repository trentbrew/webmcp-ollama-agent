<script lang="ts">
  import { layoutMode, setLayoutMode } from '../stores/layout';
  import {
    chatSettings,
    resetInferenceOption,
    resetInferenceOptions,
    resetCustomInstructions,
    setChatLanguage,
    setCustomInstructions,
    setInferenceOption,
    setKeepThinkingOpen,
  } from '../chat/settings.svelte';
  import {
    CHAT_LANGUAGE_OPTIONS,
    DEFAULT_INFERENCE_OPTIONS,
    MAX_CUSTOM_INSTRUCTIONS_LENGTH,
    isChatLanguage,
    type InferenceOptions,
  } from '../ai/config';
  import { PageSection } from '../components/shell';
  import { Button, Label, Separator, Slider, Switch } from '../components/ui';

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
    {
      key: 'temperature',
      label: 'Temperature',
      min: 0,
      max: 2,
      step: 0.05,
      hint: 'Higher = more random.',
    },
    {
      key: 'top_p',
      label: 'Top P',
      min: 0,
      max: 1,
      step: 0.05,
      hint: 'Nucleus sampling cutoff.',
    },
    {
      key: 'top_k',
      label: 'Top K',
      min: 0,
      max: 100,
      step: 1,
      hint: 'Candidate token pool size.',
    },
    {
      key: 'num_predict',
      label: 'Max output tokens',
      min: -1,
      max: 8192,
      step: 32,
      hint: '-1 = unlimited.',
    },
    {
      key: 'repeat_penalty',
      label: 'Repeat penalty',
      min: 0.8,
      max: 2,
      step: 0.05,
      hint: 'Discourages repetition.',
    },
  ];
</script>

<div class="space-y-3">
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
          value={chatSettings.language}
          onchange={(event) => {
            const value = (event.currentTarget as HTMLSelectElement).value;
            if (isChatLanguage(value)) setChatLanguage(value);
          }}
        >
          {#each CHAT_LANGUAGE_OPTIONS as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
        <p class="shell-setting-hint">
          Controls the language Ollama uses for replies. Extension UI stays in
          English for now.
        </p>
      </div>
    </div>
  </PageSection>

  <PageSection
    title="Agent"
    description="Steer how the local agent behaves. Appended to the built-in system prompt."
  >
    <div class="space-y-1.5">
      <div class="flex items-center justify-between gap-2">
        <Label for="custom-instructions">Additional instructions</Label>
        <span class="text-xs tabular-nums text-base-content/60">
          {chatSettings.customInstructions
            .length}/{MAX_CUSTOM_INSTRUCTIONS_LENGTH}
        </span>
      </div>
      <textarea
        id="custom-instructions"
        class="flex min-h-24 w-full resize-y rounded border border-base-content/20 bg-base-100 px-2.5 py-2 text-xs leading-relaxed"
        placeholder="e.g. Focus on game mechanics. Be terse. Don't suggest code unless asked."
        maxlength={MAX_CUSTOM_INSTRUCTIONS_LENGTH}
        value={chatSettings.customInstructions}
        oninput={(event) =>
          setCustomInstructions(
            (event.currentTarget as HTMLTextAreaElement).value,
          )}
      ></textarea>
      <div class="flex items-center justify-between gap-2">
        <p class="shell-setting-hint">
          Optional. Does not replace core tool or ask_user behavior.
        </p>
        {#if chatSettings.customInstructions.length > 0}
          <Button
            variant="outline"
            size="sm"
            onclick={() => resetCustomInstructions()}
          >
            Clear
          </Button>
        {/if}
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

  <PageSection
    title="Inference"
    description="Sampling parameters sent with every Ollama request."
  >
    <div class="space-y-3">
      <div class="shell-setting-row">
        <div>
          <Label>Keep reasoning expanded</Label>
          <p class="shell-setting-hint">
            Collapse the Thinking block when the response finishes.
          </p>
        </div>
        <Switch
          checked={chatSettings.keepThinkingOpen}
          onchange={(event) =>
            setKeepThinkingOpen(
              (event.currentTarget as HTMLInputElement).checked,
            )}
        />
      </div>

      <Separator />

      {#each inferenceFields as field (field.key)}
        {@const isDefault =
          chatSettings.inference[field.key] ===
          DEFAULT_INFERENCE_OPTIONS[field.key]}
        <div class="space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <Label for={`inference-${field.key}`}>{field.label}</Label>
            <span
              class="text-xs tabular-nums text-base-content/60 flex items-center gap-1"
            >
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
            oninput={(event) =>
              setInferenceOption(
                field.key,
                Number((event.currentTarget as HTMLInputElement).value),
              )}
            ondblclick={() => resetInferenceOption(field.key)}
          />
          <p class="shell-setting-hint">
            {field.hint} Double-click to reset (default {DEFAULT_INFERENCE_OPTIONS[
              field.key
            ]}).
          </p>
        </div>
      {/each}

      <div class="flex justify-end pt-1">
        <Button
          variant="outline"
          size="sm"
          onclick={() => resetInferenceOptions()}
        >
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
