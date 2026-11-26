import { describe, expect, it } from 'vitest'
import { planEscalation, unsettled } from './escalation'
import type { ReadOutcome } from './escalation'

const row = (
  seq: number,
  key: string,
  verdicts: Array<'confirmed' | 'mismatch' | 'unrelated' | 'unconfirmed'>,
  source: ReadOutcome['source'] = 'model',
  by: 'model' | 'code' = 'model',
): ReadOutcome => ({
  seq,
  key,
  source,
  judgements: verdicts.map((verdict) => ({ verdict, by })),
})

describe('what the matcher left unsettled', () => {
  it('is a line the model left unconfirmed, or a call that failed', () => {
    expect(unsettled(row(0, 'a', ['confirmed', 'unconfirmed']))).toBe(true)
    expect(unsettled(row(0, 'a', [], 'failed'))).toBe(true)
    expect(unsettled(row(0, 'a', ['confirmed', 'mismatch', 'unrelated']))).toBe(
      false,
    )
  })

  it('is never a position code settled, or one already read again', () => {
    expect(unsettled(row(0, 'a', ['unconfirmed'], 'code'))).toBe(false)
    expect(unsettled(row(0, 'a', ['unconfirmed'], 'escalated'))).toBe(false)
    expect(unsettled(row(0, 'a', ['unconfirmed'], 'cache', 'code'))).toBe(false)
  })
})

describe('the questions asked again', () => {
  const rows = [
    row(0, 'a', ['unconfirmed']),
    row(1, 'b', ['confirmed']),
    row(2, 'a', ['unconfirmed']),
    row(3, 'c', [], 'failed'),
    ...Array.from({ length: 16 }, (_, at) =>
      row(4 + at, `x${at}`, ['confirmed']),
    ),
  ]

  it('asks a question once, for every position that shares it', () => {
    expect(planEscalation(rows)).toEqual({
      items: [
        { key: 'a', seqs: [0, 2] },
        { key: 'c', seqs: [3] },
      ],
      unsettled: 3,
      capped: 0,
    })
  })

  it('stops at its share of the tender and says how many it left out', () => {
    // 20 positions at a share of 0.1: room for two.
    const plan = planEscalation(rows, 0.1)
    expect(plan.items).toEqual([{ key: 'a', seqs: [0, 2] }])
    expect(plan.capped).toBe(1)
  })

  it('is empty when the matcher settled everything', () => {
    expect(planEscalation(rows.filter((r) => r.key.startsWith('x')))).toEqual({
      items: [],
      unsettled: 0,
      capped: 0,
    })
  })
})
