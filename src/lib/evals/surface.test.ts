import { describe, expect, it } from 'vitest';
import { diffSurface, hasDrift, isBlockingDrift, snapshotSurface, stableStringify } from './surface';
import type { WebMcpToolSummary } from '../webmcp/protocol';

function tool(
  name: string,
  description = 'does a thing',
  inputSchema: object = { type: 'object', properties: { a: { type: 'string' } } },
): WebMcpToolSummary {
  return { name, description, inputSchema, origin: 'https://example.test', invokable: true };
}

describe('stableStringify', () => {
  it('is insensitive to key order', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it('is sensitive to array order', () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });
});

describe('diffSurface', () => {
  const snapshot = snapshotSurface('https://example.test', [tool('add_topping'), tool('checkout')]);

  it('reports nothing when the surface is unchanged', () => {
    const diff = diffSurface(snapshot, [tool('checkout'), tool('add_topping')]);
    expect(hasDrift(diff)).toBe(false);
  });

  it('is not fooled by a reordered schema', () => {
    const reordered = tool('add_topping', 'does a thing', {
      properties: { a: { type: 'string' } },
      type: 'object',
    });
    expect(hasDrift(diffSurface(snapshot, [reordered, tool('checkout')]))).toBe(false);
  });

  it('catches added, removed, and changed tools', () => {
    const diff = diffSurface(snapshot, [
      tool('add_topping', 'now says something else'),
      tool('set_size'),
    ]);
    expect(diff.added).toEqual(['set_size']);
    expect(diff.removed).toEqual(['checkout']);
    expect(diff.descriptionChanged).toEqual(['add_topping']);
  });

  it('reports no drift without a snapshot to compare against', () => {
    expect(hasDrift(diffSurface(undefined, [tool('anything')]))).toBe(false);
  });
});

describe('isBlockingDrift', () => {
  const snapshot = snapshotSurface('https://example.test', [tool('add_topping')]);

  it('blocks when a tool the case expects changed', () => {
    const diff = diffSurface(snapshot, [tool('add_topping', 'reworded')]);
    expect(isBlockingDrift(diff, ['add_topping'])).toBe(true);
  });

  it('does not block on an unrelated new tool', () => {
    const diff = diffSurface(snapshot, [tool('add_topping'), tool('unrelated')]);
    expect(hasDrift(diff)).toBe(true);
    expect(isBlockingDrift(diff, ['add_topping'])).toBe(false);
  });
});
