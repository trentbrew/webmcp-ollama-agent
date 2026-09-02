import { describe, expect, it } from 'vitest';
import { diffArgs, flattenExpected, scoreCalls } from './scoring';
import type { ActualCall, ExpectedNode } from './protocol';

function call(functionName: string, args: Record<string, unknown> = {}): ActualCall {
  return { functionName, arguments: args };
}

describe('flattenExpected', () => {
  it('walks nested ordered and unordered groups in document order', () => {
    const expected: ExpectedNode[] = [
      { functionName: 'a' },
      { unordered: [{ functionName: 'b' }, { ordered: [{ functionName: 'c' }] }] },
    ];
    expect(flattenExpected(expected).map((leaf) => leaf.functionName)).toEqual(['a', 'b', 'c']);
  });
});

describe('diffArgs', () => {
  it('ignores extra actual keys in subset mode', () => {
    expect(diffArgs({ topping: 'pepperoni' }, { topping: 'pepperoni', qty: 1 }, 'subset')).toEqual([]);
  });

  it('flags extra actual keys in exact mode', () => {
    const mismatches = diffArgs({ topping: 'pepperoni' }, { topping: 'pepperoni', qty: 1 }, 'exact');
    expect(mismatches).toEqual([{ path: 'qty', expected: undefined, actual: 1 }]);
  });

  it('reports nested paths', () => {
    const mismatches = diffArgs({ size: { unit: 'in', value: 12 } }, { size: { unit: 'cm', value: 12 } }, 'subset');
    expect(mismatches).toEqual([{ path: 'size.unit', expected: 'in', actual: 'cm' }]);
  });

  it('compares arrays by position', () => {
    expect(diffArgs({ ids: [1, 2] }, { ids: [1, 2] }, 'subset')).toEqual([]);
    expect(diffArgs({ ids: [1, 2] }, { ids: [2, 1] }, 'subset')).toHaveLength(1);
  });

  it('grades nothing in ignore mode', () => {
    expect(diffArgs({ topping: 'pepperoni' }, { topping: 'anchovy' }, 'ignore')).toEqual([]);
  });
});

describe('scoreCalls', () => {
  it('passes an exact single call', () => {
    const verdict = scoreCalls([{ functionName: 'add_topping', arguments: { topping: 'pepperoni' } }], [
      call('add_topping', { topping: 'pepperoni' }),
    ]);
    expect(verdict.pass).toBe(true);
    expect(verdict.failure).toBeUndefined();
  });

  it('reports no-call when the model only talked', () => {
    const verdict = scoreCalls([{ functionName: 'add_topping' }], []);
    expect(verdict.failure).toBe('no-call');
  });

  it('reports wrong-tool and names the substitution', () => {
    const verdict = scoreCalls([{ functionName: 'add_topping' }], [call('remove_topping')]);
    expect(verdict.failure).toBe('wrong-tool');
    expect(verdict.detail).toContain('add_topping');
    expect(verdict.detail).toContain('remove_topping');
  });

  it('reports out-of-order when the right calls arrive in the wrong sequence', () => {
    const verdict = scoreCalls(
      [{ functionName: 'set_size' }, { functionName: 'add_topping' }],
      [call('add_topping'), call('set_size')],
    );
    expect(verdict.failure).toBe('out-of-order');
  });

  it('accepts either sequence inside an unordered group', () => {
    const expected: ExpectedNode[] = [
      { unordered: [{ functionName: 'set_size' }, { functionName: 'add_topping' }] },
    ];
    expect(scoreCalls(expected, [call('add_topping'), call('set_size')]).pass).toBe(true);
    expect(scoreCalls(expected, [call('set_size'), call('add_topping')]).pass).toBe(true);
  });

  it('matches an unordered group even when two leaves share a name', () => {
    const expected: ExpectedNode[] = [
      {
        unordered: [
          { functionName: 'add_topping', arguments: { topping: 'ham' } },
          { functionName: 'add_topping', arguments: { topping: 'bacon' } },
        ],
      },
    ];
    const verdict = scoreCalls(expected, [
      call('add_topping', { topping: 'bacon' }),
      call('add_topping', { topping: 'ham' }),
    ]);
    expect(verdict.pass).toBe(true);
  });

  it('reports wrong-arguments with the offending path', () => {
    const verdict = scoreCalls(
      [{ functionName: 'add_topping', arguments: { topping: 'pepperoni' } }],
      [call('add_topping', { topping: 'all meats' })],
    );
    expect(verdict.failure).toBe('wrong-arguments');
    expect(verdict.mismatches).toEqual([
      { path: 'topping', expected: 'pepperoni', actual: 'all meats' },
    ]);
  });

  it('reports extra-calls when the model keeps going after the goal', () => {
    const verdict = scoreCalls([{ functionName: 'add_topping' }], [call('add_topping'), call('checkout')]);
    expect(verdict.failure).toBe('extra-calls');
    expect(verdict.detail).toContain('checkout');
  });

  it('fails a matched call that threw at runtime', () => {
    const verdict = scoreCalls([{ functionName: 'add_topping' }], [
      { functionName: 'add_topping', arguments: {}, ok: false, error: 'boom' },
    ]);
    expect(verdict.failure).toBe('runtime-error');
    expect(verdict.detail).toContain('boom');
  });

  it('treats a case with no expected calls as unusable', () => {
    expect(scoreCalls([], [call('add_topping')]).failure).toBe('model-error');
  });
});
