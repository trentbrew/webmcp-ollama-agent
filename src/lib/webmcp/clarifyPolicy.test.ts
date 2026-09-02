import { describe, expect, it } from 'vitest';
import {
  CLARIFY_NUDGE_MESSAGE,
  shouldClarifyBeforeWrite,
  shouldInjectClarifyNudge,
  WRITE_TOOL_CLARIFY_PREAMBLE,
} from './clarifyPolicy';

describe('shouldClarifyBeforeWrite', () => {
  it('returns false for read-only tools', () => {
    expect(
      shouldClarifyBeforeWrite({
        toolName: 'list_entities',
        args: {},
        readOnlyHint: true,
      }),
    ).toBe(false);
  });

  it('returns true when spawn_prop is missing mesh and position', () => {
    expect(
      shouldClarifyBeforeWrite({
        toolName: 'spawn_prop',
        args: {},
        inputSchema: { required: ['mesh', 'position'] },
      }),
    ).toBe(true);
  });

  it('returns true when spawn_prop mesh is not a valid ref', () => {
    expect(
      shouldClarifyBeforeWrite({
        toolName: 'spawn_prop',
        args: { mesh: 'box', position: [0, 1, 0] },
        inputSchema: { required: ['mesh', 'position'] },
      }),
    ).toBe(true);
  });

  it('returns false when spawn_prop has explicit primitive mesh and position', () => {
    expect(
      shouldClarifyBeforeWrite({
        toolName: 'spawn_prop',
        args: { mesh: 'primitive:box', position: [0, 2, 0] },
        inputSchema: { required: ['mesh', 'position'] },
        userText: 'Spawn primitive:box at 0,2,0',
      }),
    ).toBe(false);
  });

  it('returns true when required schema field is missing from args', () => {
    expect(
      shouldClarifyBeforeWrite({
        toolName: 'set_entity_field',
        args: { entityId: 'entity:prop/1' },
        inputSchema: { required: ['entityId', 'component', 'field', 'value'] },
      }),
    ).toBe(true);
  });
});

describe('clarify nudge helpers', () => {
  it('injects nudge after two consecutive write errors', () => {
    expect(shouldInjectClarifyNudge(0)).toBe(false);
    expect(shouldInjectClarifyNudge(1)).toBe(false);
    expect(shouldInjectClarifyNudge(2)).toBe(true);
  });

  it('exports stable nudge copy', () => {
    expect(CLARIFY_NUDGE_MESSAGE).toContain('ask_user');
    expect(WRITE_TOOL_CLARIFY_PREAMBLE).toContain('ask_user');
  });
});
