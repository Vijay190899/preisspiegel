import { describe, expect, it } from 'vitest'
import {
  assessLabor,
  entryLimit,
  laborCost,
  laborHours,
  statedSize,
  within,
} from './labor'
import { containsWhole } from './text'
import type { LaborEntry } from './labor'

const TABLE: Array<LaborEntry> = [
  {
    key: 'mcb.1p',
    label: 'Leitungsschutzschalter 1-polig einbauen',
    unit: 'St',
    minutes: 6,
  },
  {
    key: 'mcb.3p',
    label: 'Leitungsschutzschalter 3-polig einbauen',
    unit: 'St',
    minutes: 12,
  },
  {
    key: 'mccb.small',
    label: 'Leistungsschalter bis 250 A einbauen',
    unit: 'St',
    minutes: 60,
  },
  {
    key: 'mccb.large',
    label: 'Leistungsschalter über 250 A einbauen',
    unit: 'St',
    minutes: 120,
  },
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
    key: 'cable.xxxl',
    label: 'Kabel ab 120 mm² verlegen',
    unit: 'm',
    minutes: 16,
  },
  {
    key: 'tray.s',
    label: 'Kabelrinne bis 200 mm montieren',
    unit: 'm',
    minutes: 12,
  },
  {
    key: 'luminaire',
    label: 'Leuchte montieren und anschließen',
    unit: 'St',
    minutes: 25,
  },
]

const cable = {
  shortText: 'Starkstromkabel NYY-J 5x16 mm²',
  longText:
    'Starkstromkabel NYY-J 5x16 mm² nach DIN VDE 0276-603, auf vorhandener Kabelrinne verlegen.',
  unit: 'm',
}

describe('entryLimit', () => {
  it('reads what a label covers', () => {
    expect(entryLimit('Kabel 10 bis 16 mm² verlegen')).toMatchObject({
      unit: 'mm²',
      min: 10,
      max: 16,
    })
    expect(entryLimit('Leitung bis 2,5 mm² verlegen')).toMatchObject({
      unit: 'mm²',
      min: null,
      max: 2.5,
    })
    expect(entryLimit('Leistungsschalter über 250 A einbauen')).toMatchObject({
      unit: 'A',
      min: 250,
      max: null,
      minExclusive: true,
    })
    expect(entryLimit('Kabel ab 120 mm² verlegen')).toMatchObject({
      min: 120,
      minExclusive: false,
    })
    expect(entryLimit('Kabelrinne bis 200 mm montieren')?.unit).toBe('mm')
    expect(entryLimit('Leitungsschutzschalter 3-polig einbauen')).toMatchObject(
      { unit: 'polig', min: 3, max: 3 },
    )
  })

  it('finds none where the label states none', () => {
    for (const label of [
      'Leuchte montieren und anschließen',
      'Erder oder Ableitung verlegen',
      'Fangstange oder Anschlussfahne setzen',
      'Verteiler ab Werk verdrahtet aufstellen',
    ]) {
      expect(entryLimit(label)).toBeNull()
    }
  })
})

describe('statedSize', () => {
  it('reads the cross-section, not the number of cores', () => {
    expect(statedSize('NYY-J 5x16 mm²', 'mm²')).toBe(16)
    expect(statedSize('NYM-J 3 x 2,5 mm²', 'mm²')).toBe(2.5)
    expect(statedSize('H07V-K 1x25 mm²', 'mm²')).toBe(25)
  })

  it('keeps millimetres and square millimetres apart', () => {
    expect(statedSize('Breite 200 mm', 'mm')).toBe(200)
    expect(statedSize('5x16 mm²', 'mm')).toBeNull()
    expect(statedSize('Breite 200 mm', 'mm²')).toBeNull()
  })

  it('reads amperes and poles', () => {
    expect(statedSize('Bemessungsstrom 250 A', 'A')).toBe(250)
    expect(statedSize('B16, 3-polig', 'polig')).toBe(3)
    expect(statedSize('4pol', 'polig')).toBe(4)
    expect(statedSize('30 mA', 'A')).toBeNull()
  })

  it('gives nothing where two sizes are stated', () => {
    expect(statedSize('5x16 mm² oder 5x25 mm²', 'mm²')).toBeNull()
    expect(statedSize('5x16 mm² und 5x16 mm²', 'mm²')).toBe(16)
  })
})

describe('within', () => {
  it('treats "bis" and "ab" as inclusive and "über" as not', () => {
    const upTo = entryLimit('Leistungsschalter bis 250 A einbauen')
    const over = entryLimit('Leistungsschalter über 250 A einbauen')
    if (upTo === null || over === null) throw new Error('no limit')
    expect(within(upTo, 250)).toBe(true)
    expect(within(over, 250)).toBe(false)
    expect(within(over, 400)).toBe(true)
    expect(within(upTo, 400)).toBe(false)
  })
})

describe('containsWhole', () => {
  it('needs the quote at word boundaries', () => {
    expect(containsWhole('Bemessungsstrom 250 A', '250 A')).toBe(true)
    expect(containsWhole('Bemessungsstrom 250 A', '50 A')).toBe(false)
    expect(containsWhole('NYM-J 3x1,5 (100 m/Ring)', '10')).toBe(false)
    expect(containsWhole('NYM-J 3x1,5 (100 m/Ring)', '(100 m/Ring)')).toBe(true)
    expect(containsWhole('Leitungsschutzschalter B16', 'schalter B16')).toBe(
      false,
    )
    expect(containsWhole('LED-Downlight,  18 W', 'led-downlight, 18 w')).toBe(
      true,
    )
    expect(containsWhole('anything', '')).toBe(false)
  })
})

