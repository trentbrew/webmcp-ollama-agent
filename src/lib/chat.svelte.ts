import { CHAT_SYSTEM_PROMPT, MAX_TOOL_ITERATIONS } from './ai/config';
import {
  backfillMessageTimestamps,
  createMessageMetadata,
  getMessageFiles,
  getMessageText,
  type ChatMessageMetadata,
} from './ai/messages';
import { streamOllamaChat } from './ai/ollama';
import type { ChatFilePart, ChatStatus, OllamaChatMessage, OllamaToolCall, UIMessage } from './ai/protocol';
import { clearPersistedChat, loadPersistedChat } from './chat/persistence';
import { chatSettings } from './chat/settings.svelte';
import { playResponseComplete } from './chat/sfx';
import { expandMentions } from './chat/mentions';
import { browserContext } from './browser/context.svelte';
import { isBrowserTool, runBrowserTool } from './browser/tools';
import { recordToolTraceInTrellis } from './trellis/audit';
import { isTrellisTool, runTrellisTool } from './trellis/tools';
import { appendLocalTrace, mcpState, runTool } from './webmcp/store.svelte';
import { BUILTIN_TOOL_NAMES, buildAgentTools, buildAgentToolSummaries, isBuiltinTool } from './webmcp/toOllamaTools';

const persisted = loadPersistedChat();

export const chat = $state({
  messages: backfillMessageTimestamps(persisted.messages),
  status: 'ready' as ChatStatus,
  error: null as string | null,
});

let abortController: AbortController | null = null;

export type SendMessageInput = {
  text?: string;
  files?: FileList | File[];
};

export function stampAssistantMessage(message: UIMessage) {
  const metadata = message.metadata as ChatMessageMetadata | undefined;
  if (typeof metadata?.createdAt === 'number') return;

  const index = chat.messages.findIndex((entry) => entry.id === message.id);
  if (index < 0) return;

  const existing = chat.messages[index];
  chat.messages[index] = {
    ...existing,
    metadata: createMessageMetadata(existing.metadata ?? {}),
  };
}

export async function sendChatMessage(input: SendMessageInput) {
  const text = input.text?.trim() ?? '';
  const files = input.files ? [...input.files] : [];
  if (!text && files.length === 0) return;
  if (isChatBusy()) return;

  chat.error = null;
  chat.status = 'submitted';

  const userParts: UIMessage['parts'] = [];
  if (text) userParts.push({ type: 'text', text });
  for (const file of files) {
    userParts.push(await fileToPart(file));
  }

  const userMessage: UIMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    parts: userParts,
    metadata: createMessageMetadata(),
  };
  chat.messages.push(userMessage);

  const assistantMessage: UIMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    parts: [],
    metadata: createMessageMetadata(),
  };
  chat.messages.push(assistantMessage);

  abortController?.abort();
  abortController = new AbortController();
  const requestAbort = abortController;

  chat.status = 'streaming';

  await runTurn(assistantMessage.id, requestAbort, 0);
}

async function runTurn(assistantId: string, requestAbort: AbortController, iteration: number) {
  const ollamaMessages = await toOllamaMessages(chat.messages.filter((m) => m.id !== assistantId || m.parts.length > 0));
  const pageTools = mcpState.tabId != null ? (mcpState.state?.tools ?? []) : [];
  const tools = chatSettings.exposeToolsToAgent ? buildAgentTools(pageTools) : undefined;

  const toolCalls = await new Promise<OllamaToolCall[] | undefined>((resolve) => {
    streamOllamaChat({
      baseUrl: chatSettings.baseUrl,
      model: chatSettings.model,
      messages: ollamaMessages,
      think: true,
      tools,
      inferenceOptions: chatSettings.inference as unknown as Record<string, number>,
      signal: requestAbort.signal,
      handlers: {
        onDelta: (delta) => appendPart(assistantId, 'text', delta),
        onReasoning: (delta) => appendPart(assistantId, 'reasoning', delta),
        onDone: (calls) => {
          stampReasoningEnd(assistantId);
          stampAssistantCompleted(assistantId);
          resolve(calls?.length ? calls : undefined);
        },
        onError: (error) => {
          stampAssistantCompleted(assistantId);
          if (requestAbort.signal.aborted) {
            chat.status = 'ready';
          } else {
            chat.status = 'error';
            chat.error = error;
          }
          resolve(undefined);
        },
      },
    });
  });

  if (requestAbort.signal.aborted) return;
  if (chat.status === 'error') return;

  if (!toolCalls) {
    chat.status = 'ready';
    playResponseComplete();
    return;
  }

  if (iteration >= MAX_TOOL_ITERATIONS) {
    chat.status = 'error';
    chat.error = `Stopped after ${MAX_TOOL_ITERATIONS} tool-call rounds without a final answer.`;
    return;
  }

  stampToolCalls(assistantId, toolCalls);

  for (const call of toolCalls) {
    const args = call.function.arguments ?? {};
    const result = await runAgentTool(call.function.name, args);
    chat.messages.push({
      id: crypto.randomUUID(),
      role: 'tool',
      parts: [
        {
          type: 'tool-result',
          id: crypto.randomUUID(),
          toolName: call.function.name,
          args,
          result: result.ok ? result.result : undefined,
          error: result.ok ? undefined : result.error,
        },
      ],
      metadata: createMessageMetadata(),
    });
  }

  const nextAssistant: UIMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    parts: [],
    metadata: createMessageMetadata(),
  };
  chat.messages.push(nextAssistant);
  await runTurn(nextAssistant.id, requestAbort, iteration + 1);
}

