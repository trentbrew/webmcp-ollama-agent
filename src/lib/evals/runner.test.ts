import { describe, expect, it, vi } from 'vitest';
import { normalizeToolCalls, runAttempt, type ChatTurnResult } from './runner';
import type { EvalCase } from './protocol';

function makeCase(overrides: Partial<EvalCase> = {}): EvalCase {
  return {
    id: 'case-1',
    origin: 'https://pizza.test',
    prompt: 'add pepperoni',
    kind: 'direct',
    setup: [],
    expected: [{ functionName: 'add_topping', arguments: { topping: 'pepperoni' } }],
    argMatch: 'subset',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function turn(name: string, args: unknown): ChatTurnResult {
  return { toolCalls: [{ function: { name, arguments: args as Record<string, unknown> } }], content: '' };
}

const noWrites = () => false;

describe('normalizeToolCalls', () => {
  it('parses arguments handed back as a JSON string', () => {
    const calls = normalizeToolCalls([
      { function: { name: 'a', arguments: '{"x":1}' as unknown as Record<string, unknown> } },
    ]);
    expect(calls).toEqual([{ functionName: 'a', arguments: { x: 1 } }]);
  });

  it('falls back to empty arguments for junk', () => {
    const calls = normalizeToolCalls([
      { function: { name: 'a', arguments: 'not json' as unknown as Record<string, unknown> } },
    ]);
    expect(calls).toEqual([{ functionName: 'a', arguments: {} }]);
  });

  it('returns nothing for an empty or missing list', () => {
    expect(normalizeToolCalls(undefined)).toEqual([]);
    expect(normalizeToolCalls([])).toEqual([]);
  });
});

describe('runAttempt', () => {
  it('never dispatches in dry-run mode', async () => {
    const dispatch = vi.fn();
    const attempt = await runAttempt({
      evalCase: makeCase(),
      index: 0,
      mode: 'dry-run',
      systemPrompt: 'sys',
      chat: async () => turn('add_topping', { topping: 'pepperoni' }),
      dispatch,
      isWriteTool: () => true,
      allowWrites: false,
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(attempt.verdict.pass).toBe(true);
  });

  it('stops after one turn in dry-run even when the model would chain', async () => {
    const chat = vi.fn(async () => turn('add_topping', { topping: 'pepperoni' }));
    await runAttempt({
      evalCase: makeCase(),
      index: 0,
      mode: 'dry-run',
      systemPrompt: 'sys',
      chat,
      dispatch: async () => ({ ok: true }),
      isWriteTool: noWrites,
      allowWrites: false,
    });
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it('runs the prelude with no model in the loop before the graded turn', async () => {
    const order: string[] = [];
    const attempt = await runAttempt({
      evalCase: makeCase({ setup: [{ functionName: 'start_order', arguments: { size: 'L' } }] }),
      index: 0,
      mode: 'dry-run',
      systemPrompt: 'sys',
      chat: async () => {
        order.push('chat');
        return turn('add_topping', { topping: 'pepperoni' });
      },
      dispatch: async (name) => {
        order.push(`dispatch:${name}`);
        return { ok: true };
      },
      isWriteTool: noWrites,
      allowWrites: false,
    });

    expect(order).toEqual(['dispatch:start_order', 'chat']);
    expect(attempt.verdict.pass).toBe(true);
  });

  it('fails fast when a prelude step throws', async () => {
    const chat = vi.fn();
    const attempt = await runAttempt({
      evalCase: makeCase({ setup: [{ functionName: 'start_order' }] }),
      index: 0,
      mode: 'dry-run',
      systemPrompt: 'sys',
      chat,
      dispatch: async () => ({ ok: false, error: 'no session' }),
      isWriteTool: noWrites,
      allowWrites: false,
    });

    expect(chat).not.toHaveBeenCalled();
    expect(attempt.verdict.failure).toBe('runtime-error');
    expect(attempt.verdict.detail).toContain('no session');
  });

  it('dispatches and feeds results back in execute mode', async () => {
    const dispatch = vi.fn(async () => ({ ok: true, result: { added: true } }));
    let called = false;
    const attempt = await runAttempt({
      evalCase: makeCase(),
      index: 0,
      mode: 'execute',
      systemPrompt: 'sys',
      chat: async (messages) => {
        if (called) return { toolCalls: [], content: 'done', ...{} };
        called = true;
        expect(messages.at(-1)?.role).toBe('user');
        return turn('add_topping', { topping: 'pepperoni' });
      },
      dispatch,
      isWriteTool: noWrites,
      allowWrites: false,
    });

    expect(dispatch).toHaveBeenCalledWith('add_topping', { topping: 'pepperoni' });
    expect(attempt.verdict.pass).toBe(true);
    expect(attempt.calls[0].ok).toBe(true);
  });

  it('blocks write dispatch in execute mode unless writes are allowed', async () => {
    const dispatch = vi.fn(async () => ({ ok: true }));
    let called = false;
    const attempt = await runAttempt({
      evalCase: makeCase(),
      index: 0,
      mode: 'execute',
      systemPrompt: 'sys',
      chat: async () => {
        if (called) return { toolCalls: [], content: '' };
        called = true;
        return turn('add_topping', { topping: 'pepperoni' });
      },
      dispatch,
      isWriteTool: () => true,
      allowWrites: false,
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(attempt.verdict.failure).toBe('runtime-error');
    expect(attempt.calls[0].error).toContain('Blocked');
  });

  it('surfaces a transport failure as model-error, not a tool problem', async () => {
    const attempt = await runAttempt({
      evalCase: makeCase(),
      index: 0,
      mode: 'dry-run',
      systemPrompt: 'sys',
      chat: async () => ({ toolCalls: [], content: '', error: 'Ollama unreachable' }),
      dispatch: async () => ({ ok: true }),
      isWriteTool: noWrites,
      allowWrites: false,
    });

    expect(attempt.verdict.failure).toBe('model-error');
    expect(attempt.verdict.detail).toBe('Ollama unreachable');
  });

  it('keeps the assistant prose when nothing was called', async () => {
    const attempt = await runAttempt({
      evalCase: makeCase(),
      index: 0,
      mode: 'dry-run',
      systemPrompt: 'sys',
      chat: async () => ({ toolCalls: [], content: 'I would add pepperoni for you.' }),
      dispatch: async () => ({ ok: true }),
      isWriteTool: noWrites,
      allowWrites: false,
    });

    expect(attempt.verdict.failure).toBe('no-call');
    expect(attempt.content).toContain('pepperoni');
  });
});
