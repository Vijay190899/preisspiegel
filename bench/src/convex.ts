/**
 * Talks to the running Convex deployment through its CLI, which may call
 * internal functions. The benchmarks start runs and read their results this
 * way; nothing in the app's public API can do either.
 */
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const backend = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../services/backend',
)

export function convexRun<T>(name: string, args: object): T {
  const out = execFileSync(
    'pnpm',
    ['exec', 'convex', 'run', name, JSON.stringify(args)],
    { cwd: backend, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  return JSON.parse(out) as T
}

export interface RunRow {
  _id: string
  status: string
  model: string | null
  startedAt: number
  finishedAt: number | null
  positions: number
  cursor: number
  calls: number
  cached: number
  failed: number
  usd: number
  auto: number | null
  review: number | null
  materialTotal: number | null
  atRisk: number | null
  note: string | null
}
