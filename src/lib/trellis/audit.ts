import type { ToolCallTrace } from '../webmcp/protocol';
import { getTrellisKernel, trellisState } from './kernel.svelte';

const MAX_JSON_CHARS = 8_000;

export async function recordToolTraceInTrellis(trace: ToolCallTrace): Promise<void> {
  try {
    const kernel = await getTrellisKernel();
    await kernel.createEntity(`webmcp.toolTrace:${trace.id}`, 'webmcp.toolTrace', {
      traceId: trace.id,
      tabId: trace.tabId,
      toolName: trace.toolName,
      origin: trace.origin,
      source: trace.source,
      ok: trace.ok,
      startedAt: new Date(trace.startedAt).toISOString(),
      durationMs: Math.round(trace.durationMs),
      argsJson: toBoundedJson(trace.args),
      resultJson: trace.ok ? toBoundedJson(trace.result ?? null) : '',
      error: trace.error ?? '',
    });
    trellisState.opCount = kernel.getBackend().getOpCount();
  } catch (error) {
    console.warn('[trellis] Failed to record tool trace', error);
  }
}

function toBoundedJson(value: unknown): string {
  let json: string;
  try {
    json = JSON.stringify(value ?? null);
  } catch {
    json = JSON.stringify(String(value));
  }
  if (json.length <= MAX_JSON_CHARS) return json;
  return `${json.slice(0, MAX_JSON_CHARS)}...`;
}
