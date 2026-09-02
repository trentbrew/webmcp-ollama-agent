// Builds each MV3 content script as its own single-entry IIFE bundle.
//
// Rollup refuses `output.format: 'iife'` for any build with more than one entry
// point, even when the entries share no code (it treats "more than one output
// chunk" as a code-splitting build). Statically-declared content_scripts also
// can't be loaded as <script type="module">, so they can't contain top-level
// `import`/`export` either -- ruling out the 'es' format too. Running one Vite
// build per content script, each with a single entry, satisfies both constraints.
import { build } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';

const entries = {
  'mcp-main': resolve(root, 'src/content/mcp-main.ts'),
  'mcp-bridge': resolve(root, 'src/content/mcp-bridge.ts'),
};

for (const [name, entry] of Object.entries(entries)) {
  await build({
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      rollupOptions: {
        input: entry,
        output: {
          format: 'iife',
          entryFileNames: `assets/${name}.js`,
        },
      },
    },
  });
}

// sql.js's WASM binary isn't an ES import -- it's fetched at runtime via the
// `locateFile` callback in src/lib/trellis/kernelShim.ts, so Vite's normal
// asset pipeline never sees it. Copy it alongside the other built assets.
//
// Which JS wrapper actually gets bundled (and therefore which .wasm file it
// requests by name) depends on which package.json field Vite's resolver picks
// (main vs. browser vs. module). Rather than hardcode a guess -- or ship every
// variant, which cost 704K of dead weight in the store package -- read the names
// back out of the built bundle and copy exactly those. Resolution can shift
// without notice; this follows it instead of guessing, and fails loudly if the
// file sql.js asks for isn't one the installed version provides.
await mkdir(resolve(root, 'dist/assets'), { recursive: true });

const assetsDir = resolve(root, 'dist/assets');
const referenced = new Set();
for (const file of (await readdir(assetsDir)).filter((f) => f.endsWith('.js'))) {
  const source = await readFile(resolve(assetsDir, file), 'utf8');
  for (const match of source.matchAll(/sql-wasm[\w.-]*\.wasm/g)) referenced.add(match[0]);
}

if (referenced.size === 0) {
  console.warn('[build-content] No sql-wasm*.wasm reference found in the bundle -- shipping none.');
}
for (const wasmFile of referenced) {
  const from = resolve(root, `node_modules/sql.js/dist/${wasmFile}`);
  if (!existsSync(from)) {
    throw new Error(`Bundle requests ${wasmFile}, but sql.js does not ship it at ${from}.`);
  }
  await copyFile(from, resolve(assetsDir, wasmFile));
}
console.log(`[build-content] Shipped WASM: ${[...referenced].join(', ') || '(none)'}`);

// The manifest Chrome reads is dist/manifest.json, copied verbatim from public/ by
// Vite's publicDir. package.json is the single source of truth for the version, so
// stamp it in here -- and fail the build if public/manifest.json has drifted, rather
// than letting two version numbers disagree the way the old root manifest.json did.
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const manifestPath = resolve(root, 'dist/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (manifest.version !== pkg.version) {
  throw new Error(
    `Version drift: package.json is ${pkg.version}, public/manifest.json is ${manifest.version}. ` +
      'Update public/manifest.json to match, then rebuild.',
  );
}
manifest.version = pkg.version;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[build-content] Manifest version ${manifest.version}`);
