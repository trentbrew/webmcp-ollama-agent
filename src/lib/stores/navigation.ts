import { writable } from 'svelte/store';

export type PageType =
  | 'home'
  | 'chat'
  | 'mcp'
  | 'traces'
  | 'trellis'
  | 'settings'
  | 'help'
  | 'components';

export const currentPage = writable<PageType>('chat');

export function navigateTo(page: PageType) {
  currentPage.set(page);
  console.log('Navigated to:', page);
}
