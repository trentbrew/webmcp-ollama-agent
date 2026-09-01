import { newChatForActiveTab, resetChat } from '../chat.svelte';
import { requestModelPicker, requestSessionPicker } from './composerUi.svelte';

export type SlashCommand = {
  id: string;
  title: string;
  description: string;
} & ({ kind: 'insert'; insert: string } | { kind: 'action'; action: () => void });

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'new',
    title: '/new',
    description: 'Start a fresh conversation for this tab',
    kind: 'action',
    action: () => newChatForActiveTab(),
  },
  {
    id: 'resume',
    title: '/resume',
    description: "Switch to another tab's conversation",
    kind: 'action',
    action: () => requestSessionPicker(),
  },
  {
    id: 'model',
    title: '/model',
    description: 'Open model picker',
    kind: 'action',
    action: () => requestModelPicker(),
  },
  {
    id: 'tools',
    title: '/tools',
    description: 'Ask what WebMCP tools are available on this tab',
    kind: 'insert',
    insert: 'List the WebMCP tools currently available on this tab and what each one does.',
  },
  {
    id: 'trace',
    title: '/trace',
    description: 'Ask for a summary of recent tool calls',
    kind: 'insert',
    insert: 'Summarize the most recent tool calls from the trace log — what was called, with what args, and the result.',
  },
  {
    id: 'console',
    title: '/console',
    description: 'Ask for a summary of recent console/errors',
    kind: 'insert',
    insert: 'Check the console log for this tab and summarize any warnings or errors.',
  },
  {
    id: 'reset',
    title: '/reset',
    description: 'Clear the conversation',
    kind: 'action',
    action: () => resetChat(),
  },
];

export function filterSlashCommands(query: string, limit = 8): SlashCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_COMMANDS.slice(0, limit);
  return SLASH_COMMANDS.filter(
    (cmd) => cmd.id.includes(q) || cmd.title.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q),
  ).slice(0, limit);
}
