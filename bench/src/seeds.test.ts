import { describe, expect, it } from 'vitest'
import { summary, sweep } from './seeds'

/**
 * The search and the attribution were twice found to fit the tenders they
 * had been worked on and to fail on others. These twenty are from the range
 * the second audit used to show it. No model is called: the questions are
 * built and a perfect reader's decisions are compared with what the
 * generator planted. The rate over tenders nobody has looked at is in
 * docs/DATA.md; this only keeps what was reached.
 */
describe('the checks on tenders they were not set on', () => {
  it('agree with the ground truth on twenty of them, with flawless reading', async () => {
    const seeds = Array.from({ length: 20 }, (_, at) => 3000 + at)
    const { rows, failed } = await sweep(seeds)
    expect(failed).toEqual([])
    expect(summary(rows)).toMatchObject({
      tenders: 20,
      agreeing: 20,
      offersLost: 0,
      positionsPricedWrongly: 0,
      needlessReviews: 0,
    })
  }, 120_000)
})
