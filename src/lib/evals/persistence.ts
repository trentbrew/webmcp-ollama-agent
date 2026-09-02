// localStorage-backed eval store, mirroring the best-effort persistence style
// used by chat/persistence.ts (never throw on quota or a corrupt blob).

import {
  DEFAULT_EVAL_SETTINGS,
  MAX_RUNS_PER_CASE,
  type CaseResult,
  type EvalCase,
  type EvalSettings,
} from './protocol';

export const EVALS_CASES_KEY = 'webmcp:evals:cases:v1';
export const EVALS_RESULTS_KEY = 'webmcp:evals:results:v1';
export const EVALS_SETTINGS_KEY = 'webmcp:evals:settings:v1';

/** Results are disposable; keep the store small rather than unbounded. */
const MAX_STORED_RESULTS = 200;

export function loadCases(): EvalCase[] {
  try {
    const raw = localStorage.getItem(EVALS_CASES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EvalCase[];
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry.id === 'string') : [];
  } catch {
    return [];
  }
}

export function persistCases(cases: EvalCase[]) {
  try {
    localStorage.setItem(EVALS_CASES_KEY, JSON.stringify(cases));
  } catch {
    // Best-effort persistence only.
  }
}

export function loadResults(): Record<string, CaseResult> {
  try {
    const raw = localStorage.getItem(EVALS_RESULTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CaseResult>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function persistResults(results: Record<string, CaseResult>) {
  try {
    const entries = Object.entries(results)
      .sort((a, b) => b[1].finishedAt - a[1].finishedAt)
      .slice(0, MAX_STORED_RESULTS);
    localStorage.setItem(EVALS_RESULTS_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Best-effort persistence only.
  }
}

export function parseEvalSettings(parsed: Partial<EvalSettings> | null): EvalSettings {
  if (!parsed) return { ...DEFAULT_EVAL_SETTINGS };
  const runs = typeof parsed.runs === 'number' ? Math.round(parsed.runs) : DEFAULT_EVAL_SETTINGS.runs;
  return {
    runs: Math.min(Math.max(runs, 1), MAX_RUNS_PER_CASE),
    mode: parsed.mode === 'execute' ? 'execute' : 'dry-run',
    // Never restore a persisted write permission -- executing writes is opt-in
    // per session, since a suite run fires them against whatever page is open.
    allowWrites: false,
    temperature:
      typeof parsed.temperature === 'number'
        ? Math.min(Math.max(parsed.temperature, 0), 2)
        : DEFAULT_EVAL_SETTINGS.temperature,
  };
}

export function loadEvalSettings(): EvalSettings {
  try {
    const raw = localStorage.getItem(EVALS_SETTINGS_KEY);
    return parseEvalSettings(raw ? (JSON.parse(raw) as Partial<EvalSettings>) : null);
  } catch {
    return { ...DEFAULT_EVAL_SETTINGS };
  }
}

export function persistEvalSettings(settings: EvalSettings) {
  try {
    localStorage.setItem(EVALS_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Best-effort persistence only.
  }
}
