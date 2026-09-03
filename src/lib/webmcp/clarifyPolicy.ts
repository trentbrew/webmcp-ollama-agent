import type { WebMcpToolSummary } from './protocol';

export type ClarifyContext = {
  toolName: string;
  args: Record<string, unknown>;
  inputSchema?: Record<string, unknown>;
  readOnlyHint?: boolean;
  userText?: string;
};

export const CLARIFY_NUDGE_MESSAGE =
  'Clarify required: call ask_user with inferred defaults before retrying this write tool.';

export const WRITE_TOOL_CLARIFY_PREAMBLE =
  'Do not restate this tool\'s parameter list as a form or ask for its field names verbatim. Infer values from the user message or read current page state first. If only an answer the user knows is missing and you cannot enumerate the options, ask one short question in plain prose — never show a blank schema-shaped form. Use ask_user only when choices are enumerable or the value is constrained.';

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

export function shouldClarifyBeforeWrite(ctx: ClarifyContext): boolean {
  if (ctx.readOnlyHint === true) return false;

  const required = getRequiredFields(ctx.inputSchema);
  for (const field of required) {
    if (!hasValidArg(ctx.args, field, ctx.toolName) && !isExplicitInUserText(ctx.userText, field, ctx.args[field])) {
      return true;
    }
  }

  if (ctx.toolName === 'spawn_prop') {
    if (!hasValidMesh(ctx.args.mesh) && !userCitedMesh(ctx.userText)) return true;
    if (!hasValidPosition(ctx.args.position) && !userCitedPosition(ctx.userText)) return true;
  }

  return false;
}

function getRequiredFields(inputSchema?: Record<string, unknown>): string[] {
  const required = inputSchema?.required;
  return Array.isArray(required) ? required.filter((field): field is string => typeof field === 'string') : [];
}

function hasValidArg(args: Record<string, unknown>, field: string, toolName: string): boolean {
  const value = args[field];
  if (value == null || value === '') return false;
  if (toolName === 'spawn_prop' && field === 'mesh') return hasValidMesh(value);
  if (toolName === 'spawn_prop' && field === 'position') return hasValidPosition(value);
  return true;
}

function hasValidMesh(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  return value.startsWith('primitive:') || value.includes('/') || value.includes('.');
}

function hasValidPosition(value: unknown): boolean {
  if (!Array.isArray(value) || value.length < 3) return false;
  return value.slice(0, 3).every((entry) => typeof entry === 'number' && Number.isFinite(entry));
}

function isExplicitInUserText(userText: string | undefined, field: string, argValue: unknown): boolean {
  if (!userText?.trim()) return false;
  const text = userText.toLowerCase();

  if (field === 'mesh' && typeof argValue === 'string') {
    return text.includes(argValue.toLowerCase()) || (argValue.startsWith('primitive:') && text.includes(argValue.slice('primitive:'.length)));
  }

  if (field === 'position' && Array.isArray(argValue)) {
    return argValue.every((entry) => String(entry) === String(entry) && text.includes(String(entry)));
  }

  if (typeof argValue === 'string' && argValue.trim()) {
    return text.includes(argValue.toLowerCase());
  }

  return false;
}

function userCitedMesh(userText: string | undefined): boolean {
  if (!userText) return false;
  return /primitive:\w+/.test(userText) || /\.glb\b/i.test(userText) || /\b(box|sphere|capsule|cylinder)\b/i.test(userText);
}

function userCitedPosition(userText: string | undefined): boolean {
  if (!userText) return false;
  return /\[\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\]/.test(userText);
}
