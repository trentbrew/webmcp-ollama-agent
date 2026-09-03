import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// `trellis` is a linked (`link:`) dependency. Its dist bundles a bare
// `await import("sql.js")`, but sql.js is only installed under this project's
// node_modules — it is not reachable from trellis-node's own install tree, so
// Rollup cannot resolve it on its own. Point the bare specifier at our pinned
// browser-safe copy (sql-wasm-browser.js, the variant Vite picks for browser
// builds) so the linked package can bundle without re-resolving from its home.
const require = createRequire(import.meta.url);
const sqlJs = resolve(dirname(require.resolve('sql.js')), 'sql-wasm-browser.js');

export default defineConfig({
  plugins: [svelte()],
  server: {
    // Browser dev (localhost:5173) cannot call Ollama directly — no CORS headers.
    // The extension background worker bypasses this via declarativeNetRequest; here we
    // proxy same-origin so fetch/streamDirect work during local development.
    proxy: {
      '/ollama': {
        target: 'http://127.0.0.1:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ollama/, ''),
      },
    },
  },
  resolve: {
    alias: [{ find: /^sql\.js$/, replacement: sqlJs }],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      // questionnaire-e2e.html is deliberately absent: it's a Playwright fixture, and
      // e2e runs against the dev server (see playwright.config.ts), which serves it from
      // the project root with no build step. Listing it here would ship a test harness
      // to the Chrome Web Store.
      input: {
        main: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    }
  }
})