<script lang="ts">
  // Animated beam that travels around the border of its rounded parent.
  // Ported from multiplex/tauri-bun-react `border-beam.tsx`.
  // The parent must be `position: relative` and set its own border-radius.
  let {
    size = 120,
    duration = 6,
    anchor = 90,
    borderWidth = 2,
    colorFrom = 'oklch(var(--p))',
    colorTo = 'oklch(var(--p) / 0.35)',
    delay = 0,
  }: {
    size?: number;
    duration?: number;
    anchor?: number;
    borderWidth?: number;
    colorFrom?: string;
    colorTo?: string;
    delay?: number;
  } = $props();

  const style = $derived(
    [
      `--size:${size}`,
      `--duration:${duration}`,
      `--anchor:${anchor}`,
      `--border-width:${borderWidth}`,
      `--color-from:${colorFrom}`,
      `--color-to:${colorTo}`,
      `--delay:-${delay}s`,
    ].join(';'),
  );
</script>

<div class="border-beam" style={style} aria-hidden="true"></div>

<style>
  .border-beam {
    pointer-events: none;
    position: absolute;
    inset: 0;
    border-radius: inherit;
    border: calc(var(--border-width) * 1px) solid transparent;
    /* Reveal only the border ring. */
    -webkit-mask: linear-gradient(transparent, transparent), linear-gradient(white, white);
    mask: linear-gradient(transparent, transparent), linear-gradient(white, white);
    -webkit-mask-clip: padding-box, border-box;
    mask-clip: padding-box, border-box;
    -webkit-mask-composite: xor;
    mask-composite: intersect;
  }

  .border-beam::after {
    content: '';
    position: absolute;
    aspect-ratio: 1 / 1;
    width: calc(var(--size) * 1px);
    offset-anchor: calc(var(--anchor) * 1%) 50%;
    offset-path: rect(0 auto auto 0 round calc(var(--size) * 1px));
    background: linear-gradient(to left, var(--color-from), var(--color-to), transparent);
    animation: border-beam calc(var(--duration) * 1s) infinite linear;
    animation-delay: var(--delay);
  }

  @keyframes border-beam {
    100% {
      offset-distance: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .border-beam::after {
      animation: none;
    }
  }
</style>
