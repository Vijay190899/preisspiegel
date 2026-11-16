import { describe, expect, it } from 'vitest'
import { formatGermanNumber, parseGermanNumber, roundCents } from './numbers'

describe('parseGermanNumber', () => {
  it('reads a comma decimal and dot thousands separators', () => {
    expect(parseGermanNumber('1.234,56')).toBe(1234.56)
    expect(parseGermanNumber('12.345.678,9')).toBe(12345678.9)
    expect(parseGermanNumber('89,50')).toBe(89.5)
    expect(parseGermanNumber('120')).toBe(120)
  })

  it('ignores a currency or percent sign and surrounding space', () => {
    expect(parseGermanNumber(' 4,85 € ')).toBe(4.85)
    expect(parseGermanNumber('1.250,00 EUR')).toBe(1250)
    expect(parseGermanNumber('32,5 %')).toBe(32.5)
  })

  it('returns null instead of guessing', () => {
    expect(parseGermanNumber('')).toBeNull()
    expect(parseGermanNumber('auf Anfrage')).toBeNull()
    expect(parseGermanNumber('1,234.56')).toBeNull()
    expect(parseGermanNumber('12.34')).toBeNull()
    expect(parseGermanNumber('5x16')).toBeNull()
  })
})

describe('formatGermanNumber', () => {
  it('writes what parseGermanNumber reads', () => {
    for (const value of [0, 4.85, 89.5, 1234.56, 1250, 12345678.9]) {
      expect(parseGermanNumber(formatGermanNumber(value))).toBe(value)
    }
  })

  it('groups thousands and fixes the decimals', () => {
    expect(formatGermanNumber(1234.5)).toBe('1.234,50')
    expect(formatGermanNumber(120, 3)).toBe('120,000')
    expect(formatGermanNumber(1250, 0)).toBe('1.250')
    expect(formatGermanNumber(-12.5)).toBe('-12,50')
  })
})

describe('roundCents', () => {
  it('rounds half up at the third decimal', () => {
    expect(roundCents(1.005)).toBe(1.01)
    expect(roundCents(116.39999999)).toBe(116.4)
  })
})
