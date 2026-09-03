import type { ToolCallTrace } from './protocol';

/** Guards against session-storage drift and malformed background payloads. */
export function isValidTrace(trace: unknown): trace is ToolCallTrace {
  if (!trace || typeof trace !== 'object') return false;
  const entry = trace as Partial<ToolCallTrace>;
  return (
    typeof entry.id === 'string' &&
    entry.id.length > 0 &&
    typeof entry.tabId === 'number' &&
    typeof entry.toolName === 'string' &&
    entry.toolName.length > 0 &&
    typeof entry.startedAt === 'number' &&
    Number.isFinite(entry.startedAt) &&
    typeof entry.durationMs === 'number' &&
    Number.isFinite(entry.durationMs) &&
    typeof entry.ok === 'boolean' &&
    (entry.source === 'manual' || entry.source === 'agent')
  );
}

export function normalizeTrace(trace: ToolCallTrace, index = 0): ToolCallTrace {
  return {
    id: trace.id || `trace-${trace.startedAt}-${index}`,
    tabId: trace.tabId,
    toolName: trace.toolName || 'unknown',
    origin: trace.origin ?? 'unknown',
    args: trace.args,
    result: trace.result,
    error: trace.error,
    ok: trace.ok,
    startedAt: trace.startedAt,
    durationMs: Math.max(trace.pending ? 0 : 2, trace.durationMs),
    source: trace.source,
    pending: trace.pending,
  };
}

export function normalizeTraces(traces: ToolCallTrace[]): ToolCallTrace[] {
  return traces.filter(isValidTrace).map(normalizeTrace);
}
