import type { WebMcpToolSummary } from '../webmcp/protocol';
import { formatToolMention } from './mentions';

export type ChatSuggestion = {
  id: string;
  label: string;
  prompt: string;
  /** Green pill when the suggestion maps to a discovered page tool. */
  variant: 'tool' | 'default';
};

const MAX_TOOL_SUGGESTIONS = 4;

const FALLBACK_SUGGESTIONS: ChatSuggestion[] = [
  {
    id: 'list-tools',
    label: 'List page tools',
    prompt: 'List the WebMCP tools currently available on this tab and what each one does.',
    variant: 'default',
  },
  {
    id: 'trace',
    label: 'Review trace log',
    prompt:
      'Summarize the most recent tool calls from the trace log — what was called, with what args, and the result.',
    variant: 'default',
  },
  {
    id: 'console',
    label: 'Check console',
    prompt: 'Check the console log for this tab and summarize any warnings or errors.',
    variant: 'default',
  },
];

function toolToSuggestion(tool: WebMcpToolSummary): ChatSuggestion {
  const mention = formatToolMention(tool.name);
  const label = tool.title?.trim() || tool.name;
  const description = tool.description.trim();

  return {
    id: `tool:${tool.name}`,
    label,
    prompt: description
      ? `${mention} — ${description}`
      : `What can ${mention} do on this page?`,
    variant: 'tool',
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
        prompt:
          'List the WebMCP tools currently available on this tab and suggest which ones would help me get started.',
        variant: 'default',
      });
    }

    return suggestions.slice(0, limit);
  }

  if (detected) {
    const detectedSuggestions: ChatSuggestion[] = [
      {
        id: 'watch-tools',
        label: 'Watch for tools',
        prompt:
          'This page has WebMCP enabled. Tell me when new tools appear and what each one is for.',
        variant: 'default',
      },
      ...FALLBACK_SUGGESTIONS.slice(0, 2),
    ];
    return detectedSuggestions.slice(0, limit);
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
