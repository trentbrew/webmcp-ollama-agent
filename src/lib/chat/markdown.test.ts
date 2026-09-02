import { describe, expect, it, vi } from 'vitest';

vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html,
  },
}));

import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('syntax-highlights fenced javascript blocks', () => {
    const html = renderMarkdown('```javascript\nconst x = 1;\n```');
    expect(html).toContain('class="hljs language-javascript"');
    expect(html).toContain('hljs-keyword');
  });

  it('syntax-highlights json fences', () => {
    const html = renderMarkdown('```json\n{"a":1}\n```');
    expect(html).toContain('json-key');
  });

  it('preserves inline code without hljs wrapper', () => {
    const html = renderMarkdown('Use `npm install` here.');
    expect(html).toContain('<code>npm install</code>');
    expect(html).not.toContain('hljs language-');
  });
});
