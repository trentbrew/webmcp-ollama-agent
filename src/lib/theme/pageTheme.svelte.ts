// Reactive page-theme store for WebMCP.
//
// Watches the active Chrome tab. When autoMatch is on, re-syncs on tab activate.
// Lets the agent or UI apply the sampled page's palette as inline CSS vars on
// the extension's root element, overriding whatever daisyUI `data-theme` is active.

import { browserContext } from '../browser/context.svelte';
import { samplePageTheme, getSamplerScript, type SampledPage } from './sampler';
import { buildPageTheme, type PageTheme } from './buildTheme';
import { theme as namedThemeStore, type Theme } from '../stores/theme';
import { get } from 'svelte/store';

export interface PageThemeState {
  pageTheme: PageTheme | null;
  autoMatch: boolean;
  loading: boolean;
  error: string | null;
}

function makeRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>('div[data-theme]');
}

function applyPageThemeVars(pt: PageTheme): void {
  const root = makeRoot();
  if (!root) return;
  for (const [k, v] of Object.entries(pt.vars)) {
    root.style.setProperty(k, v);
  }
}

function clearPageThemeVars(): void {
  const root = makeRoot();
  if (!root) return;
  const KEYS = [
    '--p','--pc','--s','--sc','--a','--ac','--n','--nc',
    '--b1','--b2','--b3','--bc',
    '--in','--inc','--su','--suc','--wa','--wac','--er','--erc',
    '--rounded-box','--rounded-btn','--rounded-badge',
    '--page-font','color-scheme',
  ];
  for (const k of KEYS) root.style.removeProperty(k);
}

// Apply the full named daisyUI theme after page-theme is cleared.
function restoreNamedTheme(): void {
  const root = makeRoot();
  if (!root) return;
  root.setAttribute("data-theme", get(namedThemeStore) as Theme);
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const pageThemeState = $state<PageThemeState>({
  pageTheme: null,
  autoMatch: false,
  loading: false,
  error: null,
});

// ── Actions ───────────────────────────────────────────────────────────────────

export async function syncFromTab(tabId?: number): Promise<void> {
  const tid = tabId ?? browserContext.activeTab?.id;
  if (!tid) {
    pageThemeState.error = 'No active tab';
    return;
  }

  pageThemeState.loading = true;
  pageThemeState.error = null;

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tid },
      func: samplePageTheme,
    }) as unknown as [{ result: SampledPage }];

    pageThemeState.pageTheme = buildPageTheme(result);
    if (pageThemeState.autoMatch) applyPageThemeVars(pageThemeState.pageTheme);
  } catch (e) {
    pageThemeState.error = e instanceof Error ? e.message : String(e);
  } finally {
    pageThemeState.loading = false;
  }
}

export function applyPageTheme(): void {
  if (!pageThemeState.pageTheme) return;
  applyPageThemeVars(pageThemeState.pageTheme);
}

export function clearPageTheme(): void {
  clearPageThemeVars();
  restoreNamedTheme();
  pageThemeState.pageTheme = null;
  pageThemeState.error = null;
}

export function setAutoMatch(on: boolean): void {
  pageThemeState.autoMatch = on;
  if (on) {
    syncFromTab();
  } else {
    clearPageTheme();
  }
}

// ── Auto-sync on tab change ───────────────────────────────────────────────────

let lastTabId: number | null = null;

export function checkAutoSync(): void {
  const tab = browserContext.activeTab;
  if (!tab?.id) return;
  if (tab.id !== lastTabId && pageThemeState.autoMatch) {
    lastTabId = tab.id;
    syncFromTab(tab.id);
  }
}
