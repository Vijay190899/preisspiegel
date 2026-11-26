/**
 * The benchmark results, as committed.
 *
 * These are the files `pnpm bench` and `pnpm bench:heldout` wrote, imported
 * as they stand: the page shows no figure that is not in one of them, and
 * names the file under what it shows.
 */
import firstB1 from '../../../../bench/results/baseline/b1_auto_pricing.json'
import firstB2 from '../../../../bench/results/baseline/b2_traps.json'
import firstB3 from '../../../../bench/results/baseline/b3_number_guard.json'
import nowB1 from '../../../../bench/results/b1_auto_pricing.json'
import nowB2 from '../../../../bench/results/b2_traps.json'
import nowB3 from '../../../../bench/results/b3_number_guard.json'
import a119B1 from '../../../../bench/results/heldout-119/b1_auto_pricing.json'
import a119B2 from '../../../../bench/results/heldout-119/b2_traps.json'
import a119B3 from '../../../../bench/results/heldout-119/b3_number_guard.json'
import a501B1 from '../../../../bench/results/heldout-501/b1_auto_pricing.json'
import a501B2 from '../../../../bench/results/heldout-501/b2_traps.json'
import a501B3 from '../../../../bench/results/heldout-501/b3_number_guard.json'
import a502B1 from '../../../../bench/results/heldout-502/b1_auto_pricing.json'
import a502B2 from '../../../../bench/results/heldout-502/b2_traps.json'
import a502B3 from '../../../../bench/results/heldout-502/b3_number_guard.json'

import laborFirst from '../../../../bench/results/labor-first/b5_labor.json'
import laborNow from '../../../../bench/results/b5_labor.json'
import labor503 from '../../../../bench/results/heldout-labor-503/b5_labor.json'
import labor504 from '../../../../bench/results/heldout-labor-504/b5_labor.json'
import b4a from '../../../../bench/results/b4-90200/b4_escalation.json'
import b4b from '../../../../bench/results/b4-90300/b4_escalation.json'
import b4c from '../../../../bench/results/b4-90400/b4_escalation.json'

export type TrapKind =
  | 'SPEC_MISMATCH'
  | 'UNIT_BASIS'
  | 'PRICE_OUTLIER'
  | 'QTY_MISMATCH'
  | 'ALTERNATIVE_PRODUCT'
  | 'NO_OFFER'
  | 'AMBIGUOUS'
  | 'ARITHMETIC'

export const TRAP_KINDS: ReadonlyArray<TrapKind> = [
  'SPEC_MISMATCH',
  'UNIT_BASIS',
  'PRICE_OUTLIER',
  'QTY_MISMATCH',
  'ALTERNATIVE_PRODUCT',
  'NO_OFFER',
  'AMBIGUOUS',
  'ARITHMETIC',
]

export interface MeasuredRun {
  /** Which of the five runs this is. */
  key: 'first' | 'unseen119' | 'unseen501' | 'unseen502' | 'now'
  /**
   * `unseen`: a tender nothing was changed on before it was scored.
   * `first`: the demo tender's first full run. `tuned`: the demo tender
   * after the prompt and the checks were changed while looking at it.
   */
  kind: 'first' | 'unseen' | 'tuned'
  /** The folder under `bench/results/` its three files are in. */
  folder: string
  seed: number
  date: string
  gitSha: string
  model: string
  calls: number
  fromCache: number
  usd: number
  seconds: number
  positions: number
  auto: number
  autoShare: number
  autoCorrect: number
  autoPrecision: number
  autoAtRightPrice: number
  euroError: number
  euroAuto: number
  traps: Record<TrapKind, { planted: number; caught: number }>
  trapsPlanted: number
  trapsCaught: number
  reviewExpected: number
  reviewFound: number
  reviewRaised: number
  queueRecall: number
  queuePrecision: number
  numbersChecked: number
  numbersFound: number
}

