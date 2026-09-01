<script lang="ts">
  import {
    Book,
    MessageCircle,
    ExternalLink,
    Coffee,
    Heart,
  } from '../icons';
  import Icon from '../components/Icon.svelte';
  import { PageSection } from '../components/shell';
  import { Badge, Button, Collapsible, Input, Label } from '../components/ui';

  const faqs = [
    {
      question: 'How do I get started?',
      answer:
        'Use the dock icons at the bottom. Start with Chat to talk to a local model, or MCP to see tools on the active tab.',
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
      question: 'How do I change the theme?',
      answer:
        'Open Settings → Appearance. Toggle dark mode or use the palette control to pick a theme or match the active page.',
    },
    {
      question: 'Is my data secure?',
      answer:
        'Chat runs locally via Ollama. No messages are sent to external servers unless you configure a remote endpoint.',
    },
    {
      question: 'How do I report a bug?',
      answer:
        'Submit issues through the GitHub repository linked below.',
    },
  ];
</script>

<div class="space-y-3">
  <div class="grid grid-cols-1 gap-2">
    <div class="shell-card rounded p-3 flex items-center gap-3">
      <Icon icon={Book} size={20} class="text-primary shrink-0" />
      <div>
        <p class="text-sm font-medium">Documentation</p>
        <p class="text-xs text-base-content/60">Learn how to use all features</p>
      </div>
    </div>
    <div class="shell-card rounded p-3 flex items-center gap-3">
      <Icon icon={MessageCircle} size={20} class="text-primary shrink-0" />
      <div>
        <p class="text-sm font-medium">Community</p>
        <p class="text-xs text-base-content/60">Join our Discord server</p>
      </div>
    </div>
    <div class="shell-card rounded p-3 flex items-center gap-3">
      <Icon icon={ExternalLink} size={20} class="text-primary shrink-0" />
      <div>
        <p class="text-sm font-medium">GitHub</p>
        <p class="text-xs text-base-content/60">View source code</p>
      </div>
    </div>
  </div>

  <PageSection title="FAQ">
    <div class="space-y-2">
      {#each faqs as faq, i}
        <Collapsible title={faq.question} open={i === 0}>
          <p>{faq.answer}</p>
        </Collapsible>
      {/each}
    </div>
  </PageSection>

  <PageSection title="Contact">
    <p class="text-xs text-base-content/60 mb-3">Send us a message and we'll get back to you soon.</p>
    <form class="space-y-3" onsubmit={(e) => e.preventDefault()}>
      <div class="space-y-1">
        <Label for="contact-name">Your name</Label>
        <Input id="contact-name" placeholder="John Doe" />
      </div>
      <div class="space-y-1">
        <Label for="contact-email">Email</Label>
        <Input id="contact-email" type="email" placeholder="john@example.com" />
      </div>
      <div class="space-y-1">
        <Label for="contact-message">Message</Label>
        <textarea
          id="contact-message"
          class="flex min-h-[5rem] w-full rounded border border-base-content/20 bg-base-100 px-2.5 py-2 text-xs placeholder:text-base-content/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          placeholder="Describe your issue..."
        ></textarea>
      </div>
      <Button type="submit" class="w-full">Send message</Button>
    </form>
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
    <a href="https://ko-fi.com/trentbrew" target="_blank" rel="noopener noreferrer">
      <Button variant="outline" size="sm">
        <Icon icon={Coffee} size={14} />
        Support on Ko-fi
        <Icon icon={ExternalLink} size={12} />
      </Button>
    </a>
  </div>

  <div class="rounded border border-base-content/15 bg-base-content/5 px-3 py-2 text-xs">
    <Badge variant="secondary" class="mb-1">Tip</Badge>
    <p class="text-base-content/70">
      Press <kbd class="rounded border border-base-content/20 px-1">Ctrl</kbd>+<kbd class="rounded border border-base-content/20 px-1">Shift</kbd>+<kbd class="rounded border border-base-content/20 px-1">H</kbd> to open help.
    </p>
  </div>
</div>
