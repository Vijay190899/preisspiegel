import { describe, expect, it } from 'vitest'
import { perfectProposal, scoreLabor } from './labor'
import type { LaborEntry, Position } from '@preisspiegel/core'
import type { Truth } from '../../data/src/truth'

const TABLE: Array<LaborEntry> = [
  {
    key: 'cable.s',
    label: 'Leitung bis 2,5 mm² verlegen',
    unit: 'm',
    minutes: 2.5,
  },
  {
    key: 'cable.l',
    label: 'Kabel 10 bis 16 mm² verlegen',
    unit: 'm',
    minutes: 5,
  },
  {
    key: 'device',
    label: 'Installationsgerät einbauen',
    unit: 'St',
    minutes: 12,
  },
  { key: 'device.box', label: 'Dose setzen', unit: 'St', minutes: 6 },
]

const position = (
  oz: string,
  qty: number,
  unit: string,
  shortText: string,
): Position => ({
  oz,
  seq: 0,
  path: [],
  shortText,
  longText: shortText,
  qty,
  unit,
  gaebId: oz,
})

const POSITIONS = [
  position('01', 120, 'm', 'Kabel NYY-J 5x16 mm²'),
  position('02', 10, 'St', 'SCHUKO-Steckdose 16 A'),
  position('03', 4, 'St', 'Abzweigdose'),
  position('04', 8, 'h', 'Stundenlohnarbeiten Monteur'),
]

const truth = {
  positions: [
    { oz: '01', laborKey: 'cable.l' },
    { oz: '02', laborKey: 'device' },
    { oz: '03', laborKey: 'device.box' },
    { oz: '04', laborKey: null },
  ],
} as unknown as Truth

describe('scoreLabor', () => {
  it('counts right, wrong and open positions, and the hours they carry', () => {
    const score = scoreLabor(
      POSITIONS,
      truth,
      [
        {
          oz: '01',
          status: 'set',
          entryKey: 'cable.l',
          minutes: 5,
          reason: null,
        },
        // A socket timed as a box: wrong, and 6 min short on each of 10.
        {
          oz: '02',
          status: 'set',
          entryKey: 'device.box',
          minutes: 6,
          reason: null,
        },
        {
          oz: '03',
          status: 'review',
          entryKey: 'device.box',
          minutes: null,
          reason: 'limit',
        },
        {
          oz: '04',
          status: 'none',
          entryKey: null,
          minutes: null,
          reason: null,
        },
      ],
      TABLE,
    )
    expect(score).toMatchObject({
      positions: 4,
      settled: 3,
      settledRight: 2,
      wrongEntry: 1,
      wrongMinutes: 1,
      wrongNone: 0,
      review: 1,
      reviewReasons: { limit: 1 },
      hoursTrue: 12,
      hoursDecided: 11,
      hoursError: 1,
    })
    expect(score.settledPrecision).toBeCloseTo(2 / 3, 4)
  })

  it('counts a position nobody decided as open', () => {
    expect(scoreLabor(POSITIONS, truth, [], TABLE)).toMatchObject({
      settled: 0,
      review: 4,
      reviewReasons: { unread: 4 },
      settledPrecision: 1,
    })
  })

  it('calls own work given an entry wrong, and timed work given none wrong', () => {
    const score = scoreLabor(
      POSITIONS.slice(2),
      truth,
      [
        {
          oz: '03',
          status: 'none',
          entryKey: null,
          minutes: null,
          reason: null,
        },
        {
          oz: '04',
          status: 'set',
          entryKey: 'device',
          minutes: 12,
          reason: null,
        },
      ],
      TABLE,
    )
    expect(score.wrongNone).toBe(2)
    expect(score.settledRight).toBe(0)
  })
})

describe('perfectProposal', () => {
  it('quotes the text that states the size an entry is limited by', () => {
    expect(perfectProposal(POSITIONS[0]!, 'cable.l', TABLE)).toEqual({
      entry: 'cable.l',
      quote: 'Kabel NYY-J 5x16 mm²',
      limitQuote: 'Kabel NYY-J 5x16 mm²',
    })
    expect(
      perfectProposal(POSITIONS[1]!, 'device', TABLE).limitQuote,
    ).toBeNull()
  })
})
