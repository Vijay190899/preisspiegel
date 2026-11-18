/**
 * `pnpm bench:labor`: B5, labor. Scores what the labor pass decided for the
 * demo tender against the ground truth and writes `bench/results/b5_labor.json`.
 *
 * `pnpm bench:labor --heldout <seed>`: the same on a tender nothing has seen.
 * It is generated, loaded in place of the demo, given a labor pass, scored
 * and the demo is put back. About 10 cents.
 *
 * `pnpm bench:labor --perfect <from>-<to>`: no model. A reader that knows the
 * right entry and quotes the position's own words is put through the code's
 * checks on the tenders of a range of seeds. What it loses there is lost by
 * the checks, not by the reading. Free.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assessLabor, entryLimit, statedSize } from '@preisspiegel/core'
import { generate } from '../../data/src/generate'
import { convexRun } from './convex'
import { loadSeed, readSeed } from './seedData'
import type { LaborEntry, LaborProposal, Position } from '@preisspiegel/core'
import type { Truth } from '../../data/src/truth'

export interface LaborDecision {
  oz: string
  status: 'set' | 'none' | 'review'
  entryKey: string | null
  minutes: number | null
  reason: string | null
}

export interface LaborScore {
  positions: number
  /** Positions given an entry, or "no entry", without a person. */
  settled: number
  settledShare: number
  /** Of those, the ones that agree with the truth. */
  settledRight: number
  settledPrecision: number
  /** Positions set to an entry other than the true one. */
  wrongEntry: number
  /** Of those, the ones whose minutes differ as well. */
  wrongMinutes: number
  /** Own work given an entry, or timed work given none. */
  wrongNone: number
  review: number
  reviewReasons: Record<string, number>
  /** Hours of labor on the settled positions, by the truth and as decided. */
  hoursTrue: number
  hoursDecided: number
  /** The sum of |decided − true| hours over the settled positions. */
  hoursError: number
}

export function scoreLabor(
  positions: ReadonlyArray<Position>,
  truth: Truth,
  decided: ReadonlyArray<LaborDecision>,
  table: ReadonlyArray<LaborEntry>,
): LaborScore {
  const truthOf = new Map(truth.positions.map((entry) => [entry.oz, entry]))
  const decidedOf = new Map(decided.map((entry) => [entry.oz, entry]))
  const minutesOf = new Map(table.map((entry) => [entry.key, entry.minutes]))
  let settled = 0
  let settledRight = 0
  let wrongEntry = 0
  let wrongMinutes = 0
  let wrongNone = 0
  let hoursTrue = 0
  let hoursDecided = 0
  let hoursError = 0
  const reviewReasons: Record<string, number> = {}
  for (const position of positions) {
    const expected = truthOf.get(position.oz)
    if (expected === undefined) throw new Error(`No truth for ${position.oz}.`)
    const got = decidedOf.get(position.oz)
    if (got === undefined || got.status === 'review') {
      const reason = got?.reason ?? 'unread'
      reviewReasons[reason] = (reviewReasons[reason] ?? 0) + 1
      continue
    }
    settled++
    const trueMinutes =
      expected.laborKey === null ? 0 : (minutesOf.get(expected.laborKey) ?? 0)
    const gotMinutes = got.status === 'set' ? (got.minutes ?? 0) : 0
    const trueHours = (trueMinutes * position.qty) / 60
    const gotHours = (gotMinutes * position.qty) / 60
    hoursTrue += trueHours
    hoursDecided += gotHours
    hoursError += Math.abs(gotHours - trueHours)
    if (got.status === 'none') {
      if (expected.laborKey === null) settledRight++
      else wrongNone++
      continue
    }
    if (expected.laborKey === null) {
      wrongNone++
    } else if (got.entryKey === expected.laborKey) {
      settledRight++
    } else {
      wrongEntry++
      if (gotMinutes !== trueMinutes) wrongMinutes++
    }
  }
  const round = (value: number) => Math.round(value * 100) / 100
  return {
    positions: positions.length,
    settled,
    settledShare: round((settled / positions.length) * 100) / 100,
    settledRight,
    settledPrecision:
      settled === 0 ? 1 : Math.round((settledRight / settled) * 10000) / 10000,
    wrongEntry,
    wrongMinutes,
    wrongNone,
    review: positions.length - settled,
    reviewReasons,
    hoursTrue: round(hoursTrue),
    hoursDecided: round(hoursDecided),
    hoursError: round(hoursError),
  }
}

