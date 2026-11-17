/**
 * Scores what the pipeline decided against the ground truth.
 *
 * B1 asks whether the split is right and whether the part priced without a
 * person is priced correctly. B2 asks whether each planted trap was found on
 * the line it was planted on, and whether the review queue holds what it
 * should.
 */
import { REASON_CODES } from '@preisspiegel/core'
import type { Assessed, Decision, ReasonCode } from '@preisspiegel/core'
import type { Truth } from '../../data/src/truth'

export type Result = Assessed & { decision: Decision }

export interface Score {
  b1: {
    positions: number
    /** Positions the pipeline priced without asking. */
    auto: number
    autoShare: number
    /** Of those, the ones the truth also prices without asking. */
    autoCorrect: number
    autoPrecision: number
    /** Of those, the ones priced at the truth's price, to the cent. */
    autoAtRightPrice: number
    /** Sum of the absolute differences in material value, over auto positions. */
    euroError: number
    /** Material value of all auto positions, for scale. */
    euroAuto: number
  }
  b2: {
    /** Planted traps found on their line, by kind. */
    traps: Record<ReasonCode, { planted: number; caught: number }>
    trapsPlanted: number
    trapsCaught: number
    /** Positions the truth sends to review, and how many of them the pipeline did. */
    reviewExpected: number
    reviewFound: number
    /**
     * Of those found, the ones raised for at least one reason the truth
     * gives. A review raised for the wrong reason sends the estimator to the
     * wrong offer, so `reviewFound` alone flatters.
     */
    reviewFoundForReason: number
    queueRecall: number
    /** Positions the pipeline sent to review, and how many of them belong there. */
    reviewRaised: number
    queuePrecision: number
  }
  /** Positions where pipeline and truth disagree, for a write-up. */
  disagreements: Array<{
    oz: string
    expected: 'auto' | 'review'
    got: 'auto' | 'review'
    expectedReasons: Array<string>
    gotReasons: Array<string>
  }>
}

const share = (part: number, whole: number) =>
  whole === 0 ? 1 : Math.round((part / whole) * 10000) / 10000
const cents = (value: number) => Math.round(value * 100) / 100

export function score(results: ReadonlyArray<Result>, truth: Truth): Score {
  const byOz = new Map(results.map((result) => [result.position.oz, result]))
  const expected = new Map(truth.positions.map((entry) => [entry.oz, entry]))

  let auto = 0
  let autoCorrect = 0
  let autoAtRightPrice = 0
  let euroError = 0
  let euroAuto = 0
  let reviewFound = 0
  let reviewFoundForReason = 0
  let reviewRaised = 0
  let reviewRaisedRight = 0
  const disagreements: Score['disagreements'] = []

  for (const result of results) {
    const want = expected.get(result.position.oz)
    if (want === undefined) continue
    const got = result.decision
    if (got.status === 'auto') {
      auto++
      const price = got.best?.unitPrice ?? 0
      euroAuto += result.position.qty * price
      if (want.expected.decision === 'auto') {
        autoCorrect++
        const right = want.expected.bestUnitPrice ?? 0
        if (Math.abs(right - price) < 0.005) autoAtRightPrice++
        euroError += Math.abs(result.position.qty * (right - price))
      } else {
        // Priced without asking where a person should have looked: the whole
        // amount rests on an offer that was not clean.
        euroError += Math.abs(
          result.position.qty * (price - (want.expected.bestUnitPrice ?? 0)),
        )
      }
    } else {
      reviewRaised++
      if (want.expected.decision === 'review') reviewRaisedRight++
    }
    if (want.expected.decision === 'review' && got.status === 'review') {
      reviewFound++
      if (
        got.reasons.some((reason) => want.expected.reasons.includes(reason))
      ) {
        reviewFoundForReason++
      }
    }
    if (want.expected.decision !== got.status) {
      disagreements.push({
        oz: result.position.oz,
        expected: want.expected.decision,
        got: got.status,
        expectedReasons: want.expected.reasons,
        gotReasons: got.reasons,
      })
    }
  }

  const traps = Object.fromEntries(
    REASON_CODES.map((code) => [code, { planted: 0, caught: 0 }]),
  ) as Score['b2']['traps']
  for (const trap of truth.traps) {
    traps[trap.kind].planted++
    const found = trap.positions.some((oz) => {
      const result = byOz.get(oz)
      if (result === undefined) return false
      if (trap.supplier === null || trap.seq === null) {
        return result.decision.reasons.includes('NO_OFFER')
      }
      return result.offers.some(
        (offer) =>
          offer.id === `${trap.supplier}.${trap.seq}` &&
          offer.findings.some((finding) => finding.code === trap.kind),
      )
    })
    if (found) traps[trap.kind].caught++
  }
  const trapsPlanted = truth.traps.length
  const trapsCaught = Object.values(traps).reduce(
    (sum, entry) => sum + entry.caught,
    0,
  )
  const reviewExpected = truth.summary.expectedReview

  return {
    b1: {
      positions: results.length,
      auto,
      autoShare: share(auto, results.length),
      autoCorrect,
      autoPrecision: share(autoCorrect, auto),
      autoAtRightPrice,
      euroError: cents(euroError),
      euroAuto: cents(euroAuto),
    },
    b2: {
      traps,
      trapsPlanted,
      trapsCaught,
      reviewExpected,
      reviewFound,
      reviewFoundForReason,
      queueRecall: share(reviewFound, reviewExpected),
      reviewRaised,
      queuePrecision: share(reviewRaisedRight, reviewRaised),
    },
    disagreements,
  }
}
