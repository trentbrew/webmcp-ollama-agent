import { describe, expect, it } from 'vitest';
import { buildWaterfall } from './waterfall';
import { isValidTrace, normalizeTraces } from './traces';
import type { ToolCallTrace } from './protocol';

const baseTrace: ToolCallTrace = {
  id: 'trace-1',
  tabId: 1,
  toolName: 'move',
  origin: 'page',
  args: { direction: 'north' },
  ok: true,
  startedAt: 1000,
  durationMs: 120,
  source: 'agent',
};

describe('traces', () => {
  it('rejects malformed entries missing id or timestamps', () => {
    expect(isValidTrace({ ...baseTrace, id: '' })).toBe(false);
    expect(isValidTrace({ ...baseTrace, startedAt: Number.NaN })).toBe(false);
    expect(isValidTrace(undefined)).toBe(false);
  });

  it('filters invalid traces before layout', () => {
    const traces = normalizeTraces([
      baseTrace,
      { ...baseTrace, id: '', toolName: 'bad' } as ToolCallTrace,
      { ...baseTrace, id: 'trace-2', startedAt: 1120, durationMs: 80 },
    ]);
    expect(traces).toHaveLength(2);
    expect(buildWaterfall(traces).spans).toHaveLength(2);
  });
});

describe('buildWaterfall', () => {
  it('assigns lanes for overlapping calls', () => {
    const layout = buildWaterfall([
      baseTrace,
      { ...baseTrace, id: 'trace-2', startedAt: 1050, durationMs: 200 },
    ]);
    expect(layout.laneCount).toBe(2);
    expect(layout.spans.every((span) => span.id.length > 0)).toBe(true);
  });

  it('marks pending spans', () => {
    const layout = buildWaterfall([{ ...baseTrace, pending: true, durationMs: 0 }]);
    expect(layout.spans[0]?.pending).toBe(true);
  });
});