/**
 * What a reader that knows the answer would say: the true entry, the short
 * text as the name of the thing, and for an entry with a size in its label
 * the shortest text of the position that states one.
 */
export function perfectProposal(
  position: Position,
  laborKey: string | null,
  table: ReadonlyArray<LaborEntry>,
): LaborProposal {
  const entry = table.find((candidate) => candidate.key === laborKey)
  const limit = entry === undefined ? null : entryLimit(entry.label)
  let limitQuote: string | null = null
  if (limit !== null) {
    for (const text of [position.shortText, position.longText]) {
      if (statedSize(text, limit.unit) !== null) {
        limitQuote = text
        break
      }
    }
  }
  return { entry: laborKey, quote: position.shortText, limitQuote }
}

const here = dirname(fileURLToPath(import.meta.url))

function tableOf(files: Map<string, Uint8Array>): Array<LaborEntry> {
  const bytes = files.get('zeitwerte.json')
  if (bytes === undefined) throw new Error('No labor time table.')
  return (
    JSON.parse(Buffer.from(bytes).toString('utf8')) as {
      entries: Array<LaborEntry>
    }
  ).entries
}

/** `--silent`: the perfect reader quotes no size, so the code reads it itself. */
const SILENT = process.argv.includes('--silent')

async function perfect(from: number, to: number): Promise<void> {
  let tenders = 0
  let allSettled = 0
  const lost: Record<string, number> = {}
  const examples: Array<string> = []
  let positionsSeen = 0
  // Wrong entries in the position's unit, offered with the position's own
  // words: how many the checks let through, and of those, how many differ
  // only in a size the label states.
  let wrongOffered = 0
  let wrongPassed = 0
  let wrongCaughtByLimit = 0
  const passedPairs = new Map<string, number>()
  for (let seed = from; seed <= to; seed++) {
    let generated
    try {
      generated = await generate(seed)
    } catch (error) {
      // The generator fails on a few seeds in trap sampling (HANDOVER §5).
      if (error instanceof Error && /sample of \d+ from/.test(error.message)) {
        continue
      }
      throw error
    }
    const table = tableOf(generated.files)
    const truth = JSON.parse(
      Buffer.from(generated.files.get('truth.json') ?? []).toString('utf8'),
    ) as Truth
    const { gaebPositions, parseGaeb } = await import('@preisspiegel/core')
    const positions = gaebPositions(
      parseGaeb(
        Buffer.from(generated.files.get('tender.x83') ?? []).toString('utf8'),
      ),
    )
    const keyOf = new Map(truth.positions.map((e) => [e.oz, e.laborKey]))
    const decided = positions.map((position): LaborDecision => {
      const key = keyOf.get(position.oz) ?? null
      for (const other of table) {
        if (other.key === key) continue
        const outcome = assessLabor(
          position,
          perfectProposal(position, other.key, table),
          table,
        )
        if (outcome.status === 'review' && outcome.reason === 'unit') continue
        wrongOffered++
        if (outcome.status === 'set') {
          wrongPassed++
          const pair = `${key ?? 'none'} -> ${other.key}`
          passedPairs.set(pair, (passedPairs.get(pair) ?? 0) + 1)
        } else if (
          outcome.status === 'review' &&
          (outcome.reason === 'limit' || outcome.reason === 'limit_unstated')
        ) {
          wrongCaughtByLimit++
        }
      }
      const right = perfectProposal(position, key, table)
      const outcome = assessLabor(
        position,
        SILENT ? { ...right, limitQuote: null } : right,
        table,
      )
      if (outcome.status === 'review' && examples.length < 12) {
        examples.push(
          `seed ${seed} ${position.oz} ${key}: ${outcome.reason}, ${outcome.detail} | ${position.shortText}`,
        )
      }
      return {
        oz: position.oz,
        status: outcome.status,
        entryKey:
          outcome.status === 'none' ? null : (outcome.entry?.key ?? null),
        minutes: outcome.status === 'set' ? outcome.entry.minutes : null,
        reason: outcome.status === 'review' ? outcome.reason : null,
      }
    })
    const score = scoreLabor(positions, truth, decided, table)
    tenders++
    positionsSeen += score.positions
    if (
      score.settled === score.positions &&
      score.settledRight === score.settled
    ) {
      allSettled++
    }
    for (const [reason, count] of Object.entries(score.reviewReasons)) {
      lost[reason] = (lost[reason] ?? 0) + count
    }
  }
  const lostTotal = Object.values(lost).reduce((sum, n) => sum + n, 0)
  console.log(`Perfect labor reader, seeds ${from} to ${to}: ${tenders} tenders, ${positionsSeen} positions.
Every position settled and right on ${allSettled} of ${tenders} tenders.
Positions the checks send to a person although the reader was right: ${lostTotal} (${((lostTotal / positionsSeen) * 100).toFixed(2)}%)`)
  for (const [reason, count] of Object.entries(lost)) {
    console.log(`  ${reason}: ${count}`)
  }
  for (const example of examples) console.log(`  e.g. ${example}`)
  console.log(`Wrong entries in the position's unit, offered with its own words: ${wrongOffered}.
  let through by the checks: ${wrongPassed} (${((wrongPassed / wrongOffered) * 100).toFixed(1)}%)
  stopped because the size or count did not fit: ${wrongCaughtByLimit}
  The checks cannot tell a luminaire from a socket; only the size and the unit. Most let through, by pair:`)
  for (const [pair, count] of [...passedPairs]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)) {
    console.log(`    ${pair}: ${count}`)
  }
}

