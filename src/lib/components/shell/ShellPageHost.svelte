<script lang="ts">
  import type { PageType } from '../../stores/navigation';
  import { PageShell, getPageShellMeta } from './index';

  import HomePage from '../../pages/HomePage.svelte';
  import SettingsPage from '../../pages/SettingsPage.svelte';
  import HelpPage from '../../pages/HelpPage.svelte';
  import TrellisPage from '../../pages/TrellisPage.svelte';
  import McpPage from '../../pages/McpPage.svelte';
  import TracesPage from '../../pages/TracesPage.svelte';
  import EvalsPage from '../../pages/EvalsPage.svelte';
  import ComponentsDemo from '../../pages/ComponentsDemo.svelte';

  let { page }: { page: PageType } = $props();

  const meta = $derived(getPageShellMeta(page));
</script>

{#if meta}
  <PageShell
    variant={meta.variant}
    title={meta.title}
    description={meta.description}
    icon={meta.icon}
    hideHeader={meta.variant === 'fullBleed'}
  >
    {#if page === 'home'}
      <HomePage />
    {:else if page === 'settings'}
      <SettingsPage />
    {:else if page === 'help'}
      <HelpPage />
    {:else if page === 'facts'}
      <TrellisPage />
    {:else if page === 'mcp'}
      <McpPage />
    {:else if page === 'traces'}
      <TracesPage />
    {:else if page === 'evals'}
      <EvalsPage />
    {:else if page === 'components'}
      <ComponentsDemo />
    {/if}
  </PageShell>
{/if}