/** The parts of the three files the page reads. */
interface B1File {
  seed: number
  generatedAt: string
  gitSha: string
  models: { match: string }
  run: {
    calls: number
    answeredFromCache: number
    usd: number
    seconds: number
  }
  result: {
    positions: number
    auto: number
    autoShare: number
    autoCorrect: number
    autoPrecision: number
    autoAtRightPrice: number
    euroError: number
    euroAuto: number
  }
}
interface B2File {
  result: {
    traps: Record<TrapKind, { planted: number; caught: number }>
    trapsPlanted: number
    trapsCaught: number
    reviewExpected: number
    reviewFound: number
    reviewRaised: number
    queueRecall: number
    queuePrecision: number
  }
}
interface B3File {
  result: { checked: number; found: number }
}

function measured(
  key: MeasuredRun['key'],
  kind: MeasuredRun['kind'],
  folder: string,
  b1: B1File,
  b2: B2File,
  b3: B3File,
): MeasuredRun {
  return {
    key,
    kind,
    folder,
    seed: b1.seed,
    date: b1.generatedAt.slice(0, 10),
    gitSha: b1.gitSha,
    model: b1.models.match,
    calls: b1.run.calls,
    fromCache: b1.run.answeredFromCache,
    usd: b1.run.usd,
    seconds: b1.run.seconds,
    positions: b1.result.positions,
    auto: b1.result.auto,
    autoShare: b1.result.autoShare,
    autoCorrect: b1.result.autoCorrect,
    autoPrecision: b1.result.autoPrecision,
    autoAtRightPrice: b1.result.autoAtRightPrice,
    euroError: b1.result.euroError,
    euroAuto: b1.result.euroAuto,
    traps: b2.result.traps,
    trapsPlanted: b2.result.trapsPlanted,
    trapsCaught: b2.result.trapsCaught,
    reviewExpected: b2.result.reviewExpected,
    reviewFound: b2.result.reviewFound,
    reviewRaised: b2.result.reviewRaised,
    queueRecall: b2.result.queueRecall,
    queuePrecision: b2.result.queuePrecision,
    numbersChecked: b3.result.checked,
    numbersFound: b3.result.found,
  }
}

/**
 * The five runs as the page sets them out: the unseen tenders from the
 * newest back, then the first run they are measured against, and last the
 * demo tender as it is now, which the checks were changed on.
 */
export const RUNS: ReadonlyArray<MeasuredRun> = [
  measured('unseen502', 'unseen', 'heldout-502', a502B1, a502B2, a502B3),
  measured('unseen501', 'unseen', 'heldout-501', a501B1, a501B2, a501B3),
  measured('unseen119', 'unseen', 'heldout-119', a119B1, a119B2, a119B3),
  measured('first', 'first', 'baseline', firstB1, firstB2, firstB3),
  measured('now', 'tuned', '', nowB1, nowB2, nowB3),
]

/**
 * The run the page leads with: the newest tender nothing was changed on
 * before it was scored. Never the demo tender, which the checks were
 * changed against.
 */
export function headline(runs: ReadonlyArray<MeasuredRun> = RUNS): MeasuredRun {
  const newest = runs.find((run) => run.kind === 'unseen')
  if (newest === undefined) throw new Error('No unseen run is committed.')
  return newest
}

/** Where a run's files are, as a path in the repository. */
export const filesOf = (run: MeasuredRun): string =>
  `bench/results/${run.folder === '' ? '' : `${run.folder}/`}`

/** One labor pass, as B5 scored it. */
export interface LaborRun {
  key: 'laborFirst' | 'labor503' | 'laborNow' | 'labor504'
  /** As for the runs above: `unseen` was generated, read once and scored. */
  kind: 'first' | 'unseen' | 'tuned'
  /** The instructions it was read with: before or after the one change. */
  prompt: 1 | 2
  folder: string
  seed: number
  date: string
  gitSha: string
  calls: number
  fromCache: number
  usd: number
  positions: number
  settled: number
  settledRight: number
  wrongEntry: number
  review: number
  hoursTrue: number
  hoursError: number
}

interface B5File {
  seed: number
  generatedAt: string
  gitSha: string
  job: { calls: number; answeredFromCache: number; usd: number }
  result: {
    positions: number
    settled: number
    settledRight: number
    wrongEntry: number
    wrongNone: number
    review: number
    hoursTrue: number
    hoursError: number
  }
}

