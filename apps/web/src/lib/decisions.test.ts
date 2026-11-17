import { describe, expect, it } from 'vitest'
import { byOz, settleCounts, settleQueue, settleStatuses } from './decisions'
import type { Decided } from './decisions'

const decision = (oz: string, seq: number): Decided => ({
  oz,
  seq,
  offerId: 'c.1',
  supplierKey: 'c',
  unitPrice: 10,
  at: 0,
})

describe('decisions laid over a run', () => {
  const queue = [
    { oz: '01.01.0020', atRisk: 391.49 },
    { oz: '03.01.0010', atRisk: null },
    { oz: '04.04.0100', atRisk: 3101.37 },
  ]

  it('turns a decided window from red to priced, and no other', () => {
    const decided = byOz([decision('01.01.0020', 1)])
    expect(settleStatuses('arara', decided)).toBe('aaara')
    // A decision for a position the run priced by itself changes nothing.
    expect(settleStatuses('arara', byOz([decision('x', 0)]))).toBe('arara')
    expect(settleStatuses(null, decided)).toBeNull()
  })

  it('takes what is decided out of the queue', () => {
    const decided = byOz([decision('03.01.0010', 5)])
    expect(settleQueue(queue, decided).map((item) => item.oz)).toEqual([
      '01.01.0020',
      '04.04.0100',
    ])
    expect(settleQueue(queue, new Map())).toHaveLength(3)
  })

  it('moves the counts and what is at stake', () => {
    const run = { auto: 1078, review: 92, atRisk: 19621.76 }
    expect(
      settleCounts(
        run,
        queue,
        byOz([decision('01.01.0020', 1), decision('03.01.0010', 5)]),
      ),
    ).toEqual({ auto: 1080, review: 90, atRisk: 19230.27, decided: 2 })
    expect(settleCounts(run, queue, new Map())).toEqual({
      auto: 1078,
      review: 92,
      atRisk: 19621.76,
      decided: 0,
    })
  })

  it('ignores a decision about a position that is not in the queue', () => {
    const run = { auto: 10, review: 3, atRisk: 100 }
    expect(settleCounts(run, queue, byOz([decision('99.99.9999', 9)]))).toEqual(
      { auto: 10, review: 3, atRisk: 100, decided: 0 },
    )
  })
})
