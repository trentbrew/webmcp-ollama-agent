// Import/export in Chrome's WebMCP eval format so suites round-trip with their
// CLI harness instead of forking the format. Our extras (setup chain, arg match
// mode, case kind) ride along in a `webmcp` block that their reader ignores.

import {
  isExpectedLeaf,
  isOrderedGroup,
  isUnorderedGroup,
  type ArgMatchMode,
  type CaseKind,
  type EvalCase,
  type ExpectedCall,
  type ExpectedNode,
} from './protocol';

export type ChromeEvalMessage = { role: 'user' | 'system' | 'assistant'; content: string };

export type ChromeEvalCase = {
  messages: ChromeEvalMessage[];
  expectedCall: ExpectedNode[];
  webmcp?: {
    id?: string;
    origin?: string;
    kind?: CaseKind;
    argMatch?: ArgMatchMode;
    setup?: ExpectedCall[];
  };
};

export type EvalSuiteFile = {
  version: 1;
  origin?: string;
  exportedAt: string;
  cases: ChromeEvalCase[];
};

export function toChromeCase(evalCase: EvalCase): ChromeEvalCase {
  return {
    messages: [{ role: 'user', content: evalCase.prompt }],
    expectedCall: evalCase.expected,
    webmcp: {
      id: evalCase.id,
      origin: evalCase.origin,
      kind: evalCase.kind,
      argMatch: evalCase.argMatch,
      ...(evalCase.setup.length ? { setup: evalCase.setup } : {}),
    },
  };
}

export function exportSuite(cases: EvalCase[], origin?: string): EvalSuiteFile {
  return {
    version: 1,
    ...(origin ? { origin } : {}),
    exportedAt: new Date().toISOString(),
    cases: cases.map(toChromeCase),
  };
}

function sanitizeExpected(value: unknown): ExpectedNode[] {
  if (!Array.isArray(value)) return [];
  const out: ExpectedNode[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const node = entry as ExpectedNode;

    if (isExpectedLeaf(node)) {
      out.push({
        functionName: node.functionName,
        ...(node.arguments && typeof node.arguments === 'object'
          ? { arguments: node.arguments }
          : {}),
      });
      continue;
    }
    if (isOrderedGroup(node)) {
      const children = sanitizeExpected(node.ordered);
      if (children.length) out.push({ ordered: children });
      continue;
    }
    if (isUnorderedGroup(node)) {
      const children = sanitizeExpected(node.unordered);
      if (children.length) out.push({ unordered: children });
    }
  }

  return out;
}

function sanitizeSetup(value: unknown): ExpectedCall[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is ExpectedCall =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        typeof (entry as ExpectedCall).functionName === 'string',
    )
    .map((entry) => ({
      functionName: entry.functionName,
      ...(entry.arguments && typeof entry.arguments === 'object'
        ? { arguments: entry.arguments }
        : {}),
    }));
}

function isArgMatchMode(value: unknown): value is ArgMatchMode {
  return value === 'subset' || value === 'exact' || value === 'ignore';
}

export function fromChromeCase(entry: ChromeEvalCase, fallbackOrigin: string): EvalCase | null {
  const prompt = (entry.messages ?? [])
    .filter((message) => message?.role === 'user' && typeof message.content === 'string')
    .map((message) => message.content)
    .join('\n\n')
    .trim();

  const expected = sanitizeExpected(entry.expectedCall);
  if (!prompt || expected.length === 0) return null;

  const now = Date.now();
  const extras = entry.webmcp ?? {};

  return {
    id: typeof extras.id === 'string' && extras.id ? extras.id : crypto.randomUUID(),
    origin: typeof extras.origin === 'string' && extras.origin ? extras.origin : fallbackOrigin,
    prompt,
    kind: extras.kind === 'ambiguous' ? 'ambiguous' : 'direct',
    setup: sanitizeSetup(extras.setup),
    expected,
    argMatch: isArgMatchMode(extras.argMatch) ? extras.argMatch : 'subset',
    createdAt: now,
    updatedAt: now,
  };
}

/** Accepts a full suite file or a bare array of Chrome-format cases. */
export function importSuite(raw: string, fallbackOrigin: string): { cases: EvalCase[]; skipped: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Not valid JSON.');
  }

  const entries = Array.isArray(parsed)
    ? parsed
    : ((parsed as EvalSuiteFile)?.cases ?? []);

  if (!Array.isArray(entries)) throw new Error('No cases found in file.');

  const cases: EvalCase[] = [];
  let skipped = 0;

  for (const entry of entries) {
    const parsedCase = fromChromeCase(entry as ChromeEvalCase, fallbackOrigin);
    if (parsedCase) cases.push(parsedCase);
    else skipped += 1;
  }

  return { cases, skipped };
}

/** One-line summary of an expected chain, for list rows. */
export function summarizeExpected(nodes: ExpectedNode[]): string {
  const parts: string[] = [];
  for (const node of nodes) {
    if (isExpectedLeaf(node)) parts.push(node.functionName);
    else if (isOrderedGroup(node)) parts.push(summarizeExpected(node.ordered));
    else if (isUnorderedGroup(node)) parts.push(`{${summarizeExpected(node.unordered)}}`);
  }
  return parts.join(' → ');
}
