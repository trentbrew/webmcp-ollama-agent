import { describe, expect, it } from 'vitest';
import { highlightSourceCode, normalizeCodeLanguage } from './codeHighlight';

describe('normalizeCodeLanguage', () => {
  it('maps common aliases', () => {
    expect(normalizeCodeLanguage('ts')).toBe('typescript');
    expect(normalizeCodeLanguage('py')).toBe('python');
    expect(normalizeCodeLanguage('')).toBe('plaintext');
  });
});

describe('highlightSourceCode', () => {
  it('highlights javascript keywords and strings', () => {
    const html = highlightSourceCode('const name = "hello";', 'javascript');
    expect(html).toContain('hljs-keyword');
    expect(html).toContain('hljs-string');
    expect(html).not.toContain('<script');
  });

  it('delegates json fences to json highlighter', () => {
    const html = highlightSourceCode('{"ok":true}', 'json');
    expect(html).toContain('json-key');
    expect(html).toContain('json-boolean');
  });

  it('escapes html in plaintext blocks', () => {
    const html = highlightSourceCode('<script>alert(1)</script>', 'plaintext');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
