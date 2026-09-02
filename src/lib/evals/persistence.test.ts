import { describe, expect, it } from 'vitest';
import { parseEvalSettings } from './persistence';
import { DEFAULT_EVAL_SETTINGS } from './protocol';

describe('parseEvalSettings', () => {
  it('falls back to defaults for a missing blob', () => {
    expect(parseEvalSettings(null)).toEqual(DEFAULT_EVAL_SETTINGS);
  });

  it('clamps runs into range', () => {
    expect(parseEvalSettings({ runs: 0 }).runs).toBe(1);
    expect(parseEvalSettings({ runs: 999 }).runs).toBe(10);
  });

  it('never restores write permission from disk', () => {
    expect(parseEvalSettings({ allowWrites: true, mode: 'execute' }).allowWrites).toBe(false);
  });

  it('keeps a persisted execute mode', () => {
    expect(parseEvalSettings({ mode: 'execute' }).mode).toBe('execute');
    expect(parseEvalSettings({ mode: 'nonsense' as never }).mode).toBe('dry-run');
  });
});
