<script lang="ts">
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import type { ChatQuestionnairePart } from '../../ai/protocol';
  import {
    formatAnswersSummary,
    isItemAnswered,
    validateQuestionnaire,
    type QuestionnaireAnswers,
    type QuestionnaireItem,
  } from '../../ai/questionnaire';
  import { submitQuestionnaireAnswers } from '../../chat.svelte';
  import Button from '../ui/Button.svelte';

  let {
    part,
    disabled = false,
  }: {
    part: ChatQuestionnairePart;
    disabled?: boolean;
  } = $props();

  const items = $derived(part.items);
  const answered = $derived(part.status !== 'pending');
  const readOnly = $derived(disabled || answered);

  let step = $state(0);
  let answers = $state<QuestionnaireAnswers>({ ...(part.answers ?? {}) });
  let error = $state<string | null>(null);
  let submitting = $state(false);

  const current = $derived(items[step]);
  const progressLabel = $derived(`Question ${step + 1} of ${items.length}`);

  function toggleChoice(item: QuestionnaireItem, value: string) {
    if (readOnly) return;
    if (item.multiple) {
      const currentValues = Array.isArray(answers[item.name]) ? [...(answers[item.name] as string[])] : [];
      const index = currentValues.indexOf(value);
      if (index >= 0) currentValues.splice(index, 1);
      else currentValues.push(value);
      answers = { ...answers, [item.name]: currentValues };
    } else {
      answers = { ...answers, [item.name]: value };
    }
    error = null;
  }

  function isChoiceSelected(item: QuestionnaireItem, value: string) {
    const valueForItem = answers[item.name];
    if (item.multiple) return Array.isArray(valueForItem) && valueForItem.includes(value);
    return valueForItem === value;
  }

  function setInput(item: QuestionnaireItem, value: string) {
    if (readOnly) return;
    answers = { ...answers, [item.name]: value };
    error = null;
  }

  function goBack() {
    if (step <= 0) return;
    step -= 1;
    error = null;
  }

  function skipCurrent() {
    if (!current || current.required) return;
    if (current.multiple) answers = { ...answers, [current.name]: [] };
    else answers = { ...answers, [current.name]: '' };
    goForward(true);
  }

  function goForward(skipped = false) {
    if (!current) return;
    if (!skipped && current.required && !isItemAnswered(current, answers)) {
      error = 'Choose an answer to continue.';
      return;
    }
    if (step < items.length - 1) {
      step += 1;
      error = null;
      return;
    }
    void handleSubmit(skipped ? 'skipped' : 'answered');
  }

  async function handleSubmit(status: 'answered' | 'skipped' = 'answered') {
    if (readOnly || submitting) return;
    const validation = validateQuestionnaire(items, answers);
    if (!validation.ok && status === 'answered') {
      error = validation.error;
      if (validation.itemName) {
        const index = items.findIndex((item) => item.name === validation.itemName);
        if (index >= 0) step = index;
      }
      return;
    }

    submitting = true;
    error = null;
    const ok = await submitQuestionnaireAnswers(part.id, answers, status);
    if (!ok) {
      error = 'Could not submit answers. Try again.';
      submitting = false;
    }
  }
</script>

<article
  class="questionnaire"
  class:questionnaire--answered={answered}
  aria-label="Structured questionnaire"
