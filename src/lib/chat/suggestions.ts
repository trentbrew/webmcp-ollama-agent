import type { WebMcpToolSummary } from '../webmcp/protocol';
import { formatToolMention } from './mentions';

export type ChatSuggestion = {
  id: string;
  label: string;
  description: string;
  prompt: string;
};

const MAX_TOOL_SUGGESTIONS = 4;

const FALLBACK_SUGGESTIONS: ChatSuggestion[] = [
  {
    id: 'list-tools',
    label: 'List page tools',
    description: 'See what WebMCP tools are available on this tab',
    prompt: 'List the WebMCP tools currently available on this tab and what each one does.',
  },
  {
    id: 'trace',
    label: 'Review trace log',
    description: 'Summarize recent tool calls',
    prompt:
      'Summarize the most recent tool calls from the trace log — what was called, with what args, and the result.',
  },
  {
    id: 'console',
    label: 'Check console',
    description: 'Look for warnings or errors on this tab',
    prompt: 'Check the console log for this tab and summarize any warnings or errors.',
  },
];

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function toolToSuggestion(tool: WebMcpToolSummary): ChatSuggestion {
  const mention = formatToolMention(tool.name);
  const label = tool.title?.trim() || tool.name;
  const description = tool.description.trim() || 'Run this page tool';

  return {
    id: `tool:${tool.name}`,
    label,
    description: truncate(description, 72),
    prompt: description
      ? `${mention} — ${description}`
      : `What can ${mention} do on this page?`,
  };
}

export function buildChatSuggestions(
  tools: WebMcpToolSummary[],
  options: { detected?: boolean; limit?: number } = {},
): ChatSuggestion[] {
  const { detected = false, limit = 6 } = options;
  const invokable = tools.filter((tool) => tool.invokable);

  if (invokable.length > 0) {
    const suggestions = invokable.slice(0, MAX_TOOL_SUGGESTIONS).map(toolToSuggestion);

    if (invokable.length > 1 && suggestions.length < limit) {
      suggestions.push({
        id: 'overview',
        label: 'Compare tools',
        description: `Get an overview of all ${invokable.length} tools on this page`,
        prompt:
          'List the WebMCP tools currently available on this tab and suggest which ones would help me get started.',
      });
    }

    return suggestions.slice(0, limit);
  }

  if (detected) {
    return [
      {
        id: 'watch-tools',
        label: 'Watch for tools',
        description: 'WebMCP is active — tools may register as the page loads',
        prompt:
          'This page has WebMCP enabled. Tell me when new tools appear and what each one is for.',
      },
      ...FALLBACK_SUGGESTIONS.slice(0, 2),
    ].slice(0, limit);
  }

  return FALLBACK_SUGGESTIONS.slice(0, limit);
}

export function emptyStateSubtitle(
  invokableToolCount: number,
  detected: boolean,
  model: string,
): string {
  if (invokableToolCount > 0) {
    const noun = invokableToolCount === 1 ? 'tool' : 'tools';
    return `${invokableToolCount} page ${noun} ready. Pick a starting point or ask anything.`;
  }

  if (detected) {
    return `WebMCP is active on this tab. Replies stream from local Ollama (${model}).`;
  }

  return `Ask a question or attach a file for context. Replies stream from local Ollama (${model}).`;
}
