<script lang="ts">
  import {
    Book,
    MessageCircle,
    ExternalLink,
    Coffee,
    Heart,
    Shield,
    Brain,
    Layers,
  } from '../icons';
  import Icon from '../components/Icon.svelte';
  import { PageSection } from '../components/shell';
  import { Badge, Button, Collapsible } from '../components/ui';

  const GITHUB_URL = 'https://github.com/trentbrew/webmcp-ollama-agent.git';
  const TRELLIS_URL = 'https://trellis.computer';
  const WEBMCP_DOCS_URL = 'https://developer.chrome.com/docs/ai/webmcp';

  const faqs = [
    {
      question: 'Where do my messages go?',
      answer:
        'Nowhere off your machine by default. Chat runs through Ollama on localhost. Prompts, tool traces, and Facts stay in browser storage unless you point the extension at a remote endpoint yourself.',
    },
    {
      question: 'How does WebMCP stay secure?',
      answer:
        'Tools are declared by the page you are on and invoked only when you or the local agent requests them. WebMCP does not upload page content to a cloud model. Review the MCP tab before running anything unfamiliar.',
    },
    {
      question: 'How do I get started?',
      answer:
        'Install Ollama, pick a model in Chat, then browse a site that exposes WebMCP tools. Open MCP to inspect tools on the active tab and Traces to audit calls.',
    },
    {
      question: 'How does per-tab chat work?',
      answer:
        'Each browser tab has its own chat transcript. Switching tabs in Chrome switches the side panel to that tab\u2019s conversation. Messages are saved locally per tab.',
    },
    {
      question: 'What chat slash commands are available?',
      answer:
        'Type / in the composer: /new starts a fresh conversation; /resume opens the session picker; /reset clears the current session; /model opens the model picker.',
    },
    {
      question: 'How do I report a bug?',
      answer: 'Open an issue on the GitHub repository linked below.',
    },
  ];
</script>

<div class="space-y-3">
  <section
    class="shell-card rounded-lg p-4 border border-success/30 bg-success/5"
    aria-labelledby="security-heading"
  >
    <div class="flex items-start gap-3">
      <div class="min-w-0">
        <h2 id="security-heading" class="text-sm font-semibold text-success">
          Local-first · Ollama · On-device
        </h2>
        <p class="text-xs text-base-content/75 mt-1 leading-relaxed">
          WebMCP is built for agents that run on <strong>your hardware</strong>.
          Chat uses
          <strong>Ollama</strong> locally. No account, no cloud inference by default.
        </p>
      </div>
    </div>
  </section>

  <div class="grid grid-cols-1 gap-3">
    <a
      href={WEBMCP_DOCS_URL}
      target="_blank"
      rel="noopener noreferrer"
      class="shell-card rounded p-3 flex items-center gap-3 hover:bg-base-content/5 transition-colors"
    >
      <Icon icon={Book} size={20} class="text-primary shrink-0" />
      <div class="min-w-0">
        <p class="text-sm font-medium">Official WebMCP docs</p>
        <p class="text-xs text-base-content/60 truncate">
          developer.chrome.com/docs/ai/webmcp
        </p>
      </div>
      <Icon
        icon={ExternalLink}
        size={14}
        class="text-base-content/40 shrink-0 ml-auto"
      />
    </a>

    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      class="shell-card rounded p-3 flex items-center gap-3 hover:bg-base-content/5 transition-colors"
    >
      <Icon icon={ExternalLink} size={20} class="text-primary shrink-0" />
      <div class="min-w-0">
        <p class="text-sm font-medium">GitHub</p>
        <p class="text-xs text-base-content/60 truncate">
          trentbrew/webmcp-ollama-agent
        </p>
      </div>
      <Icon
        icon={ExternalLink}
        size={14}
        class="text-base-content/40 shrink-0 ml-auto"
      />
    </a>
  </div>

  <PageSection title="WebMCP quick reference">
    <p class="text-xs text-base-content/60 mb-0">
      Embedded from Google&apos;s official documentation. If the frame is blank,
      open the full docs in a new tab.
    </p>
    <a
      href={WEBMCP_DOCS_URL}
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex mt-2"
    >
      <Button variant="outline" size="sm">
        Open full docs
        <Icon icon={ExternalLink} size={12} />
      </Button>
    </a>
  </PageSection>

  <PageSection title="FAQ">
    <div class="space-y-2">
      {#each faqs as faq, i}
        <Collapsible title={faq.question}>
          <p>{faq.answer}</p>
        </Collapsible>
      {/each}
    </div>
  </PageSection>

  <div class="shell-card rounded p-4 text-center">
    <div class="flex justify-center gap-2 mb-2">
      <Icon icon={Coffee} size={24} class="text-primary" />
      <Icon icon={Heart} size={18} class="text-error/80" />
    </div>
    <p class="text-sm font-semibold">Enjoying this extension?</p>
    <p class="text-xs text-base-content/60 mt-1 mb-3">
      Support helps keep development going.
    </p>
    <a
      href="https://ko-fi.com/trentbrew"
      target="_blank"
      rel="noopener noreferrer"
    >
      <Button variant="outline" size="sm">
        <Icon icon={Coffee} size={14} />
        Support on Ko-fi
        <!-- <Icon icon={ExternalLink} size={12} /> -->
      </Button>
    </a>
  </div>

  <div
    class="rounded border border-base-content/15 bg-base-content/5 px-3 py-2 text-xs"
  >
    <Badge variant="secondary" class="mb-1">Tip</Badge>
    <p class="text-base-content/70">
      Press <kbd class="rounded border border-base-content/20 px-1">Ctrl</kbd
      >+<kbd class="rounded border border-base-content/20 px-1">Shift</kbd>+<kbd
        class="rounded border border-base-content/20 px-1">H</kbd
      > to open help.
    </p>
  </div>
</div>
