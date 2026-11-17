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

/** Tenders nobody has looked at while changing the pipeline. */
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

async function main(): Promise<void> {
  const args = process.argv.slice(2).map(Number)
  const seeds = args.length > 0 ? args : DEFAULT_SEEDS
  console.log(
    'seed   expected    perfect reader                                          never asked',
  )
  console.log(
    '       auto  rev   auto  wrong  precision  traps  reviews found  needless',
  )
  const rows: Array<SeedRow> = []
  for (const seed of seeds) {
    const row = await seedRow(seed)
    rows.push(row)
    const p = row.perfectReader
    console.log(
      [
        String(seed).padEnd(6),
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
  }
  const clean = rows.filter(
    (row) =>
      row.perfectReader.wrongAuto === 0 &&
      row.perfectReader.needless === 0 &&
      row.perfectReader.reviewFound === row.expectedReview,
  ).length
  console.log(
    `\nThe perfect reader agrees with the ground truth on every position of ${clean} of ${rows.length} tenders.`,
  )
}

if (process.argv[1]?.endsWith('seeds.ts') === true) await main()
