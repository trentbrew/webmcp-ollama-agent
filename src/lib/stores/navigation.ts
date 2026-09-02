import { writable } from 'svelte/store';
import { clearChatNavUnread } from './navIndicators.svelte';

export type PageType =
  | 'home'
  | 'chat'
  | 'mcp'
  | 'traces'
  | 'evals'
  | 'facts'
  | 'settings'
  | 'help'
  | 'components';

export const currentPage = writable<PageType>('chat');

function scrollShellBodiesToTop() {
  requestAnimationFrame(() => {
    document.querySelectorAll('.page-shell__body').forEach((el) => {
      el.scrollTop = 0;
    });
  });
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const viewport = document.querySelector('.chat-thread-scroll');
      if (viewport instanceof HTMLElement) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    });
  });
}

export function navigateTo(page: PageType) {
  currentPage.set(page);

  if (page === 'chat') {
    clearChatNavUnread();
    scrollChatToBottom();
  } else {
    scrollShellBodiesToTop();
  }
}
