// Turn a live-DOM sample into a daisyUI v4 variable set. The scoring +
// role-assignment logic mirrors the bun-color sandbox; only the input layer
// changed (area-weighted computed styles instead of regex-mined source).
import {
  contentFor,
  hexToOklchStr,
  luminance,
  parseColor,
  rgbToOklch,
  saturation,
  shiftLightness,
  toHex,
  type RGB,
} from './color';
import type { SampledPage } from './sampler';

interface Swatch {
  hex: string;
  weight: number; // painted area (px^2)
  sat: number;
  lum: number;
  hue: number;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
  'base-100': string;
  info: string;
  success: string;
  warning: string;
  error: string;
}

export interface PageTheme {
  colors: ThemeColors;
  dark: boolean;
  radii: { btn: number; box: number };
  font?: string;
  fontLinks: string[];
  vars: Record<string, string>;
  title: string;
  url: string;
}

const DEFAULTS: ThemeColors = {
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  accent: '#14b8a6',
  neutral: '#2a2e37',
  'base-100': '#ffffff',
  info: '#0ea5e9',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
};

const hueDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

// Visual-weight score: area matters most, but reward colorful mid-tones so a
// vast grey background doesn't outrank the brand fill.
function score(s: Swatch): number {
  const colorful = s.sat; // 0..1
  const midtone = 1 - Math.abs(s.lum - 0.5) * 1.2;
  return Math.log2(s.weight + 1) * (0.35 + colorful) * Math.max(0.2, midtone);
}

function summarizeRadii(pxArr: number[]): { btn: number; box: number } {
  const arr = pxArr.map((px) => px / 16).filter((r) => r > 0 && r < 5); // px -> rem, drop pills
  if (!arr.length) return { btn: 0.5, box: 1 };
  const freq = new Map<number, number>();
  for (const r of arr) {
    const k = Math.round(r * 100) / 100;
    freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const small = sorted.filter(([r]) => r <= 1);
  const large = sorted.filter(([r]) => r > 1);
  const btn = small[0]?.[0] ?? sorted[0][0];
  const box = large[0]?.[0] ?? Math.min(btn * 2, 2);
  return { btn, box };
}

export function buildPageTheme(sample: SampledPage): PageTheme {
  const swatches: Swatch[] = sample.colors
    .map(([hex, weight]) => {
      const rgb = parseColor(hex) as RGB | null;
      if (!rgb) return null;
      const o = rgbToOklch(rgb);
      return { hex, weight, sat: saturation(rgb), lum: luminance(rgb), hue: o.H };
    })
    .filter((s): s is Swatch => s !== null)
    .sort((a, b) => score(b) - score(a));

  const brand = swatches.filter((c) => c.sat > 0.15 && c.lum > 0.06 && c.lum < 0.95);
  const neutrals = swatches.filter((c) => c.sat <= 0.15);

  const themeColorHex =
    sample.themeColor && parseColor(sample.themeColor) ? toHex(parseColor(sample.themeColor)!) : undefined;

  const primary = brand[0]?.hex ?? themeColorHex ?? DEFAULTS.primary;
  const primaryHue = (brand.find((c) => c.hex === primary) ?? brand[0])?.hue ?? 0;

  const pickDistinct = (used: number[], min = 35): Swatch | undefined =>
    brand.find((c) => used.every((h) => hueDist(c.hue, h) >= min));

  const secondary = pickDistinct([primaryHue])?.hex ?? DEFAULTS.secondary;
  const secHue = brand.find((c) => c.hex === secondary)?.hue ?? primaryHue;
  const accent = pickDistinct([primaryHue, secHue])?.hex ?? DEFAULTS.accent;

  // Background: dominant neutral by painted weight. Fall back to the sampled
  // root luminance to decide light vs dark when neutrals are ambiguous.
  const bg = [...neutrals].sort((a, b) => b.weight - a.weight)[0];
  const base100 = bg?.hex ?? (sample.rootLuminance < 0.4 ? '#1a1a1a' : DEFAULTS['base-100']);
  const dark = (parseColor(base100) ? luminance(parseColor(base100)!) : sample.rootLuminance) < 0.4;

  const neutral =
    [...neutrals].sort((a, b) => (dark ? b.lum - a.lum : a.lum - b.lum))[0]?.hex ?? DEFAULTS.neutral;

  const colors: ThemeColors = {
    primary,
    secondary,
    accent,
    neutral,
    'base-100': base100,
    info: DEFAULTS.info,
    success: DEFAULTS.success,
    warning: DEFAULTS.warning,
    error: DEFAULTS.error,
  };

  const radii = summarizeRadii(sample.radii);
  const font = [...sample.fonts].sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    colors,
    dark,
    radii,
    font,
    fontLinks: sample.fontLinks,
    vars: themeVars(colors, dark, radii, font),
    title: sample.title,
    url: sample.url,
  };
}

// The daisyUI v4 CSS custom properties. Applied inline on the panel root so
// they override whatever named `data-theme` is active.
export function themeVars(
  c: ThemeColors,
  dark: boolean,
  radii: { btn: number; box: number },
  font?: string,
): Record<string, string> {
  const step = dark ? 0.045 : -0.035;
  const baseContent = shiftLightness(c['base-100'], dark ? 0.82 : -0.82);

  const vars: Record<string, string> = {
    '--p': hexToOklchStr(c.primary),
    '--pc': contentFor(c.primary),
    '--s': hexToOklchStr(c.secondary),
    '--sc': contentFor(c.secondary),
    '--a': hexToOklchStr(c.accent),
    '--ac': contentFor(c.accent),
    '--n': hexToOklchStr(c.neutral),
    '--nc': contentFor(c.neutral),
    '--b1': hexToOklchStr(c['base-100']),
    '--b2': shiftLightness(c['base-100'], step),
    '--b3': shiftLightness(c['base-100'], step * 2),
    '--bc': baseContent,
    '--in': hexToOklchStr(c.info),
    '--inc': contentFor(c.info),
    '--su': hexToOklchStr(c.success),
    '--suc': contentFor(c.success),
    '--wa': hexToOklchStr(c.warning),
    '--wac': contentFor(c.warning),
    '--er': hexToOklchStr(c.error),
    '--erc': contentFor(c.error),
    '--rounded-box': `${radii.box}rem`,
    '--rounded-btn': `${radii.btn}rem`,
    '--rounded-badge': `${radii.btn}rem`,
    'color-scheme': dark ? 'dark' : 'light',
  };
  if (font) vars['--page-font'] = font;
  return vars;
}
