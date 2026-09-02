import { DEFAULT_OLLAMA_BASE_URL } from './config';
import type {
  ListModelsResponse,
  OllamaChatMessage,
  OllamaPortInbound,
  OllamaPortOutbound,
  OllamaTool,
  OllamaToolCall,
} from './protocol';

const PORT_NAME = 'ollama-chat';
/** Same-origin Vite dev proxy — see vite.config.ts `server.proxy['/ollama']`. */
const DEV_OLLAMA_PROXY = '/ollama';

function isExtensionRuntime() {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
}

function isLocalOllamaHost(baseUrl: string) {
  try {
    const { hostname } = new URL(baseUrl);
    return hostname === '127.0.0.1' || hostname === 'localhost';
  } catch {
    return false;
  }
}

/** Map configured Ollama URL to a fetchable URL in the current runtime. */
function resolveFetchBase(baseUrl: string) {
  if (isExtensionRuntime() || !import.meta.env.DEV || !isLocalOllamaHost(baseUrl)) {
    return trimBase(baseUrl);
  }
  return DEV_OLLAMA_PROXY;
}

export async function listOllamaModels(baseUrl = DEFAULT_OLLAMA_BASE_URL): Promise<ListModelsResponse> {
  if (isExtensionRuntime()) {
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'ollama:list-models',
        baseUrl,
      })) as ListModelsResponse | undefined;
      if (response) return response;
    } catch (error) {
      return {
        models: [],
        unavailable: true,
        error: error instanceof Error ? error.message : 'Bridge unavailable',
      };
    }
  }

  return fetchModelsDirect(baseUrl);
}

export async function configureOllamaBridge(baseUrl: string) {
  if (!isExtensionRuntime()) return;
  try {
    await chrome.runtime.sendMessage({ type: 'ollama:configure', baseUrl });
  } catch {
    // Bridge may not be ready during first paint.
  }
}

export type StreamChatHandlers = {
  onDelta: (text: string) => void;
  onReasoning: (text: string) => void;
  onDone: (toolCalls?: OllamaToolCall[]) => void;
  onError: (error: string) => void;
};

export function streamOllamaChat(options: {
  baseUrl: string;
  model: string;
  messages: OllamaChatMessage[];
  think?: boolean;
  tools?: OllamaTool[];
  inferenceOptions?: Record<string, number>;
  signal?: AbortSignal;
  handlers: StreamChatHandlers;
}): () => void {
  const requestId = crypto.randomUUID();

  if (isExtensionRuntime()) {
    return streamViaBridge(requestId, options);
  }

  void streamDirect(requestId, options);
  return () => {};
}

function streamViaBridge(
  requestId: string,
  options: {
    baseUrl: string;
    model: string;
    messages: OllamaChatMessage[];
    think?: boolean;
    tools?: OllamaTool[];
    inferenceOptions?: Record<string, number>;
    signal?: AbortSignal;
    handlers: StreamChatHandlers;
  },
): () => void {
  const port = chrome.runtime.connect({ name: PORT_NAME });
  let settled = false;

  const finish = () => {
    if (settled) return;
    settled = true;
    try {
      port.disconnect();
    } catch {
      // Already disconnected.
    }
  };

  const abort = () => {
    if (settled) return;
    try {
      const payload: OllamaPortInbound = { type: 'abort', requestId };
      port.postMessage(payload);
    } catch {
      // Port already gone.
    }
    finish();
  };

  options.signal?.addEventListener('abort', abort, { once: true });

  port.onMessage.addListener((event: OllamaPortOutbound) => {
    if (event.requestId !== requestId) return;

    if (event.type === 'delta') {
      options.handlers.onDelta(event.text);
      return;
    }
    if (event.type === 'reasoning') {
      options.handlers.onReasoning(event.text);
      return;
    }
    if (event.type === 'done') {
      options.handlers.onDone(event.toolCalls);
      finish();
      return;
    }
    if (event.type === 'error') {
      options.handlers.onError(event.error);
      finish();
    }
  });

  port.onDisconnect.addListener(() => {
    if (settled) return;
    const err = chrome.runtime.lastError?.message;
    options.handlers.onError(err || 'Disconnected from Ollama bridge');
    settled = true;
  });

  const payload: OllamaPortInbound = {
    type: 'chat',
    requestId,
    baseUrl: options.baseUrl,
    model: options.model,
    messages: options.messages,
    think: options.think ?? true,
    ...(options.tools?.length ? { tools: options.tools } : {}),
    ...(options.inferenceOptions ? { options: options.inferenceOptions } : {}),
  };
  port.postMessage(payload);

  return abort;
}

async function fetchModelsDirect(baseUrl: string): Promise<ListModelsResponse> {
  try {
    const response = await fetch(`${resolveFetchBase(baseUrl)}/api/tags`, {
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

async function streamDirect(
  requestId: string,
  options: {
    baseUrl: string;
    model: string;
    messages: OllamaChatMessage[];
    think?: boolean;
    tools?: OllamaTool[];
    inferenceOptions?: Record<string, number>;
    signal?: AbortSignal;
    handlers: StreamChatHandlers;
  },
) {
  let toolCalls: OllamaToolCall[] | undefined;

  try {
    const response = await fetch(`${resolveFetchBase(options.baseUrl)}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        stream: true,
        think: options.think ?? true,
        ...(options.tools?.length ? { tools: options.tools } : {}),
        ...(options.inferenceOptions ? { options: options.inferenceOptions } : {}),
      }),
      signal: options.signal,
    });

    if (!response.ok || !response.body) {
      options.handlers.onError(`Ollama returned ${response.status}`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) {
          const seen = applyDirectChunk(line, options.handlers);
          if (seen) toolCalls = seen;
        }
        newline = buffer.indexOf('\n');
      }
    }

    options.handlers.onDone(toolCalls);
    void requestId;
  } catch (error) {
    if (options.signal?.aborted) return;
    options.handlers.onError(error instanceof Error ? error.message : 'Failed to reach Ollama');
  }
}

function applyDirectChunk(line: string, handlers: StreamChatHandlers): OllamaToolCall[] | undefined {
  try {
    const chunk = JSON.parse(line) as {
      message?: { content?: string; thinking?: string; tool_calls?: OllamaToolCall[] };
      done?: boolean;
      error?: string;
    };
    if (chunk.error) {
      handlers.onError(chunk.error);
      return undefined;
    }
    if (chunk.message?.thinking) handlers.onReasoning(chunk.message.thinking);
    if (chunk.message?.content) handlers.onDelta(chunk.message.content);
    return chunk.message?.tool_calls?.length ? chunk.message.tool_calls : undefined;
  } catch {
    // Ignore malformed frames.
    return undefined;
  }
}

function trimBase(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '');
}
