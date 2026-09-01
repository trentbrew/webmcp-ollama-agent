<script lang="ts">
  import { onMount } from 'svelte';
  import { getTrellisKernel, trellisState } from '../trellis/kernel.svelte';
  import type { EntityRecord } from 'trellis/browser-core';
  import { PageSection } from '../components/shell';
  import { Button } from '../components/ui';

  type FactRow = { entity: string; type: string; attribute: string; value: string };
  type RelRow = { source: string; attribute: string; target: string };

  let facts = $state<FactRow[]>([]);
  let relationships = $state<RelRow[]>([]);
  let creating = $state(false);

  onMount(() => {
    void bootAndLoad();
  });

  function refresh(entities: EntityRecord[]) {
    const nextFacts: FactRow[] = [];
    const nextRels: RelRow[] = [];
    for (const entity of entities) {
      for (const fact of entity.facts) {
        if (fact.a === 'type') continue;
        nextFacts.push({
          entity: entity.id,
          type: entity.type,
          attribute: fact.a,
          value: String(fact.v),
        });
      }
      for (const link of entity.links) {
        nextRels.push({ source: link.e1, attribute: link.a, target: link.e2 });
      }
    }
    facts = nextFacts;
    relationships = nextRels;
  }

  async function bootAndLoad() {
    try {
      const kernel = await getTrellisKernel();
      refresh(kernel.listEntities());
    } catch {
      // trellisState.error already set by getTrellisKernel().
    }
  }

  async function createTestEntity() {
    creating = true;
    try {
      const kernel = await getTrellisKernel();
      await kernel.createEntity(crypto.randomUUID(), 'webmcp.diagnostic', {
        note: `created at ${new Date().toLocaleTimeString()}`,
      });
      trellisState.opCount = kernel.getBackend().getOpCount();
      refresh(kernel.listEntities());
    } finally {
      creating = false;
    }
  }
</script>

<div class="space-y-3 h-full flex flex-col min-h-0">
  {#if trellisState.status === 'booting'}
    <p class="text-xs text-base-content/60 px-1">Booting kernel…</p>
  {:else if trellisState.status === 'error'}
    <p class="text-xs text-error px-1">{trellisState.error}</p>
  {:else if trellisState.status === 'ready'}
    <div class="flex items-center justify-between gap-2 flex-wrap px-1">
      <p class="text-xs text-base-content/60">
        {trellisState.opCount} op{trellisState.opCount === 1 ? '' : 's'} persisted
        ({trellisState.opsReplayed} replayed on boot).
      </p>
      <div class="flex gap-1.5">
        <Button variant="ghost" size="sm" onclick={() => void bootAndLoad()}>Refresh</Button>
        <Button size="sm" disabled={creating} onclick={() => void createTestEntity()}>
          {creating ? 'Creating…' : 'Add test fact'}
        </Button>
      </div>
    </div>
  {/if}

  <PageSection title="Facts ({facts.length})" class="min-h-0 flex-1">
    {#if facts.length === 0}
      <p class="text-xs text-base-content/60">No facts yet.</p>
    {:else}
      <div class="overflow-x-auto -mx-1">
        <table class="shell-table">
          <thead>
            <tr>
              <th>Entity</th>
              <th>Type</th>
              <th>Attr</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {#each facts as fact, i (`${fact.entity}:${fact.attribute}:${i}`)}
              <tr>
                <td class="font-mono text-[0.65rem] opacity-70 max-w-[4rem] truncate">{fact.entity}</td>
                <td>{fact.type}</td>
                <td>{fact.attribute}</td>
                <td class="break-all">{fact.value}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </PageSection>

  <PageSection title="Relationships ({relationships.length})">
    {#if relationships.length === 0}
      <p class="text-xs text-base-content/60">No relationships yet.</p>
    {:else}
      <div class="overflow-x-auto -mx-1">
        <table class="shell-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Rel</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {#each relationships as rel, i (`${rel.source}:${rel.attribute}:${rel.target}:${i}`)}
              <tr>
                <td class="font-mono text-[0.65rem] opacity-70 max-w-[4rem] truncate">{rel.source}</td>
                <td>{rel.attribute}</td>
                <td class="font-mono text-[0.65rem] opacity-70 max-w-[4rem] truncate">{rel.target}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </PageSection>
</div>
