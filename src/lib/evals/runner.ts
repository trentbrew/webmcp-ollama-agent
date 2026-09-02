// Attempt execution, factored away from Svelte state and chrome.* so the
// control flow (setup chain -> graded turn -> scoring) is testable with fakes.

import { MAX_TOOL_ITERATIONS } from '../ai/config';
import type { OllamaChatMessage, OllamaToolCall } from '../ai/protocol';
import { scoreCalls } from './scoring';
import {
  type ActualCall,
  type Attempt,
  type CaseVerdict,
  type EvalCase,
  type ExpectedCall,
  type RunMode,
} from './protocol';

export type DispatchResult = {
  ok: boolean;
  result?: unknown;
  error?: string;
  durationMs?: number;
};

export type ChatTurnResult = {
  toolCalls: OllamaToolCall[];
  content: string;
  error?: string;
};

export type ChatTurn = (messages: OllamaChatMessage[]) => Promise<ChatTurnResult>;
export type Dispatch = (name: string, args: unknown) => Promise<DispatchResult>;

export type RunAttemptOptions = {
  evalCase: EvalCase;
  index: number;
  mode: RunMode;
  systemPrompt: string;
  chat: ChatTurn;
  dispatch: Dispatch;
  /** True for tools without `readOnlyHint` -- blocked unless writes are allowed. */
  isWriteTool: (name: string) => boolean;
  allowWrites: boolean;
};

/**
 * Ollama sometimes hands back `arguments` as a JSON string rather than an
 * object, and older builds omit it entirely. Normalize before scoring so an
 * encoding quirk never reads as a wrong-arguments failure.
 */
export function normalizeToolCalls(toolCalls: OllamaToolCall[] | undefined): ActualCall[] {
  if (!toolCalls?.length) return [];

  return toolCalls
    .filter((call) => typeof call?.function?.name === 'string')
    .map((call) => {
      const raw = call.function.arguments as unknown;
      let args: Record<string, unknown> = {};

      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            args = parsed as Record<string, unknown>;
          }
        } catch {
          // Leave args empty; scoring will surface it as a mismatch.
        }
      } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        args = raw as Record<string, unknown>;
      }

      return { functionName: call.function.name, arguments: args };
    });
}

function makeAttempt(
  index: number,
  verdict: CaseVerdict,
  calls: ActualCall[],
  durationMs: number,
  content?: string,
): Attempt {
  return { index, verdict, calls, durationMs, content };
}

/** Runs the authored prelude with no model in the loop. */
async function runSetup(
  setup: ExpectedCall[],
  dispatch: Dispatch,
): Promise<{ ok: true } | { ok: false; step: ExpectedCall; error: string }> {
  for (const step of setup) {
    const outcome = await dispatch(step.functionName, step.arguments ?? {});
    if (!outcome.ok) {
      return { ok: false, step, error: outcome.error ?? 'Setup step failed' };
    }
  }
  return { ok: true };
}

export async function runAttempt(options: RunAttemptOptions): Promise<Attempt> {
  const { evalCase, index, mode, systemPrompt, chat, dispatch, isWriteTool, allowWrites } = options;
  const startedAt = Date.now();

  const setup = await runSetup(evalCase.setup, dispatch);
  if (!setup.ok) {
    return makeAttempt(
      index,
      {
        pass: false,
        failure: 'runtime-error',
        detail: `Setup step ${setup.step.functionName} failed: ${setup.error}`,
        mismatches: [],
        expectedNames: [],
        actualNames: [],
      },
      [],
      Date.now() - startedAt,
    );
  }

  const messages: OllamaChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: evalCase.prompt },
  ];

  const observed: ActualCall[] = [];
  let lastContent = '';

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const turn = await chat(messages);

    if (turn.error) {
      return makeAttempt(
        index,
        {
          pass: false,
          failure: 'model-error',
          detail: turn.error,
          mismatches: [],
          expectedNames: [],
          actualNames: observed.map((call) => call.functionName),
        },
        observed,
        Date.now() - startedAt,
        turn.content,
      );
    }

    lastContent = turn.content || lastContent;
    const calls = normalizeToolCalls(turn.toolCalls);

    // Dry-run grades the first proposed turn and stops -- nothing is dispatched,
    // so a suite is safe to run against a page with destructive tools.
    if (mode === 'dry-run') {
      observed.push(...calls);
      break;
    }

    if (calls.length === 0) break;

    messages.push({ role: 'assistant', content: turn.content, tool_calls: turn.toolCalls });

    for (const call of calls) {
      if (isWriteTool(call.functionName) && !allowWrites) {
        const blocked: ActualCall = {
          ...call,
          ok: false,
          error: 'Blocked: write tool, and "allow writes" is off.',
        };
        observed.push(blocked);
        messages.push({
          role: 'tool',
          content: `Error: ${blocked.error}`,
        });
        continue;
      }

      const outcome = await dispatch(call.functionName, call.arguments);
      observed.push({
        ...call,
        ok: outcome.ok,
        error: outcome.error,
        durationMs: outcome.durationMs,
      });
      messages.push({
        role: 'tool',
        content: outcome.ok
          ? JSON.stringify(outcome.result ?? null)
          : `Error: ${outcome.error ?? 'tool failed'}`,
      });
    }
  }

  const verdict = scoreCalls(evalCase.expected, observed, evalCase.argMatch);
  return makeAttempt(index, verdict, observed, Date.now() - startedAt, lastContent);
}
