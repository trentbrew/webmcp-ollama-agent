// Detect an active /, @, or # trigger at the composer's cursor position, adapted to
// webmcp's own entities: / = canned commands, @ = mention a WebMCP tool, # = reference
// a past trace entry. Same detection/replacement mechanics as pi-sprite's composer
// triggers (@file/#session/`/`slash), just pointed at different data.
export type ComposerTrigger =
  | { mode: 'slash'; query: string; start: number; end: number }
  | { mode: 'tool'; query: string; start: number; end: number }
  | { mode: 'trace'; query: string; start: number; end: number };

export function detectComposerTrigger(value: string, cursor: number): ComposerTrigger | null {
  const before = value.slice(0, cursor);

  const slashMatch = before.match(/(?:^|\s)\/([\w-]*)$/);
  if (slashMatch) {
    const token = slashMatch[0];
    const query = slashMatch[1] ?? '';
    const start = before.length - token.length + token.lastIndexOf('/');
    return { mode: 'slash', query, start, end: cursor };
  }

  const toolMatch = before.match(/@([\w.-]*)$/);
  if (toolMatch) {
    const token = toolMatch[0];
    const query = toolMatch[1] ?? '';
    const start = before.length - token.length;
    return { mode: 'tool', query, start, end: cursor };
  }

  const traceMatch = before.match(/#([\w-]*)$/);
  if (traceMatch) {
    const token = traceMatch[0];
    const query = traceMatch[1] ?? '';
    const start = before.length - token.length;
    return { mode: 'trace', query, start, end: cursor };
  }

  return null;
}

export function applyComposerReplacement(
  value: string,
  start: number,
  end: number,
  replacement: string,
): { value: string; cursor: number } {
  const next = value.slice(0, start) + replacement + value.slice(end);
  return { value: next, cursor: start + replacement.length };
}
