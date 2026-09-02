import { describe, expect, it } from 'vitest';
import { exportSuite, importSuite, summarizeExpected, toChromeCase } from './format';
import type { EvalCase } from './protocol';

const sample: EvalCase = {
  id: 'case-1',
  origin: 'https://pizza.test',
  prompt: 'add pepperoni',
  kind: 'direct',
  setup: [{ functionName: 'start_order' }],
  expected: [{ functionName: 'add_topping', arguments: { topping: 'pepperoni' } }],
  argMatch: 'subset',
  createdAt: 1,
  updatedAt: 1,
};

describe('toChromeCase', () => {
  it('emits Chrome-shaped messages and expectedCall', () => {
    const chrome = toChromeCase(sample);
    expect(chrome.messages).toEqual([{ role: 'user', content: 'add pepperoni' }]);
    expect(chrome.expectedCall).toEqual(sample.expected);
    expect(chrome.webmcp?.setup).toEqual(sample.setup);
  });
});

describe('importSuite', () => {
  it('round-trips a suite exported here', () => {
    const raw = JSON.stringify(exportSuite([sample], sample.origin));
    const { cases, skipped } = importSuite(raw, 'https://fallback.test');
    expect(skipped).toBe(0);
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({
      id: sample.id,
      origin: sample.origin,
      prompt: sample.prompt,
      argMatch: 'subset',
      setup: sample.setup,
      expected: sample.expected,
    });
  });

  it('reads a bare array of Chrome cases with no webmcp block', () => {
    const raw = JSON.stringify([
      {
        messages: [{ role: 'user', content: 'all the meat' }],
        expectedCall: [{ functionName: 'add_topping', arguments: { topping: 'ham' } }],
      },
    ]);
    const { cases } = importSuite(raw, 'https://fallback.test');
    expect(cases[0].origin).toBe('https://fallback.test');
    expect(cases[0].kind).toBe('direct');
    expect(cases[0].argMatch).toBe('subset');
    expect(cases[0].setup).toEqual([]);
  });

  it('joins multiple user turns into one prompt', () => {
    const raw = JSON.stringify([
      {
        messages: [
          { role: 'user', content: 'start an order' },
          { role: 'assistant', content: 'sure' },
          { role: 'user', content: 'add pepperoni' },
        ],
        expectedCall: [{ functionName: 'add_topping' }],
      },
    ]);
    expect(importSuite(raw, 'x').cases[0].prompt).toBe('start an order\n\nadd pepperoni');
  });

  it('skips cases with no prompt or no expected calls', () => {
    const raw = JSON.stringify([
      { messages: [], expectedCall: [{ functionName: 'a' }] },
      { messages: [{ role: 'user', content: 'hi' }], expectedCall: [] },
      { messages: [{ role: 'user', content: 'hi' }], expectedCall: [{ functionName: 'a' }] },
    ]);
    const { cases, skipped } = importSuite(raw, 'x');
    expect(cases).toHaveLength(1);
    expect(skipped).toBe(2);
  });

  it('preserves nested groups through import', () => {
    const raw = JSON.stringify([
      {
        messages: [{ role: 'user', content: 'both toppings' }],
        expectedCall: [{ unordered: [{ functionName: 'a' }, { functionName: 'b' }] }],
      },
    ]);
    expect(importSuite(raw, 'x').cases[0].expected).toEqual([
      { unordered: [{ functionName: 'a' }, { functionName: 'b' }] },
    ]);
  });

  it('throws on non-JSON input', () => {
    expect(() => importSuite('not json', 'x')).toThrow(/valid JSON/);
  });
});

describe('summarizeExpected', () => {
  it('renders a chain with unordered groups braced', () => {
    expect(
      summarizeExpected([
        { functionName: 'start' },
        { unordered: [{ functionName: 'a' }, { functionName: 'b' }] },
      ]),
    ).toBe('start → {a → b}');
  });
});
