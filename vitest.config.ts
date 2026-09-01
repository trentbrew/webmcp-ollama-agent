import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts (the extension build) since tests run under
// plain Node, not the browser/extension environment -- see
// src/lib/trellis/tools.test.ts for why that's the right environment for the
// embedded-kernel tests specifically (sql.js's `:memory:` mode never touches
// fs/OPFS/chrome.*, so it runs natively here with no shim or polyfill).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