async function runAgentTool(name: string, args: unknown): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const startedAt = Date.now();
  const result = await executeAgentTool(name, args);
  const trace = {
    id: crypto.randomUUID(),
    tabId: mcpState.tabId ?? browserContext.activeTab?.id ?? 0,
    toolName: name,
    origin: toolOrigin(name),
    args,
    result: result.ok ? result.result : undefined,
    error: result.ok ? undefined : result.error,
    ok: result.ok,
    startedAt,
    durationMs: Date.now() - startedAt,
    source: 'agent' as const,
  };

  if (isBuiltinTool(name)) {
    void appendLocalTrace(trace);
  }
  void recordToolTraceInTrellis(trace);

  return result;
}

async function executeAgentTool(name: string, args: unknown): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  if (name === BUILTIN_TOOL_NAMES.trace) {
    const limit = typeof (args as { limit?: number })?.limit === 'number' ? (args as { limit: number }).limit : 10;
    return { ok: true, result: mcpState.traces.slice(-limit) };
  }
  if (name === BUILTIN_TOOL_NAMES.console) {
    const limit = typeof (args as { limit?: number })?.limit === 'number' ? (args as { limit: number }).limit : 20;
    return { ok: true, result: mcpState.console.slice(-limit) };
  }
  if (isTrellisTool(name)) {
    return runTrellisTool(name, args);
  }
  if (isBrowserTool(name)) {
    return runBrowserTool(name, args);
  }
  if (isBuiltinTool(name)) {
    return { ok: false, error: `Unhandled built-in tool "${name}".` };
  }
  return runTool(name, args, 'agent');
}

function toolOrigin(name: string): string {
  if (isBuiltinTool(name)) return 'webmcp-extension';
  return mcpState.state?.tools.find((tool) => tool.name === name)?.origin ?? mcpState.tabUrl ?? 'unknown';
}

function stampToolCalls(assistantId: string, toolCalls: OllamaToolCall[]) {
  const index = chat.messages.findIndex((entry) => entry.id === assistantId);
  if (index < 0) return;
  const message = chat.messages[index];
  const callParts = toolCalls.map((call) => ({
    type: 'tool-call' as const,
    id: crypto.randomUUID(),
    toolName: call.function.name,
    args: call.function.arguments ?? {},
  }));
  chat.messages[index] = { ...message, parts: [...message.parts, ...callParts] };
}

export function resetChat() {
  abortController?.abort();
  abortController = null;
  chat.messages = [];
  chat.status = 'ready';
  chat.error = null;
  clearPersistedChat();
}

export function isChatBusy() {
  return chat.status === 'submitted' || chat.status === 'streaming';
}

