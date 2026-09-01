import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SqlJsKernelBackend, TrellisKernel } from 'trellis/browser-core';

// runTrellisTool() calls getTrellisKernel() from kernel.svelte.ts, which hard-gates
// on OPFS being available (by design -- it's meant to error loudly outside a real
// extension side panel) and resolves the WASM binary via chrome.runtime.getURL.
// Neither exists under plain Node/vitest. Rather than polyfill chrome/OPFS, swap in
// a real kernel backed by sql.js's `:memory:` mode -- that mode never touches
// fs/OPFS/chrome.* at all (verified in kernelShim.ts/SqlJsKernelBackend's own
// loadFromDisk/flushToDisk short-circuits), so it runs natively here with zero
// shimming. This tests real kernel behavior, not a mock of it -- only the
// extension-specific storage plumbing is swapped out.
vi.mock('./kernel.svelte', async () => {
  let kernelPromise: Promise<TrellisKernel> | null = null;

  async function boot(): Promise<TrellisKernel> {
    const backend = await SqlJsKernelBackend.create({ dbPath: ':memory:' });
    backend.init();
    const kernel = new TrellisKernel({ backend, agentId: 'vitest', autoReplay: true });
    kernel.boot();
    return kernel;
  }

  return {
    trellisState: { status: 'ready', error: null, opsReplayed: 0, opCount: 0 },
    getTrellisKernel: () => {
      if (!kernelPromise) kernelPromise = boot();
      return kernelPromise;
    },
  };
});

const { runTrellisTool, TRELLIS_TOOL_NAMES } = await import('./tools');

function uniqueType(label: string) {
  return `webmcp.test.${label}.${crypto.randomUUID()}`;
}

