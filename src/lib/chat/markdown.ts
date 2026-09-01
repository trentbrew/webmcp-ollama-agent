import DOMPurify from 'dompurify';
import { marked, Renderer } from 'marked';

const renderer = new Renderer();
renderer.link = ({ href, title, tokens }) => {
  const text = renderer.parser.parseInline(tokens);
  const titleAttr = title ? ` title="${title}"` : '';
  return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
};

marked.setOptions({ gfm: true, breaks: false, renderer });

export function renderMarkdown(source: string): string {
  const html = marked.parse(source, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel'],
  });
}
