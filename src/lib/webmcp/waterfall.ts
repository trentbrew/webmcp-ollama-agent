import type { ToolCallTrace } from './protocol';
import { normalizeTraces } from './traces';

export type WaterfallSpan = {
  id: string;
  label: string;
  startMs: number;
  durationMs: number;
  lane: number;
  ok: boolean;
  source: 'manual' | 'agent';
  pending?: boolean;
};

/** Lays out trace entries as lane-packed horizontal bars (overlapping calls get separate lanes). */
export function buildWaterfall(traces: ToolCallTrace[]): { spans: WaterfallSpan[]; totalMs: number; laneCount: number } {
  const valid = normalizeTraces(traces);
  if (valid.length === 0) return { spans: [], totalMs: 0, laneCount: 0 };

  const sorted = [...valid].sort((a, b) => a.startedAt - b.startedAt);
  const origin = sorted[0].startedAt;
  const laneEnds: number[] = [];

  const spans: WaterfallSpan[] = sorted.map((trace) => {
    const startMs = trace.startedAt - origin;
    const durationMs = Math.max(trace.durationMs, 2);
    let lane = laneEnds.findIndex((end) => end <= startMs);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(startMs + durationMs);
    } else {
      laneEnds[lane] = startMs + durationMs;
    }
    return {
      id: trace.id,
      label: trace.toolName,
      startMs,
      durationMs,
      lane,
      ok: trace.ok,
      source: trace.source,
      pending: trace.pending,
    };
  });

  const totalMs = Math.max(100, ...spans.map((span) => span.startMs + span.durationMs));
  return { spans, totalMs, laneCount: laneEnds.length };
}

export function formatWaterfallDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
