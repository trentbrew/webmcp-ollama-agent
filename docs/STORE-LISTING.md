# Chrome Web Store submission notes

Working draft of the answers the CWS dashboard asks for. Nothing here ships in
the extension package — it exists so the justifications are written once and
stay consistent across resubmissions.

## Single purpose

> Inspect and exercise the WebMCP tools a web page exposes, using a language
> model running locally on the user's own machine.

Everything in the panel serves that: the MCP tab lists the active tab's tools
and schemas and runs them directly, the Traces tab audits the calls, and Chat
drives the same tools through a local model.

## Permission justifications

Paste these into the dashboard fields. The same table lives in `PRIVACY.md` for
users; keep the two in sync.

**`sidePanel`** — The extension's entire UI is a Chrome side panel.

**`tabs`** — Conversations are scoped to a tab. Reading the tab title and URL
labels each conversation and lets the user switch between them. No browsing
history is collected or stored beyond the open tabs' titles.

**`scripting`** — WebMCP detection runs from content scripts at
`document_start`. Tabs that were already open when the extension was installed
or updated never received them, so those tabs are injected programmatically on
install and startup. Without this the extension appears broken until every open
tab is manually reloaded.

**`storage`** — Persists conversations, model settings, and tool traces in the
local browser profile. Nothing is synced.

**`declarativeNetRequest`** — Ollama runs as a local HTTP server that rejects
cross-origin requests from an extension origin. A single dynamic rule rewrites
the `Origin` header on requests to the user-configured model host so those
requests succeed. It is scoped to that host and does not touch page traffic.

**Broad host permissions (`http://*/*`, `https://*/*`)** — WebMCP is a web
platform API that any site can use; an inspector for it cannot know in advance
which sites those are, the way a devtool cannot know which pages it will be
opened on. Content scripts detect tool registrations and relay calls only on the
tab the user is actively viewing, and the data goes only to the panel and the
user's locally configured model.

**Localhost host permissions** — Reach the model host (default
`http://127.0.0.1:11434`).

## Listing copy

**Name:** WebMCP Agent Substrate

**Short description (132 char max):**

> Inspect and run the WebMCP tools any page exposes — with a local model. No API
> key, no account, nothing leaves your machine.

**Category:** Developer Tools

**Notes on positioning:** the search term people use after a frustrating hour is
"WebMCP inspector." Existing inspectors all require a cloud API key; the local
model is the differentiator and belongs in the first sentence.

## Pre-submission checklist

- [x] Privacy policy published at a public URL (`PRIVACY.md`)
- [x] Test fixtures excluded from the production bundle
- [x] `package.json` and `public/manifest.json` versions agree (build enforces)
- [x] First-run state when no model host is reachable
- [ ] Screenshots: 1280x800 or 640x400, at least one, at most five
- [ ] 128x128 store icon (separate from the manifest icons)
- [ ] Developer account registration fee paid (one time)
- [ ] Verified publisher email
- [ ] Load `dist/` unpacked and walk a clean profile through first run

## Expect a slow review

Broad host permissions plus content scripts on every page put this in extended
review. Budget weeks, not days, and expect at least one follow-up question about
`declarativeNetRequest`.
