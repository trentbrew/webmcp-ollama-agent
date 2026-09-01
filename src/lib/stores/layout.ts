import { writable, get } from 'svelte/store';

export type LayoutMode = 'dock' | 'panes';

const STORAGE_KEY = 'svelte5-extension-layout';

// Initialize from localStorage or default to 'dock'
const storedLayout = (localStorage.getItem(STORAGE_KEY) as LayoutMode) || 'dock';
export const layoutMode = writable<LayoutMode>(storedLayout);

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
