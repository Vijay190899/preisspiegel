import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // The web app's own import alias, for its tests.
      '~': fileURLToPath(new URL('./apps/web/src', import.meta.url)),
    },
  },
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'services/backend/convex/**/*.test.ts',
      'data/src/**/*.test.ts',
      'bench/src/**/*.test.ts',
      'apps/web/src/**/*.test.ts',
    ],
  },
})
