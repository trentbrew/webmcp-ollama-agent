<script lang="ts">
  import {
    ArrowUp,
    ChevronDown,
    ExternalLink,
    Paperclip,
    Square,
    Terminal,
    Wrench,
    Hash,
    X,
  } from '../../icons';
  import { formatFileSize } from '../../ai/messages';
  import { isChatBusy, sendChatMessage } from '../../chat.svelte';
  import {
    chatModelCatalog,
    chatSettings,
    setChatModel,
    setExposeToolsToAgent,
  } from '../../chat/settings.svelte';
  import {
    applyComposerReplacement,
    detectComposerTrigger,
  } from '../../chat/composerTriggers';
  import { closeSessionPicker, composerUi } from '../../chat/composerUi.svelte';
  import {
    filterSlashCommands,
    type SlashCommand,
  } from '../../chat/slashCommands';
  import {
    filterToolMentions,
    filterTraceMentions,
    formatToolMention,
  } from '../../chat/mentions';
  import {
    listResumableSessions,
    resumeSession,
    type ResumeTarget,
  } from '../../chat/sessions.svelte';
  import type { ResumableSession } from '../../chat/persistence';
  import BorderBeam from '../ui/BorderBeam.svelte';
  import { browserContext } from '../../browser/context.svelte';
  import {
    buildAgentToolSummaries,
    buildBuiltinToolSummaries,
    buildDiscoveredToolSummaries,
  } from '../../webmcp/toOllamaTools';
  import { mcpState } from '../../webmcp/store.svelte';

  let { onSend }: { onSend?: () => void } = $props();

  let draft = $state('');
  let pendingFiles = $state<File[]>([]);
  let fileInput: HTMLInputElement | undefined;
  let textarea: HTMLTextAreaElement | undefined;
  let modelMenuOpen = $state(false);
  let toolsMenuOpen = $state(false);
  let resumableSessions = $state<ResumableSession[]>([]);
  let sessionPickerIndex = $state(0);

  const sessionPickerOpen = $derived(composerUi.sessionPickerOpen);

  $effect(() => {
    if (composerUi.modelPickerOpen) {
      modelMenuOpen = true;
      composerUi.modelPickerOpen = false;
    }
  });

  $effect(() => {
    if (!sessionPickerOpen) return;
    void listResumableSessions().then((sessions) => {
      resumableSessions = sessions;
      sessionPickerIndex = 0;
    });
  });

  const busy = $derived(isChatBusy());
  const canSend = $derived(Boolean(draft.trim() || pendingFiles.length > 0));

  // -- @/#// composer triggers --------------------------------------------
  let cursor = $state(0);
  let selectedIndex = $state(0);
  let menuDismissed = $state(false);
  let lastTriggerKey = $state('');

  type SuggestionItem =
    | { kind: 'slash'; command: SlashCommand }
    | { kind: 'tool'; name: string; description: string }
    | { kind: 'trace'; id: string; toolName: string; ok: boolean };

  const trigger = $derived(detectComposerTrigger(draft, cursor));

  const items = $derived.by((): SuggestionItem[] => {
    if (!trigger) return [];
    if (trigger.mode === 'slash') {
      return filterSlashCommands(trigger.query).map((command) => ({
        kind: 'slash' as const,
        command,
      }));
    }
    if (trigger.mode === 'tool') {
      return filterToolMentions(
        buildAgentToolSummaries(mcpState.state?.tools ?? []),
        trigger.query,
      ).map((tool) => ({
        kind: 'tool' as const,
        name: tool.name,
        description: tool.description,
      }));
    }
    return filterTraceMentions(mcpState.traces, trigger.query).map((entry) => ({
      kind: 'trace' as const,
      id: entry.id,
      toolName: entry.toolName,
      ok: entry.ok,
    }));
  });

  const menuOpen = $derived(
    trigger !== null &&
      items.length > 0 &&
      !menuDismissed &&
      !sessionPickerOpen,
  );

  function sessionLabel(session: ResumableSession): string {
    const title = session.title || hostFromUrl(session.url) || 'Untitled tab';
    const suffix = session.kind === 'archive' ? ' (archived)' : '';
    return `${title}${suffix}`;
  }

  function hostFromUrl(url: string | null): string {
    if (!url) return '';
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  async function pickSession(session: ResumableSession) {
    const target: ResumeTarget =
      session.kind === 'open'
        ? { kind: 'open', tabId: session.tabId }
        : { kind: 'archive', id: session.id };
    await resumeSession(target);
    draft = '';
    closeSessionPicker();
  }

  $effect(() => {
    const key = trigger
      ? `${trigger.mode}:${trigger.start}:${trigger.query}`
      : '';
    if (key !== lastTriggerKey) {
      lastTriggerKey = key;
      menuDismissed = false;
      selectedIndex = 0;
    }
  });

  function updateCursor(event: Event) {
    cursor = (event.currentTarget as HTMLTextAreaElement).selectionStart;
  }

  function applyItem(item: SuggestionItem) {
    if (item.kind === 'slash') {
      if (item.command.kind === 'action') {
        item.command.action();
        draft = '';
        menuDismissed = true;
        return;
      }
      insertReplacement(item.command.insert);
      return;
    }

    if (item.kind === 'tool') {
      insertReplacement(`${formatToolMention(item.name)} `);
      return;
    }

    insertReplacement(`#${item.id.slice(0, 8)} `);
  }

  function insertReplacement(replacement: string) {
    if (!trigger) return;
    const { value, cursor: nextCursor } = applyComposerReplacement(
      draft,
      trigger.start,
      trigger.end,
      replacement,
    );
    draft = value;
    menuDismissed = true;
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(nextCursor, nextCursor);
      cursor = nextCursor;
    });
  }

  const pageTools = $derived(mcpState.state?.tools ?? []);
  const discoveredTools = $derived(buildDiscoveredToolSummaries(pageTools));
  const builtinTools = $derived(buildBuiltinToolSummaries());
  const toolCount = $derived(discoveredTools.length + builtinTools.length);
  const activeTab = $derived(browserContext.activeTab);
  const activeTabTitle = $derived(
    activeTab?.title || activeTabHost(activeTab?.url) || 'Active tab',
  );
  const activeTabHostLabel = $derived(activeTabHost(activeTab?.url));
  const tabCount = $derived(browserContext.currentWindowTabs.length);

  function openFilePicker() {
    fileInput?.click();
  }

  function handleFileSelection(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const selected = input.files ? [...input.files] : [];
    if (selected.length > 0) pendingFiles = [...pendingFiles, ...selected];
    input.value = '';
  }

  function removePendingFile(index: number) {
    pendingFiles = pendingFiles.filter((_, i) => i !== index);
  }

  function filesToFileList(files: File[]) {
    const dt = new DataTransfer();
    for (const file of files) dt.items.add(file);
    return dt.files;
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    const text = draft.trim();
    if ((!text && pendingFiles.length === 0) || busy) return;

    const files =
      pendingFiles.length > 0 ? filesToFileList(pendingFiles) : undefined;
    draft = '';
    pendingFiles = [];
    onSend?.();
    await sendChatMessage({ text: text || undefined, files });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (sessionPickerOpen && resumableSessions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        sessionPickerIndex =
          (sessionPickerIndex + 1) % resumableSessions.length;
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        sessionPickerIndex =
          (sessionPickerIndex - 1 + resumableSessions.length) %
          resumableSessions.length;
        return;
      }
      if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
        event.preventDefault();
        const session = resumableSessions[sessionPickerIndex];
        if (session) void pickSession(session);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSessionPicker();
        return;
      }
    }

    if (menuOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        selectedIndex = (selectedIndex + 1) % items.length;
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
        return;
      }
      if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
        event.preventDefault();
        const item = items[selectedIndex];
        if (item) applyItem(item);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        menuDismissed = true;
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      (event.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
    }
  }

  function pickModel(model: string) {
    setChatModel(model);
    modelMenuOpen = false;
  }

  function activeTabHost(url: string | null | undefined): string {
    if (!url) return '';
    try {
      return new URL(url).hostname;
    } catch {
      return url.split(':')[0] || url;
    }
  }