function laborRun(
  key: LaborRun['key'],
  kind: LaborRun['kind'],
  prompt: LaborRun['prompt'],
  folder: string,
  file: B5File,
): LaborRun {
  return {
    key,
    kind,
    prompt,
    folder,
    seed: file.seed,
    date: file.generatedAt.slice(0, 10),
    gitSha: file.gitSha,
    calls: file.job.calls,
    fromCache: file.job.answeredFromCache,
    usd: file.job.usd,
    positions: file.result.positions,
    settled: file.result.settled,
    settledRight: file.result.settledRight,
    wrongEntry: file.result.wrongEntry + file.result.wrongNone,
    review: file.result.review,
    hoursTrue: file.result.hoursTrue,
    hoursError: file.result.hoursError,
  }
}

/** The labor passes, set out like the runs: the unseen ones first, newest in front. */
export const LABOR_RUNS: ReadonlyArray<LaborRun> = [
  laborRun('labor504', 'unseen', 2, 'heldout-labor-504', labor504),
  laborRun('labor503', 'unseen', 1, 'heldout-labor-503', labor503),
  laborRun('laborFirst', 'first', 1, 'labor-first', laborFirst),
  laborRun('laborNow', 'tuned', 2, '', laborNow),
]

/** Where a labor pass's file is. */
export const laborFileOf = (run: LaborRun): string =>
  `bench/results/${run.folder === '' ? '' : `${run.folder}/`}b5_labor.json`

/**
 * B4: unseen tenders read by the matcher alone, and with the larger model
 * reading again what the matcher could not settle. Three runs of each,
 * pooled; cost and calls come from the runs that paid for the answers
 * (`cost` in each file), since a re-score from the cache costs nothing.
 */
const B4_RUNS = [
  { file: 'bench/results/b4-90200/b4_escalation.json', run: b4a },
  { file: 'bench/results/b4-90300/b4_escalation.json', run: b4b },
  { file: 'bench/results/b4-90400/b4_escalation.json', run: b4c },
]
const sum = (values: ReadonlyArray<number>) =>
  values.reduce((total, value) => total + value, 0)

function pooledSide(side: 'matcher' | 'escalation') {
  const arms = B4_RUNS.map(({ run }) => ({
    arm: run[side],
    paid: side === 'matcher' ? run.cost.matcher : run.cost.larger,
  }))
  const auto = sum(arms.map(({ arm }) => arm.auto))
  const review = sum(arms.map(({ arm }) => arm.review))
  return {
    review,
    auto,
    autoPrecision:
      sum(arms.map(({ arm }) => arm.autoPrecision * arm.auto)) / auto,
    euroError: sum(arms.map(({ arm }) => arm.euroError)),
    trapsCaught: sum(arms.map(({ arm }) => arm.trapsCaught)),
    trapsPlanted: sum(arms.map(({ arm }) => arm.trapsPlanted)),
    queuePrecision: sum(arms.map(({ arm }) => arm.reviewFound)) / review,
    usd: sum(arms.map(({ paid }) => paid.usd)),
    calls: sum(arms.map(({ paid }) => paid.calls)),
  }
}

export const ESCALATION = {
  seeds: B4_RUNS.map(({ run }) => run.seed),
  n: sum(B4_RUNS.map(({ run }) => run.n)),
  expectedReview: sum(B4_RUNS.map(({ run }) => run.expected.review)),
  files: B4_RUNS.map(({ file, run }) => ({
    file,
    gitSha: run.escalation.gitSha,
    date: run.generatedAt.slice(0, 10),
  })),
  model: b4a.escalation.models.escalation,
  questions: sum(
    B4_RUNS.map(({ run }) => run.escalation.run.escalation.questions),
  ),
  positions: sum(
    B4_RUNS.map(({ run }) => run.escalation.run.escalation.positions),
  ),
  sides: [pooledSide('matcher'), pooledSide('escalation')],
}
