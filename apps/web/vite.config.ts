import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'

// `convex dev` writes the deployment URL into the backend package's
// `.env.local` as CONVEX_URL. Read it from there so there is one source.
// Only names with these prefixes reach the browser bundle.
const ENV_DIR = '../../services/backend'
const ENV_PREFIX = ['VITE_', 'CONVEX_URL']

/**
 * Where the browser may connect: the page's own origin and the Convex
 * deployment, over HTTPS for queries and a WebSocket for live updates.
 */
function convexOrigins(url: string | undefined): Array<string> {
  if (url === undefined || url === '') {
    return ['https://*.convex.cloud', 'wss://*.convex.cloud']
  }
  const { host, protocol } = new URL(url)
  const secure = protocol === 'https:'
  return [`${protocol}//${host}`, `${secure ? 'wss' : 'ws'}://${host}`]
}

/**
 * The headers every response carries. Scripts allow 'unsafe-inline' because
 * the server-rendered page hydrates from inline scripts and sets the theme
 * before paint; everything else is held to this origin and the Convex
 * deployment (ADR-63).
 */
function securityHeaders(convexUrl: string | undefined) {
  const policy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${convexOrigins(convexUrl).join(' ')}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
  return {
    'content-security-policy': policy,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'strict-transport-security': 'max-age=63072000; includeSubDomains',
  }
}

/**
 * GAEB files are XML. Served as such, hosts compress them in transit; under
 * their own extensions they would go out as bytes of no known kind. One rule
 * per file, because a route may hold only one wildcard.
 */
function gaebRules() {
  const seed = fileURLToPath(new URL('../../data/seed', import.meta.url))
  return Object.fromEntries(
    readdirSync(seed)
      .filter((name) => /\.x8\d$/.test(name))
      .map((name) => [
        `/demo/${name}`,
        { headers: { 'content-type': 'application/xml; charset=utf-8' } },
      ]),
  )
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ENV_DIR, ENV_PREFIX)
  const convexUrl = env.VITE_CONVEX_URL ?? env.CONVEX_URL
  return {
    envDir: ENV_DIR,
    envPrefix: ENV_PREFIX,
    resolve: {
      tsconfigPaths: true,
    },
    server: {
      port: 3000,
    },
    plugins: [
      tailwindcss(),
      tanstackStart(),
      // Builds for the host it runs on: Vercel's output on Vercel, a Node
      // server elsewhere.
      nitro({
        compressPublicAssets: true,
        routeRules: {
          '/**': { headers: securityHeaders(convexUrl) },
          // File names carry a hash of their content.
          '/assets/**': {
            headers: { 'cache-control': 'public, max-age=31536000, immutable' },
          },
          ...gaebRules(),
        },
      }),
      viteReact(),
    ],
  }
})
