// Runs in the page's MAIN world (same JS realm as the page itself), injected at
// document_start via manifest content_scripts[].world = "MAIN".
//
// WebMCP's document.modelContext.getTools() does NOT expose each tool's `execute`
// callback (verified against the webmcp-types package) -- the native API is built
// for the browser's own in-process agent, not for extensions. So the only reliable
// way to actually *invoke* a page's tools is to wrap registerTool here, in the same
// realm the tool was defined in, and keep a live reference to `execute` ourselves.
//
// This must be a transparent wrapper: always call through to the real
// implementation so the page's own behavior (and any native browser agent) is
// unaffected.

type WebMcpExecute = (input: unknown, options: { signal: AbortSignal }) => unknown;

type WebMcpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  execute: WebMcpExecute;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
};

type ModelContextLike = {
  registerTool: (tool: WebMcpTool, options?: unknown) => unknown;
  getTools?: (options?: unknown) => Promise<unknown[]>;
  addEventListener?: (type: string, listener: () => void) => void;
};

const PAGE_SOURCE = 'webmcp-ext-page';
const BRIDGE_SOURCE = 'webmcp-ext-bridge';

const captured = new Map<string, WebMcpTool>();
// Tools seen only via getTools() (registered before we could wrap, or by a
// different modelContext instance) -- metadata only, not invokable by us.
const metadataOnly = new Map<string, { name: string; title?: string; description: string; inputSchema?: object; annotations?: WebMcpTool['annotations'] }>();

let detected = false;

function summarize() {
  const seen = new Set<string>();
  const tools = [] as Array<{
    name: string;
    title?: string;
    description: string;
    inputSchema?: object;
    annotations?: WebMcpTool['annotations'];
    origin: string;
    invokable: boolean;
  }>;

  for (const tool of captured.values()) {
    seen.add(tool.name);
    tools.push({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
      origin: location.origin,
      invokable: true,
    });
  }
  for (const tool of metadataOnly.values()) {
    if (seen.has(tool.name)) continue;
    tools.push({ ...tool, origin: location.origin, invokable: false });
  }
  return tools;
}

function post(message: Record<string, unknown>) {
  window.postMessage({ source: PAGE_SOURCE, ...message }, '*');
}

function broadcastState(requestId?: string) {
  post({ type: 'tools', requestId, detected, tools: summarize() });
}

function wrapModelContext(ctx: ModelContextLike | undefined | null): ModelContextLike | undefined {
  if (!ctx || (ctx as { __webmcpWrapped?: boolean }).__webmcpWrapped) return ctx ?? undefined;

  const originalRegister = ctx.registerTool.bind(ctx);
  ctx.registerTool = (tool: WebMcpTool, options?: unknown) => {
    const result = originalRegister(tool, options);
    if (tool && typeof tool.name === 'string' && typeof tool.execute === 'function') {
      captured.set(tool.name, tool);
      metadataOnly.delete(tool.name);
      detected = true;
      broadcastState();
    }
    return result;
  };

  ctx.addEventListener?.('toolchange', () => {
    void refreshMetadata(ctx);
  });

  (ctx as { __webmcpWrapped?: boolean }).__webmcpWrapped = true;
  detected = true;
  return ctx;
}

async function refreshMetadata(ctx: ModelContextLike) {
  if (typeof ctx.getTools !== 'function') return;
  try {
    const list = (await ctx.getTools()) as Array<{
      name: string;
      title?: string;
      description: string;
      inputSchema?: object;
      annotations?: WebMcpTool['annotations'];
    }>;
    metadataOnly.clear();
    for (const entry of list ?? []) {
      if (!entry?.name || captured.has(entry.name)) continue;
      metadataOnly.set(entry.name, {
        name: entry.name,
        title: entry.title,
        description: entry.description,
        inputSchema: entry.inputSchema,
        annotations: entry.annotations,
      });
    }
    broadcastState();
  } catch {
    // Best-effort metadata refresh only.
  }
}

