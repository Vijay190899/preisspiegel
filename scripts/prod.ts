/**
 * `pnpm prod <convex args>`: runs the Convex CLI against the production
 * deployment. The deploy key is read from services/backend/.env.production.local
 * (git-ignored, never .env.local, which the dev server reads) and handed to
 * the CLI through its environment, so it appears on no command line and in
 * no output. Example: `pnpm prod deploy -y`, `pnpm prod run health:get`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { repoRoot } from './localEnv'

const backend = resolve(repoRoot, 'services/backend')
const file = resolve(backend, '.env.production.local')
if (!existsSync(file)) {
  console.error(`No ${file}. It holds CONVEX_DEPLOY_KEY for production.`)
  process.exit(1)
}

const env: NodeJS.ProcessEnv = { ...process.env }
// The local deployment's names would point the CLI elsewhere.
delete env.CONVEX_DEPLOYMENT
delete env.CONVEX_URL
for (const line of readFileSync(file, 'utf8').split('\n')) {
  const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim())
  if (match?.[1] !== undefined) env[match[1]] = match[2]
}
if (!env.CONVEX_DEPLOY_KEY?.startsWith('prod:')) {
  console.error('CONVEX_DEPLOY_KEY in that file is not a production key.')
  process.exit(1)
}

const result = spawnSync('pnpm', ['exec', 'convex', ...process.argv.slice(2)], {
  cwd: backend,
  env,
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
