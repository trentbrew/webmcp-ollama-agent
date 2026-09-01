// Color parsing + conversions (no deps). Ported from the bun-color sandbox and
// trimmed to what the page-theme pipeline needs.

export interface RGB {
  r: number;
  g: number;
  b: number;
}
export interface OKLCH {
  L: number; // 0..1
  C: number; // ~0..0.4
  H: number; // 0..360
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Parse any hex / rgb() / rgba() / hsl() token into RGB. Returns null if unparseable.
export function parseColor(raw: string): RGB | null {
  const s = raw.trim().toLowerCase();

  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3 || hex.length === 4) hex = hex.split('').map((c) => c + c).join('');
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].every((n) => !Number.isNaN(n))) return { r, g, b };
    }
    return null;
  }

  const rgbMatch = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (rgbMatch) {
    return { r: +rgbMatch[1], g: +rgbMatch[2], b: +rgbMatch[3] };
  }

  const hslMatch = s.match(/hsla?\(\s*([\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%/);
  if (hslMatch) {
    return hslToRgb(+hslMatch[1], +hslMatch[2] / 100, +hslMatch[3] / 100);
  }

  return null;
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

// Relative luminance (WCAG) 0..1
export function luminance({ r, g, b }: RGB): number {
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const srgbToLinear = (c: number) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function rgbToOklch({ r, g, b }: RGB): OKLCH {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.sqrt(a * a + bb * bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L: clamp(L, 0, 1), C, H };
}

// daisyUI v4 stores colors as space-separated oklch components: "L% C H"
export function oklchStr({ L, C, H }: OKLCH): string {
  return `${(L * 100).toFixed(3)}% ${C.toFixed(4)} ${H.toFixed(2)}`;
}

export function hexToOklchStr(hex: string): string {
  return oklchStr(rgbToOklch(parseColor(hex)!));
}

// A readable content color (near-black or near-white, faintly tinted with the hue)
export function contentFor(hex: string): string {
  const oklch = rgbToOklch(parseColor(hex)!);
  const tint = Math.min(oklch.C, 0.045);
  return oklch.L > 0.55
    ? `${(0.14 * 100).toFixed(3)}% ${tint.toFixed(4)} ${oklch.H.toFixed(2)}`
    : `${(0.96 * 100).toFixed(3)}% ${tint.toFixed(4)} ${oklch.H.toFixed(2)}`;
}

// Nudge lightness (for base-200 / base-300 steps). Positive = lighten.
export function shiftLightness(hex: string, delta: number): string {
  const o = rgbToOklch(parseColor(hex)!);
  return oklchStr({ ...o, L: clamp(o.L + delta, 0, 1) });
}

// HSL saturation proxy for "is this a grey?"
export function saturation({ r, g, b }: RGB): number {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  if (max === min) return 0;
  const d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}
