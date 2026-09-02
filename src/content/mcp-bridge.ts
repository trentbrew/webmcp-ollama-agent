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
let retired = false;

// A reload, update, or disable orphans this content script: the port dies and every
// chrome.* call starts throwing -- "Extension context invalidated", or a TypeError once
// chrome.runtime itself is gone. Uncaught inside the disconnect retry, that spams the
// console of the very page the panel is meant to be inspecting, once per open tab per
// reload. An SW restart looks identical from the port's side, so tell them apart by
// probing chrome.runtime: it stays live across an SW restart and vanishes with the
// extension. When it's gone, retire the orphan quietly -- the newly injected bridge
// takes over, and there is nothing left for this one to relay to.
function extensionAlive() {
  return Boolean(chrome.runtime?.id);
}

function retire() {
  if (retired) return;
  retired = true;
  port = undefined;
  window.removeEventListener('message', handlePageMessage);
}

function connect() {
  if (retired) return;
  if (!extensionAlive()) {
    retire();
    return;
  }

  try {
    port = chrome.runtime.connect({ name: WEBMCP_TAB_PORT });
  } catch {
    // Context died between the probe and the call.
    retire();
    return;
  }

  port.onMessage.addListener(handleBackgroundMessage);
  port.onDisconnect.addListener(() => {
    port = undefined;
    if (!extensionAlive()) {
      // Not an idle SW teardown -- the extension itself is gone.
      retire();
      return;
    }
    // Reconnect on the next tick; the SW will wake and re-register onConnect.
    setTimeout(() => {
      if (port || retired) return;
      connect();
      if (retired) return;
      // Ask the page (MAIN world, state still alive) to rebroadcast its tools so
      // the freshly-woken background repopulates its tab state and badge.
      window.postMessage({ source: WEBMCP_BRIDGE_SOURCE, type: 'list-tools', requestId: 'reconnect' }, '*');
    }, 250);
  });
}

function send(message: BridgeToBackground) {
  if (retired) return;
  try {
    port?.postMessage(message);
  } catch {
    // Background/service worker not reachable (e.g. mid-restart) -- drop silently,
    // the reconnect handler will resync once the SW is back. If the extension itself
    // is gone, stop relaying into the void.
    if (!extensionAlive()) retire();
  }
}

function handlePageMessage(event: MessageEvent) {
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
}

window.addEventListener('message', handlePageMessage);

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
