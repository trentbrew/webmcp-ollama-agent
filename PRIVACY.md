# Privacy Policy — WebMCP Agent Substrate

Last updated: September 1, 2026

## Summary

This extension does not collect, transmit, or sell your data. There are no
accounts, no analytics, and no telemetry. Everything it reads stays inside your
browser profile, except for the text you send to the model host you configure —
which by default is a program running on your own computer.

## What the extension accesses

- **Page content on the active tab.** Content scripts detect WebMCP tools that a
  site registers, read their names, descriptions, and schemas, and relay tool
  calls and results. The panel can also sample the page's colors and fonts to
  match its own theme.
- **Console messages on the active tab**, so the panel can show them in its log.
- **Tab titles and URLs**, to label conversations and scope them to a tab.
- **What you type**, including any files you attach to a message.

## Where that data goes

- **To the model host you configure.** Your prompts, the tool schemas exposed by
  the current page, and tool results are sent to the Ollama endpoint set in
  Settings so a model can respond. The default is `http://127.0.0.1:11434` — a
  process on your own machine, not a server we run.

  If you change that address to a remote host, your prompts and page tool data
  will be sent to that host, and its operator's privacy practices apply. This is
  the only setting that causes data to leave your computer.

- **Nowhere else.** The extension makes no other network requests. It contacts
  no server operated by the developer, and no third-party API, analytics
  endpoint, or crash reporter.

## Where that data is stored

- `chrome.storage.local` and `chrome.storage.session` — conversation history,
  settings, and tool traces.
- Origin Private File System (OPFS) — the embedded graph database used by the
  Trellis tools.

All of this lives in your local browser profile. None of it is synced to a
server by the extension. Removing the extension removes it.

## Permissions and why they are needed

| Permission | Why |
| --- | --- |
| `sidePanel` | The entire UI is a side panel. |
| `tabs` | Read tab title/URL to scope a conversation to its tab and to switch between them. |
| `scripting` | Inject the WebMCP detection scripts into tabs that were already open when the extension was installed or updated. |
| `storage` | Persist conversations, settings, and traces locally. |
| `declarativeNetRequest` | Rewrite request headers on calls to the local Ollama endpoint so the browser permits them. Applied only to the configured model host, never to page traffic. |
| `host_permissions` for `http://*/*`, `https://*/*` | WebMCP tools can be registered by any site, and the extension's purpose is to inspect them wherever they appear. It reads page data only for the tab you have open in front of you, and only to surface tools, results, and console output in the panel. |
| `host_permissions` for `http://localhost/*`, `http://127.0.0.1/*` | Reach the local model host. |

## Changes

Material changes to this policy will be published in this file, and the "last
updated" date above will change.

## Contact

Questions or concerns: open an issue at
<https://github.com/trentbrew/webmcp-ollama-agent>.
