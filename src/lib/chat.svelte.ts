import { CHAT_SYSTEM_PROMPT, MAX_TOOL_ITERATIONS } from './ai/config';
import {
  createMessageMetadata,
  getMessageFiles,
  getMessageText,
  type ChatMessageMetadata,
} from './ai/messages';
import { parseAskUserArgs, type QuestionnaireAnswers } from './ai/questionnaire';
import { streamOllamaChat } from './ai/ollama';
import type { ChatFilePart, ChatQuestionnairePart, ChatStatus, OllamaChatMessage, OllamaToolCall, UIMessage } from './ai/protocol';
import { chatSettings } from './chat/settings.svelte';
import { playResponseComplete } from './chat/sfx';
import { expandMentions } from './chat/mentions';
import {
  chatSessionState,
  clearDetachedArchiveOnEdit,
  exitDetachedArchive,
  getAbortController,
  getChatForTab,
  getDisplayedChatSession,
  initChatSessionTracking,
  isChatBusy,
  newChatForActiveTab,
  persistSession,
  resetChat,
  resetChatForActiveTab,
  setAbortController,
  type DetachedChatSession,
  type TabChatSession,
} from './chat/sessions.svelte';
import { browserContext } from './browser/context.svelte';
import { isBrowserTool, runBrowserTool } from './browser/tools';
import { recordToolTraceInTrellis } from './trellis/audit';
import { isTrellisTool, runTrellisTool } from './trellis/tools';
import { appendLocalTrace, mcpState, runTool } from './webmcp/store.svelte';
import { BUILTIN_TOOL_NAMES, buildAgentTools, buildAgentToolSummaries, isBuiltinTool } from './webmcp/toOllamaTools';

export {
  chatSessionState,
  exitDetachedArchive,
  getDisplayedChatSession,
  initChatSessionTracking,
  isChatBusy,
  newChatForActiveTab,
  resetChat,
  resetChatForActiveTab,
};

const EMPTY_CHAT_VIEW = {
  tabId: -1,
  messages: [] as UIMessage[],
  status: 'ready' as ChatStatus,
  error: null as string | null,
  url: null,
  title: null,
  updatedAt: 0,
};

type PendingQuestionnaire = {
  sessionKey: number;
  assistantId: string;
  resolve: (answers: QuestionnaireAnswers) => void;
  reject: (reason: Error) => void;
};

const pendingQuestionnaires = new Map<string, PendingQuestionnaire>();

/** Returns the currently displayed chat session (active tab or detached archive). */
export function getChat() {
  return getDisplayedChatSession() ?? EMPTY_CHAT_VIEW;
}

/** Active pending questionnaire for the dock UI (not inline in transcript). */
export function getPendingQuestionnaire(): ChatQuestionnairePart | null {
  const session = getDisplayedChatSession();
  if (!session || session.status !== 'awaiting-input') return null;

  for (let index = session.messages.length - 1; index >= 0; index -= 1) {
    const message = session.messages[index];
    if (message.role !== 'assistant') continue;
    for (const part of message.parts) {
      if (part.type === 'questionnaire' && part.status === 'pending') {
        return part;
      }
    }
  }

  return null;
}

declare global {
  interface Window {
    __webmcpE2EAnswers?: QuestionnaireAnswers;
  }
}

/** Seeds chat state so Playwright can exercise QuestionnaireDock submit flow. */
export function primeQuestionnaireForE2E(part: ChatQuestionnairePart): void {
  const tabId = 1;
  chatSessionState.activeTabId = tabId;
  chatSessionState.detached = null;

  const assistantId = 'e2e-assistant';
  const session = getChatForTab(tabId);
  session.messages = [
    {
      id: assistantId,
      role: 'assistant',
      parts: [part],
      metadata: createMessageMetadata(),
    },
  ];
  session.status = 'awaiting-input';
  session.error = null;
  session.updatedAt = Date.now();

  pendingQuestionnaires.set(part.id, {
    sessionKey: tabId,
    assistantId,
    resolve: (answers) => {
      window.__webmcpE2EAnswers = answers;
    },
    reject: () => {},
  });
}

export type SendMessageInput = {
  text?: string;
  files?: FileList | File[];
};

function sessionKey(session: TabChatSession | DetachedChatSession): number {
  return 'archiveId' in session ? -1 : session.tabId;
}

function requireWritableSession(): TabChatSession | DetachedChatSession | null {
  const session = getDisplayedChatSession();
  if (!session) return null;
  if ('archiveId' in session) clearDetachedArchiveOnEdit();
  return getDisplayedChatSession();
}