</script>

<input
  bind:this={fileInput}
  type="file"
  multiple
  class="sr-only"
  aria-hidden="true"
  tabindex="-1"
  onchange={handleFileSelection}
/>

<form
  class="chat-composer"
  class:chat-composer--busy={busy}
  onsubmit={handleSubmit}
>
  {#if busy}
    <BorderBeam size={120} duration={6} borderWidth={2} />
  {/if}
  <div
    class="chat-composer__context"
    title={activeTab?.url ?? 'No active tab context'}
  >
    <ExternalLink size={12} />
    <span class="chat-composer__context-title truncate"
      >{activeTab ? activeTabTitle : 'No active tab context'}</span
    >
    {#if activeTabHostLabel}
      <span class="chat-composer__context-host truncate"
        >{activeTabHostLabel}</span
      >
    {/if}
    {#if tabCount > 0}
      <span class="chat-composer__context-count"
        >{tabCount} tab{tabCount === 1 ? '' : 's'}</span
      >
    {/if}
  </div>
  {#if pendingFiles.length > 0}
    <div class="chat-composer__files">
      {#each pendingFiles as file, index (file.name + file.size + index)}
        <div class="chat-composer__file">
          <Paperclip size={11} />
          <span class="truncate">{file.name}</span>
          <span class="chat-composer__file-size"
            >{formatFileSize(file.size)}</span
          >
          <button
            type="button"
            class="chat-composer__file-remove"
            aria-label={`Remove ${file.name}`}
            onclick={() => removePendingFile(index)}
          >
            <X size={11} />
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <div class="chat-composer__field">
    {#if sessionPickerOpen}
      <div
        class="chat-composer__suggestions"
        role="listbox"
        aria-label="Resume conversation"
      >
        {#if resumableSessions.length === 0}
          <p class="chat-composer__suggestions-empty">
            No other conversations to resume.
          </p>
        {:else}
          {#each resumableSessions as session, index (session.kind === 'open' ? `open-${session.tabId}` : `archive-${session.id}`)}
            <button
              type="button"
              class="chat-composer__suggestion"
              class:is-selected={index === sessionPickerIndex}
              role="option"
              aria-selected={index === sessionPickerIndex}
              onmouseenter={() => (sessionPickerIndex = index)}
              onmousedown={(event) => event.preventDefault()}
              onclick={() => void pickSession(session)}
            >
              <ExternalLink size={13} class="chat-composer__suggestion-icon" />
              <span class="chat-composer__suggestion-text">
                <span class="chat-composer__suggestion-title"
                  >{sessionLabel(session)}</span
                >
                <span class="chat-composer__suggestion-desc">
                  {session.messageCount} message{session.messageCount === 1
                    ? ''
                    : 's'}
                  {#if session.url}
                    · {hostFromUrl(session.url)}
                  {/if}
                </span>
              </span>
            </button>
          {/each}
        {/if}
      </div>
    {:else if menuOpen}
      <div
        class="chat-composer__suggestions"
        role="listbox"
        aria-label="Composer suggestions"
      >
        {#each items as item, index (item.kind === 'slash' ? `slash-${item.command.id}` : item.kind === 'tool' ? `tool-${item.name}` : `trace-${item.id}`)}
          <button
            type="button"
            class="chat-composer__suggestion"
            class:is-selected={index === selectedIndex}
            role="option"
            aria-selected={index === selectedIndex}
            onmouseenter={() => (selectedIndex = index)}
            onmousedown={(event) => event.preventDefault()}
            onclick={() => applyItem(item)}
          >
            {#if item.kind === 'slash'}
              <Terminal size={13} class="chat-composer__suggestion-icon" />
              <span class="chat-composer__suggestion-text">
                <span class="chat-composer__suggestion-title"
                  >{item.command.title}</span
                >
                <span class="chat-composer__suggestion-desc"
                  >{item.command.description}</span
                >
              </span>
            {:else if item.kind === 'tool'}
              <Wrench size={13} class="chat-composer__suggestion-icon" />
              <span class="chat-composer__suggestion-text">
                <span class="chat-composer__suggestion-title">@{item.name}</span
                >
                <span class="chat-composer__suggestion-desc"
                  >{item.description}</span
                >
              </span>
            {:else}
              <Hash size={13} class="chat-composer__suggestion-icon" />
              <span class="chat-composer__suggestion-text">
                <span class="chat-composer__suggestion-title"
                  >#{item.id.slice(0, 8)}</span
                >
                <span class="chat-composer__suggestion-desc"
                  >{item.toolName} — {item.ok ? 'ok' : 'error'}</span
                >
              </span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}

    <textarea
      bind:this={textarea}
      bind:value={draft}
      rows={1}
      placeholder="Message Ollama… (@ tool · # trace · / command)"
      aria-label="Message"
      disabled={busy}
      class="chat-composer__textarea"
      oninput={updateCursor}
      onclick={updateCursor}
      onkeyup={updateCursor}
      onselect={updateCursor}
      onkeydown={handleKeydown}
    ></textarea>
  </div>

  <div class="chat-composer__actions">
    <div class="chat-composer__left">
      <button
        type="button"
        class="chat-composer__icon-btn"
        aria-label="Add attachments"
        disabled={busy}
        onclick={openFilePicker}
      >
        <Paperclip size={14} />
      </button>

      <div class="chat-composer__tools">
        <div class="chat-composer__tools-pills">
          <button
            type="button"
            class="chat-composer__tools-pill"
            class:is-on={chatSettings.exposeToolsToAgent}
            aria-haspopup="menu"
            aria-expanded={toolsMenuOpen}
            title={`${builtinTools.length} built-in tool${builtinTools.length === 1 ? '' : 's'}`}
            onclick={() => (toolsMenuOpen = !toolsMenuOpen)}
          >
            {builtinTools.length} built-in
          </button>
          <button
            type="button"
            class="chat-composer__tools-pill"
            class:is-discovered={discoveredTools.length > 0}
            class:is-on={chatSettings.exposeToolsToAgent}
            aria-haspopup="menu"
            aria-expanded={toolsMenuOpen}
            title={`${discoveredTools.length} discovered tool${discoveredTools.length === 1 ? '' : 's'}`}
            onclick={() => (toolsMenuOpen = !toolsMenuOpen)}
          >
            {discoveredTools.length} discovered
          </button>
        </div>
        {#if toolsMenuOpen}
          <div class="chat-composer__tools-menu" role="menu">
            <div class="chat-composer__tools-header">
              <span class="chat-composer__tools-title">Tools ({toolCount})</span
              >
              <label class="chat-composer__tools-expose">
                <span>Expose to agent</span>
                <input
                  type="checkbox"
                  checked={chatSettings.exposeToolsToAgent}
                  onchange={(event) =>
                    setExposeToolsToAgent(
                      (event.currentTarget as HTMLInputElement).checked,
                    )}
                />
              </label>
            </div>
            <div class="chat-composer__tools-list">
              {#if discoveredTools.length > 0}
                <p class="chat-composer__tools-section">Discovered</p>
                {#each discoveredTools as tool (tool.name)}
                  <button
                    type="button"
                    class="chat-composer__tools-item"
                    role="menuitem"
                    title={tool.description}
                    onclick={() => {
                      insertReplacement(`${formatToolMention(tool.name)} `);
                      toolsMenuOpen = false;
                    }}
                  >
                    <Wrench
                      size={12}
                      class="chat-composer__tools-item-icon is-discovered"
                    />
                    <span class="chat-composer__tools-item-body">
                      <span class="chat-composer__tools-item-name"
                        >{tool.name}</span
                      >
                      {#if tool.description}
                        <span class="chat-composer__tools-item-desc"
                          >{tool.description}</span
                        >
                      {/if}
                    </span>
                  </button>
                {/each}
              {/if}
              <p class="chat-composer__tools-section">Built-in</p>
              {#each builtinTools as tool (tool.name)}
                <button
                  type="button"
                  class="chat-composer__tools-item"
                  role="menuitem"
                  title={tool.description}
                  onclick={() => {
                    insertReplacement(`${formatToolMention(tool.name)} `);
                    toolsMenuOpen = false;
                  }}
                >
                  <Wrench size={12} class="chat-composer__tools-item-icon" />
                  <span class="chat-composer__tools-item-body">
                    <span class="chat-composer__tools-item-name"
                      >{tool.name}</span
                    >
                    {#if tool.description}
                      <span class="chat-composer__tools-item-desc"
                        >{tool.description}</span
                      >
                    {/if}
                  </span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <div class="chat-composer__model">
        <button
          type="button"
          class="chat-composer__model-btn"
          aria-haspopup="listbox"
          aria-expanded={modelMenuOpen}
          disabled={busy}
          onclick={() => (modelMenuOpen = !modelMenuOpen)}
        >
          <span class="truncate">{chatSettings.model}</span>
          <ChevronDown size={11} />
        </button>
        {#if modelMenuOpen}
          <div class="chat-composer__model-menu" role="listbox">
            {#each chatModelCatalog.available as model (model)}
              <button
                type="button"
                class="chat-composer__model-item"
                class:is-selected={chatSettings.model === model}
                role="option"
                aria-selected={chatSettings.model === model}
                onclick={() => pickModel(model)}
              >
                <span class="truncate">{model}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <button
      type="submit"
      class="chat-composer__send"
      disabled={!canSend || busy}
      aria-label="Send message"
    >
      {#if busy}
        <Square size={11} fill="currentColor" strokeWidth={0} />
      {:else}
        <ArrowUp size={14} />
      {/if}
    </button>
  </div>
</form>

{#if modelMenuOpen}
  <button
    type="button"
    class="chat-composer__scrim"
    aria-label="Close model menu"
    onclick={() => (modelMenuOpen = false)}
  ></button>
{/if}
{#if sessionPickerOpen}
  <button
    type="button"
    class="chat-composer__scrim"
    aria-label="Close session picker"
    onclick={closeSessionPicker}
  ></button>
{/if}
{#if toolsMenuOpen}
  <button
    type="button"
    class="chat-composer__scrim"
    aria-label="Close tools menu"
    onclick={() => (toolsMenuOpen = false)}
  ></button>
{/if}

<style>
  .chat-composer {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    flex-shrink: 0;
    margin: 0.5rem;
    margin-top: 0 !important;
    padding: 0.5rem;
    /* box-shadow: 0 -8px 24px -4px color-mix(in oklab, black 12%, transparent); */
    border: 1px solid color-mix(in oklab, currentColor 12%, transparent);
    border-radius: 0.75rem;
    background: color-mix(in oklab, currentColor 3%, transparent);
    transition: border-color 160ms ease;
  }

  .chat-composer:focus-within {
    border-color: oklch(var(--p) / 0.5);
  }

  .chat-composer--busy {
    border-color: transparent;
  }

  .chat-composer__context {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.375rem;
    padding: 0.125rem 0.125rem 0.375rem;
    border-bottom: 1px solid color-mix(in oklab, currentColor 8%, transparent);
    color: oklch(var(--bc) / 0.62);
    font-size: 0.6875rem;
    background: var(--muted);
  }

  :global(.chat-composer__context svg) {
    flex-shrink: 0;
  }

  .chat-composer__context-title {
    min-width: 0;
    font-weight: 600;
    color: oklch(var(--bc) / 0.78);
  }

  .chat-composer__context-host {
    min-width: 2rem;
    max-width: 8rem;
    opacity: 0.75;
  }

  .chat-composer__context-count {
    flex-shrink: 0;
    margin-left: auto;
    padding-left: 0.375rem;
    opacity: 0.65;
    font-variant-numeric: tabular-nums;
  }

  .chat-composer__files {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .chat-composer__file {
    display: flex;
    max-width: 100%;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid color-mix(in oklab, currentColor 14%, transparent);
    border-radius: 0.375rem;
    font-size: 0.7rem;
  }

  .chat-composer__file-size {
    opacity: 0.6;
    flex-shrink: 0;
  }

  .chat-composer__file-remove {
    display: inline-flex;
    margin-left: 0.125rem;
    border: none;
    background: transparent;
    opacity: 0.6;
    cursor: pointer;
  }

  .chat-composer__file-remove:hover {
    opacity: 1;
  }

  .chat-composer__field {
    position: relative;
  }

  .chat-composer__suggestions {
    position: absolute;
    bottom: calc(100% + 0.25rem);
    left: 0;
    right: 0;
    z-index: 30;
    display: flex;
    max-height: 12rem;
    flex-direction: column;
    overflow-y: auto;
    padding: 0.25rem;
    border: 1px solid color-mix(in oklab, currentColor 16%, transparent);
    border-radius: 0.5rem;
    background: oklch(var(--b1));
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  }

  .chat-composer__suggestion {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border: none;
    border-radius: 0.375rem;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .chat-composer__suggestion.is-selected,
  .chat-composer__suggestion:hover {
    background: color-mix(in oklab, currentColor 8%, transparent);
  }

  :global(.chat-composer__suggestion-icon) {
    flex-shrink: 0;
    opacity: 0.6;
  }

  .chat-composer__suggestion-text {
    display: flex;
    min-width: 0;
    flex-direction: column;
  }

  .chat-composer__suggestion-title {
    font-size: 0.75rem;
    font-weight: 600;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .chat-composer__suggestion-desc {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.6875rem;
    opacity: 0.6;
  }

  .chat-composer__suggestions-empty {
    margin: 0;
    padding: 0.5rem 0.625rem;
    font-size: 0.75rem;
    opacity: 0.65;
  }

  .chat-composer__tools-pills {
    display: inline-flex;
    align-items: center;
    gap: 0.3125rem;
  }

  .chat-composer__tools-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.1875rem 0.5rem;
    border: 1px solid color-mix(in oklab, currentColor 16%, transparent);
    border-radius: 999px;
    background: transparent;
    color: inherit;
    opacity: 0.55;
    font-size: 0.6875rem;
    line-height: 1.2;
    white-space: nowrap;
    cursor: pointer;
  }

  .chat-composer__tools-pill.is-discovered {
    opacity: 1;
    border-color: oklch(var(--su) / 0.45);
    background: oklch(var(--su) / 0.12);
    color: oklch(var(--suc, var(--su)));
  }

  .chat-composer__tools-pill.is-on {
    opacity: 1;
    border-color: oklch(var(--p) / 0.5);
    background: oklch(var(--p) / 0.12);
    color: oklch(var(--p));
  }

  .chat-composer__tools-pill.is-on.is-discovered {
    border-color: oklch(var(--su) / 0.55);
    background: oklch(var(--su) / 0.16);
    color: oklch(var(--suc, var(--su)));
  }

  .chat-composer__tools {
    position: relative;
  }

  .chat-composer__tools-menu {
    position: absolute;
    bottom: calc(100% + 0.25rem);
    left: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    width: 17rem;
    max-width: 80vw;
    border: 1px solid color-mix(in oklab, currentColor 16%, transparent);
    border-radius: 0.5rem;
    background: oklch(var(--b1));
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    overflow: hidden;
  }

  .chat-composer__tools-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid color-mix(in oklab, currentColor 12%, transparent);
  }

  .chat-composer__tools-title {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.7;
  }

  .chat-composer__tools-expose {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.68rem;
    opacity: 0.8;
    cursor: pointer;
  }

  .chat-composer__tools-list {
    display: flex;
    flex-direction: column;
    max-height: 15rem;
    overflow-y: auto;
    padding: 0.25rem;
  }

  .chat-composer__tools-section {
    margin: 0.25rem 0.45rem 0.125rem;
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.5;
  }

  .chat-composer__tools-section:first-child {
    margin-top: 0;
  }

  .chat-composer__tools-item {
    display: flex;
    align-items: flex-start;
    gap: 0.45rem;
    padding: 0.35rem 0.45rem;
    border: none;
    border-radius: 0.375rem;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .chat-composer__tools-item:hover {
    background: color-mix(in oklab, currentColor 8%, transparent);
  }

  :global(.chat-composer__tools-item-icon) {
    flex-shrink: 0;
    margin-top: 0.1rem;
    opacity: 0.6;
  }

  :global(.chat-composer__tools-item-icon.is-discovered) {
    opacity: 0.85;
    color: oklch(var(--su));
  }

  .chat-composer__tools-item-body {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .chat-composer__tools-item-name {
    font-size: 0.75rem;
    font-weight: 500;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .chat-composer__tools-item-desc {
    font-size: 0.68rem;
    line-height: 1.35;
    opacity: 0.6;
  }

  .chat-composer__textarea {
    width: 100%;
    min-height: 5rem;
    max-height: 10rem;
    resize: none;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: var(--chat-font-size, 0.8125rem);
    line-height: 1.4;
    outline: none;
  }

  .chat-composer__textarea::placeholder {
    opacity: 0.5;
  }

  .chat-composer__textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .chat-composer__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .chat-composer__left {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
  }

  .chat-composer__icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    border-radius: 0.375rem;
    background: transparent;
    opacity: 0.65;
    cursor: pointer;
  }

  .chat-composer__icon-btn:hover:not(:disabled) {
    opacity: 1;
    background: color-mix(in oklab, currentColor 8%, transparent);
  }

  .chat-composer__icon-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .chat-composer__model {
    position: relative;
  }

  .chat-composer__model-btn {
    display: inline-flex;
    max-width: 9rem;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid color-mix(in oklab, currentColor 16%, transparent);
    border-radius: 999px;
    background: var(--muted);
    color: inherit;
    font-size: 0.6875rem;
    cursor: pointer;
  }

  .chat-composer__model-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .chat-composer__model-menu {
    position: absolute;
    bottom: calc(100% + 0.25rem);
    left: 0;
    z-index: 30;
    display: flex;
    max-height: 14rem;
    min-width: 10rem;
    flex-direction: column;
    overflow-y: auto;
    padding: 0.25rem;
    border: 1px solid color-mix(in oklab, currentColor 16%, transparent);
    border-radius: 0.5rem;
    background: oklch(var(--b1));
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  }

  .chat-composer__model-item {
    display: block;
    padding: 0.3rem 0.5rem;
    border: none;
    border-radius: 0.375rem;
    background: transparent;
    color: inherit;
    font-size: 0.75rem;
    text-align: left;
    cursor: pointer;
  }

  .chat-composer__model-item:hover {
    background: color-mix(in oklab, currentColor 8%, transparent);
  }

  .chat-composer__model-item.is-selected {
    font-weight: 600;
  }

  .chat-composer__send {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.875rem;
    height: 1.875rem;
    flex-shrink: 0;
    border: none;
    border-radius: 999px;
    background: oklch(var(--p));
    color: oklch(var(--pc));
    cursor: pointer;
    transition:
      opacity 120ms ease,
      filter 120ms ease;
  }

  .chat-composer__send:hover:not(:disabled) {
    filter: brightness(1.08);
  }

  .chat-composer__send:disabled {
    background: color-mix(in oklab, currentColor 14%, transparent);
    color: inherit;
    opacity: 0.4;
    cursor: not-allowed;
  }

  .chat-composer__scrim {
    position: fixed;
    inset: 0;
    z-index: 20;
    border: none;
    background: transparent;
    cursor: default;
  }
</style>
