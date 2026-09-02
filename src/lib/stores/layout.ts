import { writable, get } from 'svelte/store';

export type LayoutMode = 'dock' | 'panes';

const STORAGE_KEY = 'svelte5-extension-layout';

function readLayoutMode(): LayoutMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'panes' || stored === 'dock') return stored;
  return 'panes';
}

export const layoutMode = writable<LayoutMode>(readLayoutMode());

// Subscribe to save layout changes to localStorage
layoutMode.subscribe((value) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, value);
  }
});

export function setLayoutMode(newMode: LayoutMode): void {
  layoutMode.set(newMode);
}

export function toggleLayoutMode(): void {
  layoutMode.update((current) => {
    const newMode: LayoutMode = current === 'dock' ? 'panes' : 'dock';
    return newMode;
  });
}
