/**
 * `pnpm bench:heldout [seed]`: the benchmarks on a tender the pipeline has
 * never seen.
 *
 * The prompt, the search and the checks were all worked on while looking at
 * the demo tender, so its scores say what the pipeline can be brought to,
 * not what it does unprepared. This generates a second tender from another
 * seed, loads it in place of the demo, runs it once, scores it, and puts
 * the demo back. Nothing is changed between generating and scoring.
 *
 * Costs one full run on the default model, about 40 cents.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SEED, generate } from '../../data/src/generate'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const seed = Number(process.argv[2] ?? SEED + 1)
if (!Number.isInteger(seed) || seed === SEED) {
  throw new Error(`Give a seed other than the demo's (${SEED}).`)
}

const folder = `data/out/heldout-${seed}`
const dir = resolve(repoRoot, folder)
mkdirSync(dir, { recursive: true })
const { files, truth } = await generate(seed)
for (const [name, bytes] of files) writeFileSync(resolve(dir, name), bytes)
console.log(
  `Generated seed ${seed}: ${truth.summary.positions} positions, expected ${truth.summary.expectedAuto} auto and ${truth.summary.expectedReview} review.`,
)

const pnpm = (args: Array<string>, env: Record<string, string> = {}) =>
  execFileSync('pnpm', args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })

try {
  pnpm(['seed', 'load'], { SEED_DIR: folder })
  pnpm(['bench', '--start'], { SEED_DIR: folder, BENCH_OUT: `heldout-${seed}` })
} finally {
  // Whatever happened, the demo tender goes back, with a run of its own.
  // Its answers are all in the cache, so that run calls no model.
  console.log('\nPutting the demo tender back.')
  pnpm(['seed', 'load'])
  pnpm(['bench', '--start'])
}
