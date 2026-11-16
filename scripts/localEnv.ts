/**
 * Where local configuration lives. The repo root's `.env.local` is the
 * documented place; `services/backend/.env.local` is where `convex dev` keeps
 * its own settings, and values added there are picked up too. The root file
 * wins when both set a name.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const ENV_FILES = [
  resolve(repoRoot, '.env.local'),
  resolve(repoRoot, 'services/backend/.env.local'),
] as const

/** Loads the env files into `process.env`. Names already set are left alone. */
export function loadLocalEnv(): void {
  for (const file of ENV_FILES) {
    if (existsSync(file)) process.loadEnvFile(file)
  }
}

/** Every `NAME=value` in the env files, first file first. Comments are skipped. */
export function readLocalEnv(): Map<string, string> {
  const values = new Map<string, string>()
  for (const file of ENV_FILES) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const match = /^\s*([A-Z][A-Z0-9_]*)\s*=(.*)$/.exec(line)
      if (match === null) continue
      const [, name = '', raw = ''] = match
      if (values.has(name)) continue
      values.set(name, raw.trim().replace(/^(['"])(.*)\1$/, '$2'))
    }
  }
  return values
}
