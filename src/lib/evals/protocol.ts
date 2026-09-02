// Types for the evals runner. The on-disk case shape deliberately mirrors
// Chrome's WebMCP eval format (`{ messages, expectedCall }` with `ordered` /
// `unordered` nesting) so suites round-trip with their CLI harness -- see
// `format.ts` for the import/export mapping.

/** A single expected tool invocation. `arguments` is compared per `argMatch`. */
export type ExpectedCall = {
  functionName: string;
  arguments?: Record<string, unknown>;
};

/**
 * Expected calls form a tree: leaves are calls, `ordered` groups must match in
 * sequence, `unordered` groups may match in any order within their window.
 * A bare top-level array is treated as `ordered`.
 */
export type ExpectedNode =
  | ExpectedCall
  | { ordered: ExpectedNode[] }
  | { unordered: ExpectedNode[] };

export function isExpectedLeaf(node: ExpectedNode): node is ExpectedCall {
  return typeof (node as ExpectedCall).functionName === 'string';
}

export function isOrderedGroup(node: ExpectedNode): node is { ordered: ExpectedNode[] } {
  return Array.isArray((node as { ordered?: unknown }).ordered);
}

export function isUnorderedGroup(node: ExpectedNode): node is { unordered: ExpectedNode[] } {
  return Array.isArray((node as { unordered?: unknown }).unordered);
}

/** A tool call the model actually produced. */
export type ActualCall = {
  functionName: string;
  arguments: Record<string, unknown>;
  /** Present only in execute mode, where the call was really dispatched. */
  ok?: boolean;
  error?: string;
  durationMs?: number;
};

export type ArgMatchMode =
  /** Every expected key/value must be present and deep-equal; extra actual keys allowed. */
  | 'subset'
  /** Arguments must be deep-equal, key for key. */
  | 'exact'
  /** Only the function name is graded. */
  | 'ignore';

export type CaseKind = 'direct' | 'ambiguous';

/**
 * `dry-run` stops at the first assistant turn and grades the proposed calls
 * without dispatching them -- safe against write tools. `execute` runs the full
 * agent loop with real dispatch, which is what grades multi-step ordering.
 */
export type RunMode = 'dry-run' | 'execute';

export type ToolSurfaceEntry = {
  name: string;
  description: string;
  /** Stable-stringified inputSchema, so a key reorder is not a change. */
  schema: string;
  readOnlyHint: boolean;
};

export type ToolSurfaceSnapshot = {
  origin: string;
  capturedAt: number;
  tools: ToolSurfaceEntry[];
};

export type SurfaceDiff = {
  added: string[];
  removed: string[];
  descriptionChanged: string[];
  schemaChanged: string[];
};

export type EvalCase = {
  id: string;
  /** Page origin this case was authored against. Cases are listed per origin. */
  origin: string;
  /** The user turn under test. */
  prompt: string;
  kind: CaseKind;
  /**
   * Tool chain executed with no model in the loop before the graded turn, to
   * drive the app into a pre-failure state (Chrome's mid-chain recipe).
   */
  setup: ExpectedCall[];
  expected: ExpectedNode[];
  argMatch: ArgMatchMode;
  /** Tool surface captured at authoring time; drift is reported against it. */
  surface?: ToolSurfaceSnapshot;
  createdAt: number;
  updatedAt: number;
};

export type FailureKind =
  | 'no-call'
  | 'wrong-tool'
  | 'out-of-order'
  | 'wrong-arguments'
  | 'extra-calls'
  | 'runtime-error'
  | 'model-error';

export const FAILURE_LABELS: Record<FailureKind, string> = {
  'no-call': 'No tool called',
  'wrong-tool': 'Wrong tool selected',
  'out-of-order': 'Tools called out of order',
  'wrong-arguments': 'Wrong arguments',
  'extra-calls': 'Extra tool calls',
  'runtime-error': 'Tool threw at runtime',
  'model-error': 'Model or transport error',
};

/** What to go fix when a failure of this kind shows up. */
export const FAILURE_REMEDIES: Record<FailureKind, string> = {
  'no-call': 'The description may not connect to how a user phrases the request. Lead it with the user intent it serves.',
  'wrong-tool': 'Two descriptions overlap. Make each one say what it does *and* what it is not for.',
  'out-of-order': 'Encode the dependency in the descriptions ("call after X") or fold the steps into one tool.',
  'wrong-arguments': 'Tighten inputSchema: add enum values, describe each property, and mark what is required.',
  'extra-calls': 'The model kept going after the goal was met. Say in the description when the tool is done.',
  'runtime-error': 'A plain JS bug in the tool body -- check the Traces tab for the thrown error.',
  'model-error': 'Ollama was unreachable, timed out, or returned a malformed frame. Not a tool-quality signal.',
};

export type ArgMismatch = {
  /** Dotted path into the argument object, e.g. `topping` or `items.0.id`. */
  path: string;
  expected: unknown;
  actual: unknown;
};

export type CaseVerdict = {
  pass: boolean;
  failure?: FailureKind;
  detail?: string;
  mismatches: ArgMismatch[];
  expectedNames: string[];
  actualNames: string[];
};

export type Attempt = {
  index: number;
  verdict: CaseVerdict;
  calls: ActualCall[];
  durationMs: number;
  /** Assistant prose, kept for the "model refused to call anything" case. */
  content?: string;
};

export type CaseResult = {
  caseId: string;
  model: string;
  mode: RunMode;
  attempts: Attempt[];
  passCount: number;
  runCount: number;
  drift?: SurfaceDiff;
  finishedAt: number;
};

export type EvalSettings = {
  /** Runs per case. Pass rate over k, not a boolean -- models are nondeterministic. */
  runs: number;
  mode: RunMode;
  /** Execute mode refuses to dispatch non-readOnly tools unless this is on. */
  allowWrites: boolean;
  temperature: number;
};

export const DEFAULT_EVAL_SETTINGS: EvalSettings = {
  runs: 3,
  mode: 'dry-run',
  allowWrites: false,
  temperature: 0.2,
};

export const MAX_RUNS_PER_CASE = 10;
export const EVAL_TIMEOUT_MS = 90_000;

export function passRate(result: CaseResult | undefined): number {
  if (!result || result.runCount === 0) return 0;
  return result.passCount / result.runCount;
}

/** A case passes outright only when every attempt passed. */
export function resultStatus(
  result: CaseResult | undefined,
): 'unrun' | 'pass' | 'flaky' | 'fail' {
  if (!result || result.runCount === 0) return 'unrun';
  if (result.passCount === result.runCount) return 'pass';
  if (result.passCount === 0) return 'fail';
  return 'flaky';
}

/** The failure that showed up most across a result's attempts. */
export function dominantFailure(result: CaseResult | undefined): FailureKind | undefined {
  if (!result) return undefined;
  const counts = new Map<FailureKind, number>();
  for (const attempt of result.attempts) {
    const failure = attempt.verdict.failure;
    if (!failure) continue;
    counts.set(failure, (counts.get(failure) ?? 0) + 1);
  }
  let best: FailureKind | undefined;
  let bestCount = 0;
  for (const [failure, count] of counts) {
    if (count > bestCount) {
      best = failure;
      bestCount = count;
    }
  }
  return best;
}
