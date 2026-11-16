import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'services/backend/convex/**/*.test.ts',
      'data/src/**/*.test.ts',
      'bench/src/**/*.test.ts',
    ],
  },
})
