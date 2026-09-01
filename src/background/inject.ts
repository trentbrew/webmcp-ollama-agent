// Cold-start injection for already-open tabs.
//
// MV3 manifest content_scripts only run on navigation, so after the extension is
// installed or updated (onInstalled) -- or the browser restarts (onStartup) --
// every already-open http(s) tab is left without mcp-main/mcp-bridge until a
// manual reload. This module programmatically injects both bundles into those
// tabs via chrome.scripting so tools light up without a reload.
//
// Requires the "scripting" permission plus http/https host_permissions: a
// content_scripts `matches` entry does NOT grant executeScript host access.

// document_start manifest injection uses world MAIN (page realm, to wrap
// registerTool) and world ISOLATED (extension realm, to bridge to the SW). We
// mirror that split here so programmatic injection behaves identically.
const INJECTIONS: Array<{ file: string; world: `${chrome.scripting.ExecutionWorld}` }> = [
  { file: 'assets/mcp-main.js', world: 'MAIN' },
  { file: 'assets/mcp-bridge.js', world: 'ISOLATED' },
];

// Restricted schemes/hosts where executeScript always throws. We already filter
// the tabs.query to http/https, but a tab's URL can still be a page the extension
// may not script (e.g. the Chrome Web Store), so every call is wrapped in a catch.
async function injectIntoTab(tabId: number) {
  for (const { file, world } of INJECTIONS) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: false },
        files: [file],
        world,
        injectImmediately: true,
      });
    } catch {
      // Restricted tab (chrome://, web store, view-source, PDF viewer) or the tab
      // closed mid-inject -- skip it without aborting the rest of the batch.
    }
  }
}

/**
 * Inject both content-script bundles into every open http/https tab. Idempotent:
 * the content scripts self-guard against double-execution, so re-running (e.g. an
 * onStartup restore that also auto-injects via manifest) is safe.
 */
export async function injectExistingTabs() {
  let tabs: chrome.tabs.Tab[] = [];
  try {
    tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  } catch {
    return;
  }

  await Promise.all(
    tabs.map((tab) => (typeof tab.id === 'number' ? injectIntoTab(tab.id) : Promise.resolve())),
  );
}
