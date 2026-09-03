import { buildChatSystemPrompt, MAX_TOOL_ITERATIONS } from './ai/config';
import {
  createMessageMetadata,
  getMessageFiles,
  getMessageReasoning,
  getMessageText,
  type ChatMessageMetadata,
} from './ai/messages';
import {
  extractAskUserPayloadFromText,
  parseAskUserArgs,
  stripAskUserPseudoCode,
  type QuestionnaireAnswers,
} from './ai/questionnaire';
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
import { appendLocalTrace, appendPendingTrace, mcpState, runTool } from './webmcp/store.svelte';
import {
  CLARIFY_NUDGE_MESSAGE,
  isPageWriteTool,
  shouldInjectClarifyNudge,
} from './webmcp/clarifyPolicy';
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
    __webmcpE2EChatStatus?: () => ChatStatus;
    __webmcpE2EQuestionnaireStatus?: (id: string) => ChatQuestionnairePart['status'] | null;
    __webmcpE2EErrorToolResults?: () => number;
  }
}

/** Playwright helpers — read live chat session state from the e2e harness. */
export function getChatStatusForE2E(): ChatStatus {
  return getDisplayedChatSession()?.status ?? 'ready';
}

export function getQuestionnaireStatusForE2E(questionnaireId: string): ChatQuestionnairePart['status'] | null {
  const session = getDisplayedChatSession();
  if (!session) return null;
  for (const message of session.messages) {
    for (const part of message.parts) {
      if (part.type === 'questionnaire' && part.id === questionnaireId) {
        return part.status;
      }
    }
  }
  return null;
}

export function getErrorToolResultCountForE2E(): number {
  const session = getDisplayedChatSession();
  if (!session) return 0;
  let count = 0;
  for (const message of session.messages) {
    for (const part of message.parts) {
      if (part.type === 'tool-result' && part.error) count += 1;
    }
  }
  return count;
}

function attachE2EChatHooks() {
  window.__webmcpE2EChatStatus = getChatStatusForE2E;
  window.__webmcpE2EQuestionnaireStatus = getQuestionnaireStatusForE2E;
  window.__webmcpE2EErrorToolResults = getErrorToolResultCountForE2E;
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
  attachE2EChatHooks();
}

/** Seeds streaming state so Playwright can exercise the composer stop button. */
export function primeStreamingChatForE2E(): void {
  const tabId = 1;
  chatSessionState.activeTabId = tabId;
  chatSessionState.detached = null;

  const session = getChatForTab(tabId);
  session.messages = [
    {
      id: 'e2e-user',
      role: 'user',
      parts: [{ type: 'text', text: 'Hello' }],
      metadata: createMessageMetadata(),
    },
    {
      id: 'e2e-assistant',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Thinking…' }],
      metadata: createMessageMetadata(),
    },
  ];
  session.status = 'streaming';
  session.error = null;
  session.updatedAt = Date.now();
  setAbortController(tabId, new AbortController());
  attachE2EChatHooks();
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

  await runTurn(session, assistantMessage.id, requestAbort, 0, 0);
}

/** Aborts the in-flight chat turn (streaming, tool loop, or questionnaire wait). */
export function cancelChat() {
  const session = getDisplayedChatSession();
  if (!session || !isChatBusy()) return;

  const key = sessionKey(session);

  for (const [id, pending] of pendingQuestionnaires.entries()) {
    if (pending.sessionKey !== key) continue;
    markQuestionnaireAnswered(session, pending.assistantId, id, {}, 'skipped');
    pendingQuestionnaires.delete(id);
    pending.reject(new Error('Questionnaire cancelled.'));
  }

  getAbortController(key)?.abort();
  session.status = 'ready';
  session.updatedAt = Date.now();
  persistSession(session);
}

/**
 * Injected on the retry after a turn is cut off at num_predict. A long think is
 * the usual reason the budget ran out before a tool call, so the retry drops
 * extended thinking and says plainly what the turn owes.
 */
const TRUNCATED_RETRY_NUDGE =
  'Your previous attempt ran out of output budget while reasoning and never produced an answer. Do not deliberate this time. If a tool matches the request, call it immediately with your best inferred arguments; otherwise answer in two sentences.';

