// Runs in the extension's isolated world (default content-script world). Cannot see
// the MAIN-world page script's JS state directly, so it relays between window.postMessage
// (page <-> mcp-main.ts) and chrome.runtime.connect (background).
import {
  WEBMCP_BRIDGE_SOURCE,
  WEBMCP_PAGE_SOURCE,
  WEBMCP_TAB_PORT,
  type BackgroundToBridge,
  type BridgeToBackground,
  type PageResponse,
} from '../lib/webmcp/protocol';

// The MV3 service worker is ephemeral: Chrome tears it down when idle and the
// port silently dies with it. The bridge only connects once at document_start,
// so without reconnection the background's in-memory tab state (and the panel it
// feeds) is lost forever after the first SW restart, while the toolbar badge keeps
// showing a stale, retained count. Reconnect on disconnect and re-request the
// page's tools so the background always resyncs.
// Idempotency guard -- mirror mcp-main. A second injection (onStartup restore that
// also auto-ran the manifest content script) would open a duplicate runtime port.
const bridgeFlag = '__webmcpBridgeLoaded';
if ((window as unknown as Record<string, boolean>)[bridgeFlag]) {
  // Already bridged in this isolated realm -- do nothing.
} else {
  (window as unknown as Record<string, boolean>)[bridgeFlag] = true;
  install();
}

function install() {

let port: chrome.runtime.Port | undefined;

function connect() {
  port = chrome.runtime.connect({ name: WEBMCP_TAB_PORT });

  port.onMessage.addListener(handleBackgroundMessage);
  port.onDisconnect.addListener(() => {
    port = undefined;
    // Reconnect on the next tick; the SW will wake and re-register onConnect.
    setTimeout(() => {
      if (port) return;
      connect();
      // Ask the page (MAIN world, state still alive) to rebroadcast its tools so
      // the freshly-woken background repopulates its tab state and badge.
      window.postMessage({ source: WEBMCP_BRIDGE_SOURCE, type: 'list-tools', requestId: 'reconnect' }, '*');
    }, 250);
  });
}

function send(message: BridgeToBackground) {
  try {
    port?.postMessage(message);
  } catch {
    // Background/service worker not reachable (e.g. mid-restart) -- drop silently,
    // the reconnect handler will resync once the SW is back.
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data as PageResponse | undefined;
  if (!data || data.source !== WEBMCP_PAGE_SOURCE) return;

  if (data.type === 'ready' || data.type === 'tools') {
    send({ type: 'state', detected: data.detected, tools: 'tools' in data ? data.tools : [] });
    return;
  }

  if (data.type === 'tool-result') {
    send({
      type: 'tool-result',
      requestId: data.requestId,
      ok: data.ok,
      result: data.result,
      error: data.error,
      durationMs: data.durationMs,
    });
    return;
  }

  if (data.type === 'console-entry') {
    send({ type: 'console-entry', level: data.level, args: data.args, timestamp: data.timestamp });
  }
});

function handleBackgroundMessage(message: BackgroundToBridge) {
  if (message.type === 'list-tools') {
    window.postMessage({ source: WEBMCP_BRIDGE_SOURCE, type: 'list-tools', requestId: 'background' }, '*');
    return;
  }

  if (message.type === 'call-tool') {
    window.postMessage(
      { source: WEBMCP_BRIDGE_SOURCE, type: 'call-tool', requestId: message.requestId, name: message.name, args: message.args },
      '*',
    );
  }
}

connect();

// Ask the page script for its current state in case it broadcast "ready" before this
// isolated-world script finished connecting the port.
window.postMessage({ source: WEBMCP_BRIDGE_SOURCE, type: 'list-tools', requestId: 'initial' }, '*');

} // end install()
