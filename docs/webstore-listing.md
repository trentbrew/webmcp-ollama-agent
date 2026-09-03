# Chrome Web Store — listing & permission justification

Paste-ready copy for the Developer Dashboard. This is the "single purpose" and
permission rationale that reviewers (and the automated single-purpose check) read.
It is written to be honest and to make clear the differentiator: fully local, no
account, no cloud, no provider token.

---

## Single purpose

> An AI agent in a browser side panel that chats with a local model and can
> discover and invoke the WebMCP tools the active page exposes.

Everything in the UI — Chat, MCP tool list, Trace audit, Evals — serves that one
purpose. It is not a content scraper, a data collector, or a service offered
through a remote provider.

## Description (short, for the listing)

> Chat with a local AI that can actually use the page you're on. WebMCP lets a
> site declare real tools; this side panel detects them, shows you what's
> available, runs your prompts against a local Ollama model, and lets you audit
> every tool call. No account. No cloud. No API key. Your prompts and page data
> go to the model running on your own computer.

## Feature bullet points

- **Local by default** — responds through Ollama on `127.0.0.1:11434`; nothing is
  sent to a cloud model or to the developer.
- **WebMCP tool access** — reads the structured tools a page registers and lets
  you (or the agent) invoke them directly.
- **Active-tab scoped** — reads only the tab you have in front of you.
- **Auditable** — every tool call is recorded with a trace log and timeline.
- **Test your site** — an eval runner grades whether a model picks the right tool
  for a prompt, in dry-run mode.

## Permission justification

Each permission is required for the stated purpose and is scoped as narrowly as
the design allows.

| Permission | Why it's needed | Scope |
| --- | --- | --- |
| `sidePanel` | The entire product is a Chrome side panel. | UI only. |
| `tabs` | Identify the **active** tab (title/URL) so a conversation is scoped to it and its tools/traces are shown. Also lets the panel follow the active tab across switches. | Reads the active tab's title/URL only. Does not enumerate other tabs' content. |
| `scripting` | Inject the WebMCP detection bridge into tabs that were already open when the extension was installed/updated (MV3 content scripts only run on navigation). | The active tab and tabs the user has open; injection only, no page mutation. |
| `storage` | Persist conversations, settings, and tool traces locally (`chrome.storage.local`/`session`). | Local browser profile only. |
| `declarativeNetRequest` | Only to rewrite the `Origin`/`Referer` header on requests to the configured **local** model host so the browser permits the call. The rule is URL-filtered to that hostname and only matches `XMLHTTPREQUEST`/`OTHER`. | The local Ollama host (default `127.0.0.1:11434`) only. Never applies to general page traffic. |
| `host_permissions` (`http://*/*`, `https://*/*`) | WebMCP tools can be registered by any site; the extension's purpose is to inspect them wherever they appear. The bridge runs in the page to detect and invoke those tools. | Reads only the active tab, and only tool metadata, schemas, results, and console output — never arbitrary page content. |
| `host_permissions` (`http://localhost/*`, `http://127.0.0.1/*`) | Reach the local model host for chat. | Local only. |

## Why there is no login, no cloud, and no provider token

The agent uses a model you run yourself (Ollama). There are no accounts, no paid
tiers tied to signing in, no forwarding of prompts to a hosted model, and no
developer-operated server. This is a deliberate design choice: WebMCP is about
letting an AI operate on your own machine in your own browser.

## Notes for reviewers

- The `declarativeNetRequest` rule exists solely to let the extension call a
  local model from the extension's service worker, which would otherwise be
  blocked by CORS. The request is cross-origin only to `127.0.0.1`/`localhost`.
- `wasm-unsafe-eval` in the extension-pages CSP is required only for the bundled
  SQLite WebAssembly the embedded graph tools use. It loads a local, static
  `.wasm` shipped with the extension; it executes no remote code.
- All functionality works without any account. No sign-up is gated behind any
  capability.
