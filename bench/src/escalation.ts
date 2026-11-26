/**
 * `pnpm bench:escalation [seed] [model]`: B4, whether a larger model earns
 * its cost on the questions the matcher could not settle.
 *
 * A tender the pipeline has never seen is generated and loaded in place of
 * the demo, then run twice: once with the matcher alone, and once with the
 * escalation role switched on, so the questions the matcher left unsettled
 * are read again by the larger model (`escalate` in agent/run.ts). The second
 * run takes the matcher's answers from the cache, so what it costs is the
 * larger model's share alone. Both runs are scored against the ground truth,
 * side by side, and the demo tender is put back with its read-back and its
 * labor pass. Nothing is changed between the two runs but the role.
 *
 * Calls models and costs money: about 30 to 40 cents for the matcher's run
 * on a new tender, and what the larger model's questions cost on top.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generate } from '../../data/src/generate'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const backend = resolve(repoRoot, 'services/backend')
const seed = Number(process.argv[2] ?? 90200)
const larger = process.argv[3] ?? 'claude-sonnet-5-5'
const ROLE = 'LLM_ESCALATION_MODEL'
const out = `b4-${seed}`

const pnpm = (args: Array<string>, env: Record<string, string> = {}) =>
  execFileSync('pnpm', args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
const convex = (args: Array<string>) =>
  execFileSync('pnpm', ['exec', 'convex', ...args], {
    cwd: backend,
    encoding: 'utf8',
  }).trim()

/** The role's setting on the deployment, to put back afterwards. */
function roleNow(): string | null {
  const names = convex(['env', 'list'])
    .split('\n')
    .map((line) => line.split('=')[0])
  if (!names.includes(ROLE)) return null
  const value = convex(['env', 'get', ROLE])
  return value === '' ? null : value
}
function setRole(model: string | null): void {
  if (model === null) {
    if (roleNow() !== null) convex(['env', 'remove', ROLE])
  } else {
    convex(['env', 'set', ROLE, model])
  }
}

const folder = `data/out/${out}`
const dir = resolve(repoRoot, folder)
mkdirSync(dir, { recursive: true })
const { files, truth } = await generate(seed)
for (const [name, bytes] of files) writeFileSync(resolve(dir, name), bytes)
console.log(
  `Generated seed ${seed}: ${truth.summary.positions} positions, expected ${truth.summary.expectedAuto} auto and ${truth.summary.expectedReview} review.`,
)

const before = roleNow()
try {
  pnpm(['seed', 'load'], { SEED_DIR: folder })
  console.log('\nThe matcher alone.')
  setRole(null)
  pnpm(['bench', '--start'], { SEED_DIR: folder, BENCH_OUT: `${out}/matcher` })
  console.log(`\nThe matcher, and ${larger} on what it could not settle.`)
  setRole(larger)
  pnpm(['bench', '--start'], {
    SEED_DIR: folder,
    BENCH_OUT: `${out}/escalation`,
  })
} finally {
  // Whatever happened, the role and the demo tender go back as they were.
  console.log('\nPutting the demo tender back.')
  setRole(before)
  pnpm(['seed', 'load'])
  pnpm(['demo:reset'])
  convex([
    'run',
    'agent/labor:start',
    JSON.stringify({ slug: 'demo', replay: true }),
  ])
}

// --- The comparison ---------------------------------------------------------

interface Scored {
  gitSha: string
  models: { match: string | null; escalation: string | null }
  run: {
    calls: number
    answeredFromCache: number
    usd: number
    seconds: number | null
    escalation: null | {
      questions: number
      positions: number
      unsettled: number
      capped: number
      answered: number
      failed: number
      calls: number
      usd: number
    }
  }
  result: {
    positions: number
    auto: number
    autoShare: number
    autoPrecision: number
    autoAtRightPrice: number
    euroError: number
    trapsCaught: number
    trapsPlanted: number
    reviewFound: number
    reviewExpected: number
    queuePrecision: number
  }
}
const results = resolve(repoRoot, 'bench/results', out)
const read = (side: string, name: string) =>
  JSON.parse(readFileSync(resolve(results, side, name), 'utf8')) as Scored

function arm(name: string) {
  const b1 = read(name, 'b1_auto_pricing.json')
  const b2 = read(name, 'b2_traps.json')
  return {
    models: b1.models,
    review: b1.result.positions - b1.result.auto,
    auto: b1.result.auto,
    autoShare: b1.result.autoShare,
    autoPrecision: b1.result.autoPrecision,
    autoAtRightPrice: b1.result.autoAtRightPrice,
    euroError: b1.result.euroError,
    trapsCaught: b2.result.trapsCaught,
    trapsPlanted: b2.result.trapsPlanted,
    reviewFound: b2.result.reviewFound,
    reviewExpected: b2.result.reviewExpected,
    queuePrecision: b2.result.queuePrecision,
    run: b1.run,
    gitSha: b1.gitSha,
  }
}

const matcher = arm('matcher')
const escalation = arm('escalation')
const round = (value: number) => Math.round(value * 10000) / 10000
const comparison = {
  benchmark: 'B4',
  question:
    'Does reading again with a larger model what the matcher could not settle shrink the review queue without hurting precision, and at what cost?',
  generatedAt: new Date().toISOString(),
  seed,
  n: truth.summary.positions,
  expected: {
    auto: truth.summary.expectedAuto,
    review: truth.summary.expectedReview,
  },
  matcher,
  escalation,
  difference: {
    review: escalation.review - matcher.review,
    autoPrecision: round(escalation.autoPrecision - matcher.autoPrecision),
    euroError: round(escalation.euroError - matcher.euroError),
    trapsCaught: escalation.trapsCaught - matcher.trapsCaught,
    queuePrecision: round(escalation.queuePrecision - matcher.queuePrecision),
    // The second run read the matcher's answers from the cache, so its cost
    // is the larger model's alone.
    usd: escalation.run.usd,
  },
}
writeFileSync(
  resolve(results, 'b4_escalation.json'),
  `${JSON.stringify(comparison, null, 2)}\n`,
)

const pct = (value: number) => `${(value * 100).toFixed(1)}%`
console.log(`
B4 on seed ${seed} (${truth.summary.positions} positions, ${truth.summary.expectedReview} reviews expected)
                          matcher alone      + ${larger}
review queue              ${String(matcher.review).padEnd(18)} ${escalation.review}
priced without a person   ${pct(matcher.autoShare).padEnd(18)} ${pct(escalation.autoShare)}
  of those, right         ${pct(matcher.autoPrecision).padEnd(18)} ${pct(escalation.autoPrecision)}
euro error                ${String(matcher.euroError).padEnd(18)} ${escalation.euroError}
traps found               ${`${matcher.trapsCaught} of ${matcher.trapsPlanted}`.padEnd(18)} ${escalation.trapsCaught} of ${escalation.trapsPlanted}
reviews that belong       ${pct(matcher.queuePrecision).padEnd(18)} ${pct(escalation.queuePrecision)}
cost                      ${`$${matcher.run.usd}`.padEnd(18)} +$${escalation.run.usd} (${escalation.run.escalation?.questions ?? 0} questions, ${escalation.run.escalation?.positions ?? 0} positions)

Wrote bench/results/${out}/b4_escalation.json`)