export function stampAssistantMessage(message: UIMessage) {
  const session = getDisplayedChatSession();
  if (!session) return;

  const metadata = message.metadata as ChatMessageMetadata | undefined;
  if (typeof metadata?.createdAt === 'number') return;

  const index = session.messages.findIndex((entry) => entry.id === message.id);
  if (index < 0) return;

  const existing = session.messages[index];
  session.messages[index] = {
    ...existing,
    metadata: createMessageMetadata(existing.metadata ?? {}),
  };
}

export async function sendChatMessage(input: SendMessageInput) {
  const session = requireWritableSession();
  if (!session) return;

  const text = input.text?.trim() ?? '';
  const files = input.files ? [...input.files] : [];
  if (!text && files.length === 0) return;
  if (isChatBusy()) return;

  const tabId = sessionKey(session);

  session.error = null;
  session.status = 'submitted';

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
  session.messages.push(userMessage);

  const assistantMessage: UIMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    parts: [],
    metadata: createMessageMetadata(),
  };
  session.messages.push(assistantMessage);

  getAbortController(tabId)?.abort();
  const requestAbort = new AbortController();
  setAbortController(tabId, requestAbort);

  session.status = 'streaming';
  session.updatedAt = Date.now();
  persistSession(session);

  await runTurn(session, assistantMessage.id, requestAbort, 0);
}

