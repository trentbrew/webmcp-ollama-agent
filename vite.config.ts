import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

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