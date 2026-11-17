import { describe, expect, it } from 'vitest'
import { findingText } from './findings'
import type { Translate } from './i18n'

/** A stand-in for the dictionary: the key, then the values it was given. */
const t: Translate = (key, values) =>
  `${key}${values === undefined ? '' : ` ${JSON.stringify(values)}`}`

describe('findingText', () => {
  it('says what was specified and what was offered, with the arithmetic', () => {
    expect(
      findingText(t, {
        code: 'SPEC_MISMATCH',
        detail: {
          attribute: 'Bemessungsstrom',
          tender: '250 A',
          offer: '138 kVA',
          arithmetic: '138 kVA / (√3 × 400 V) = 199 A',
        },
      }),
    ).toEqual({
      text: 'finding.SPEC_MISMATCH {"attribute":"Bemessungsstrom","tender":"250 A","offer":"138 kVA"}',
      arithmetic: '138 kVA / (√3 × 400 V) = 199 A',
    })
  })

  it('has its own words for a difference that could not be checked', () => {
    expect(
      findingText(t, { code: 'SPEC_MISMATCH', detail: { unconfirmed: 1 } }),
    ).toEqual({ text: 'finding.SPEC_MISMATCH.unconfirmed' })
    expect(
      findingText(t, { code: 'AMBIGUOUS', detail: { unconfirmed: 1 } }),
    ).toEqual({ text: 'finding.AMBIGUOUS.unconfirmed' })
  })

  it('writes amounts and quantities the German way', () => {
    expect(
      findingText(t, {
        code: 'ARITHMETIC',
        detail: { expected: 1234.5, printed: 1357.95 },
      }).text,
    ).toBe('finding.ARITHMETIC {"expected":"1.234,50","printed":"1.357,95"}')
    expect(
      findingText(t, {
        code: 'QTY_MISMATCH',
        detail: { asked: 1250, offered: 125 },
      }).text,
    ).toBe('finding.QTY_MISMATCH {"asked":"1.250","offered":"125"}')
  })

  it('names the units as the tender writes them', () => {
    expect(
      findingText(t, {
        code: 'UNIT_BASIS',
        detail: { lineUnit: 'RG', tenderUnit: 'm' },
      }).text,
    ).toBe('finding.UNIT_BASIS {"lineUnit":"RG","tenderUnit":"m"}')
  })
})
