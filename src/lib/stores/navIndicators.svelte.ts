/** Nav chrome: chat completion dot + cross-tab badge counts from background. */

export const navIndicators = $state({
  /** Agent finished while user was away from Chat — show green dot until Chat is opened. */
  chatUnread: false,
  /** Sum of tool counts on browser tabs other than the active one. */
  otherTabsToolCount: 0,
  /** Sum of trace counts on browser tabs other than the active one. */
  otherTabsTraceCount: 0,
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

export function setNavBadgeCounts(toolCount: number, traceCount: number) {
  navIndicators.otherTabsToolCount = toolCount;
  navIndicators.otherTabsTraceCount = traceCount;
}
