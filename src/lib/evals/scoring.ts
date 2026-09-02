// Pure scoring for eval attempts. No DOM, no chrome.*, no model -- everything
// here is deterministic so the failure taxonomy stays testable.

import {
  isExpectedLeaf,
  isOrderedGroup,
  isUnorderedGroup,
  type ActualCall,
  type ArgMatchMode,
  type ArgMismatch,
  type CaseVerdict,
  type ExpectedCall,
  type ExpectedNode,
} from './protocol';

export function flattenExpected(nodes: ExpectedNode[]): ExpectedCall[] {
  const out: ExpectedCall[] = [];
  for (const node of nodes) {
    if (isExpectedLeaf(node)) out.push(node);
    else if (isOrderedGroup(node)) out.push(...flattenExpected(node.ordered));
    else if (isUnorderedGroup(node)) out.push(...flattenExpected(node.unordered));
  }
  return out;
}

function countLeaves(node: ExpectedNode): number {
  if (isExpectedLeaf(node)) return 1;
  if (isOrderedGroup(node)) return node.ordered.reduce((sum, child) => sum + countLeaves(child), 0);
  if (isUnorderedGroup(node)) return node.unordered.reduce((sum, child) => sum + countLeaves(child), 0);
  return 0;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (typeof a === 'object') {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord);
    const bKeys = Object.keys(bRecord);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => key in bRecord && deepEqual(aRecord[key], bRecord[key]));
  }

  return false;
}

/**
 * Collects every place `expected` and `actual` disagree, as dotted paths.
 * In `subset` mode keys absent from `expected` are ignored, which is the
 * default because models legitimately fill in optional properties.
 */
export function diffArgs(
  expected: Record<string, unknown> | undefined,
  actual: Record<string, unknown>,
  mode: ArgMatchMode,
  prefix = '',
): ArgMismatch[] {
  if (mode === 'ignore' || !expected) return [];

  const mismatches: ArgMismatch[] = [];
  const keys = mode === 'exact'
    ? [...new Set([...Object.keys(expected), ...Object.keys(actual)])]
    : Object.keys(expected);

  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const expectedValue = expected[key];
    const actualValue = actual?.[key];

    const bothPlainObjects =
      expectedValue !== null &&
      actualValue !== null &&
      typeof expectedValue === 'object' &&
      typeof actualValue === 'object' &&
      !Array.isArray(expectedValue) &&
      !Array.isArray(actualValue);

    if (bothPlainObjects) {
      mismatches.push(
        ...diffArgs(
          expectedValue as Record<string, unknown>,
          actualValue as Record<string, unknown>,
          mode,
          path,
        ),
      );
      continue;
    }

    if (!deepEqual(expectedValue, actualValue)) {
      mismatches.push({ path, expected: expectedValue, actual: actualValue });
    }
  }

  return mismatches;
}

function callMatches(expected: ExpectedCall, actual: ActualCall | undefined, mode: ArgMatchMode): boolean {
  if (!actual) return false;
  if (expected.functionName !== actual.functionName) return false;
  return diffArgs(expected.arguments, actual.arguments, mode).length === 0;
}

/** Backtracking bijection -- greedy is wrong when two leaves share a name. */
function matchUnordered(
  leaves: ExpectedCall[],
  window: ActualCall[],
  mode: ArgMatchMode,
  used: boolean[] = new Array(window.length).fill(false),
  index = 0,
): boolean {
  if (index >= leaves.length) return true;
  for (let i = 0; i < window.length; i += 1) {
    if (used[i]) continue;
    if (!callMatches(leaves[index], window[i], mode)) continue;
    used[i] = true;
    if (matchUnordered(leaves, window, mode, used, index + 1)) return true;
    used[i] = false;
  }
  return false;
}

/** Returns the index just past the consumed calls, or null when the node fails. */
function consumeNode(
  node: ExpectedNode,
  actual: ActualCall[],
  start: number,
  mode: ArgMatchMode,
): number | null {
  if (isExpectedLeaf(node)) {
    return callMatches(node, actual[start], mode) ? start + 1 : null;
  }

  if (isOrderedGroup(node)) {
    return consumeSequence(node.ordered, actual, start, mode);
  }

  if (isUnorderedGroup(node)) {
    const leaves = flattenExpected(node.unordered);
    const end = start + leaves.length;
    if (end > actual.length) return null;
    return matchUnordered(leaves, actual.slice(start, end), mode) ? end : null;
  }

  return null;
}

