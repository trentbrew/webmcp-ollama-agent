import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Regression test for TRL-12: when the MV3 service worker spins down it takes the
// panel's runtime port -- and the background's in-memory panelSubscriptions map --
// with it. The panel must reconnect AND re-send `subscribe` for the active tab so
// pushed tool-state resumes without a manual page reload.

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

beforeEach(() => {
  ports.length = 0;
  vi.useFakeTimers();

  // store.svelte.ts uses the Svelte 5 `$state` rune. Under plain-node vitest it
  // isn't compiled, so provide an identity shim -- the reconnect logic under test
  // only reads/writes plain properties, not reactive tracking.
  (globalThis as Record<string, unknown>).$state = <T>(v: T) => v;

  const tabsListeners = { onActivated: () => {}, onUpdated: () => {}, onCreated: () => {}, onRemoved: () => {}, onMoved: () => {} };

  (globalThis as Record<string, unknown>).chrome = {
    runtime: {
      id: 'test-extension',
      connect: vi.fn((opts: { name: string }) => {
        const port = makePort(opts.name);
        ports.push(port);
        return port;
      }),
    },
    tabs: {
      query: vi.fn(async () => [{ id: 42, url: 'https://chess.example/game' }]),
      onActivated: { addListener: () => tabsListeners.onActivated },
      onUpdated: { addListener: () => tabsListeners.onUpdated },
      onCreated: { addListener: () => tabsListeners.onCreated },
      onRemoved: { addListener: () => tabsListeners.onRemoved },
      onMoved: { addListener: () => tabsListeners.onMoved },
    },
  };
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as Record<string, unknown>).chrome;
  delete (globalThis as Record<string, unknown>).$state;
  vi.resetModules();
});

function subscribeCalls(port: FakePort) {
  return port.postMessage.mock.calls.filter(([m]) => (m as { type?: string })?.type === 'subscribe');
}

describe('mcp panel store — SW-restart reconnect (TRL-12)', () => {
  it('reconnects and re-subscribes to the active tab when the port disconnects', async () => {
    const store = await import('./store.svelte');
    const chrome = (globalThis as Record<string, unknown>).chrome as {
      runtime: { connect: ReturnType<typeof vi.fn> };
    };

    // Panel boots: subscribeToActiveTab() -> connect() + subscribe.
    store.initMcpTracking();
    await vi.runAllTicks();
    await Promise.resolve();
    await Promise.resolve();

    expect(chrome.runtime.connect).toHaveBeenCalledTimes(1);
    const first = ports[0];
    expect(subscribeCalls(first).length).toBeGreaterThanOrEqual(1);
    expect(store.mcpState.tabId).toBe(42);
    expect(store.mcpState.connected).toBe(true);

    // Service worker spins down -> port dies.
    first._disconnect();
    expect(store.mcpState.connected).toBe(false);

    // Debounced reconnect fires.
    await vi.advanceTimersByTimeAsync(350);
    await Promise.resolve();

    // A brand-new port was opened and a fresh subscribe was sent for tab 42.
    expect(chrome.runtime.connect).toHaveBeenCalledTimes(2);
    const second = ports[1];
    const resub = subscribeCalls(second);
    expect(resub.length).toBe(1);
    expect((resub[0][0] as { tabId: number }).tabId).toBe(42);
    expect(store.mcpState.connected).toBe(true);
  });
});
