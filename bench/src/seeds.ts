/**
 * `pnpm bench:seeds [seed ...]`: the two model-free reference runs on
 * tenders from other seeds.
 *
 * A check that was shaped while looking at one tender can fit that tender
 * and no other. The perfect reader answers every question from the ground
 * truth, so whatever it gets wrong is the search, the attribution or the
 * decision, not the reading; and it costs nothing to run on as many tenders
 * as one likes. Nothing is written to disk and no model is called.
 */
import { lineId } from '@preisspiegel/core'
import { generate } from '../../data/src/generate'
import { offlineRunsOf } from './offline'
import { readSeed } from './seedData'
import type { OfferDraft } from '../../data/src/offers'
import type { Score } from './score'

/** What runs without arguments. These have been read; they are a quick look, not a measure. */
const DEFAULT_SEEDS = [431, 432, 433, 434, 435, 436, 437, 438]

export interface SeedRow {
  seed: number
  expectedAuto: number
  expectedReview: number
  /** Lines that truly answer a position and were never put to a reader. */
  neverAsked: number
  noReader: Brief
  perfectReader: Brief
}

interface Brief {
  auto: number
  /** Positions priced automatically that needed a person. */
  wrongAuto: number
  autoPrecision: number
  euroError: number
  traps: string
  reviewFound: number
  /** Reviews raised that the truth does not ask for. */
  needless: number
}

const brief = (score: Score): Brief => ({
  auto: score.b1.auto,
  wrongAuto: score.b1.auto - score.b1.autoCorrect,
  autoPrecision: score.b1.autoPrecision,
  euroError: score.b1.euroError,
  traps: `${score.b2.trapsCaught}/${score.b2.trapsPlanted}`,
  reviewFound: score.b2.reviewFound,
  needless: Math.round(score.b2.reviewRaised * (1 - score.b2.queuePrecision)),
})

export async function seedRow(seed: number): Promise<SeedRow> {
  const generated = await generate(seed)
  const data = await readSeed((name) => {
    const bytes = generated.files.get(name)
    if (bytes === undefined) throw new Error(`Seed ${seed} has no ${name}.`)
    return bytes
  })
  const runs = await offlineRunsOf(data)

  // A true offer the search never showed to anybody cannot be found by any
  // reader, however good.
  const shown = new Set<string>()
  for (const question of runs.questions) {
    for (const id of question.echoes) shown.add(`${question.oz} ${id}`)
    for (const candidate of question.candidates) {
      shown.add(`${question.oz} ${candidate.id}`)
    }
  }
  const productOf = new Map(
    data.truth.positions.map((entry) => [entry.oz, entry.productId]),
  )
  let neverAsked = 0
  for (const line of data.lines) {
    if (line.posRef !== null) continue
    const drafts: Record<string, ReadonlyArray<OfferDraft> | undefined> =
      generated.offers.lines
    const draft = drafts[line.supplierKey]?.[line.seq]
    if (draft === undefined) continue
    for (const oz of draft.positions) {
      // A line quoted in place of another article is still the offer for
      // the positions it was quoted against.
      if (!productOf.has(oz)) continue
      if (!shown.has(`${oz} ${lineId(line)}`)) neverAsked++
    }
  }

  return {
    seed,
    expectedAuto: data.truth.summary.expectedAuto,
    expectedReview: data.truth.summary.expectedReview,
    neverAsked,
    noReader: brief(runs.noReader),
    perfectReader: brief(runs.perfectReader),
  }
}

/** `431`, or a range such as `5000-5149`. */
function seedsOf(args: ReadonlyArray<string>): Array<number> {
  return args.flatMap((arg) => {
    const [from, to] = arg.split('-').map(Number)
    if (from === undefined || !Number.isInteger(from)) return []
    if (to === undefined || !Number.isInteger(to)) return [from]
    return Array.from({ length: to - from + 1 }, (_, at) => from + at)
  })
}

const clean = (row: SeedRow): boolean =>
  row.perfectReader.wrongAuto === 0 &&
  row.perfectReader.needless === 0 &&
  row.perfectReader.reviewFound === row.expectedReview

