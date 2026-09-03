import { DEFAULT_OLLAMA_BASE_URL } from '../lib/ai/config';
import type {
  ListModelsResponse,
  OllamaChatMessage,
  OllamaPortInbound,
  OllamaPortOutbound,
  OllamaTool,
  OllamaToolCall,
} from '../lib/ai/protocol';
import { injectExistingTabs } from './inject';
import { initWebMcp } from './webmcp';

const CORS_RULE_ID = 1;
const OLLAMA_PORT = 'ollama-chat';

initWebMcp();

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
  // Side panel API is unavailable in some test contexts.
});

chrome.runtime.onInstalled.addListener(() => {
  void ensureCorsBypass(DEFAULT_OLLAMA_BASE_URL);
  // Manifest content_scripts don't run in tabs opened before install/update, so
  // inject them now -- otherwise open tabs show no tools until a manual reload.
  void injectExistingTabs();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureCorsBypass(DEFAULT_OLLAMA_BASE_URL);
  void injectExistingTabs();
});

void ensureCorsBypass(DEFAULT_OLLAMA_BASE_URL);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'ollama:list-models') {
    const baseUrl = typeof message.baseUrl === 'string' ? message.baseUrl : DEFAULT_OLLAMA_BASE_URL;
    void listModels(baseUrl).then(sendResponse);
    return true;
  }

  if (message?.type === 'ollama:configure') {
    const baseUrl = typeof message.baseUrl === 'string' ? message.baseUrl : DEFAULT_OLLAMA_BASE_URL;
    void ensureCorsBypass(baseUrl).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === 'capture-screenshot') {
    void (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.windowId) {
          sendResponse({ ok: false, error: 'No active tab' });
          return;
        }
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
        sendResponse({ ok: true, dataUrl });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return true;
  }

  return false;
});

const inflight = new Map<string, AbortController>();

/**
 * MV3 terminates this service worker after 30s of inactivity, and an in-flight
 * `fetch` does not count as activity. A large tool surface means Ollama can spend
 * well over 30s in prompt processing before it emits its first token, so without
 * a heartbeat the worker is killed mid-prefill, the fetch aborts, and Ollama logs
 * a `500` at exactly 30.00s. Calling an extension API resets the idle timer, so we
 * tick one while any chat request is outstanding.
 */
const KEEPALIVE_INTERVAL_MS = 20_000;
let keepaliveTimer: ReturnType<typeof setInterval> | undefined;

function syncKeepalive() {
  if (inflight.size > 0 && keepaliveTimer === undefined) {
    keepaliveTimer = setInterval(() => {
      void chrome.runtime.getPlatformInfo().catch(() => {});
    }, KEEPALIVE_INTERVAL_MS);
    return;
  }
  if (inflight.size === 0 && keepaliveTimer !== undefined) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = undefined;
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== OLLAMA_PORT) return;

  port.onMessage.addListener((message: OllamaPortInbound) => {
    if (message.type === 'abort') {
      inflight.get(message.requestId)?.abort();
      inflight.delete(message.requestId);
      syncKeepalive();
      return;
    }

    if (message.type !== 'chat') return;

    const controller = new AbortController();
    inflight.set(message.requestId, controller);
    syncKeepalive();

    void streamChat(message, controller.signal, (event) => {
      try {
        port.postMessage(event);
      } catch {
        controller.abort();
      }
    }).finally(() => {
      inflight.delete(message.requestId);
      syncKeepalive();
    });
  });

  port.onDisconnect.addListener(() => {
    for (const controller of inflight.values()) controller.abort();
    inflight.clear();
    syncKeepalive();
  });
});

async function ensureCorsBypass(baseUrl: string) {
  try {
    const origin = new URL(baseUrl).origin;
    const host = new URL(baseUrl).hostname;

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [CORS_RULE_ID],
      addRules: [
        {
          id: CORS_RULE_ID,
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
              {
                header: 'Origin',
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: origin,
              },
              {
                header: 'Referer',
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
              },
            ],
          },
          condition: {
            urlFilter: `${host}`,
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              chrome.declarativeNetRequest.ResourceType.OTHER,
            ],
          },
        },
      ],
    });
  } catch (error) {
    console.warn('Failed to install Ollama CORS bypass rule', error);
  }
}

