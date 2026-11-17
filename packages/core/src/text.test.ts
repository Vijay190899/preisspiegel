import { describe, expect, it } from 'vitest'
import { containsQuote, searchTerms, squash } from './text'

describe('squash', () => {
  it('makes every run of white space one space', () => {
    expect(squash('  NYM-J \n 3x1,5 mm²  ')).toBe('NYM-J 3x1,5 mm²')
  })

  it('evens out dashes and quotation marks', () => {
    expect(squash('Lumfeld „ROTO“ – 18 W')).toBe('Lumfeld "ROTO" - 18 W')
  })
})

describe('containsQuote', () => {
  const source =
    'Bemessungsstrom 250 A,\nSchutzart IP 44, liefern und aufstellen.'

  it('finds a quote whatever its case and spacing', () => {
    expect(containsQuote(source, 'bemessungsstrom  250 A')).toBe(true)
    expect(containsQuote(source, 'A, Schutzart IP 44')).toBe(true)
  })

  it('does not accept a paraphrase, a correction or nothing at all', () => {
    expect(containsQuote(source, 'Nennstrom 250 A')).toBe(false)
    expect(containsQuote(source, 'Schutzart IP44')).toBe(false)
    expect(containsQuote(source, '   ')).toBe(false)
  })
})

describe('searchTerms', () => {
  it('gives words, numbers and the pieces of longer words', () => {
    const terms = searchTerms('Leitungsschutzschalter B16, 1-polig')
    expect(terms).toEqual(
      expect.arrayContaining([
        'leitungsschutzschalter',
        'b',
        '16',
        '1',
        'polig',
      ]),
    )
    // The piece a wholesaler's "LS-Schalter" shares with it.
    expect(terms).toContain('#scha')
    expect(searchTerms('LS-Schalter B16 1p')).toContain('#scha')
  })

  it('reads a cross-section the same however it is written', () => {
    expect(searchTerms('3×1,5 mm²')).toEqual(
      expect.arrayContaining(['3', 'x', '1,5', 'mm', '2']),
    )
    expect(searchTerms('3X1,5')).toEqual(
      expect.arrayContaining(['3', 'x', '1,5']),
    )
  })
})
