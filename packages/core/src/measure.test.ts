import { describe, expect, it } from 'vitest'
import {
  canonicalUnit,
  compareValues,
  kindKey,
  parseMeasure,
  sameText,
  specSignature,
} from './measure'

describe('parseMeasure', () => {
  it('reads a number with its unit, in German notation', () => {
    expect(parseMeasure('250 A')).toEqual({ value: 250, unit: 'a' })
    expect(parseMeasure('138 kVA')).toEqual({ value: 138, unit: 'kva' })
    expect(parseMeasure('0,03A')).toEqual({ value: 0.03, unit: 'a' })
    expect(parseMeasure('30 mA')).toEqual({ value: 30, unit: 'ma' })
    expect(parseMeasure('1.250 mm')).toEqual({ value: 1250, unit: 'mm' })
    expect(parseMeasure('16 mm²')).toEqual({ value: 16, unit: 'mm2' })
    expect(parseMeasure('4000 K')).toEqual({ value: 4000, unit: 'k' })
  })

  it('reads a bare number', () => {
    expect(parseMeasure('3')).toEqual({ value: 3, unit: '' })
    expect(parseMeasure('2,5')).toEqual({ value: 2.5, unit: '' })
  })

  it('does not guess at text that is not one measure', () => {
    expect(parseMeasure('NYM-J')).toBeNull()
    expect(parseMeasure('5x16')).toBeNull()
    expect(parseMeasure('B16')).toBeNull()
    expect(parseMeasure('')).toBeNull()
  })
})

describe('compareValues', () => {
  it('finds the cabinet offered in kVA too small for the current asked for', () => {
    const result = compareValues('250 A', '138 kVA')
    expect(result.decidedBy).toBe('code')
    expect(result.agrees).toBe(false)
    // 138 kVA at 400 V three-phase is 199 A.
    expect(result.arithmetic).toBe('138 kVA / (√3 × 400 V) = 199 A')
    // Both on one scale, so the shortfall can be drawn.
    expect(result.scale?.asked).toBe(250)
    expect(result.scale?.offered).toBeCloseTo(199.2, 1)
    expect(result.scale?.unit).toBe('A')
  })

  it('puts two measures of one kind on the scale of the one asked for', () => {
    expect(compareValues('1.800 lm', '900 lm').scale).toEqual({
      asked: 1800,
      offered: 900,
      unit: 'lm',
    })
    expect(compareValues('30 mA', '0,3 A').scale).toEqual({
      asked: 30,
      offered: 300,
      unit: 'mA',
    })
    expect(compareValues('NYM-J', 'NYY-J').scale).toBeUndefined()
  })

  it('accepts a cabinet whose kVA rating covers the current', () => {
    // 173 kVA is 250 A; a rating is rounded, so it counts as the same.
    expect(compareValues('250 A', '173 kVA')).toMatchObject({
      agrees: true,
      decidedBy: 'code',
    })
  })

  it('converts within a dimension before comparing', () => {
    expect(compareValues('30 mA', '0,03 A')).toMatchObject({ agrees: true })
    expect(compareValues('6 kA', '6000 A')).toMatchObject({ agrees: true })
    expect(compareValues('300 mA', '0,03A')).toMatchObject({ agrees: false })
    expect(compareValues('1.200 mm', '1,2 m')).toMatchObject({ agrees: true })
    expect(compareValues('0,3 kW', '300 W')).toMatchObject({ agrees: true })
  })

  it('compares bare numbers and numbers with the same unit', () => {
    expect(compareValues('3', '3')).toMatchObject({ agrees: true })
    expect(compareValues('4000 K', '3000 K')).toMatchObject({ agrees: false })
    expect(compareValues('16 A', '16')).toMatchObject({ agrees: true })
  })

  it('does not take a code for a measurement', () => {
    // A lamp marked 830 has a colour temperature of 3000 K. That is for
    // whoever knows lamps to say, not for arithmetic.
    expect(compareValues('3000 K', '830').decidedBy).toBe('model')
    expect(compareValues('4000 K', '840').decidedBy).toBe('model')
  })

  it('compares codes as text, whatever their spacing and case', () => {
    expect(compareValues('5x16', '5X16')).toMatchObject({
      agrees: true,
      decidedBy: 'code',
    })
    expect(compareValues('IP 44', 'IP44')).toMatchObject({ agrees: true })
    expect(compareValues('3×1,5', '3x1,5')).toMatchObject({ agrees: true })
  })

  it('leaves it to the reader of the text where it cannot tell', () => {
    // Different wordings of what may be the same thing: not for code to say.
    expect(compareValues('4-polig', '4p').decidedBy).toBe('model')
    expect(compareValues('Aufputz', 'AP').decidedBy).toBe('model')
    // Units of different kinds are never the same measure.
    expect(compareValues('16 A', '16 mm²')).toMatchObject({
      agrees: false,
      decidedBy: 'code',
    })
  })
})

