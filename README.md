# WebMCP Local Agent

<img width="1920" height="1080" alt="CleanShot 2026-09-02 at 22 53 25 1" src="https://github.com/user-attachments/assets/d700cba4-5cc7-41ca-ad3e-896e6c45bf0c" />

An AI agent that lives in your Chrome side panel, driven by a language model
running **locally on your own machine**. It inspects the [WebMCP](https://github.com/webmachinelearning/webmcp)
tools a web page exposes, runs them directly, audits every call, and lets a local
model use those tools in a chat.

No API key. No account. No cloud. Nothing leaves your machine except the text you
send to the model host you configure — which by default is [Ollama](https://ollama.com/)
running on `127.0.0.1`.

---

## What it does

- **MCP tab** — lists the WebMCP tools the active tab has registered, with their
  schemas, and runs them directly with a form-driven input. Includes tool search
  and a live connection state.
- **Chat tab** — a conversational agent that drives the same page tools through a
  local model. Conversations are scoped per-tab and persisted locally.
- **Traces tab** — an audit log of every tool call: arguments, results, timing,
  and a waterfall view of a turn's activity.
- **Evals tab** — lightweight evaluation harness for prompt/tool behavior.
- **Local-first** — the model runs on your machine via Ollama; prompts and tool
  results never touch a hosted service.

See [`FEATURES.md`](FEATURES.md) for the full surface area and
[`PRIVACY.md`](PRIVACY.md) for exactly what the extension accesses.

---

## Requirements

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) (recommended) or npm
- [Google Chrome](https://www.google.com/chrome/) 111+
- [Ollama](https://ollama.com/) (or any Ollama-compatible endpoint) for the chat
  agent. The MCP and Traces tabs work without a model.

---

## Quick start

```bash
# install
pnpm install

# build the extension into dist/
pnpm build

# or develop with hot reload
pnpm dev
```

Then load it in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the `dist/` folder.
4. Open the side panel from the toolbar icon.

To use the Chat tab, run a local model:

```bash
ollama pull llama3.2
ollama serve   # defaults to http://127.0.0.1:11434
```

Set the host in the extension's **Settings** tab if it differs from the default.

---

## Development

This project uses a [`justfile`](justfile) for common tasks. If you have
[`just`](https://github.com/casey/just) installed:

| Command | Description |
| --- | --- |
| `just dev` | Vite dev server with HMR |
| `just build` | Build the unpacked extension into `dist/` |
| `just rebuild` | Clean + build |
| `just check` | `svelte-check` type/diagnostic pass |
| `just unit` | Vitest unit tests |
| `just e2e` | Playwright end-to-end tests |
| `just verify` | `check` + `unit` + `e2e` |
| `just package` | Production build + packaged zip |
| `just open-chrome` | Launch Chrome with the unpacked extension |

The equivalent npm scripts are also available: `pnpm dev`, `pnpm build`,
`pnpm check`, `pnpm test`, `pnpm test:e2e`.

---

## Architecture

```
src/
├── main.ts               # side-panel entry
├── App.svelte            # panel shell + navigation
├── background/           # MV3 service worker: tab injection, WebMCP relay
│   ├── index.ts
│   └── inject.ts
├── content/              # content scripts (MAIN + ISOLATED worlds)
│   ├── mcp-main.ts       # detects page WebMCP registrations
│   └── mcp-bridge.ts     # relays tool calls between page and panel
└── lib/
    ├── ai/               # Ollama client, protocol, message shaping
    ├── chat/             # sessions, persistence, markdown, slash commands
    ├── webmcp/           # tool schema mapping, traces, clarify policy
    ├── browser/          # active-tab context + browser tools
    ├── trellis/          # local graph kernel (OPFS-backed)
    ├── pages/            # Chat / MCP / Traces / Evals / Settings / Help
    ├── components/       # UI components
    └── stores/           # app state
```

Two content scripts run at `document_start`: one in the page's `MAIN` world to
observe WebMCP tool registrations, and one in the `ISOLATED` world to bridge tool
calls to the panel. The service worker programmatically injects these into tabs
that were already open at install/update time.

**Stack:** [Vite](https://vite.dev/) · [Svelte 5](https://svelte.dev/) (runes) ·
[TypeScript](https://www.typescriptlang.org/) · [TailwindCSS](https://tailwindcss.com/) +
[DaisyUI](https://daisyui.com/) · Chrome Manifest V3.

---

## Privacy

The extension is scoped to the **active tab only**. It has no analytics, no
telemetry, and no accounts. The only network egress is to the model host you
configure. Read the full [privacy policy](PRIVACY.md).

---

## Contributing

Contributions are welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md). Please run
`just verify` (or `pnpm check && pnpm test`) before opening a PR.

---

## License

[MIT](LICENSE.md) © Trent Brew

If this project is useful to you, consider [buying me a coffee](https://ko-fi.com/trentbrew) ☕