function appendPart(messageId: string, type: 'text' | 'reasoning', delta: string) {
  const index = chat.messages.findIndex((entry) => entry.id === messageId);
  if (index < 0) return;

  const message = chat.messages[index];
  const parts = [...message.parts];
  const last = parts.at(-1);

  if (last && last.type === type) {
    parts[parts.length - 1] = { ...last, text: last.text + delta };
  } else {
    parts.push({ type, text: delta });
  }

  // Track how long the model spent reasoning: start on the first reasoning
  // delta, and stop once the first visible answer text arrives.
  let metadata = message.metadata ?? {};
  if (type === 'reasoning' && typeof metadata.reasoningStartedAt !== 'number') {
    metadata = { ...metadata, reasoningStartedAt: Date.now() };
  } else if (
    type === 'text' &&
    typeof metadata.reasoningStartedAt === 'number' &&
    typeof metadata.reasoningEndedAt !== 'number'
  ) {
    metadata = { ...metadata, reasoningEndedAt: Date.now() };
  }

  chat.messages[index] = { ...message, parts, metadata };
}

function stampReasoningEnd(messageId: string) {
  const index = chat.messages.findIndex((entry) => entry.id === messageId);
  if (index < 0) return;
  const message = chat.messages[index];
  const metadata = message.metadata ?? {};
  if (typeof metadata.reasoningStartedAt === 'number' && typeof metadata.reasoningEndedAt !== 'number') {
    chat.messages[index] = { ...message, metadata: { ...metadata, reasoningEndedAt: Date.now() } };
  }
}

function stampAssistantCompleted(messageId: string) {
  const index = chat.messages.findIndex((entry) => entry.id === messageId);
  if (index < 0) return;
  const message = chat.messages[index];
  const metadata = message.metadata ?? {};
  if (typeof metadata.completedAt === 'number') return;
  chat.messages[index] = {
    ...message,
    metadata: { ...metadata, completedAt: Date.now() },
  };
}

async function toOllamaMessages(messages: UIMessage[]): Promise<OllamaChatMessage[]> {
  const converted: OllamaChatMessage[] = [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
  ];

  for (const message of messages) {
    if (message.role === 'system') continue;

    if (message.role === 'tool') {
      for (const part of message.parts) {
        if (part.type !== 'tool-result') continue;
        converted.push({
          role: 'tool',
          content: part.error ? `Error: ${part.error}` : JSON.stringify(part.result ?? null),
        });
      }
      continue;
    }

    const toolCallParts = message.parts.filter(
      (part): part is Extract<UIMessage['parts'][number], { type: 'tool-call' }> => part.type === 'tool-call',
    );
    const text = getMessageText(message);
    const files = getMessageFiles(message);
    const images: string[] = [];
    const textAttachments: string[] = [];

    for (const file of files) {
      if (file.mediaType.startsWith('image/')) {
        const raw = stripDataUrl(file.url);
        if (raw) images.push(raw);
        continue;
      }
      if (file.url.startsWith('data:text') || file.mediaType.startsWith('text/') || isTextLike(file)) {
        const body = await dataUrlToText(file.url);
        if (body) {
          textAttachments.push(`\n\n[Attached file: ${file.filename ?? 'attachment'}]\n${body}`);
        }
      } else {
        textAttachments.push(`\n\n[Attached file: ${file.filename ?? 'attachment'} (${file.mediaType})]`);
      }
    }

    const rawContent = `${text}${textAttachments.join('')}`.trim();
    const content =
      message.role === 'user' ? expandMentions(rawContent, buildAgentToolSummaries(mcpState.state?.tools ?? []), mcpState.traces) : rawContent;

    converted.push({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content,
      ...(images.length ? { images } : {}),
      ...(toolCallParts.length
        ? {
            tool_calls: toolCallParts.map((part) => ({
              function: { name: part.toolName, arguments: part.args as Record<string, unknown> },
            })),
          }
        : {}),
    });
  }

  return converted;
}

async function fileToPart(file: File): Promise<ChatFilePart> {
  const url = await readAsDataUrl(file);
  return {
    type: 'file',
    url,
    filename: file.name,
    mediaType: file.type || 'application/octet-stream',
  };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function stripDataUrl(url: string) {
  const comma = url.indexOf(',');
  return comma >= 0 ? url.slice(comma + 1) : url;
}

async function dataUrlToText(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    return await response.text();
  } catch {
    try {
      return atob(stripDataUrl(url));
    } catch {
      return '';
    }
  }
}

function isTextLike(file: ChatFilePart) {
  const name = file.filename ?? '';
  return /\.(txt|md|json|csv|ts|js|svelte|css|html|xml|yml|yaml|toml)$/i.test(name);
}