/**
 * Watch `document`/`navigator` for a modelContext that appears after we start observing.
 *
 * A page can set `modelContext` either via plain assignment (`document.modelContext = x`,
 * caught by the accessor trap below) or via `Object.defineProperty(doc, 'modelContext',
 * {value: x})` (a common polyfill pattern, which silently REPLACES our trap without ever
 * calling its setter). So the trap alone isn't reliable -- pair it with a short, tight poll
 * that re-checks by object identity, since document_start runs before the page's own
 * scripts, and the race window before a page assigns modelContext is at most a few seconds.
 */
function watch(target: object, key: 'modelContext') {
  let lastSeen: ModelContextLike | undefined;

  const tryWrap = () => {
    const current = (target as Record<string, unknown>)[key] as ModelContextLike | undefined;
    if (current && current !== lastSeen) {
      lastSeen = current;
      wrapModelContext(current);
    }
  };

  tryWrap();

  try {
    let value = (target as Record<string, unknown>)[key] as ModelContextLike | undefined;
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      get() {
        return value;
      },
      set(next: ModelContextLike | null | undefined) {
        value = wrapModelContext(next);
        lastSeen = value;
      },
    });
  } catch {
    // Property already non-configurable -- the poll below is the fallback.
  }

  let attempts = 0;
  const interval = setInterval(() => {
    attempts += 1;
    tryWrap();
    if (attempts > 80) clearInterval(interval);
  }, 100);
}

watch(document, 'modelContext');
watch(navigator, 'modelContext');

post({ type: 'ready', detected });

// ---- Console + uncaught-error capture -------------------------------------
// No chrome.debugger attach here (would show an intrusive "extension is
// debugging this browser" banner and needs a broader permission). This only
// catches output emitted after this script installs (document_start, so
// effectively everything for a normal page's own scripts) plus uncaught
// exceptions and unhandled rejections.

function stringifyArg(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value, null, 0) ?? String(value);
  } catch {
    return String(value);
  }
}

function reportConsole(level: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'exception', args: unknown[]) {
  post({ type: 'console-entry', level, args: args.map(stringifyArg), timestamp: Date.now() });
}

(['log', 'info', 'warn', 'error', 'debug'] as const).forEach((level) => {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    reportConsole(level, args);
    original(...args);
  };
});

window.addEventListener('error', (event) => {
  reportConsole('exception', [event.error ?? event.message]);
});

window.addEventListener('unhandledrejection', (event) => {
  reportConsole('exception', [`Unhandled rejection: ${stringifyArg(event.reason)}`]);
});

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data as { source?: string } | undefined;
  if (!data || data.source !== BRIDGE_SOURCE) return;

  const request = data as { type: string; requestId: string; name?: string; args?: unknown };

  if (request.type === 'list-tools') {
    broadcastState(request.requestId);
    return;
  }

  if (request.type === 'call-tool') {
    void handleCallTool(request.requestId, request.name ?? '', request.args);
  }
});

async function handleCallTool(requestId: string, name: string, args: unknown) {
  const started = performance.now();
  const tool = captured.get(name);

  if (!tool) {
    post({
      type: 'tool-result',
      requestId,
      ok: false,
      error: `Tool "${name}" is not invokable (not captured at registration time).`,
      durationMs: performance.now() - started,
    });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const result = await tool.execute(args, { signal: controller.signal });
    post({
      type: 'tool-result',
      requestId,
      ok: true,
      result: toSerializable(result),
      durationMs: performance.now() - started,
    });
  } catch (error) {
    post({
      type: 'tool-result',
      requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: performance.now() - started,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** structuredClone can throw on functions/DOM nodes -- fall back to a stringified marker. */
function toSerializable(value: unknown): unknown {
  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return { __unserializable: true, preview: String(value) };
    }
  }
}
