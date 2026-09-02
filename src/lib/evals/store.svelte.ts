// Reactive eval state plus the live wiring (Ollama for the graded turn,
// the WebMCP bridge for dispatch). Everything model-shaped lives in runner.ts.

import { buildChatSystemPrompt } from '../ai/config';
import { streamOllamaChat } from '../ai/ollama';
import type { OllamaChatMessage, OllamaTool } from '../ai/protocol';
import { chatSettings } from '../chat/settings.svelte';
import type { ToolCallTrace, WebMcpToolSummary } from '../webmcp/protocol';
import { mcpState, runTool } from '../webmcp/store.svelte';
import { buildDiscoveredToolSummaries, buildPageOnlyTools } from '../webmcp/toOllamaTools';
import { exportSuite, importSuite } from './format';
import {
  loadCases,
  loadEvalSettings,
  loadResults,
  persistCases,
  persistEvalSettings,
  persistResults,
} from './persistence';
import { runAttempt, type ChatTurn, type ChatTurnResult } from './runner';
import { diffSurface, snapshotSurface } from './surface';
import {
  EVAL_TIMEOUT_MS,
  MAX_RUNS_PER_CASE,
  type Attempt,
  type CaseResult,
  type EvalCase,
  type EvalSettings,
  type ExpectedCall,
  type RunMode,
} from './protocol';

export type RunProgress = {
  total: number;
  done: number;
  currentCaseId: string | null;
  attempt: number;
  attempts: number;
};

export const evalState = $state({
  cases: loadCases() as EvalCase[],
  results: loadResults() as Record<string, CaseResult>,
  settings: loadEvalSettings() as EvalSettings,
  running: null as RunProgress | null,
  lastError: null as string | null,
});

let runAbort: AbortController | null = null;

export function currentOrigin(): string {
  const url = mcpState.tabUrl ?? mcpState.state?.url ?? null;
  if (!url) return 'unknown';
  try {
    return new URL(url).origin;
  } catch {
    return 'unknown';
  }
}

export function pageTools(): WebMcpToolSummary[] {
  return buildDiscoveredToolSummaries(mcpState.state?.tools ?? []);
}

export function casesForOrigin(origin = currentOrigin()): EvalCase[] {
  return evalState.cases
    .filter((entry) => entry.origin === origin)
    .sort((a, b) => a.createdAt - b.createdAt);
}

// ---- Case CRUD -------------------------------------------------------------

export function newCaseDraft(prompt = ''): EvalCase {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    origin: currentOrigin(),
    prompt,
    kind: 'direct',
    setup: [],
    expected: [],
    argMatch: 'subset',
    surface: snapshotSurface(currentOrigin(), pageTools()),
    createdAt: now,
    updatedAt: now,
  };
}

/** Turns a real tool call from the Traces tab into a prefilled case. */
export function caseFromTrace(trace: ToolCallTrace): EvalCase {
  const draft = newCaseDraft('');
  draft.expected = [
    {
      functionName: trace.toolName,
      arguments:
        trace.args && typeof trace.args === 'object' && !Array.isArray(trace.args)
          ? (trace.args as Record<string, unknown>)
          : {},
    },
  ];
  return draft;
}

export function saveCase(evalCase: EvalCase) {
  const next = { ...evalCase, updatedAt: Date.now() };
  const index = evalState.cases.findIndex((entry) => entry.id === next.id);
  if (index >= 0) evalState.cases[index] = next;
  else evalState.cases.push(next);
  persistCases(evalState.cases);
}

export function removeCase(id: string) {
  evalState.cases = evalState.cases.filter((entry) => entry.id !== id);
  delete evalState.results[id];
  persistCases(evalState.cases);
  persistResults(evalState.results);
}

export function getCase(id: string): EvalCase | undefined {
  return evalState.cases.find((entry) => entry.id === id);
}

/** Re-captures the tool surface so a reviewed drift stops being reported. */
export function acceptDrift(id: string) {
  const evalCase = getCase(id);
  if (!evalCase) return;
  saveCase({ ...evalCase, surface: snapshotSurface(evalCase.origin, pageTools()) });
  const result = evalState.results[id];
  if (result) {
    evalState.results[id] = { ...result, drift: undefined };
    persistResults(evalState.results);
  }
}

// ---- Settings --------------------------------------------------------------

export function setRuns(runs: number) {
  evalState.settings.runs = Math.min(Math.max(Math.round(runs), 1), MAX_RUNS_PER_CASE);
  persistEvalSettings({ ...evalState.settings });
}

export function setMode(mode: RunMode) {
  evalState.settings.mode = mode;
  if (mode === 'dry-run') evalState.settings.allowWrites = false;
  persistEvalSettings({ ...evalState.settings });
}

export function setAllowWrites(value: boolean) {
  evalState.settings.allowWrites = value;
  persistEvalSettings({ ...evalState.settings });
}

// ---- Import / export -------------------------------------------------------

export function exportCasesJson(origin = currentOrigin()): string {
  return JSON.stringify(exportSuite(casesForOrigin(origin), origin), null, 2);
}

