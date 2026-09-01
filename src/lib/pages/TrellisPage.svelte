<script lang="ts">
  import { onMount } from 'svelte';
  import { Layers } from '../icons';
  import { getTrellisKernel, trellisState } from '../trellis/kernel.svelte';
  import type { KernelOp } from 'trellis/browser-core';

  let ops = $state<KernelOp[]>([]);
  let creating = $state(false);

  onMount(() => {
    void bootAndLoad();
  });

  async function bootAndLoad() {
    try {
      const kernel = await getTrellisKernel();
      ops = kernel.readAllOps();
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
      ops = kernel.readAllOps();
    } finally {
      creating = false;
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-3">
    <Layers size={32} class="text-primary" />
    <div>
      <h1 class="text-3xl font-bold">Trellis (embedded)</h1>
      <p class="text-sm opacity-70">Local-first graph kernel running in this side panel — diagnostic view.</p>
    </div>
  </div>

  <div class="card thread-card">
    <div class="card-body">
      <h2 class="card-title">Status</h2>

      {#if trellisState.status === 'booting'}
        <div class="alert alert-info">
          <span>Booting kernel…</span>
        </div>
      {:else if trellisState.status === 'error'}
        <div class="alert alert-error">
          <span>{trellisState.error}</span>
        </div>
      {:else if trellisState.status === 'ready'}
        <div class="alert alert-success">
          <span>
            Ready — {trellisState.opCount} op{trellisState.opCount === 1 ? '' : 's'} persisted
            ({trellisState.opsReplayed} replayed on boot).
          </span>
        </div>
      {/if}

      <p class="text-xs opacity-60">
        Storage is a shim (OPFS via a monkeypatched <code>SqlJsKernelBackend</code>) — see the build notes for why
        this is a stopgap, not upstream trellis-node behavior.
      </p>

      <div class="card-actions justify-end mt-2">
        <button class="btn btn-primary btn-sm" disabled={creating || trellisState.status !== 'ready'} onclick={() => void createTestEntity()}>
          {creating ? 'Creating…' : 'Create test entity'}
        </button>
      </div>
    </div>
  </div>

  <div class="card thread-card">
    <div class="card-body">
      <h2 class="card-title">Op log ({ops.length})</h2>
      {#if ops.length === 0}
        <p class="text-sm opacity-60">No ops yet.</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="table table-xs">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Timestamp</th>
                <th>Hash</th>
              </tr>
            </thead>
            <tbody>
              {#each [...ops].reverse().slice(0, 20) as op (op.hash)}
                <tr>
                  <td>{op.kind}</td>
                  <td class="tabular-nums">{new Date(op.timestamp).toLocaleTimeString()}</td>
                  <td class="font-mono text-xs opacity-60">{op.hash.slice(0, 16)}…</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</div>
