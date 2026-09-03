function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringifyText(text: unknown): string {
  if (typeof text === 'string') return text;
  if (typeof text === 'number' || typeof text === 'boolean') return String(text);
  if (text == null) return '';
  try {
    return JSON.stringify(text) ?? String(text);
  } catch {
    return String(text);
  }
}

/** Check for MCP `CallToolResult` content items carrying `isError`. */
function hasErrorContent(content: unknown): boolean {
  if (!Array.isArray(content)) return false;
  return content.some((item) => isPlainObject(item) && item.isError === true);
}

function textFromContent(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  // Prefer the errored item's text; fall back to the first text item.
  for (const item of content) {
    if (!isPlainObject(item)) continue;
    if (item.isError === true) {
      const text = stringifyText(item.text);
      if (text.trim()) return text.trim();
    }
  }
  for (const item of content) {
    if (!isPlainObject(item)) continue;
    if (item.type === 'text') {
      const text = stringifyText(item.text);
      if (text.trim()) return text.trim();
    }
  }
  return null;
}

/**
 * A page tool's `execute` can resolve normally while its MCP-style result still
 * carries `content[].isError = true` (or a top-level `isError`) -- the demo's
 * "Timed out waiting for UI to update (requestId: ...)" is exactly this shape.
 * The extension treats a resolved `execute` as success, so those were relayed as
 * `ok: true`, leaving the model to read contradictory "ok" + "isError: true"
 * content. Detect that shape and surface it as a real tool error.
 *
 * Returns an error string when the result is error-flagged, or null otherwise.
 */
export function extractToolResultError(result: unknown): string | null {
  if (!isPlainObject(result)) return null;

  const topIsError = result.isError === true;
  if (!topIsError && !hasErrorContent(result.content)) return null;

  const explicit = isPlainObject(result) && typeof result.error === 'string' ? result.error : undefined;
  if (explicit?.trim()) return explicit.trim();
  const message = result.message;
  if (typeof message === 'string' && message.trim()) return message.trim();

  const fromContent = textFromContent(result.content);
  if (fromContent) return fromContent;

  return 'Tool returned an error result.';
}
