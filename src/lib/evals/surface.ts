// Tool-surface snapshots and drift detection.
//
// WebMCP tools are tied to component lifecycle, so the set a page exposes
// changes as the app changes. A suite authored against one surface can quietly
// stop testing anything -- drift is reported as a third result state next to
// pass and fail.

import type { WebMcpToolSummary } from '../webmcp/protocol';
import type { SurfaceDiff, ToolSurfaceEntry, ToolSurfaceSnapshot } from './protocol';

/** Key-sorted JSON so a reordered schema is not read as a change. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(',')}}`;
}

export function toSurfaceEntry(tool: WebMcpToolSummary): ToolSurfaceEntry {
  return {
    name: tool.name,
    description: tool.description,
    schema: stableStringify(tool.inputSchema ?? {}),
    readOnlyHint: tool.annotations?.readOnlyHint === true,
  };
}

export function snapshotSurface(origin: string, tools: WebMcpToolSummary[]): ToolSurfaceSnapshot {
  return {
    origin,
    capturedAt: Date.now(),
    tools: tools.map(toSurfaceEntry).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function diffSurface(
  snapshot: ToolSurfaceSnapshot | undefined,
  tools: WebMcpToolSummary[],
): SurfaceDiff {
  const empty: SurfaceDiff = { added: [], removed: [], descriptionChanged: [], schemaChanged: [] };
  if (!snapshot) return empty;

  const before = new Map(snapshot.tools.map((entry) => [entry.name, entry]));
  const after = new Map(tools.map((tool) => [tool.name, toSurfaceEntry(tool)]));

  const diff: SurfaceDiff = { added: [], removed: [], descriptionChanged: [], schemaChanged: [] };

  for (const [name, entry] of after) {
    const previous = before.get(name);
    if (!previous) {
      diff.added.push(name);
      continue;
    }
    if (previous.description !== entry.description) diff.descriptionChanged.push(name);
    if (previous.schema !== entry.schema) diff.schemaChanged.push(name);
  }

  for (const name of before.keys()) {
    if (!after.has(name)) diff.removed.push(name);
  }

  return diff;
}

export function hasDrift(diff: SurfaceDiff | undefined): boolean {
  if (!diff) return false;
  return (
    diff.added.length > 0 ||
    diff.removed.length > 0 ||
    diff.descriptionChanged.length > 0 ||
    diff.schemaChanged.length > 0
  );
}

/**
 * Drift that can actually invalidate a result: a tool the case expects is gone,
 * or its contract moved. A newly added unrelated tool is worth showing but does
 * not, on its own, mean the case stopped testing what it was written to test.
 */
export function isBlockingDrift(diff: SurfaceDiff | undefined, expectedNames: string[]): boolean {
  if (!diff) return false;
  const touched = new Set([...diff.removed, ...diff.schemaChanged, ...diff.descriptionChanged]);
  return expectedNames.some((name) => touched.has(name));
}

export function describeDrift(diff: SurfaceDiff): string[] {
  const lines: string[] = [];
  if (diff.removed.length) lines.push(`${diff.removed.join(', ')} gone`);
  if (diff.added.length) lines.push(`${diff.added.join(', ')} added`);
  if (diff.schemaChanged.length) lines.push(`${diff.schemaChanged.join(', ')} schema changed`);
  if (diff.descriptionChanged.length) {
    lines.push(`${diff.descriptionChanged.join(', ')} description changed`);
  }
  return lines;
}
