/**
 * Build Chrome Web Store image assets from source screenshots, WITHOUT touching
 * the source files.
 *
 *   - Copies each source screenshot UNMODIFIED into screenshots/store/<name>.png
 *     (the 1280x800 upload you actually submit).
 *   - Derives a 440x280 promo tile into screenshots/store/<name>-promo.png via
 *     `sips -z ... --out`, which never mutates the input — so re-running this
 *     can never clobber the original screenshots.
 *   - Validates the required screenshot dimensions (1280x800 or 640x400) so you
 *     find out before uploading instead of in the store review.
 *
 * Usage:
 *   node scripts/store-assets.mjs [srcDir] [name ...]
 *   defaults: srcDir=~/Downloads/mcp, names a b c
 *
 * Safe by construction: sips is always called with `--out` pointing at a fresh
 * dest path; the source path is only opened for reading.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const SCREENSHOT_DIMS = [
  [1280, 800],
  [640, 400],
];
const MAX_MB = 15;
const PROMO = [440, 280];

const srcDir = resolve(process.argv[2] ?? join(homedir(), 'Downloads', 'mcp'));
const names =
  process.argv.length > 3 ? process.argv.slice(3) : ['a', 'b', 'c'];

const outDir = join(process.cwd(), 'screenshots', 'store');
mkdirSync(outDir, { recursive: true });

function sizePx(file) {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], {
    encoding: 'utf8',
  });
  const w = Number(/pixelWidth:\s*(\d+)/.exec(out)?.[1]);
  const h = Number(/pixelHeight:\s*(\d+)/.exec(out)?.[1]);
  return [w, h];
}

let ok = true;
for (const name of names) {
  const src = join(srcDir, `${name}.png`);
  if (!existsSync(src)) {
    console.warn(`[skip] missing source: ${src}`);
    continue;
  }

  const [w, h] = sizePx(src);
  const validDim = SCREENSHOT_DIMS.some(([dw, dh]) => dw === w && dh === h);
  const mb = (statSync(src).size / 1024 / 1024).toFixed(1);

  if (!validDim) {
    console.error(
      `[FAIL] ${name}.png is ${w}x${h} — Web Store screenshots must be ` +
        `1280x800 or 640x400. Re-export at the correct size; ` +
        `derived assets were still written but this upload will be rejected.`,
    );
    ok = false;
  } else if (Number(mb) > MAX_MB) {
    console.error(`[FAIL] ${name}.png is ${mb} MB (> ${MAX_MB} MB limit).`);
    ok = false;
  } else {
    console.log(`[ok]   ${name}.png ${w}x${h} ${mb} MB`);
  }

  // 1. Unmodified copy = the upload.
  copyFileSync(src, join(outDir, `${name}.png`));

  // 2. Promo tile derived via --out (never mutates src).
  const promo = join(outDir, `${name}-promo.png`);
  execFileSync('sips', ['-z', String(PROMO[1]), String(PROMO[0]), src, '--out', promo], {
    stdio: 'ignore',
  });
  console.log(`[out]  screenshots/store/${name}.png (upload) + ${name}-promo.png (${PROMO[0]}x${PROMO[1]})`);
}

if (!ok) process.exit(1);
console.log('\nDone. Upload the non-promo PNGs as screenshots; promos are optional.');