describe('sameText', () => {
  it('ignores case, spacing and the multiplication sign', () => {
    expect(sameText('NYM-J 3x1,5', 'nym-j 3×1,5')).toBe(true)
    expect(sameText('NYM-J', 'NYY-J')).toBe(false)
  })
})

describe('canonicalUnit', () => {
  it('maps the ways suppliers write pieces and metres', () => {
    for (const raw of ['ST', 'St', 'Stck', 'Stk', 'Stück', 'stk.']) {
      expect(canonicalUnit(raw), raw).toEqual({ unit: 'St', pack: false })
    }
    for (const raw of ['M', 'm', 'Mtr', 'lfm', 'mtr.']) {
      expect(canonicalUnit(raw), raw).toEqual({ unit: 'm', pack: false })
    }
  })

  it('knows a pack or a ring is not a unit of the tender', () => {
    for (const raw of [
      'VE',
      'RG',
      'Ring',
      'Pack',
      'PK',
      'Bund',
      'BD',
      'Rolle',
      'KTN',
    ]) {
      expect(canonicalUnit(raw).pack, raw).toBe(true)
    }
  })

  it('keeps a unit it does not know as written', () => {
    expect(canonicalUnit('psch')).toEqual({ unit: 'psch', pack: false })
    expect(canonicalUnit('kg')).toEqual({ unit: 'kg', pack: false })
    expect(canonicalUnit(null)).toEqual({ unit: '', pack: false })
  })
})

describe('specSignature and kindKey', () => {
  const light = (rating: string, end = 'liefern und montieren.') =>
    `LED-Downlight als Deckeneinbauleuchte, Deckenausschnitt Ø 200 mm, Systemleistung 26 W, Leuchtenlichtstrom 2.600 lm, Farbtemperatur 3000 K, Farbwiedergabe Ra > 80, Schutzart ${rating}, ${end}`

  it('reads the measures and codes a text states, however they are spaced', () => {
    expect(specSignature(light('IP 44'))).toBe(specSignature(light('IP44')))
    expect(specSignature(light('IP 44'))).toContain('ip44')
    expect(specSignature(light('IP 44'))).toContain('26w')
    expect(specSignature('NYM-J 3x1,5 mm², B16, 1-polig')).toContain('3x1,5mm2')
  })

  it('tells two ratings apart', () => {
    expect(specSignature(light('IP 20'))).not.toBe(
      specSignature(light('IP 44')),
    )
  })

  it('does not count where the thing is installed, or how the text ends', () => {
    expect(
      specSignature(
        light(
          'IP 20',
          'einschließlich Lieferung.\nEinbauort: 2. Obergeschoss.',
        ),
      ),
    ).toBe(specSignature(light('IP 20')))
  })

  it('gives positions that ask for the same thing one key', () => {
    const at = (longText: string) =>
      kindKey({ shortText: 'LED-Downlight, 26 W', longText, unit: 'St' })
    expect(at(light('IP20'))).toBe(at(light('IP 20', 'liefern.')))
    expect(at(light('IP 20'))).not.toBe(at(light('IP 44')))
    expect(
      kindKey({ shortText: 'Kabel', longText: 'Kabel 3x1,5', unit: 'm' }),
    ).not.toBe(
      kindKey({ shortText: 'Kabel', longText: 'Kabel 3x1,5', unit: 'St' }),
    )
  })
})
