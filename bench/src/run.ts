/**
 * `pnpm bench`: scores the newest finished run of the demo tender against
 * the ground truth and writes the results to `bench/results/`.
 *
 *   pnpm bench            score the newest finished full run
 *   pnpm bench --start    start a full run first, and wait for it
 *
 * Needs `pnpm dev` running with the seed loaded. Starting a run calls the
 * model and costs money, about 40 cents on the default model with an
 * empty answer cache.
 *
 * B1  how much is priced without a person, and whether that part is right
 * B2  whether each planted trap was found, and what the review queue holds
 * B3  whether every number shown is at the place it says it came from
 *
 * Beside the model's result stand two runs that need no model: no reader at
 * all, and a perfect one. The first run ever scored is kept as the baseline.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SUPPLIERS } from '../../data/src/names'
import { convexRun } from './convex'
import { numberGuard } from './numberGuard'
import { offlineRuns } from './offline'
import { score } from './score'
import type { RunRow } from './convex'
import type { Result, Score } from './score'

const here = dirname(fileURLToPath(import.meta.url))
// BENCH_OUT writes to a folder of its own under results, and keeps no
// baseline there: used for a tender other than the demo's.
const subfolder = process.env.BENCH_OUT
const resultsDir = resolve(here, '../results', subfolder ?? '')
const SLUG = 'demo'
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))

function gitSha(): string {
  const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
  const dirty =
    execFileSync('git', ['status', '--porcelain'], {
      encoding: 'utf8',
    }).trim() !== ''
  return dirty ? `${sha}-dirty` : sha
}

async function finishedRun(start: boolean): Promise<RunRow> {
  if (start) {
    const id = convexRun<string>('agent/run:start', { slug: SLUG })
    console.log(`Started run ${id}.`)
  }
  for (;;) {
    const run = convexRun<RunRow | null>('agent/store:latestRun', {
      slug: SLUG,
    })
    if (run === null) {
      throw new Error('No run yet. Start one with `pnpm bench --start`.')
    }
    if (run.status === 'done') return run
    if (run.status === 'failed' || run.status === 'stopped') {
      throw new Error(`The newest run ${run.status}: ${run.note ?? 'no note'}`)
    }
    console.log(
      `  ${run.status}: ${run.cursor} of ${run.positions} positions, ${run.calls} calls, ${run.usd.toFixed(4)} USD`,
    )
    await sleep(8000)
  }
}

const references = ({ b1, b2 }: Score) => ({
  autoShare: b1.autoShare,
  autoPrecision: b1.autoPrecision,
  euroError: b1.euroError,
  trapsCaught: b2.trapsCaught,
  queueRecall: b2.queueRecall,
  queuePrecision: b2.queuePrecision,
})

async function main(): Promise<void> {
  const run = await finishedRun(process.argv.includes('--start'))
  const offline = await offlineRuns()
  const { positions, lines, truth } = offline.seed
  if (run.positions !== positions.length) {
    throw new Error(
      `The newest run covers ${run.positions} of ${positions.length} positions. Scores are for full runs: pnpm bench --start`,
    )
  }

  // The run's decisions, a page at a time.
  const byOz = new Map(positions.map((position) => [position.oz, position]))
  const results: Array<Result> = []
  for (let fromSeq = 0; fromSeq < run.positions; fromSeq += 200) {
    const page = convexRun<
      Array<Result['decision'] & { oz: string; offers: Result['offers'] }>
    >('agent/store:matches', { runId: run._id, fromSeq, limit: 200 })
    for (const { oz, offers, ...decision } of page) {
      const position = byOz.get(oz)
      if (position !== undefined) results.push({ position, offers, decision })
    }
  }
  const scored = score(results, truth)
  const guard = await numberGuard(
    positions,
    lines,
    Object.fromEntries(
      Object.entries(SUPPLIERS).map(([key, supplier]) => [
        key,
        supplier.fileName,
      ]),
    ),
    'tender.x83',
  )

  const header = {
    generatedAt: new Date().toISOString(),
    gitSha: gitSha(),
    seed: truth.seed,
    n: positions.length,
    offerLines: lines.length,
    provider: process.env.LLM_PROVIDER ?? 'openrouter',
    models: { match: run.model, escalation: null },
    run: {
      id: run._id,
      calls: run.calls,
      answeredFromCache: run.cached,
      failed: run.failed,
      usd: Math.round(run.usd * 10000) / 10000,
      seconds:
        run.finishedAt === null
          ? null
          : Math.round((run.finishedAt - run.startedAt) / 1000),
    },
  }
  const files = {
    'b1_auto_pricing.json': {
      benchmark: 'B1',
      question:
        'How much of the tender is priced without a person, and is that part right?',
      ...header,
      expected: {
        auto: truth.summary.expectedAuto,
        review: truth.summary.expectedReview,
      },
      result: scored.b1,
      references: {
        noReader: references(offline.noReader),
        perfectReader: references(offline.perfectReader),
      },
    },
    'b2_traps.json': {
      benchmark: 'B2',
      question:
        'Was each planted trap found on its line, and does the review queue hold what it should?',
      ...header,
      result: scored.b2,
      references: {
        noReader: {
          traps: offline.noReader.b2.traps,
          trapsCaught: offline.noReader.b2.trapsCaught,
        },
        perfectReader: {
          traps: offline.perfectReader.b2.traps,
          trapsCaught: offline.perfectReader.b2.trapsCaught,
        },
      },
      disagreements: scored.disagreements,
    },
    'b3_number_guard.json': {
      benchmark: 'B3',
      question:
        'Is every number shown for an offer at the place it says it came from?',
      ...header,
      result: guard,
    },
  }

  mkdirSync(
    subfolder === undefined ? resolve(resultsDir, 'baseline') : resultsDir,
    { recursive: true },
  )
  for (const [name, content] of Object.entries(files)) {
    const text = `${JSON.stringify(content, null, 2)}\n`
    writeFileSync(resolve(resultsDir, name), text)
    const baseline = resolve(resultsDir, 'baseline', name)
    if (subfolder === undefined && !existsSync(baseline)) {
      writeFileSync(baseline, text)
    }
  }

  const percent = (share: number) => `${(share * 100).toFixed(1)}%`
  const first = JSON.parse(
    readFileSync(
      resolve(here, '../results/baseline/b1_auto_pricing.json'),
      'utf8',
    ),
  ) as { result: Score['b1'] }
  console.log(`
B1  priced without a person   ${scored.b1.auto} of ${scored.b1.positions} (${percent(scored.b1.autoShare)}), expected ${truth.summary.expectedAuto}
    of those, rightly so      ${percent(scored.b1.autoPrecision)}  (first run: ${percent(first.result.autoPrecision)})
    at the right price        ${scored.b1.autoAtRightPrice} of ${scored.b1.auto}
    euro error                ${scored.b1.euroError.toFixed(2)} of ${scored.b1.euroAuto.toFixed(2)}
B2  traps found               ${scored.b2.trapsCaught} of ${scored.b2.trapsPlanted}
    review queue              ${scored.b2.reviewRaised} raised, ${scored.b2.reviewFound} of ${scored.b2.reviewExpected} expected found
    queue recall, precision   ${percent(scored.b2.queueRecall)}, ${percent(scored.b2.queuePrecision)}
B3  numbers at their source   ${guard.found} of ${guard.checked} (${percent(guard.share)})
    no reader                 ${percent(offline.noReader.b1.autoShare)} auto at ${percent(offline.noReader.b1.autoPrecision)}, ${offline.noReader.b2.trapsCaught} traps, error ${offline.noReader.b1.euroError.toFixed(2)}
    perfect reader            ${percent(offline.perfectReader.b1.autoShare)} auto at ${percent(offline.perfectReader.b1.autoPrecision)}, ${offline.perfectReader.b2.trapsCaught} traps
run ${run.calls} calls, ${run.cached} from cache, ${run.failed} failed, ${run.usd.toFixed(4)} USD
Wrote ${Object.keys(files).length} files to bench/results.`)
}

await main()
