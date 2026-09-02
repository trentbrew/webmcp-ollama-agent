/** Normalize tool schemas that arrive as JSON strings from page metadata. */
export function normalizeJsonValue(input: unknown): unknown {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed);
    } catch {
      return input;
    }
  }
  return input ?? {};
}

export function formatJsonDisplay(input: unknown): string {
  const normalized = normalizeJsonValue(input);
  if (typeof normalized === 'string') return normalized;
  try {
    return JSON.stringify(normalized, null, 2);
  } catch {
    return String(normalized);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Token-highlight pretty JSON for {@html} rendering (caller must sanitize if needed). */
export function highlightJson(input: unknown): string {
  const text = formatJsonDisplay(input);
  const escaped = escapeHtml(text);

  return escaped.replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let kind = 'number';
      if (/^"/.test(match)) {
        kind = /:$/.test(match) ? 'key' : 'string';
      } else if (/true|false/.test(match)) {
        kind = 'boolean';
      } else if (/null/.test(match)) {
        kind = 'null';
      }
      return `<span class="json-${kind}">${match}</span>`;
    },
  );
}
