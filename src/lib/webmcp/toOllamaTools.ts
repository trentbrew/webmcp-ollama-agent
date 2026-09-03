import { CLARIFY_PREAMBLE_TOOL_CAP } from '../ai/config';
import type { OllamaTool } from '../ai/protocol';
import { BROWSER_TOOLS, isBrowserTool } from '../browser/tools';
import { isTrellisTool, TRELLIS_TOOLS } from '../trellis/tools';
import { appendClarifyPreamble } from './clarifyPolicy';
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
        'Present a structured multi-step questionnaire to the user and wait for their answers. Infer values from the user message first; pass inferred values as default on items so the user confirms or edits. Only ask your own genuinely ambiguous or un-inferable fields — discrete choices or constrained values. Never restate a page tool\'s required parameter names/types as a form; for an open-ended value you cannot enumerate, reply in plain chat prose instead. Use validation for dates and numbers. Returns a JSON object keyed by item name.',
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
                default: {
                  oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
                  description:
                    'Pre-filled answer (string, or string array when multiple is true). User can edit before submitting.',
                },
                validation: {
                  type: 'object',
                  description:
                    'Declarative constraints enforced on Next/Submit. Date inputs default minDate to today when omitted.',
                  properties: {
                    min: { type: 'number', description: 'Minimum numeric value.' },
                    max: { type: 'number', description: 'Maximum numeric value.' },
                    minLength: { type: 'number', description: 'Minimum text length.' },
                    maxLength: { type: 'number', description: 'Maximum text length.' },
                    pattern: { type: 'string', description: 'Regex pattern (no flags).' },
                    minDate: {
                      type: 'string',
                      description: 'Earliest YYYY-MM-DD date, or literal "today".',
                    },
                    maxDate: { type: 'string', description: 'Latest YYYY-MM-DD date.' },
                    message: { type: 'string', description: 'Custom error message when validation fails.' },
                  },
                },
                choices: {
                  type: 'array',
                  description:
                    'Choice list for enum/radio questions. Use "choices" (not "items") for options.',
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
                    inputType: {
                      type: 'string',
                      enum: ['text', 'number', 'date'],
                      description: 'Use "date" for YYYY-MM-DD fields.',
                    },
                  },
                },
                when: {
                  type: 'object',
                  description:
                    'Optional visibility gate keyed by prior answer names, e.g. { "tripType": "round-trip" }.',
                  additionalProperties: {
                    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
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

export function buildBuiltinToolSummaries(): WebMcpToolSummary[] {
  return [...BUILTIN_TOOLS, ...BROWSER_TOOLS, ...TRELLIS_TOOLS].map((tool) => ({
    name: tool.function.name,
    description: tool.function.description ?? '',
    inputSchema: tool.function.parameters,
    annotations: { readOnlyHint: isReadOnlyLocalTool(tool.function.name) },
    origin: 'webmcp-extension',
    invokable: true,
  }));
}

export function buildDiscoveredToolSummaries(pageTools: WebMcpToolSummary[]): WebMcpToolSummary[] {
  return pageTools.filter((tool) => tool.invokable && !isBuiltinTool(tool.name));
}

export function buildAgentToolSummaries(pageTools: WebMcpToolSummary[]): WebMcpToolSummary[] {
  return [...buildDiscoveredToolSummaries(pageTools), ...buildBuiltinToolSummaries()];
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

function toolToOllama(tool: WebMcpToolSummary, withClarifyPreamble = true): OllamaTool {
  const description = withClarifyPreamble
    ? appendClarifyPreamble(tool.description, tool.annotations?.readOnlyHint)
    : tool.description;
  return {
    type: 'function',
    function: {
      name: tool.name,
      description,
      parameters: tool.inputSchema ?? { type: 'object', properties: {} },
    },
  };
}

export function buildAgentTools(pageTools: WebMcpToolSummary[]): OllamaTool[] {
  const discovered = buildDiscoveredToolSummaries(pageTools);
  // The preamble repeats the same ~340 chars on every write tool. On a wide
  // surface that is thousands of duplicated tokens all pushing toward "ask"
  // over "act" -- the opposite of what a large surface needs.
  const total = discovered.length + BUILTIN_TOOLS.length + BROWSER_TOOLS.length + TRELLIS_TOOLS.length;
  const withPreamble = total <= CLARIFY_PREAMBLE_TOOL_CAP;
  const invokable = discovered.map((tool) => toolToOllama(tool, withPreamble));
  return [...invokable, ...BUILTIN_TOOLS, ...BROWSER_TOOLS, ...TRELLIS_TOOLS];
}

/**
 * Page tools only, with the same description treatment the agent sees. Evals
 * grade the page's own tool surface, so the extension's built-ins are left out
 * -- they would otherwise compete for selection and pollute the failure signal.
 */
export function buildPageOnlyTools(pageTools: WebMcpToolSummary[]): OllamaTool[] {
  const discovered = buildDiscoveredToolSummaries(pageTools);
  const withPreamble = discovered.length <= CLARIFY_PREAMBLE_TOOL_CAP;
  return discovered.map((tool) => toolToOllama(tool, withPreamble));
}
