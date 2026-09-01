// The live-DOM sampler. Unlike static CSS mining, this runs *inside the page*
// via chrome.scripting.executeScript and reads getComputedStyle on actually
// painted elements — the fully-resolved cascade (post-JS, post-var(), post
// media-query) — and weights every color by the pixel area it paints rather
// than by how often its string appears in source.
//
// IMPORTANT: the sampler is self-contained (no imports, no closure over module
// scope) so it can be serialized and injected. Use getSamplerScript() to get
// the serialised form for chrome.scripting.executeScript.

export interface SampledPage {
  url: string;
  title: string;
  themeColor?: string;
  colors: Array<[string, number]>; // [hex, area-weight]
  fonts: Array<[string, number]>; // [family, area-weight]
  radii: number[]; // px samples from surface elements
  fontLinks: string[]; // Google Fonts / Bunny / Typekit hrefs
  rootLuminance: number; // 0..1
}

// Self-contained page-theme sampler — all helpers are local so toString() works.
function samplePageTheme(): SampledPage {
  const MAX_ELEMENTS = 5000;

  const toHex = (raw: string): string | null => {
    const m = raw.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)/i);
    if (!m) return null;
    const a = m[4] === undefined ? 1 : +m[4];
    if (a < 0.15) return null;
    const h = (n: number) =>
      Math.max(0, Math.min(255, Math.round(+n))).toString(16).padStart(2, '0');
    return `#${h(+m[1])}${h(+m[2])}${h(+m[3])}`;
  };

  const luminanceOf = (raw: string): number => {
    const m = raw.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if (!m) return 1;
    const lin = (c: number) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(+m[1]) + 0.7152 * lin(+m[2]) + 0.0722 * lin(+m[3]);
  };

  const expandShortHex = (h: string): string =>
    '#' + h.slice(1).split('').map((c) => c + c).join('');

  const colors = new Map<string, number>();
  const fonts = new Map<string, number>();
  const radii: number[] = [];

  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 800;
  const viewportArea = vw * vh;

  const bump = (map: Map<string, number>, key: string, w: number) =>
    map.set(key, (map.get(key) ?? 0) + w);

  const all = document.body?.querySelectorAll<HTMLElement>('*') ?? [];

  for (const el of all) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (rect.bottom < -vh || rect.top > vh * 2) continue;
    if (rect.right < 0 || rect.left > vw) continue;

    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;

    const area = Math.min(rect.width, vw) * Math.min(rect.height, vh);
    if (area < 4) continue;

    const bg = toHex(cs.backgroundColor);
    if (bg) bump(colors, bg, area);

    const fg = toHex(cs.color);
    if (fg && el.textContent?.trim().length) {
      bump(colors, fg, area * 0.25);
      const fam = cs.fontFamily.replace(/\s+/g, ' ').replace(/["']/g, '').trim();
      const first = fam.split(',')[0]?.trim().toLowerCase() ?? '';
      if (
        fam &&
        !/^(sans-serif|serif|monospace|system-ui|-apple-system|ui-sans-serif|ui-serif|ui-monospace|inherit)$/.test(first)
      ) {
        bump(fonts, fam, area);
      }
    }

    const bc = toHex(cs.borderTopColor);
    if (bc && parseFloat(cs.borderTopWidth) > 0) bump(colors, bc, area * 0.08);

    if (bg && area < viewportArea * 0.5) {
      const r = parseFloat(cs.borderTopLeftRadius);
      if (Number.isFinite(r) && r > 0 && r < 80) radii.push(r);
    }
  }

  // :root custom properties that resolve to colors (design tokens).
  try {
    const rootCs = getComputedStyle(document.documentElement);
    for (let i = 0; i < rootCs.length; i++) {
      const prop = rootCs.item(i);
      if (!prop.startsWith('--')) continue;
      const val = rootCs.getPropertyValue(prop).trim();
      const hex = toHex(val) ?? (/^#[0-9a-f]{3,8}$/i.test(val) ? val : null);
      if (hex) bump(colors, hex.length === 4 ? expandShortHex(hex) : hex, viewportArea * 0.02);
    }
  } catch {
    /* cross-origin / hostile getComputedStyle */
  }

  const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const themeColorRaw = themeMeta?.content?.trim();
  const themeColor = themeColorRaw
    ? toHex(themeColorRaw) ?? (/^#[0-9a-f]{3,8}$/i.test(themeColorRaw) ? themeColorRaw : undefined)
    : undefined;

  const fontLinks: string[] = [];
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"], link[rel="preload"]')) {
    const href = link.href;
    if (href && /fonts\.googleapis\.com|fonts\.bunny\.net|use\.typekit/i.test(href))
      fontLinks.push(href);
  }

  const rootBg = document.body ? getComputedStyle(document.body).backgroundColor : '';
  const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
  const bgForLum = toHex(rootBg) ? rootBg : htmlBg;
  const rootLuminance = luminanceOf(bgForLum || 'rgb(255,255,255)');

  return {
    url: location.href,
    title: document.title || location.hostname,
    themeColor,
    colors: [...colors.entries()],
    fonts: [...fonts.entries()],
    radii,
    fontLinks: [...new Set(fontLinks)].slice(0, 3),
    rootLuminance,
  };
}

// Re-export for direct use in the panel process.
export { samplePageTheme };

// The serialized form — pass as `func` to chrome.scripting.executeScript.
export function getSamplerScript(): string {
  return samplePageTheme.toString();
}
