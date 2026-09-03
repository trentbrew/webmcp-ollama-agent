/** Nav chrome: read-only chat-completion indicator (scope: the active tab only). */

export const navIndicators = $state({
  /** Agent finished while user was away from Chat — show green dot until Chat is opened. */
  chatUnread: false,
});

let wasChatBusy = false;

export function trackChatActivity(busy: boolean, onChatPage: boolean) {
  if (wasChatBusy && !busy && !onChatPage) {
    navIndicators.chatUnread = true;
  }
  if (onChatPage) {
    navIndicators.chatUnread = false;
  }
  wasChatBusy = busy;
}

export function clearChatNavUnread() {
  navIndicators.chatUnread = false;
}