describe('runTrellisTool', () => {
  beforeAll(async () => {
    // Warm the kernel once so the first real test isn't paying WASM-init latency.
    await runTrellisTool(TRELLIS_TOOL_NAMES.status, {});
  });

  it('reports status once booted', async () => {
    const result = await runTrellisTool(TRELLIS_TOOL_NAMES.status, {});
    expect(result.ok).toBe(true);
    expect(result.result).toMatchObject({ agentId: 'vitest' });
  });

  it('rejects an unknown tool name', async () => {
    const result = await runTrellisTool('trellis_not_a_real_tool', {});
    expect(result).toEqual({ ok: false, error: 'Unhandled Trellis tool "trellis_not_a_real_tool".' });
  });

  describe('createEntity', () => {
    it('creates an entity and returns its id, delta, and op hash', async () => {
      const type = uniqueType('create');
      const result = await runTrellisTool(TRELLIS_TOOL_NAMES.createEntity, {
        type,
        attributes: { title: 'hello', count: 3, active: true },
      });

      expect(result.ok).toBe(true);
      const created = result.result as { id: string; type: string; factsAdded: number; opHash: string };
      expect(created.type).toBe(type);
      expect(created.factsAdded).toBeGreaterThan(0);
      expect(typeof created.opHash).toBe('string');
      expect(typeof created.id).toBe('string');
    });

    it('honors a caller-provided id', async () => {
      const type = uniqueType('create-id');
      const id = `custom-${crypto.randomUUID()}`;
      const result = await runTrellisTool(TRELLIS_TOOL_NAMES.createEntity, { id, type, attributes: {} });
      expect(result.ok).toBe(true);
      expect((result.result as { id: string }).id).toBe(id);
    });

    it('rejects a missing type', async () => {
      const result = await runTrellisTool(TRELLIS_TOOL_NAMES.createEntity, { attributes: {} });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/type/);
    });

    it('rejects a non-primitive attribute value', async () => {
      const type = uniqueType('create-bad-attr');
      const result = await runTrellisTool(TRELLIS_TOOL_NAMES.createEntity, {
        type,
        attributes: { nested: { not: 'allowed' } },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/attributes\.nested/);
    });
  });

  describe('readEntity / updateEntity / deleteEntity', () => {
    it('reads back an entity with the attributes it was created with', async () => {
      const type = uniqueType('read');
      const create = await runTrellisTool(TRELLIS_TOOL_NAMES.createEntity, {
        type,
        attributes: { title: 'read me' },
      });
      const id = (create.result as { id: string }).id;

      const read = await runTrellisTool(TRELLIS_TOOL_NAMES.readEntity, { id });
      expect(read.ok).toBe(true);
      expect(read.result).toMatchObject({ id, type, attributes: { title: 'read me' } });
    });

    it('returns a null result (not an error) for a nonexistent id', async () => {
      const read = await runTrellisTool(TRELLIS_TOOL_NAMES.readEntity, { id: 'does-not-exist' });
      expect(read).toEqual({ ok: true, result: null });
    });

    it('updates attributes and the update is visible on the next read', async () => {
      const type = uniqueType('update');
      const create = await runTrellisTool(TRELLIS_TOOL_NAMES.createEntity, {
        type,
        attributes: { title: 'before' },
      });
      const id = (create.result as { id: string }).id;

      const update = await runTrellisTool(TRELLIS_TOOL_NAMES.updateEntity, {
        id,
        attributes: { title: 'after' },
      });
      expect(update.ok).toBe(true);

      const read = await runTrellisTool(TRELLIS_TOOL_NAMES.readEntity, { id });
      expect(read.result).toMatchObject({ attributes: { title: 'after' } });
    });

    it('deletes an entity so it no longer reads back', async () => {
      const type = uniqueType('delete');
      const create = await runTrellisTool(TRELLIS_TOOL_NAMES.createEntity, { type, attributes: {} });
      const id = (create.result as { id: string }).id;

      const del = await runTrellisTool(TRELLIS_TOOL_NAMES.deleteEntity, { id });
      expect(del.ok).toBe(true);

      const read = await runTrellisTool(TRELLIS_TOOL_NAMES.readEntity, { id });
      expect(read).toEqual({ ok: true, result: null });
    });
  });

  describe('listEntities', () => {
    it('filters by type and clamps the limit', async () => {
      const type = uniqueType('list');
      for (let i = 0; i < 5; i += 1) {
        await runTrellisTool(TRELLIS_TOOL_NAMES.createEntity, { type, attributes: { i } });
      }

      const listed = await runTrellisTool(TRELLIS_TOOL_NAMES.listEntities, { type, limit: 3 });
      expect(listed.ok).toBe(true);
      const body = listed.result as { entities: unknown[]; count: number; limit: number };
      expect(body.limit).toBe(3);
      expect(body.entities).toHaveLength(3);
    });

    it('clamps an over-large limit to the 100 cap and a negative limit up to 1', async () => {
      const type = uniqueType('list-clamp');
      await runTrellisTool(TRELLIS_TOOL_NAMES.createEntity, { type, attributes: {} });

      const tooBig = await runTrellisTool(TRELLIS_TOOL_NAMES.listEntities, { type, limit: 500 });
      expect((tooBig.result as { limit: number }).limit).toBe(100);

      const negative = await runTrellisTool(TRELLIS_TOOL_NAMES.listEntities, { type, limit: -5 });
      expect((negative.result as { limit: number }).limit).toBe(1);
    });
  });

  describe('addLink / removeLink', () => {
    it('links two entities and the link is visible on the source, then removable', async () => {
      const type = uniqueType('link');
      const a = (await runTrellisTool(TRELLIS_TOOL_NAMES.createEntity, { type, attributes: {} })).result as { id: string };
      const b = (await runTrellisTool(TRELLIS_TOOL_NAMES.createEntity, { type, attributes: {} })).result as { id: string };

      const link = await runTrellisTool(TRELLIS_TOOL_NAMES.addLink, {
        sourceId: a.id,
        attribute: 'relatesTo',
        targetId: b.id,
      });
      expect(link.ok).toBe(true);

      const read = await runTrellisTool(TRELLIS_TOOL_NAMES.readEntity, { id: a.id });
      const links = (read.result as { links: Array<{ a: string; e2: string }> }).links;
      expect(links.some((entry) => entry.a === 'relatesTo' && entry.e2 === b.id)).toBe(true);

      const removed = await runTrellisTool(TRELLIS_TOOL_NAMES.removeLink, {
        sourceId: a.id,
        attribute: 'relatesTo',
        targetId: b.id,
      });
      expect(removed.ok).toBe(true);

      const readAfter = await runTrellisTool(TRELLIS_TOOL_NAMES.readEntity, { id: a.id });
      const linksAfter = (readAfter.result as { links: Array<{ a: string; e2: string }> }).links;
      expect(linksAfter.some((entry) => entry.a === 'relatesTo' && entry.e2 === b.id)).toBe(false);
    });
  });

  describe('query', () => {
    it('finds entities by type via EQL-S', async () => {
      const type = uniqueType('query');
      await runTrellisTool(TRELLIS_TOOL_NAMES.createEntity, { type, attributes: { tag: 'x' } });
      await runTrellisTool(TRELLIS_TOOL_NAMES.createEntity, { type, attributes: { tag: 'y' } });

      const result = await runTrellisTool(TRELLIS_TOOL_NAMES.query, {
        query: `find ?e where type = "${type}"`,
      });

      expect(result.ok).toBe(true);
      const body = result.result as { bindings: unknown[]; count: number };
      expect(body.count).toBe(2);
      expect(body.bindings).toHaveLength(2);
    });

    it('surfaces a malformed query as a tool error, not a thrown exception', async () => {
      const result = await runTrellisTool(TRELLIS_TOOL_NAMES.query, { query: '!!! not eql-s at all ???' });
      expect(result.ok).toBe(false);
      expect(typeof result.error).toBe('string');
    });
  });

  describe('readOps', () => {
    it('returns recent ops newest-first, respecting the limit', async () => {
      const type = uniqueType('ops');
      await runTrellisTool(TRELLIS_TOOL_NAMES.createEntity, { type, attributes: { n: 1 } });
      await runTrellisTool(TRELLIS_TOOL_NAMES.createEntity, { type, attributes: { n: 2 } });

      const result = await runTrellisTool(TRELLIS_TOOL_NAMES.readOps, { limit: 2 });
      expect(result.ok).toBe(true);
      const body = result.result as { ops: Array<{ timestamp: string }>; count: number };
      expect(body.count).toBe(2);
      const [first, second] = body.ops;
      expect(new Date(first.timestamp).getTime()).toBeGreaterThanOrEqual(new Date(second.timestamp).getTime());
    });
  });
});
