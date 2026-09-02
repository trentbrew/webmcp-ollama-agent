import { describe, expect, it } from 'vitest';
import { formatJsonDisplay, highlightJson, normalizeJsonValue } from './jsonHighlight';

describe('normalizeJsonValue', () => {
  it('parses JSON string schemas', () => {
    const raw = '{"type":"object","properties":{"location":{"type":"string"}}}';
    expect(normalizeJsonValue(raw)).toEqual({
      type: 'object',
      properties: { location: { type: 'string' } },
    });
  });

  it('returns objects unchanged', () => {
    const obj = { type: 'object' };
    expect(normalizeJsonValue(obj)).toBe(obj);
  });
});

describe('highlightJson', () => {
  it('pretty-prints and wraps tokens', () => {
    const html = highlightJson({ type: 'object', required: ['location'] });
    expect(html).toContain('json-key');
    expect(html).toContain('json-string');
    expect(html).toContain('\n');
    expect(html).not.toContain('&lt;script');
  });

  it('handles string input schema', () => {
    const html = highlightJson('{"type":"object"}');
    expect(formatJsonDisplay('{"type":"object"}')).toContain('"type"');
    expect(html).toContain('json-key');
  });
});