async function listModels(baseUrl: string): Promise<ListModelsResponse> {
  await ensureCorsBypass(baseUrl);

  try {
    const response = await fetch(`${trimBase(baseUrl)}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      return { models: [], unavailable: true, error: 'Ollama unavailable' };
    }

    const data = (await response.json()) as {
      models?: Array<{ name?: string; model?: string }>;
    };

    const models = (data.models ?? [])
      .map((entry) => entry.name ?? entry.model)
      .filter((name): name is string => Boolean(name))
      .sort((a, b) => a.localeCompare(b));

    return { models };
  } catch (error) {
    return {
      models: [],
      unavailable: true,
      error: error instanceof Error ? error.message : 'Failed to list Ollama models',
    };
  }
}

async function streamChat(
  request: {
    requestId: string;
    baseUrl: string;
    model: string;
    messages: OllamaChatMessage[];
    think?: boolean;
    tools?: OllamaTool[];
    options?: Record<string, number>;
  },
  signal: AbortSignal,
  emit: (event: OllamaPortOutbound) => void,
) {
  const { requestId } = request;
  await ensureCorsBypass(request.baseUrl);

  try {
    const response = await fetch(`${trimBase(request.baseUrl)}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: true,
        think: request.think ?? true,
        ...(request.tools?.length ? { tools: request.tools } : {}),
        ...(request.options ? { options: request.options } : {}),
      }),
      signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      emit({
        type: 'error',
        requestId,
        error: body || `Ollama returned ${response.status}`,
      });
      return;
    }

    if (!response.body) {
      emit({ type: 'error', requestId, error: 'Ollama returned an empty stream' });
      return;
    }

    const toolCallChunks: OllamaToolCall[] = [];

    for await (const chunk of readNdjson(response.body)) {
      if (signal.aborted) break;

      const message = chunk.message;
      if (message) {
        if (typeof message.thinking === 'string' && message.thinking) {
          emit({ type: 'reasoning', requestId, text: message.thinking });
        }
        if (typeof message.content === 'string' && message.content) {
          emit({ type: 'delta', requestId, text: message.content });
        }
        // Ollama can spread tool calls across chunks; collecting rather than
        // replacing keeps every call the model asked for.
        if (message.tool_calls?.length) {
          toolCallChunks.push(...message.tool_calls);
        }
      }

      if (chunk.error) {
        emit({
          type: 'error',
          requestId,
          error: typeof chunk.error === 'string' ? chunk.error : 'Ollama stream error',
        });
        return;
      }

      if (chunk.done) {
        // `length` means the model was cut off mid-answer, so a missing tool call
        // is a truncation, not a decision. Report it as a recoverable outcome --
        // the chat loop retries once without extended thinking before surfacing
        // it to the user, because a long think is the usual reason for the cut.
        emit({
          type: 'done',
          requestId,
          toolCalls: toolCallChunks,
          ...(chunk.done_reason === 'length' ? { truncated: true } : {}),
        });
        return;
      }
    }

    emit({ type: 'done', requestId, toolCalls: toolCallChunks });
  } catch (error) {
    if (signal.aborted) {
      emit({ type: 'error', requestId, error: 'Aborted' });
      return;
    }

    emit({
      type: 'error',
      requestId,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to reach Ollama. Is it running?',
    });
  }
}

type OllamaStreamChunk = {
  message?: {
    role?: string;
    content?: string;
    thinking?: string;
    tool_calls?: OllamaToolCall[];
  };
  done?: boolean;
  done_reason?: string;
  error?: string;
};

async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<OllamaStreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) {
          try {
            yield JSON.parse(line) as OllamaStreamChunk;
          } catch {
            // Skip malformed frames.
          }
        }
        newline = buffer.indexOf('\n');
      }
    }

    const trailing = buffer.trim();
    if (trailing) {
      try {
        yield JSON.parse(trailing) as OllamaStreamChunk;
      } catch {
        // Ignore incomplete trailing frame.
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function trimBase(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '');
}