describe('assessLabor', () => {
  it('takes an entry whose limit the position meets', () => {
    expect(
      assessLabor(
        cable,
        {
          entry: 'cable.l',
          quote: 'Starkstromkabel NYY-J',
          limitQuote: '5x16 mm²',
        },
        TABLE,
      ),
    ).toMatchObject({ status: 'set', entry: { key: 'cable.l', minutes: 5 } })
  })

  it('refuses a cable timed as a thinner one, and says why', () => {
    const outcome = assessLabor(
      cable,
      {
        entry: 'cable.s',
        quote: 'Starkstromkabel NYY-J',
        limitQuote: '5x16 mm²',
      },
      TABLE,
    )
    expect(outcome).toMatchObject({
      status: 'review',
      reason: 'limit',
      detail: '16 mm² is not "bis 2,5 mm²".',
    })
  })

  it('does not take a size the model states but the position does not', () => {
    expect(
      assessLabor(
        cable,
        {
          entry: 'cable.s',
          quote: 'Starkstromkabel NYY-J',
          limitQuote: '5x2,5 mm²',
        },
        TABLE,
      ),
    ).toMatchObject({ status: 'review', reason: 'quote' })
    expect(
      assessLabor(
        {
          ...cable,
          shortText: 'Starkstromkabel',
          longText: 'Kabel nach Plan.',
        },
        { entry: 'cable.l', quote: 'Starkstromkabel', limitQuote: null },
        TABLE,
      ),
    ).toMatchObject({ status: 'review', reason: 'limit_unstated' })
    expect(
      assessLabor(
        cable,
        {
          entry: 'cable.l',
          quote: 'Starkstromkabel NYY-J',
          limitQuote: 'DIN VDE 0276-603',
        },
        TABLE,
      ),
    ).toMatchObject({ status: 'review', reason: 'limit_unstated' })
  })

  it('reads the size from the position itself where no words were quoted', () => {
    expect(
      assessLabor(
        cable,
        { entry: 'cable.l', quote: 'Starkstromkabel NYY-J', limitQuote: null },
        TABLE,
      ),
    ).toMatchObject({ status: 'set', limitQuote: cable.shortText })
    expect(
      assessLabor(
        cable,
        { entry: 'cable.s', quote: 'Starkstromkabel NYY-J', limitQuote: null },
        TABLE,
      ),
    ).toMatchObject({ status: 'review', reason: 'limit' })
    // A short text with two sizes says nothing; the long text is read.
    expect(
      assessLabor(
        {
          shortText: 'Kabel 5x16 mm² oder 5x25 mm²',
          longText: 'Kabel NYY-J 5x16 mm², verlegen.',
          unit: 'm',
        },
        { entry: 'cable.l', quote: 'Kabel', limitQuote: null },
        TABLE,
      ),
    ).toMatchObject({
      status: 'set',
      limitQuote: 'Kabel NYY-J 5x16 mm², verlegen.',
    })
    // Counts as well as sizes.
    expect(
      assessLabor(
        {
          shortText: 'Leitungsschutzschalter C25, 1-polig',
          longText: '',
          unit: 'St',
        },
        { entry: 'mcb.1p', quote: 'Leitungsschutzschalter', limitQuote: null },
        TABLE,
      ).status,
    ).toBe('set')
  })

  it('refuses an entry by the piece for a position by the metre', () => {
    expect(
      assessLabor(
        cable,
        {
          entry: 'luminaire',
          quote: 'Starkstromkabel NYY-J',
          limitQuote: null,
        },
        TABLE,
      ),
    ).toMatchObject({ status: 'review', reason: 'unit' })
  })

  it('refuses a key that is not in the table and a quote that is not in the position', () => {
    expect(
      assessLabor(
        cable,
        {
          entry: 'cable.huge',
          quote: 'Starkstromkabel NYY-J',
          limitQuote: null,
        },
        TABLE,
      ),
    ).toMatchObject({ status: 'review', reason: 'unknown_entry' })
    expect(
      assessLabor(
        cable,
        { entry: 'cable.l', quote: 'Erdkabel NYY-J', limitQuote: '5x16 mm²' },
        TABLE,
      ),
    ).toMatchObject({ status: 'review', reason: 'quote' })
  })

  it('accepts "no entry" only with words of the position', () => {
    const hourly = {
      shortText: 'Stundenlohnarbeiten Monteur',
      longText:
        'Stundenlohnarbeiten eines Elektromonteurs auf besondere Anordnung.',
      unit: 'h',
    }
    expect(
      assessLabor(
        hourly,
        { entry: null, quote: 'Stundenlohnarbeiten', limitQuote: null },
        TABLE,
      ),
    ).toEqual({ status: 'none', quote: 'Stundenlohnarbeiten' })
    expect(
      assessLabor(
        hourly,
        { entry: null, quote: 'Regiearbeiten', limitQuote: null },
        TABLE,
      ),
    ).toMatchObject({ status: 'review', reason: 'quote' })
  })

  it('sends a position nobody read to a person', () => {
    expect(assessLabor(cable, null, TABLE)).toMatchObject({
      status: 'review',
      reason: 'unread',
    })
  })

  it('reads units as the tender writes them', () => {
    expect(
      assessLabor(
        {
          shortText: 'Leuchte',
          longText: 'LED-Leuchte liefern.',
          unit: 'Stck',
        },
        { entry: 'luminaire', quote: 'LED-Leuchte', limitQuote: null },
        TABLE,
      ).status,
    ).toBe('set')
  })
})

describe('labor arithmetic', () => {
  it('turns minutes per unit into hours and money', () => {
    expect(laborHours(5, 240)).toBe(20)
    expect(laborHours(2.5, 100)).toBeCloseTo(4.1667, 4)
    expect(laborCost(20, 62)).toBe(1240)
    expect(laborCost(4.1667, 62)).toBe(258.34)
  })
})
