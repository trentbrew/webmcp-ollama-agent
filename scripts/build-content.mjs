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
import { copyFile, mkdir } from 'node:fs/promises';

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
// (main vs. browser vs. module) -- observed to be sql-wasm-browser.js/.wasm in
// this build, but pin that by inspecting bundle output at your peril; it's
// cheap to just ship every non-debug variant so locateFile always finds a match
// regardless of which entry sql.js resolves to.
await mkdir(resolve(root, 'dist/assets'), { recursive: true });
for (const wasmFile of ['sql-wasm.wasm', 'sql-wasm-browser.wasm']) {
  await copyFile(resolve(root, `node_modules/sql.js/dist/${wasmFile}`), resolve(root, `dist/assets/${wasmFile}`));
}
