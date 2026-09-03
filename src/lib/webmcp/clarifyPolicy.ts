import type { WebMcpToolSummary } from './protocol';

export const CLARIFY_NUDGE_MESSAGE =
  'Two writes in a row failed. Read the last error, then call a read-only tool to check the values this tool actually accepts and retry with corrected arguments. Use ask_user only if the error says the choice is genuinely the user\'s.';

export const WRITE_TOOL_CLARIFY_PREAMBLE =
  'Call this now with your best inferred arguments; fill anything the user left unspecified with a sensible default. If you need a valid value, look it up with a read-only tool rather than asking. Use ask_user only when this action is destructive or hard to undo, and never restate this tool\'s parameter list as a form.';

export function shouldInjectClarifyNudge(consecutiveWriteErrors: number): boolean {
  return consecutiveWriteErrors >= 2;
}

export function appendClarifyPreamble(description: string, readOnlyHint?: boolean): string {
  if (readOnlyHint === true) return description;
  return `${description} ${WRITE_TOOL_CLARIFY_PREAMBLE}`;
}

export function isPageWriteTool(name: string, pageTools: WebMcpToolSummary[]): boolean {
  const tool = pageTools.find((entry) => entry.name === name);
  return tool != null && tool.invokable && tool.annotations?.readOnlyHint !== true;
}
