/**
 * `pnpm prod <convex args>`: runs the Convex CLI against the production
 * deployment, e.g. `pnpm prod run health:get`.
 *
 * The deploy key is read from services/backend/.convex-prod.env (git-ignored,
 * mode 600). Not .env.local, which the dev server and every local `convex`
 * command read, and not .env.production.local, which Vite loads in a
 * production build from the same folder. The key reaches the CLI through its
 * environment, so it appears on no command line and in no output.
 *
 * What changes production's code or data (`deploy`, `import`) runs only from
 * a clean `main` that matches GitHub, so nothing unreviewed goes live.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { repoRoot } from './localEnv'

const backend = resolve(repoRoot, 'services/backend')
const file = resolve(backend, '.convex-prod.env')
const args = process.argv.slice(2)
const git = (...gitArgs: Array<string>) =>
  execFileSync('git', gitArgs, { cwd: repoRoot, encoding: 'utf8' }).trim()

if (!existsSync(file)) {
  console.error(`No ${file}. It holds CONVEX_DEPLOY_KEY for production.`)
  process.exit(1)
}

if (args[0] === 'deploy' || args[0] === 'import') {
  git('fetch', '--quiet', 'origin', 'main')
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
  const dirty = git('status', '--porcelain') !== ''
  const behind = git('rev-parse', 'HEAD') !== git('rev-parse', 'origin/main')
  if (branch !== 'main' || dirty || behind) {
    console.error(
      `\`${args[0]}\` changes production. Run it from a clean main that matches origin/main (here: ${branch}${dirty ? ', uncommitted changes' : ''}${behind ? ', not at origin/main' : ''}).`,
    )
    process.exit(1)
  }
}

/** `NAME=value`, with an optional `export ` and quotes around the value. */
function parseLine(line: string): [string, string] | null {
  const match = /^(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim())
  if (match?.[1] === undefined || match[2] === undefined) return null
  const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
  return [match[1], value]
}

const env: NodeJS.ProcessEnv = { ...process.env }
// The local deployment's names would point the CLI elsewhere.
delete env.CONVEX_DEPLOYMENT
delete env.CONVEX_URL
for (const line of readFileSync(file, 'utf8').split('\n')) {
  const pair = parseLine(line)
  if (pair !== null) env[pair[0]] = pair[1]
}
if (!env.CONVEX_DEPLOY_KEY?.startsWith('prod:')) {
  console.error('CONVEX_DEPLOY_KEY in that file is not a production key.')
  process.exit(1)
}

const result = spawnSync('pnpm', ['exec', 'convex', ...args], {
  cwd: backend,
  env,
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
