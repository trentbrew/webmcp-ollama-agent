<script lang="ts">
  import { chatSessionState, getPendingQuestionnaire } from '../../chat.svelte';
  import QuestionnaireCard from './QuestionnaireCard.svelte';

  const pending = $derived.by(() => {
    chatSessionState.activeTabId;
    chatSessionState.detached;
    return getPendingQuestionnaire();
  });
</script>

{#if pending}
  <div class="questionnaire-dock">
    <QuestionnaireCard part={pending} />
  </div>
{/if}

<style>
  .questionnaire-dock {
    flex-shrink: 0;
    width: 100%;
    max-width: 48rem;
    margin: 0 auto;
  }
</style>
