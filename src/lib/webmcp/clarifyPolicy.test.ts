import { describe, expect, it } from 'vitest';
import {
  CLARIFY_NUDGE_MESSAGE,
  isPageWriteTool,
  shouldInjectClarifyNudge,
  WRITE_TOOL_CLARIFY_PREAMBLE,
} from './clarifyPolicy';
import type { WebMcpToolSummary } from './protocol';

const tools: WebMcpToolSummary[] = [
  {
    name: 'spawn_prop',
    description: 'Place a static 3D model.',
    origin: 'page',
    invokable: true,
    annotations: { readOnlyHint: false },
  },
  {
    name: 'list_entities',
    description: 'List entities.',
    origin: 'page',
    invokable: true,
    annotations: { readOnlyHint: true },
  },
];

describe('isPageWriteTool', () => {
  it('identifies invokable non-read-only page tools', () => {
    expect(isPageWriteTool('spawn_prop', tools)).toBe(true);
    expect(isPageWriteTool('list_entities', tools)).toBe(false);
    expect(isPageWriteTool('unknown_tool', tools)).toBe(false);
  });
});

describe('clarify nudge helpers', () => {
  it('injects nudge after two consecutive write errors', () => {
    expect(shouldInjectClarifyNudge(0)).toBe(false);
    expect(shouldInjectClarifyNudge(1)).toBe(false);
    expect(shouldInjectClarifyNudge(2)).toBe(true);
  });

  it('points a stuck agent at read-only discovery, not at asking', () => {
    expect(CLARIFY_NUDGE_MESSAGE).toContain('read-only tool');
    expect(WRITE_TOOL_CLARIFY_PREAMBLE).toContain('Call this now');
  });

  it('still names ask_user as the destructive-action escape hatch', () => {
    expect(CLARIFY_NUDGE_MESSAGE).toContain('ask_user');
    expect(WRITE_TOOL_CLARIFY_PREAMBLE).toContain('ask_user');
  });
});
