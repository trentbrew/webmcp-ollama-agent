import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ExecuteScriptArgs = {
  target: { tabId: number; allFrames: boolean };
  files: string[];
  world: string;
  injectImmediately: boolean;
};

const executeScript = vi.fn(async (_args: ExecuteScriptArgs) => []);
const tabsQuery = vi.fn(async () => [] as Array<{ id?: number }>);

beforeEach(() => {
  executeScript.mockReset();
  tabsQuery.mockReset();

  (globalThis as Record<string, unknown>).chrome = {
    scripting: { executeScript },
    tabs: { query: tabsQuery },
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).chrome;
  vi.resetModules();
});

describe('injectExistingTabs (TRL-13)', () => {
  it('injects mcp-main (MAIN) and mcp-bridge (ISOLATED) into each http(s) tab', async () => {
    tabsQuery.mockResolvedValueOnce([{ id: 7 }, { id: 9 }]);

    const { injectExistingTabs } = await import('./inject');
    await injectExistingTabs();

    expect(tabsQuery).toHaveBeenCalledWith({ url: ['http://*/*', 'https://*/*'] });
    expect(executeScript).toHaveBeenCalledTimes(4);

    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 7, allFrames: false },
      files: ['assets/mcp-main.js'],
      world: 'MAIN',
      injectImmediately: true,
    });
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 7, allFrames: false },
      files: ['assets/mcp-bridge.js'],
      world: 'ISOLATED',
      injectImmediately: true,
    });
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 9, allFrames: false },
      files: ['assets/mcp-main.js'],
      world: 'MAIN',
      injectImmediately: true,
    });
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 9, allFrames: false },
      files: ['assets/mcp-bridge.js'],
      world: 'ISOLATED',
      injectImmediately: true,
    });
  });

  it('skips tabs without ids and continues when executeScript throws', async () => {
    tabsQuery.mockResolvedValueOnce([{ id: 3 }, {}, { id: 5 }]);
    executeScript.mockImplementation(async (args: ExecuteScriptArgs) => {
      if (args.target.tabId === 3 && args.world === 'MAIN') {
        throw new Error('Cannot access restricted page');
      }
      return [];
    });

    const { injectExistingTabs } = await import('./inject');
    await injectExistingTabs();

    expect(executeScript).toHaveBeenCalledTimes(4);
    expect(executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 5, allFrames: false } }),
    );
  });

  it('no-ops when tabs.query throws', async () => {
    tabsQuery.mockRejectedValueOnce(new Error('tabs unavailable'));

    const { injectExistingTabs } = await import('./inject');
    await injectExistingTabs();

    expect(executeScript).not.toHaveBeenCalled();
  });
});