export interface Sweep {
  rows: Array<SeedRow>
  /** Seeds the generator could not make a tender from. */
  failed: Array<number>
}

/** The reference runs on every seed given, one after the other. */
export async function sweep(
  seeds: ReadonlyArray<number>,
  each?: (row: SeedRow) => void,
): Promise<Sweep> {
  const rows: Array<SeedRow> = []
  const failed: Array<number> = []
  for (const seed of seeds) {
    try {
      const row = await seedRow(seed)
      rows.push(row)
      each?.(row)
    } catch (error) {
      // The generator cannot plant its plan on a few seeds and says so.
      // Anything else is a fault in what is being measured and must show.
      if (
        !(error instanceof Error) ||
        !/^sample of \d+ from/.test(error.message)
      ) {
        throw error
      }
      failed.push(seed)
    }
  }
  return { rows, failed }
}

/** What a sweep comes to, as the figures the write-up quotes. */
export function summary(rows: ReadonlyArray<SeedRow>) {
  const count = (test: (row: SeedRow) => boolean) => rows.filter(test).length
  const missesTrap = (row: SeedRow) => {
    const [caught = 0, planted = 0] = row.perfectReader.traps
      .split('/')
      .map(Number)
    return caught < planted
  }
  return {
    tenders: rows.length,
    /** Tenders on which some true offer was never shown to a reader. */
    losingOffers: count((row) => row.neverAsked > 0),
    offersLost: rows.reduce((sum, row) => sum + row.neverAsked, 0),
    /** Tenders where the perfect reader agrees on every position. */
    agreeing: count(clean),
    /** Tenders where it prices something that needed a person. */
    pricingWrongly: count((row) => row.perfectReader.wrongAuto > 0),
    positionsPricedWrongly: rows.reduce(
      (sum, row) => sum + row.perfectReader.wrongAuto,
      0,
    ),
    /** Tenders where it raises a review nobody needs. */
    raisingNeedlessly: count((row) => row.perfectReader.needless > 0),
    needlessReviews: rows.reduce(
      (sum, row) => sum + row.perfectReader.needless,
      0,
    ),
    /** Tenders where it misses a planted trap. */
    missingTraps: count(missesTrap),
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const seeds = args.length > 0 ? seedsOf(args) : DEFAULT_SEEDS
  // A long sweep prints only the tenders that are not clean.
  const onlyFailures = seeds.length > 20
  console.log(
    'seed   expected    perfect reader                                          never asked',
  )
  console.log(
    '       auto  rev   auto  wrong  precision  traps  reviews found  needless',
  )
  const { rows, failed } = await sweep(seeds, (row) => {
    if (onlyFailures && clean(row) && row.neverAsked === 0) return
    const p = row.perfectReader
    console.log(
      [
        String(row.seed).padEnd(6),
        String(row.expectedAuto).padEnd(5),
        String(row.expectedReview).padEnd(5),
        String(p.auto).padEnd(5),
        String(p.wrongAuto).padEnd(6),
        `${(p.autoPrecision * 100).toFixed(1)}%`.padEnd(10),
        p.traps.padEnd(6),
        `${p.reviewFound}/${row.expectedReview}`.padEnd(14),
        String(p.needless).padEnd(9),
        String(row.neverAsked),
      ].join(' '),
    )
  })
  const s = summary(rows)
  console.log(`
${s.tenders} tenders${failed.length > 0 ? ` (the generator failed on ${failed.length}: ${failed.join(', ')})` : ''}, with flawless reading:
  agrees with the ground truth on every position   ${s.agreeing}
  some true offer never shown to a reader          ${s.losingOffers} tenders, ${s.offersLost} offers
  prices a position that needed a person           ${s.pricingWrongly} tenders, ${s.positionsPricedWrongly} positions
  raises a review nobody needs                     ${s.raisingNeedlessly} tenders, ${s.needlessReviews} reviews
  misses a planted trap                            ${s.missingTraps} tenders`)
}

if (process.argv[1]?.endsWith('seeds.ts') === true) await main()
