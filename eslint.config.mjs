import { defineConfig, globalIgnores } from 'eslint/config'
import { tanstackConfig } from '@tanstack/eslint-config'
import convexPlugin from '@convex-dev/eslint-plugin'

export default defineConfig([
  globalIgnores([
    '.claude/**',
    '**/_generated/**',
    '**/routeTree.gen.ts',
    '**/.output/**',
    '**/.nitro/**',
    '**/.tanstack/**',
    '**/.convex/**',
    'apps/web/public/**',
  ]),
  ...tanstackConfig,
  // Applies to every `convex/` directory, wherever it sits in the workspace.
  ...convexPlugin.configs.recommended,
])
