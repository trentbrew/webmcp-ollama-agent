#!/usr/bin/env node
// Renders manifest PNG icons from public/mcp-brand.svg (requires rsvg-convert).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'public/mcp-brand.svg');
const outDir = resolve(root, 'public/icons');
const sizes = [16, 48, 128];

function findRsvgConvert() {
  const candidates = ['rsvg-convert', '/opt/homebrew/bin/rsvg-convert', '/usr/local/bin/rsvg-convert'];
  for (const bin of candidates) {
    try {
      execFileSync(bin, ['--version'], { stdio: 'ignore' });
      return bin;
    } catch {
      // try next
    }
  }
  return null;
}

function committedIconsExist() {
  return sizes.every((size) => existsSync(resolve(outDir, `icon${size}.png`)));
}

const rsvg = findRsvgConvert();
if (!rsvg) {
  if (committedIconsExist()) {
    console.warn('[icons] rsvg-convert not found — using committed PNGs in public/icons/');
    process.exit(0);
  }
  throw new Error('rsvg-convert not found — install librsvg (brew install librsvg)');
}

await mkdir(outDir, { recursive: true });

for (const size of sizes) {
  const out = resolve(outDir, `icon${size}.png`);
  execFileSync(rsvg, ['-w', String(size), '-h', String(size), source, '-o', out], { stdio: 'inherit' });
  console.log(`[icons] ${out}`);
}
