import type { OllamaTool } from '../ai/protocol';
import { BROWSER_TOOLS, isBrowserTool } from '../browser/tools';
import { isTrellisTool, TRELLIS_TOOLS } from '../trellis/tools';
import type { WebMcpToolSummary } from './protocol';

/** Names reserved for extension-local tools (handled in chat.svelte.ts, never routed to the page). */
export const BUILTIN_TOOL_NAMES = {
  trace: 'webmcp_trace',
  console: 'webmcp_console',
  askUser: 'ask_user',
} as const;

const BUILTIN_TOOLS: OllamaTool[] = [
  {
    type: 'function',
    function: {
      name: BUILTIN_TOOL_NAMES.trace,
      description:
        "Read this extension's own tool-call trace log (recent WebMCP tool invocations, both yours and manual test runs), for debugging or reasoning about prior calls.",
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max entries to return (default 10, most recent first).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: BUILTIN_TOOL_NAMES.console,
      description: "Read recent console.log/warn/error output and uncaught errors from the active tab's page.",
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max entries to return (default 20, most recent first).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: BUILTIN_TOOL_NAMES.askUser,
      description:
        'Present a structured multi-step questionnaire to the user and wait for their answers. Use when you need specific choices or values instead of guessing from free text. Returns a JSON object keyed by item name.',
      parameters: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            description: 'Ordered list of questions to present.',
            items: {
              type: 'object',
              required: ['name', 'prompt'],
              properties: {
                name: { type: 'string', description: 'Answer key returned in the result object.' },
                prompt: { type: 'string', description: 'Question title shown to the user.' },
                description: { type: 'string', description: 'Optional helper text under the prompt.' },
                required: { type: 'boolean', description: 'Whether the user must answer (default true).' },
                multiple: { type: 'boolean', description: 'Allow selecting more than one choice.' },
                choices: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['value', 'label'],
                    properties: {
                      value: { type: 'string' },
                      label: { type: 'string' },
                      description: { type: 'string' },
                      shortcut: { type: 'string', description: 'Keyboard shortcut hint (e.g. A, B, 1).' },
                    },
                  },
                },
                input: {
                  type: 'object',
                  required: ['label'],
                  properties: {
                    label: { type: 'string' },
                    placeholder: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
];

export function isBuiltinTool(name: string): boolean {
  return (
    name === BUILTIN_TOOL_NAMES.trace ||
    name === BUILTIN_TOOL_NAMES.console ||
    name === BUILTIN_TOOL_NAMES.askUser ||
    isTrellisTool(name) ||
    isBrowserTool(name)
  );
}

export function buildAgentToolSummaries(pageTools: WebMcpToolSummary[]): WebMcpToolSummary[] {
  const invokable = pageTools.filter((tool) => tool.invokable && !isBuiltinTool(tool.name));
  const local = [...BUILTIN_TOOLS, ...BROWSER_TOOLS, ...TRELLIS_TOOLS].map((tool) => ({
    name: tool.function.name,
    description: tool.function.description ?? '',
    inputSchema: tool.function.parameters,
    annotations: { readOnlyHint: isReadOnlyLocalTool(tool.function.name) },
    origin: 'webmcp-extension',
    invokable: true,
  }));
  return [...invokable, ...local];
}

function isReadOnlyLocalTool(name: string): boolean {
  if (name === BUILTIN_TOOL_NAMES.trace || name === BUILTIN_TOOL_NAMES.console) return true;
  if (isBrowserTool(name)) return true;
  return (
    name === 'trellis_status' ||
    name === 'trellis_read_entity' ||
    name === 'trellis_list_entities' ||
    name === 'trellis_query' ||
    name === 'trellis_read_ops'
  );
}

function toolToOllama(tool: WebMcpToolSummary): OllamaTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema ?? { type: 'object', properties: {} },
    },
  };
}

export function buildAgentTools(pageTools: WebMcpToolSummary[]): OllamaTool[] {
  const invokable = pageTools.filter((tool) => tool.invokable && !isBuiltinTool(tool.name)).map(toolToOllama);
  return [...invokable, ...BUILTIN_TOOLS, ...BROWSER_TOOLS, ...TRELLIS_TOOLS];
}