interface JobRow {
  _id: string
  status: string
  mode: string
  model: string
  calls: number
  cached: number
  failed: number
  usd: number
  startedAt: number
  finishedAt: number | null
  positions: number
  note: string | null
}

const repoRoot = resolve(here, '../..')

function pnpm(args: Array<string>, env: Record<string, string> = {}): void {
  execFileSync('pnpm', args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
}

/** Starts a labor pass and waits for it to end. */
async function pass(replay: boolean): Promise<JobRow> {
  convexRun('agent/labor:start', { slug: 'demo', replay })
  for (;;) {
    await new Promise((done) => setTimeout(done, 5000))
    const job = convexRun<JobRow | null>('agent/labor:latestJob', {
      slug: 'demo',
    })
    if (job !== null && job.status !== 'reading') return job
  }
}

async function heldOut(seed: number): Promise<void> {
  const { SEED } = await import('../../data/src/generate')
  if (seed === SEED)
    throw new Error(`Give a seed other than the demo's (${SEED}).`)
  const folder = `data/out/heldout-labor-${seed}`
  const dir = resolve(repoRoot, folder)
  mkdirSync(dir, { recursive: true })
  const { files } = await generate(seed)
  for (const [name, bytes] of files) writeFileSync(resolve(dir, name), bytes)
  try {
    pnpm(['seed', 'load'], { SEED_DIR: folder })
    const job = await pass(false)
    const data = await readSeed((name) => {
      const bytes = files.get(name)
      if (bytes === undefined) throw new Error(`Seed ${seed} has no ${name}.`)
      return bytes
    })
    await live({
      data,
      table: tableOf(files),
      job,
      out: `heldout-labor-${seed}/b5_labor.json`,
    })
  } finally {
    // The demo goes back with a run and a labor pass of its own, both from
    // stored answers, so neither calls a model.
    console.log('\nPutting the demo tender back.')
    pnpm(['seed', 'load'])
    pnpm(['demo:reset'])
    await pass(true)
  }
}

async function live(given?: {
  data: Awaited<ReturnType<typeof loadSeed>>
  table: Array<LaborEntry>
  job: JobRow
  out: string
}): Promise<void> {
  const { positions, truth } = given?.data ?? (await loadSeed())
  const job =
    given?.job ??
    convexRun<JobRow | null>('agent/labor:latestJob', { slug: 'demo' })
  if (job === null || job.status !== 'done') {
    throw new Error('No finished labor pass. Start one with agent/labor:start.')
  }
  if (job.positions !== positions.length) {
    throw new Error(
      `The newest labor pass covered ${job.positions} of ${positions.length} positions; a trial is not scored.`,
    )
  }
  const decided: Array<LaborDecision> = []
  for (let fromSeq = 0; ; fromSeq += 400) {
    const page = convexRun<Array<LaborDecision>>('agent/labor:matches', {
      slug: 'demo',
      fromSeq,
      limit: 400,
    })
    decided.push(...page)
    if (page.length < 400) break
  }
  const { readFileSync } = await import('node:fs')
  const table =
    given?.table ??
    (
      JSON.parse(
        readFileSync(resolve(here, '../../data/seed/zeitwerte.json'), 'utf8'),
      ) as { entries: Array<LaborEntry> }
    ).entries
  const score = scoreLabor(positions, truth, decided, table)
  const gitSha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
  const dirty =
    execFileSync('git', ['status', '--porcelain'], {
      encoding: 'utf8',
    }).trim() !== ''
  const wrong = decided
    .filter((entry) => {
      const expected = truth.positions.find((e) => e.oz === entry.oz)
      return (
        entry.status !== 'review' &&
        (entry.status === 'none'
          ? expected?.laborKey !== null
          : entry.entryKey !== expected?.laborKey)
      )
    })
    .map((entry) => ({
      oz: entry.oz,
      got: entry.status === 'none' ? null : entry.entryKey,
      expected:
        truth.positions.find((e) => e.oz === entry.oz)?.laborKey ?? null,
    }))
  const out = {
    benchmark: 'B5',
    question:
      'Is each position tied to the right entry of the labor time table, and is what is not sent to a person?',
    generatedAt: new Date().toISOString(),
    gitSha: dirty ? `${gitSha}-dirty` : gitSha,
    seed: truth.seed,
    n: positions.length,
    job: {
      id: job._id,
      mode: job.mode,
      model: job.model,
      calls: job.calls,
      answeredFromCache: job.cached,
      failed: job.failed,
      usd: Math.round(job.usd * 10000) / 10000,
      seconds:
        job.finishedAt === null
          ? null
          : Math.round((job.finishedAt - job.startedAt) / 1000),
    },
    result: score,
    wrong,
  }
  const target = resolve(here, '../results', given?.out ?? 'b5_labor.json')
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`)
  const pct = (share: number) => `${(share * 100).toFixed(1)}%`
  console.log(`B5 labor, ${job.model}, ${job.calls} calls, $${out.job.usd}:
  settled without a person   ${score.settled} of ${score.positions} (${pct(score.settled / score.positions)})
  of those, right            ${score.settledRight} (${pct(score.settledPrecision)})
  wrong entry                ${score.wrongEntry} (${score.wrongMinutes} with other minutes), wrong "no entry" ${score.wrongNone}
  to a person                ${score.review} ${JSON.stringify(score.reviewReasons)}
  hours on settled           ${score.hoursDecided} decided, ${score.hoursTrue} true, error ${score.hoursError}
Wrote bench/results/${given?.out ?? 'b5_labor.json'}.`)
}

if (process.argv[1]?.endsWith('labor.ts') === true) {
  const [flag, range] = process.argv.slice(2)
  if (flag === '--perfect') {
    const [from, to] = (range ?? '').split('-').map(Number)
    if (
      from === undefined ||
      to === undefined ||
      Number.isNaN(from) ||
      Number.isNaN(to)
    ) {
      throw new Error('Give a range of seeds: --perfect 6000-6199')
    }
    await perfect(from, to)
  } else if (flag === '--heldout') {
    const seed = Number(range)
    if (!Number.isInteger(seed)) throw new Error('Give a seed: --heldout 503')
    await heldOut(seed)
  } else {
    await live()
  }
}
