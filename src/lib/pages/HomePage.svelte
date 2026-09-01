<script lang="ts">
  import { navigateTo } from '../stores/navigation';
  import { PageSection } from '../components/shell';
  import { Button } from '../components/ui';
  import Footer from '../components/Footer.svelte';

  let count = $state(0);
</script>

<div class="space-y-3">
  <PageSection title="WebMCP">
    <p class="text-sm text-base-content/70 leading-relaxed">
      Your AI-powered Chrome extension side panel. Chat with local models, invoke page tools via WebMCP, and inspect traces.
    </p>
    <div class="flex gap-2 mt-3">
      <Button size="sm" onclick={() => navigateTo('chat')}>Open chat</Button>
      <Button variant="outline" size="sm" onclick={() => navigateTo('mcp')}>View tools</Button>
    </div>
  </PageSection>

  <PageSection title="Quick stats">
    <div class="grid grid-cols-2 gap-2">
      <div class="rounded border border-base-content/10 p-3">
        <p class="text-[0.65rem] uppercase tracking-wide text-base-content/50">Clicks</p>
        <p class="text-lg font-semibold text-primary tabular-nums">{count}</p>
      </div>
      <div class="rounded border border-base-content/10 p-3">
        <p class="text-[0.65rem] uppercase tracking-wide text-base-content/50">Status</p>
        <p class="text-lg font-semibold">Active</p>
      </div>
    </div>
    <div class="flex gap-2 mt-3">
      <Button size="sm" onclick={() => count++}>Increment</Button>
      <Button variant="outline" size="sm" onclick={() => (count = 0)}>Reset</Button>
    </div>
  </PageSection>

  <PageSection title="Stack">
    <ul class="space-y-1.5 text-sm text-base-content/70">
      <li>Svelte 5 + Vite + TypeScript</li>
      <li>Tailwind + DaisyUI theme tokens</li>
      <li>Shell UI primitives (shadcn-inspired)</li>
      <li>Lucide icons, WebMCP, Ollama</li>
    </ul>
    <div class="mt-3">
      <Button variant="outline" size="sm" onclick={() => navigateTo('components')}>
        View components
      </Button>
    </div>
  </PageSection>

  <Footer />
</div>