async function runTurn(
  session: TabChatSession | DetachedChatSession,
  assistantId: string,
  requestAbort: AbortController,
  iteration: number,
) {
  const tabId = sessionKey(session);
  const ollamaMessages = await toOllamaMessages(
    session.messages.filter((m) => m.id !== assistantId || m.parts.length > 0),
  );
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
        onDelta: (delta) => appendPart(session, assistantId, 'text', delta),
        onReasoning: (delta) => appendPart(session, assistantId, 'reasoning', delta),
        onDone: (calls) => {
          stampReasoningEnd(session, assistantId);
          stampAssistantCompleted(session, assistantId);
          resolve(calls?.length ? calls : undefined);
        },
        onError: (error) => {
          stampAssistantCompleted(session, assistantId);
          if (requestAbort.signal.aborted) {
            session.status = 'ready';
          } else {
            session.status = 'error';
            session.error = error;
          }
          resolve(undefined);
        },
      },
    });
  });

  if (requestAbort.signal.aborted) return;
  if (session.status === 'error') return;

  if (!toolCalls) {
    session.status = 'ready';
    session.updatedAt = Date.now();
    persistSession(session);
    playResponseComplete();
    return;
  }

  if (iteration >= MAX_TOOL_ITERATIONS) {
    session.status = 'error';
    session.error = `Stopped after ${MAX_TOOL_ITERATIONS} tool-call rounds without a final answer.`;
    session.updatedAt = Date.now();
    persistSession(session);
    return;
  }

  stampToolCalls(session, assistantId, toolCalls);

  for (const call of toolCalls) {
    const args = call.function.arguments ?? {};
    let result: { ok: boolean; result?: unknown; error?: string };

    if (call.function.name === BUILTIN_TOOL_NAMES.askUser) {
      result = await runAskUserTool(session, assistantId, args, requestAbort.signal);
    } else {
      result = await runAgentTool(call.function.name, args);
    }

    session.messages.push({
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
  session.messages.push(nextAssistant);
  session.updatedAt = Date.now();
  persistSession(session);
  await runTurn(session, nextAssistant.id, requestAbort, iteration + 1);
}

async function runAskUserTool(
  session: TabChatSession | DetachedChatSession,
  assistantId: string,
  args: unknown,
  signal: AbortSignal,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const parsed = parseAskUserArgs(args);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const questionnaireId = crypto.randomUUID();
  const part: ChatQuestionnairePart = {
    type: 'questionnaire',
    id: questionnaireId,
    items: parsed.items,
    status: 'pending',
  };
  attachQuestionnairePart(session, assistantId, part);
  session.status = 'awaiting-input';
  session.updatedAt = Date.now();
  persistSession(session);

  try {
    const answers = await waitForQuestionnaireAnswers(
      questionnaireId,
      sessionKey(session),
      assistantId,
      signal,
    );
    markQuestionnaireAnswered(session, assistantId, questionnaireId, answers, 'answered');
    session.status = 'streaming';
    session.updatedAt = Date.now();
    persistSession(session);
    return { ok: true, result: answers };
  } catch (error) {
    session.status = signal.aborted ? 'ready' : 'error';
    if (!signal.aborted) {
      session.error = error instanceof Error ? error.message : String(error);
    }
    session.updatedAt = Date.now();
    persistSession(session);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function submitQuestionnaireAnswers(
  questionnaireId: string,
  answers: QuestionnaireAnswers,
  status: 'answered' | 'skipped' = 'answered',
): Promise<boolean> {
  const pending = pendingQuestionnaires.get(questionnaireId);
  if (!pending) return false;

  const session = getDisplayedChatSession();
  if (!session || sessionKey(session) !== pending.sessionKey) return false;

  markQuestionnaireAnswered(session, pending.assistantId, questionnaireId, answers, status);
  session.updatedAt = Date.now();
  persistSession(session);

  pendingQuestionnaires.delete(questionnaireId);
  pending.resolve(answers);
  return true;
}

function waitForQuestionnaireAnswers(
  questionnaireId: string,
  key: number,
  assistantId: string,
  signal: AbortSignal,
): Promise<QuestionnaireAnswers> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Questionnaire cancelled.'));
      return;
    }

    const onAbort = () => {
      pendingQuestionnaires.delete(questionnaireId);
      reject(new Error('Questionnaire cancelled.'));
    };
    signal.addEventListener('abort', onAbort, { once: true });

    pendingQuestionnaires.set(questionnaireId, {
      sessionKey: key,
      assistantId,
      resolve: (answers) => {
        signal.removeEventListener('abort', onAbort);
        resolve(answers);
      },
      reject: (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    });
  });
}

function attachQuestionnairePart(
  session: TabChatSession | DetachedChatSession,
  assistantId: string,
  part: ChatQuestionnairePart,
) {
  const index = session.messages.findIndex((entry) => entry.id === assistantId);
  if (index < 0) return;
  const message = session.messages[index];
  session.messages[index] = { ...message, parts: [...message.parts, part] };
}

function markQuestionnaireAnswered(
  session: TabChatSession | DetachedChatSession,
  assistantId: string,
  questionnaireId: string,
  answers: QuestionnaireAnswers,
  status: 'answered' | 'skipped',
) {
  const index = session.messages.findIndex((entry) => entry.id === assistantId);
  if (index < 0) return;
  const message = session.messages[index];
  session.messages[index] = {
    ...message,
    parts: message.parts.map((part) =>
      part.type === 'questionnaire' && part.id === questionnaireId
        ? { ...part, answers, status }
        : part,
    ),
  };
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

function stampToolCalls(session: TabChatSession | DetachedChatSession, assistantId: string, toolCalls: OllamaToolCall[]) {
  const index = session.messages.findIndex((entry) => entry.id === assistantId);
  if (index < 0) return;
  const message = session.messages[index];
  const callParts = toolCalls.map((call) => ({
    type: 'tool-call' as const,
    id: crypto.randomUUID(),
    toolName: call.function.name,
    args: call.function.arguments ?? {},
  }));
  session.messages[index] = { ...message, parts: [...message.parts, ...callParts] };
}

function appendPart(
  session: TabChatSession | DetachedChatSession,
  messageId: string,
  type: 'text' | 'reasoning',
  delta: string,
) {
  const index = session.messages.findIndex((entry) => entry.id === messageId);
  if (index < 0) return;

  const message = session.messages[index];
  const parts = [...message.parts];
  const last = parts.at(-1);

  if (last && last.type === type) {
    parts[parts.length - 1] = { ...last, text: last.text + delta };
  } else {
    parts.push({ type, text: delta });
  }

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

  session.messages[index] = { ...message, parts, metadata };
}

function stampReasoningEnd(session: TabChatSession | DetachedChatSession, messageId: string) {
  const index = session.messages.findIndex((entry) => entry.id === messageId);
  if (index < 0) return;
  const message = session.messages[index];
  const metadata = message.metadata ?? {};
  if (typeof metadata.reasoningStartedAt === 'number' && typeof metadata.reasoningEndedAt !== 'number') {
    session.messages[index] = { ...message, metadata: { ...metadata, reasoningEndedAt: Date.now() } };
  }
}

function stampAssistantCompleted(session: TabChatSession | DetachedChatSession, messageId: string) {
  const index = session.messages.findIndex((entry) => entry.id === messageId);
  if (index < 0) return;
  const message = session.messages[index];
  const metadata = message.metadata ?? {};
  if (typeof metadata.completedAt === 'number') return;
  session.messages[index] = {
    ...message,
    metadata: { ...metadata, completedAt: Date.now() },
  };
}

async function toOllamaMessages(messages: UIMessage[]): Promise<OllamaChatMessage[]> {
  const converted: OllamaChatMessage[] = [{ role: 'system', content: CHAT_SYSTEM_PROMPT }];

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
      message.role === 'user'
        ? expandMentions(rawContent, buildAgentToolSummaries(mcpState.state?.tools ?? []), mcpState.traces)
        : rawContent;

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