function consumeSequence(
  nodes: ExpectedNode[],
  actual: ActualCall[],
  start: number,
  mode: ArgMatchMode,
): number | null {
  let cursor = start;
  for (const node of nodes) {
    const next = consumeNode(node, actual, cursor, mode);
    if (next === null) return null;
    cursor = next;
  }
  return cursor;
}

function nameCounts(names: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return counts;
}

/** Pairs each expected leaf with the nth actual call of the same name. */
function pairwiseMismatches(
  leaves: ExpectedCall[],
  actual: ActualCall[],
  mode: ArgMatchMode,
): ArgMismatch[] {
  const consumed = new Set<number>();
  const mismatches: ArgMismatch[] = [];

  for (const leaf of leaves) {
    const index = actual.findIndex(
      (call, i) => !consumed.has(i) && call.functionName === leaf.functionName,
    );
    if (index < 0) continue;
    consumed.add(index);
    mismatches.push(...diffArgs(leaf.arguments, actual[index].arguments, mode));
  }

  return mismatches;
}

export function scoreCalls(
  expected: ExpectedNode[],
  actual: ActualCall[],
  mode: ArgMatchMode = 'subset',
): CaseVerdict {
  const leaves = flattenExpected(expected);
  const expectedNames = leaves.map((leaf) => leaf.functionName);
  const actualNames = actual.map((call) => call.functionName);
  const base = { mismatches: [] as ArgMismatch[], expectedNames, actualNames };

  if (leaves.length === 0) {
    return { ...base, pass: false, failure: 'model-error', detail: 'Case has no expected calls.' };
  }

  if (actual.length === 0) {
    return {
      ...base,
      pass: false,
      failure: 'no-call',
      detail: `Expected ${expectedNames.join(', ')} but the model called nothing.`,
    };
  }

  const consumedTo = consumeSequence(expected, actual, 0, mode);

  if (consumedTo !== null) {
    // Every expected call matched in place. Two things can still sink the run:
    // trailing calls the case did not ask for, and a matched call that threw.
    if (consumedTo < actual.length) {
      const extras = actualNames.slice(consumedTo);
      return {
        ...base,
        pass: false,
        failure: 'extra-calls',
        detail: `Matched, then kept going: ${extras.join(', ')}.`,
      };
    }

    const threw = actual.find((call) => call.ok === false);
    if (threw) {
      return {
        ...base,
        pass: false,
        failure: 'runtime-error',
        detail: `${threw.functionName} threw: ${threw.error ?? 'unknown error'}`,
      };
    }

    return { ...base, pass: true };
  }

  // Failed. Work out which bucket, most specific first.
  const expectedCounts = nameCounts(expectedNames);
  const actualCounts = nameCounts(actualNames);

  const missing = [...expectedCounts.entries()]
    .filter(([name, count]) => (actualCounts.get(name) ?? 0) < count)
    .map(([name]) => name);
  const unexpected = [...actualCounts.entries()]
    .filter(([name, count]) => count > (expectedCounts.get(name) ?? 0))
    .map(([name]) => name);

  if (missing.length > 0) {
    const detail = unexpected.length
      ? `Expected ${missing.join(', ')} — called ${unexpected.join(', ')} instead.`
      : `Never called ${missing.join(', ')}.`;
    return { ...base, pass: false, failure: 'wrong-tool', detail };
  }

  // Right tools, right counts: is it purely a sequencing problem?
  const anyOrder = matchUnordered(leaves, actual.slice(0, leaves.length), mode);
  if (anyOrder) {
    return {
      ...base,
      pass: false,
      failure: 'out-of-order',
      detail: `Expected ${expectedNames.join(' → ')} but got ${actualNames.join(' → ')}.`,
    };
  }

  const mismatches = pairwiseMismatches(leaves, actual, mode);
  if (mismatches.length > 0) {
    const first = mismatches[0];
    return {
      ...base,
      pass: false,
      failure: 'wrong-arguments',
      mismatches,
      detail: `${first.path}: expected ${JSON.stringify(first.expected)}, got ${JSON.stringify(first.actual)}.`,
    };
  }

  const threw = actual.find((call) => call.ok === false);
  if (threw) {
    return {
      ...base,
      pass: false,
      failure: 'runtime-error',
      detail: `${threw.functionName} threw: ${threw.error ?? 'unknown error'}`,
    };
  }

  return {
    ...base,
    pass: false,
    failure: 'extra-calls',
    detail: `Expected ${expectedNames.join(' → ')} but got ${actualNames.join(' → ')}.`,
  };
}
