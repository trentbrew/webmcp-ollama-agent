import { describe, expect, it } from 'vitest';
import { appendClarifyPreamble, WRITE_TOOL_CLARIFY_PREAMBLE } from './clarifyPolicy';

describe('appendClarifyPreamble', () => {
  it('appends clarify preamble to write page tool descriptions', () => {
    const result = appendClarifyPreamble('Place a static 3D model in the world.');
    expect(result).toContain(WRITE_TOOL_CLARIFY_PREAMBLE);
    expect(result).toContain('read-only tool rather than asking');
  });

  it('leaves read-only tool descriptions unchanged', () => {
    const description = 'List entities in the scene.';
    expect(appendClarifyPreamble(description, true)).toBe(description);
  });
});
