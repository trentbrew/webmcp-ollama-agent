import type { ToolCallTrace, WebMcpToolSummary } from '../webmcp/protocol';

export function formatToolMention(name: string): string {
  return `@${name}`;
}

export function formatTraceMention(trace: ToolCallTrace): string {
  return `#${trace.id.slice(0, 8)}`;
}

export function filterToolMentions(tools: WebMcpToolSummary[], query: string, limit = 8): WebMcpToolSummary[] {
  const q = query.trim().toLowerCase();
  const list = q ? tools.filter((tool) => tool.name.toLowerCase().includes(q)) : tools;
  return list.slice(0, limit);
}

export function filterTraceMentions(traces: ToolCallTrace[], query: string, limit = 8): ToolCallTrace[] {
  const q = query.trim().toLowerCase();
  const sorted = [...traces].sort((a, b) => b.startedAt - a.startedAt);
  const list = q ? sorted.filter((trace) => trace.id.startsWith(q) || trace.toolName.toLowerCase().includes(q)) : sorted;
  return list.slice(0, limit);
}

const TOOL_TOKEN = /@([\w.-]+)/g;
const TRACE_TOKEN = /#([\w-]{4,})/g;

/**
 * Appends inline context after each @tool / #traceId token in the OUTGOING text sent to
 * the model, leaving the raw token visible in the composer/transcript. Runs fresh on
 * each turn against the original text, so it's safe to call repeatedly.
 */
export function expandMentions(text: string, tools: WebMcpToolSummary[], traces: ToolCallTrace[]): string {
  let expanded = text.replace(TOOL_TOKEN, (match, name: string) => {
    const tool = tools.find((entry) => entry.name === name);
    if (!tool) return match;
    const schema = tool.inputSchema ? ` | schema: ${JSON.stringify(tool.inputSchema)}` : '';
    return `${match} [Tool "${tool.name}": ${tool.description}${schema}]`;
  });

  expanded = expanded.replace(TRACE_TOKEN, (match, shortId: string) => {
    const trace = traces.find((entry) => entry.id.startsWith(shortId));
    if (!trace) return match;
    const outcome = trace.ok ? `result: ${JSON.stringify(trace.result)}` : `error: ${trace.error}`;
    return `${match} [Trace ${shortId}: called "${trace.toolName}" with ${JSON.stringify(trace.args)} → ${outcome}]`;
  });

  return expanded;
}