>
  {#if answered}
    <header class="questionnaire__header">
      <span class="questionnaire__progress">Answered</span>
      <p class="questionnaire__summary">{formatAnswersSummary(part.answers ?? {})}</p>
    </header>
  {:else if current}
    <header class="questionnaire__header">
      <span class="questionnaire__progress">{progressLabel}</span>
      <h3 class="questionnaire__title">{current.prompt}</h3>
      {#if current.description}
        <p class="questionnaire__description">{current.description}</p>
      {/if}
    </header>

    <div class="questionnaire__body" in:fly={{ y: 6, duration: 180, easing: cubicOut }}>
      {#if current.choices?.length}
        <div
          class="questionnaire__choices"
          role={current.multiple ? 'group' : 'radiogroup'}
          aria-label={current.prompt}
        >
          {#each current.choices as choice (choice.value)}
            <button
              type="button"
              class="questionnaire__choice"
              class:questionnaire__choice--selected={isChoiceSelected(current, choice.value)}
              aria-pressed={isChoiceSelected(current, choice.value)}
              disabled={readOnly || submitting}
              onclick={() => toggleChoice(current, choice.value)}
            >
              {#if choice.shortcut}
                <span class="questionnaire__shortcut">{choice.shortcut}</span>
              {/if}
              <span class="questionnaire__choice-text">
                <span class="questionnaire__choice-label">{choice.label}</span>
                {#if choice.description}
                  <span class="questionnaire__choice-description">{choice.description}</span>
                {/if}
              </span>
            </button>
          {/each}
        </div>
      {/if}

      {#if current.input}
        <label class="questionnaire__input-label">
          <span>{current.input.label}</span>
          <input
            class="questionnaire__input"
            type="text"
            value={typeof answers[current.name] === 'string' ? (answers[current.name] as string) : ''}
            placeholder={current.input.placeholder}
            disabled={readOnly || submitting}
            oninput={(event) => setInput(current, event.currentTarget.value)}
          />
        </label>
      {/if}

      {#if error}
        <p class="questionnaire__error" role="alert">{error}</p>
      {/if}
    </div>

    <footer class="questionnaire__actions">
      <Button
        variant="ghost"
        size="sm"
        disabled={step === 0 || submitting}
        onclick={goBack}
      >
        Previous
      </Button>
      <div class="questionnaire__actions-end">
        {#if !current.required}
          <Button variant="ghost" size="sm" disabled={submitting} onclick={() => skipCurrent()}>
            Skip
          </Button>
        {/if}
        {#if step < items.length - 1}
          <Button variant="primary" size="sm" disabled={submitting} onclick={() => goForward()}>
            Next
          </Button>
        {:else}
          <Button variant="primary" size="sm" disabled={submitting} onclick={() => goForward()}>
            Submit
          </Button>
        {/if}
      </div>
    </footer>
  {/if}
</article>

<style>
  .questionnaire {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.875rem;
    border: 1px solid oklch(var(--bc) / 0.14);
    border-radius: 0.5rem;
    background: oklch(var(--b1));
  }

  .questionnaire--answered {
    opacity: 0.85;
  }

  .questionnaire__header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .questionnaire__progress {
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: oklch(var(--bc) / 0.5);
  }

  .questionnaire__title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1.35;
    color: oklch(var(--bc));
  }

  .questionnaire__description,
  .questionnaire__summary {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: oklch(var(--bc) / 0.65);
  }

  .questionnaire__body {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .questionnaire__choices {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .questionnaire__choice {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid oklch(var(--bc) / 0.12);
    border-radius: 0.375rem;
    background: oklch(var(--b2) / 0.35);
    color: oklch(var(--bc));
    text-align: left;
    cursor: pointer;
    transition:
      border-color 140ms ease,
      background 140ms ease;
  }

  .questionnaire__choice:hover:not(:disabled) {
    border-color: oklch(var(--p) / 0.45);
    background: oklch(var(--p) / 0.06);
  }

  .questionnaire__choice--selected {
    border-color: oklch(var(--p) / 0.65);
    background: oklch(var(--p) / 0.1);
  }

  .questionnaire__choice:disabled {
    cursor: default;
    opacity: 0.7;
  }

  .questionnaire__shortcut {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 0.25rem;
    border-radius: 0.25rem;
    background: oklch(var(--bc) / 0.08);
    font-size: 0.6875rem;
    font-weight: 700;
    color: oklch(var(--bc) / 0.7);
  }

  .questionnaire__choice-text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }

  .questionnaire__choice-label {
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .questionnaire__choice-description {
    font-size: 0.75rem;
    color: oklch(var(--bc) / 0.6);
  }

  .questionnaire__input-label {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: oklch(var(--bc) / 0.7);
  }

  .questionnaire__input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.625rem;
    border: 1px solid oklch(var(--bc) / 0.14);
    border-radius: 0.375rem;
    background: oklch(var(--b1));
    color: oklch(var(--bc));
    font-size: 0.8125rem;
  }

  .questionnaire__input:focus {
    outline: 2px solid oklch(var(--p) / 0.45);
    outline-offset: 1px;
  }

  .questionnaire__error {
    margin: 0;
    font-size: 0.75rem;
    color: oklch(var(--er, var(--bc)) / 0.9);
  }

  .questionnaire__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding-top: 0.25rem;
  }

  .questionnaire__actions-end {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
</style>
