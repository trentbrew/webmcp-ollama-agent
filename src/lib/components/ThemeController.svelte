<script lang="ts">
  import {
    theme,
    setTheme,
    AVAILABLE_THEMES,
    type Theme,
  } from '../stores/theme';
  import { pageThemeState, syncFromTab, applyPageTheme, clearPageTheme } from '../theme/pageTheme.svelte';
  import { Palette, Check, Sparkles, Loader } from '../icons';
  import Icon from './Icon.svelte';

  let showThemeModal = $state(false);

  interface Props {
    autoMatch?: boolean;
    onToggleAutoMatch?: (on: boolean) => void;
  }
  let { autoMatch = false, onToggleAutoMatch }: Props = $props();

  const themeGroups = {
    'Light Themes': [
      'light', 'cupcake', 'bumblebee', 'emerald', 'corporate', 'retro',
      'garden', 'lofi', 'pastel', 'fantasy', 'wireframe', 'cmyk',
      'autumn', 'acid', 'lemonade', 'winter',
    ],
    'Dark Themes': [
      'dark', 'synthwave', 'cyberpunk', 'valentine', 'halloween', 'forest',
      'aqua', 'black', 'luxury', 'dracula', 'business', 'night',
      'coffee', 'dim', 'nord', 'sunset',
    ],
  };

  function selectTheme(newTheme: Theme) {
    setTheme(newTheme);
    showThemeModal = false;
  }

  function capitalizeTheme(t: string): string {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  async function handleMatchPage() {
    if (pageThemeState.loading) return;
    await syncFromTab();
    applyPageTheme();
  }

  function handleAutoMatchToggle() {
    onToggleAutoMatch?.(!autoMatch);
  }
</script>

<div class="flex items-center gap-1">
  <!-- Match page -->
  <div class="dropdown dropdown-end">
    <button
      tabindex="0"
      class="btn btn-circle btn-ghost tooltip tooltip-bottom"
      data-tip="Match page theme"
      onclick={handleMatchPage}
      disabled={pageThemeState.loading}
      aria-label="Match page theme"
    >
      {#if pageThemeState.loading}
        <Icon icon={Loader} size={20} class="animate-spin" />
      {:else}
        <Icon icon={Sparkles} size={20} />
      {/if}
    </button>
  </div>

  <!-- Auto-match toggle -->
  <label class="swap swap-rotate tooltip tooltip-bottom" data-tip="Auto-match page theme">
    <input
      type="checkbox"
      checked={autoMatch}
      onchange={handleAutoMatchToggle}
      aria-label="Auto-match page theme"
    />
    <span class="swap-off text-base-content/50">
      <Icon icon={Sparkles} size={16} />
    </span>
    <span class="swap-on text-warning">
      <Icon icon={Sparkles} size={16} />
    </span>
  </label>

  <div class="dropdown dropdown-end">
    <button
      tabindex="0"
      class="btn btn-circle btn-ghost"
      aria-label="Change theme"
    >
      <Icon icon={Palette} size={20} />
    </button>

    <div class="dropdown-content z-[1] card card-compact w-80 max-h-96 overflow-y-auto p-2 shadow-2xl bg-base-200 mt-3">
      <div class="card-body">
        <h3 class="card-title text-sm">
          <Icon icon={Palette} size={18} />
          Choose Theme
        </h3>

        {#each Object.entries(themeGroups) as [groupName, themes]}
          <div class="mb-3">
            <div class="text-xs font-semibold opacity-60 mb-2">{groupName}</div>
            <div class="grid grid-cols-2 gap-2">
              {#each themes as themeName}
                <button
                  class="btn btn-sm justify-start {$theme === themeName
                    ? 'btn-primary'
                    : 'btn-ghost'}"
                  onclick={() => selectTheme(themeName as Theme)}
                  data-theme={themeName}
                >
                  <div class="flex items-center justify-between w-full">
                    <span class="text-xs">{capitalizeTheme(themeName)}</span>
                    {#if $theme === themeName}
                      <Icon icon={Check} size={14} />
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/each}

        {#if pageThemeState.pageTheme}
          <div class="divider my-1"></div>
          <div class="text-xs opacity-70 mb-1">
            Matched: <span class="font-mono">{pageThemeState.pageTheme.title}</span>
          </div>
          <button
            class="btn btn-sm btn-ghost w-full"
            onclick={() => clearPageTheme()}
          >
            Clear page theme
          </button>
        {/if}

        {#if pageThemeState.error}
          <div class="text-xs text-error mt-1">{pageThemeState.error}</div>
        {/if}
      </div>
    </div>
  </div>
</div>