export function importCasesJson(raw: string): { added: number; skipped: number } {
  const { cases, skipped } = importSuite(raw, currentOrigin());
  const byId = new Map(evalState.cases.map((entry) => [entry.id, entry]));
  for (const entry of cases) byId.set(entry.id, entry);
  evalState.cases = [...byId.values()];
  persistCases(evalState.cases);
  return { added: cases.length, skipped };
}

// ---- Running ---------------------------------------------------------------

function isWriteTool(name: string): boolean {
  const tool = pageTools().find((entry) => entry.name === name);
  return tool ? tool.annotations?.readOnlyHint !== true : true;
}

function makeChatTurn(tools: OllamaTool[], signal: AbortSignal): ChatTurn {
  return (messages: OllamaChatMessage[]) =>
    new Promise<ChatTurnResult>((resolve) => {
      let content = '';
      let settled = false;

      const finish = (value: ChatTurnResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };

      // Ollama runs locally, but a wedged model or a dropped bridge port would
      // otherwise hang the whole suite -- every turn gets its own deadline.
      const stop = streamOllamaChat({
        baseUrl: chatSettings.baseUrl,
        model: chatSettings.model,
        messages,
        think: false,
        tools,
        inferenceOptions: { temperature: evalState.settings.temperature },
        signal,
        handlers: {
          onDelta: (text) => {
            content += text;
          },
          onReasoning: () => {},
          onDone: (toolCalls) => finish({ toolCalls: toolCalls ?? [], content }),
          onError: (error) => finish({ toolCalls: [], content, error }),
        },
      });

      const timer = setTimeout(() => {
        stop();
        finish({ toolCalls: [], content, error: `Timed out after ${EVAL_TIMEOUT_MS / 1000}s` });
      }, EVAL_TIMEOUT_MS);

      signal.addEventListener(
        'abort',
        () => {
          stop();
          finish({ toolCalls: [], content, error: 'Run cancelled' });
        },
        { once: true },
      );
    });
}

async function dispatch(name: string, args: unknown) {
  const startedAt = performance.now();
  const outcome = await runTool(name, args, 'manual');
  return { ...outcome, durationMs: performance.now() - startedAt };
}

export function cancelRun() {
  runAbort?.abort();
  runAbort = null;
  evalState.running = null;
}

export async function runCases(ids: string[]): Promise<void> {
  if (evalState.running) return;

  const targets = ids
    .map((id) => getCase(id))
    .filter((entry): entry is EvalCase => Boolean(entry));
  if (targets.length === 0) return;

  const tools = pageTools();
  if (tools.length === 0) {
    evalState.lastError = 'No invokable WebMCP tools on this tab — nothing to evaluate against.';
    return;
  }

  const ollamaTools = buildPageOnlyTools(mcpState.state?.tools ?? []);
  // Same base prompt the chat agent runs on, minus the user's language and
  // custom instructions -- evals grade the page's tools, not chat preferences.
  const systemPrompt = buildChatSystemPrompt('en', { toolNames: tools.map((tool) => tool.name) });

  const controller = new AbortController();
  runAbort = controller;
  evalState.lastError = null;
  evalState.running = {
    total: targets.length,
    done: 0,
    currentCaseId: targets[0].id,
    attempt: 0,
    attempts: evalState.settings.runs,
  };

  const chat = makeChatTurn(ollamaTools, controller.signal);

  try {
    for (const evalCase of targets) {
      if (controller.signal.aborted) break;

      if (evalState.running) evalState.running.currentCaseId = evalCase.id;

      const attempts: Attempt[] = [];
      for (let index = 0; index < evalState.settings.runs; index += 1) {
        if (controller.signal.aborted) break;
        if (evalState.running) evalState.running.attempt = index + 1;

        attempts.push(
          await runAttempt({
            evalCase,
            index,
            mode: evalState.settings.mode,
            systemPrompt,
            chat,
            dispatch,
            isWriteTool,
            allowWrites: evalState.settings.allowWrites,
          }),
        );
      }

      if (attempts.length === 0) break;

      const drift = diffSurface(evalCase.surface, tools);
      const result: CaseResult = {
        caseId: evalCase.id,
        model: chatSettings.model,
        mode: evalState.settings.mode,
        attempts,
        passCount: attempts.filter((attempt) => attempt.verdict.pass).length,
        runCount: attempts.length,
        drift,
        finishedAt: Date.now(),
      };

      evalState.results[evalCase.id] = result;
      persistResults(evalState.results);

      if (evalState.running) evalState.running.done += 1;
    }
  } finally {
    runAbort = null;
    evalState.running = null;
  }
}

export function runAllForOrigin(origin = currentOrigin()): Promise<void> {
  return runCases(casesForOrigin(origin).map((entry) => entry.id));
}

/** Manual replay of an authored prelude, for stepping the app into a state. */
export async function replaySetupStep(step: ExpectedCall) {
  return dispatch(step.functionName, step.arguments ?? {});
}
