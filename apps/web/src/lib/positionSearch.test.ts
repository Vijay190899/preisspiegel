import { describe, expect, it } from 'vitest'
import { filterPositions, searchPositions } from './positionSearch'
import type { PositionRow } from './queries'

const row = (oz: string, shortText: string): PositionRow => {
  const [title = '', subtitle = ''] = oz.split('.')
  return {
    oz,
    seq: 0,
    shortText,
    qty: 1,
    unit: 'St',
    path: [
      { rno: title, label: `Titel ${title}` },
      { rno: subtitle, label: `Untertitel ${subtitle}` },
    ],
  }
}

const rows = [
  row('01.01.0020', 'Anschlussverteilerschrank 250 A für Baustrom'),
  row('03.02.0040', 'Leitungsschutzschalter B16, 1-polig'),
  row('03.02.0050', 'Leitungsschutzschalter B16, 3-polig'),
  row('04.03.0010', 'Mantelleitung NYM-J 3x1,5 mm²'),
  row('07.01.0030', 'LED-Downlight, 18 W, 1.800 lm, 3000 K'),
]

describe('searchPositions', () => {
  it('finds a position by the start of its ordinal number', () => {
    expect(searchPositions(rows, '03.02', 8).map((r) => r.oz)).toEqual([
      '03.02.0040',
      '03.02.0050',
    ])
  })

  it('accepts an ordinal number typed without its dots', () => {
    expect(searchPositions(rows, '0101', 8).map((r) => r.oz)).toEqual([
      '01.01.0020',
    ])
  })

  it('finds positions whose text has every word, in any order', () => {
    expect(
      searchPositions(rows, '3-polig leitungsschutz', 8).map((r) => r.oz),
    ).toEqual(['03.02.0050'])
  })

  it('lists ordinal-number matches before text matches', () => {
    // "18" opens no ordinal number here, but "07" does and "18 W" is text.
    const result = searchPositions(
      [row('18.01.0010', 'Stundenlohn'), ...rows],
      '18',
      8,
    )
    expect(result.map((r) => r.oz)).toEqual(['18.01.0010', '07.01.0030'])
  })

  it('returns the first positions for an empty query, up to the limit', () => {
    expect(searchPositions(rows, '  ', 2)).toHaveLength(2)
  })

  it('returns nothing when nothing matches', () => {
    expect(searchPositions(rows, 'wärmepumpe', 8)).toEqual([])
  })
})

describe('filterPositions', () => {
  it('keeps one title when asked to', () => {
    expect(filterPositions(rows, '', '03').map((r) => r.oz)).toEqual([
      '03.02.0040',
      '03.02.0050',
    ])
  })

  it('combines the title with the words of the query', () => {
    expect(filterPositions(rows, '1-polig', '03').map((r) => r.oz)).toEqual([
      '03.02.0040',
    ])
  })

  it('matches against the ordinal number as well as the text', () => {
    expect(filterPositions(rows, '04.03', undefined)).toHaveLength(1)
  })
})
