import { beforeEach, describe, expect, it, vi } from 'vitest';

// Regression test: reloading/updating/disabling the extension orphans the content
// script in every open tab. The port dies exactly as it does on an idle service-worker
// teardown, but here the retry is fatal -- chrome.runtime.connect throws
// "Extension context invalidated" (or a TypeError once chrome.runtime is gone), uncaught,
// into the console of the page the panel is inspecting. The bridge must tell the two
// cases apart: reconnect across an SW restart, retire quietly when the extension is gone.

type PortListener = (arg: unknown) => void;

type FakePort = {
  name: string;
  postMessage: ReturnType<typeof vi.fn>;
  onMessage: { addListener: (cb: PortListener) => void };
  onDisconnect: { addListener: (cb: () => void) => void };
  _disconnect: () => void;
};

function makePort(name: string): FakePort {
  let disconnectCb: (() => void) | undefined;
  return {
    name,
    postMessage: vi.fn(),
    onMessage: { addListener: () => {} },
    onDisconnect: { addListener: (cb) => { disconnectCb = cb; } },
    _disconnect: () => disconnectCb?.(),
  };
}

const ports: FakePort[] = [];
let listeners: Array<(event: unknown) => void>;

// The bridge runs at document_start against real globals; under node vitest we supply
// only the surface it touches (window listeners/postMessage + the chrome.runtime port).
function installGlobals() {
  ports.length = 0;
  listeners = [];
  const win = {
    addEventListener: vi.fn((type: string, cb: (event: unknown) => void) => {
      if (type === 'message') listeners.push(cb);
    }),
    removeEventListener: vi.fn((type: string, cb: (event: unknown) => void) => {
      if (type === 'message') listeners = listeners.filter((l) => l !== cb);
    }),
    postMessage: vi.fn(),
  };
  (globalThis as Record<string, unknown>).window = win;
  (globalThis as Record<string, unknown>).chrome = {
    runtime: {
      id: 'test-extension',
      connect: vi.fn((opts: { name: string }) => {
        const port = makePort(opts.name);
        ports.push(port);
        return port;
      }),
    },
  };
  return win;
}

function chromeStub() {
  return (globalThis as Record<string, unknown>).chrome as {
    runtime?: { id?: string; connect: ReturnType<typeof vi.fn> };
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
});

describe('mcp-bridge orphan handling', () => {
  it('reconnects when the service worker restarts (extension still alive)', async () => {
    installGlobals();
    await import('./mcp-bridge');

    expect(chromeStub().runtime!.connect).toHaveBeenCalledTimes(1);

    ports[0]._disconnect();
    vi.advanceTimersByTime(250);

    expect(chromeStub().runtime!.connect).toHaveBeenCalledTimes(2);
  });

  it('retires without reconnecting when the extension context is gone', async () => {
    const win = installGlobals();
    await import('./mcp-bridge');
    expect(listeners).toHaveLength(1);

    // Extension reloaded: chrome.runtime is torn out from under the orphan.
    delete chromeStub().runtime;
    ports[0]._disconnect();

    expect(() => vi.advanceTimersByTime(250)).not.toThrow();
    expect(listeners).toHaveLength(0);
    expect(win.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('swallows a connect() that throws mid-retry instead of surfacing it to the page', async () => {
    installGlobals();
    await import('./mcp-bridge');

    // chrome.runtime.id survives the check but the call still throws -- the race
    // Chrome exposes while an update is landing.
    chromeStub().runtime!.connect = vi.fn(() => {
      throw new Error('Extension context invalidated.');
    });
    ports[0]._disconnect();

    expect(() => vi.advanceTimersByTime(250)).not.toThrow();
    expect(listeners).toHaveLength(0);
  });

  it('stops relaying page messages once retired', async () => {
    installGlobals();
    await import('./mcp-bridge');

    const { WEBMCP_PAGE_SOURCE } = await import('../lib/webmcp/protocol');
    const relay = listeners[0];
    const port = ports[0];

    delete chromeStub().runtime;
    port._disconnect();
    vi.advanceTimersByTime(250);

    port.postMessage.mockClear();
    relay({ source: (globalThis as Record<string, unknown>).window, data: { source: WEBMCP_PAGE_SOURCE, type: 'tools', detected: true, tools: [] } });

    expect(port.postMessage).not.toHaveBeenCalled();
  });
});
