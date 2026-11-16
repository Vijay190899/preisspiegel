/**
 * `pnpm env:push`: copies local configuration into the Convex deployment's
 * environment, which is where Convex functions read it from.
 *
 * Only names documented in `.env.example` are pushed, so Convex's own
 * settings and anything unrelated stay local. Values never appear on a
 * command line or in the output.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { readLocalEnv, repoRoot } from './localEnv'

function documentedNames(): Array<string> {
  const example = readFileSync(resolve(repoRoot, '.env.example'), 'utf8')
  return [...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(
    (match) => match[1] ?? '',
  )
}

function main(): void {
  const prod = process.argv.includes('--prod')
  const local = readLocalEnv()
  const names = documentedNames().filter((name) => local.has(name))
  if (names.length === 0) {
    console.log('Nothing to push: no documented name is set locally.')
    return
  }

  // The CLI reads `NAME=value` pairs from a file. Keep it private and brief.
  const dir = mkdtempSync(join(tmpdir(), 'preisspiegel-env-'))
  const file = join(dir, 'push.env')
  try {
    writeFileSync(
      file,
      names.map((name) => `${name}=${local.get(name) ?? ''}\n`).join(''),
      { mode: 0o600 },
    )
    execFileSync(
      'pnpm',
      [
        'exec',
        'convex',
        'env',
        'set',
        ...(prod ? ['--prod'] : []),
        '--force',
        '--from-file',
        file,
      ],
      { cwd: resolve(repoRoot, 'services/backend'), stdio: 'ignore' },
    )
  } catch {
    console.error(
      'Pushing failed. A local Convex deployment only runs while `pnpm dev` does.',
    )
    process.exitCode = 1
    return
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }

  console.log(`Pushed ${names.length} names to Convex: ${names.join(', ')}`)
}

main()