async function runTurn(
  session: TabChatSession | DetachedChatSession,
  assistantId: string,
  requestAbort: AbortController,
  iteration: number,
  consecutiveWriteErrors: number,
  afterTruncation = false,
) {
  const tabId = sessionKey(session);
  const history = await toOllamaMessages(
    session.messages.filter((m) => m.id !== assistantId || m.parts.length > 0),
  );
  const ollamaMessages: OllamaChatMessage[] = afterTruncation
    ? [...history, { role: 'system', content: TRUNCATED_RETRY_NUDGE }]
    : history;
  const pageTools = mcpState.tabId != null ? (mcpState.state?.tools ?? []) : [];
  const tools = chatSettings.exposeToolsToAgent ? buildAgentTools(pageTools) : undefined;

  let wasTruncated = false;
  const toolCalls = await new Promise<OllamaToolCall[] | undefined>((resolve) => {
    streamOllamaChat({
      baseUrl: chatSettings.baseUrl,
      model: chatSettings.model,
      messages: ollamaMessages,
      think: afterTruncation ? false : chatSettings.extendedThinking,
      tools,
      inferenceOptions: chatSettings.inference as unknown as Record<string, number>,
      signal: requestAbort.signal,
      handlers: {
        onDelta: (delta) => appendPart(session, assistantId, 'text', delta),
        onReasoning: (delta) => appendPart(session, assistantId, 'reasoning', delta),
        onDone: (calls, truncated) => {
          wasTruncated = truncated === true;
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
    const recovered = await tryRecoverAskUserFromAssistant(session, assistantId, requestAbort, iteration);
    if (recovered) return;

    // Cut off at num_predict with nothing to show for it. The budget covers
    // thinking as well as output, so a long think is the usual culprit: clear
    // the half-finished bubble and take one more pass with thinking off before
    // handing the user an error they can only fix in Settings.
    if (wasTruncated && !afterTruncation) {
      clearAssistantParts(session, assistantId);
      session.updatedAt = Date.now();
      persistSession(session);
      await runTurn(session, assistantId, requestAbort, iteration, consecutiveWriteErrors, true);
      return;
    }

    if (wasTruncated) {
      session.status = 'error';
      session.error =
        'Ollama stopped at the num_predict limit before finishing, twice in a row. Raise num_predict in Settings, or reduce the tool surface.';
      session.updatedAt = Date.now();
      persistSession(session);
      return;
    }

    // No tool calls, no text, no reasoning: the turn produced nothing at all.
    // Falling through to 'ready' here leaves an empty bubble and reads as the
    // agent silently giving up, so surface it as the failure it is.
    const message = getAssistantMessage(session, assistantId);
    const producedNothing =
      !message || (!getMessageText(message).trim() && !getMessageReasoning(message).trim());

    if (producedNothing) {
      session.status = 'error';
      session.error =
        'The model returned an empty response. This usually means the request was cut short — check that Ollama is still running, and try turning off "Expose tools to agent" or trimming the page tool surface if the page registers a lot of tools.';
      session.updatedAt = Date.now();
      persistSession(session);
      return;
    }

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

  let writeErrors = consecutiveWriteErrors;

  for (const call of toolCalls) {
    if (requestAbort.signal.aborted) {
      session.status = 'ready';
      session.updatedAt = Date.now();
      persistSession(session);
      return;
    }
    const args = call.function.arguments ?? {};
    let result: { ok: boolean; result?: unknown; error?: string };

    if (call.function.name === BUILTIN_TOOL_NAMES.askUser) {
      result = await runAskUserTool(session, assistantId, args, requestAbort.signal);
      writeErrors = 0;
    } else {
      result = await runAgentTool(call.function.name, args);
      if (isPageWriteTool(call.function.name, pageTools)) {
        writeErrors = result.ok ? 0 : writeErrors + 1;
      }
    }

    if (requestAbort.signal.aborted) {
      session.status = 'ready';
      session.updatedAt = Date.now();
      persistSession(session);
      return;
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

  if (shouldInjectClarifyNudge(writeErrors)) {
    session.messages.push({
      id: crypto.randomUUID(),
      role: 'tool',
      parts: [
        {
          type: 'tool-result',
          id: crypto.randomUUID(),
          toolName: BUILTIN_TOOL_NAMES.askUser,
          args: {},
          result: CLARIFY_NUDGE_MESSAGE,
        },
      ],
      metadata: createMessageMetadata(),
    });
    writeErrors = 0;
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
  await runTurn(session, nextAssistant.id, requestAbort, iteration + 1, writeErrors);
}

function getAssistantMessage(
  session: TabChatSession | DetachedChatSession,
  assistantId: string,
): UIMessage | undefined {
  return session.messages.find((entry) => entry.id === assistantId);
}

/** Drop a truncated assistant bubble's partial text/reasoning before retrying into it. */
function clearAssistantParts(session: TabChatSession | DetachedChatSession, assistantId: string) {
  const index = session.messages.findIndex((entry) => entry.id === assistantId);
  if (index < 0) return;
  session.messages[index] = { ...session.messages[index], parts: [] };
}

function stripAskUserFromAssistantParts(session: TabChatSession | DetachedChatSession, assistantId: string) {
  const index = session.messages.findIndex((entry) => entry.id === assistantId);
  if (index < 0) return;
  const message = session.messages[index];
  session.messages[index] = {
    ...message,
    parts: message.parts
      .map((part) => {
        if (part.type !== 'text' && part.type !== 'reasoning') return part;
        const cleaned = stripAskUserPseudoCode(part.text);
        return cleaned ? { ...part, text: cleaned } : null;
      })
      .filter((part): part is NonNullable<typeof part> => part !== null),
  };
}

async function tryRecoverAskUserFromAssistant(
  session: TabChatSession | DetachedChatSession,
  assistantId: string,
  requestAbort: AbortController,
  iteration: number,
): Promise<boolean> {
  const message = getAssistantMessage(session, assistantId);
  if (!message) return false;

  const combined = `${getMessageReasoning(message)}\n${getMessageText(message)}`;
  const payload = extractAskUserPayloadFromText(combined);
  if (!payload) return false;

  const parsed = parseAskUserArgs(payload);
  if (!parsed.ok) return false;

  stripAskUserFromAssistantParts(session, assistantId);
  stampToolCalls(session, assistantId, [
    {
      function: {
        name: BUILTIN_TOOL_NAMES.askUser,
        arguments: payload as Record<string, unknown>,
      },
    },
  ]);

  const result = await runAskUserTool(session, assistantId, payload, requestAbort.signal);
  session.messages.push({
    id: crypto.randomUUID(),
    role: 'tool',
    parts: [
      {
        type: 'tool-result',
        id: crypto.randomUUID(),
        toolName: BUILTIN_TOOL_NAMES.askUser,
        args: payload,
        result: result.ok ? result.result : undefined,
        error: result.ok ? undefined : result.error,
      },
    ],
    metadata: createMessageMetadata(),
  });

  if (requestAbort.signal.aborted || session.status === 'error') return true;

  const nextAssistant: UIMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    parts: [],
    metadata: createMessageMetadata(),
  };
  session.messages.push(nextAssistant);
  session.updatedAt = Date.now();
  persistSession(session);
  await runTurn(session, nextAssistant.id, requestAbort, iteration + 1, 0);
  return true;
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
  const traceId = crypto.randomUUID();
  const tabId = mcpState.tabId ?? browserContext.activeTab?.id ?? 0;

  // WebMCP page tools are dispatched via runTool(), which owns its own pending ->
  // finalized trace through the background call round-trip. Everything else the
  // agent runs synchronously here (builtin, browser, trellis) records its own
  // pending + finalized trace so it streams live into the Traces tab.
  const dispatchedViaRunTool = !isBuiltinTool(name) && !isTrellisTool(name) && !isBrowserTool(name);

  if (!dispatchedViaRunTool) {
    appendPendingTrace(traceId, tabId, name, args, 'agent');
  }

  const result = await executeAgentTool(name, args);
  const trace = {
    id: dispatchedViaRunTool ? crypto.randomUUID() : traceId,
    tabId,
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

  if (!dispatchedViaRunTool) {
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
  const pageTools = mcpState.tabId != null ? (mcpState.state?.tools ?? []) : [];
  const agentTools = chatSettings.exposeToolsToAgent ? buildAgentTools(pageTools) : undefined;
  const toolNames = agentTools?.map((tool) => tool.function.name);

  const converted: OllamaChatMessage[] = [
    { role: 'system', content: buildChatSystemPrompt(chatSettings.language, {
      toolNames,
      customInstructions: chatSettings.customInstructions,
    }) },
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
