import { describe, expect, it } from 'vitest'
import { parseOfferPdf } from './pdfTable'
import type { PdfTextItem } from './pdfTable'

/**
 * These tables are typed by hand, not rendered by the demo generator, so they
 * test the reader against layouts it was not written alongside.
 */

/** A run of text. Width is estimated at 4.5 points per character. */
const at = (
  text: string,
  x: number,
  baseline: number,
  options: { right?: boolean; centre?: boolean; page?: number } = {},
): PdfTextItem => {
  const w = text.length * 4.5
  const left =
    options.right === true ? x - w : options.centre === true ? x - w / 2 : x
  return { page: options.page ?? 1, text, x: left, w, baseline, size: 8 }
}

// Columns: line no. (right 50), description (left 60), quantity (right 300),
// unit (left 310), price (right 400), total (right 480).
const header = (baseline: number, page = 1) => [
  at('Pos.', 50, baseline, { right: true, page }),
  at('Bezeichnung', 60, baseline, { page }),
  at('Menge', 300, baseline, { right: true, page }),
  at('ME', 310, baseline, { page }),
  at('Preis', 400, baseline, { right: true, page }),
  at('Betrag', 480, baseline, { right: true, page }),
]
const row = (
  baseline: number,
  no: string,
  text: string,
  qty: string,
  unit: string,
  price: string,
  total: string,
  page = 1,
) => [
  at(no, 50, baseline, { right: true, page }),
  at(text, 60, baseline, { page }),
  at(qty, 300, baseline, { right: true, page }),
  at(unit, 310, baseline, { page }),
  at(price, 400, baseline, { right: true, page }),
  at(total, 480, baseline, { right: true, page }),
]

describe('parseOfferPdf', () => {
  it('reads rows under a header it recognises by name', () => {
    const { lines, warnings } = parseOfferPdf(
      [
        at('Angebot 4711', 60, 40),
        ...header(100),
        ...row(114, '1', 'Kabelschuh 16 mm²', '40', 'St', '0,85', '34,00'),
        ...row(126, '2', 'Erdungsband', '12,5', 'm', '1.204,10', '15.051,25'),
      ],
      's',
    )
    expect(warnings).toEqual([])
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({
      supplierKey: 's',
      seq: 0,
      text: 'Kabelschuh 16 mm²',
      qty: 40,
      unit: 'St',
      unitPrice: 0.85,
      priceBasis: 1,
      total: 34,
    })
    expect(lines[1]).toMatchObject({
      qty: 12.5,
      unitPrice: 1204.1,
      total: 15051.25,
    })
  })

  it('says where each number sits on the page', () => {
    const { lines } = parseOfferPdf(
      [
        ...header(100),
        ...row(114, '1', 'Kabelschuh', '40', 'St', '0,85', '34,00'),
      ],
      's',
    )
    const source = lines[0]!.sources.unitPrice
    expect(source).toMatchObject({ kind: 'pdf', page: 1 })
    if (source?.kind !== 'pdf') throw new Error('expected a PDF source')
    // The box ends where the right-aligned price ends, give or take its padding.
    expect(source.x + source.w).toBeCloseTo(401, 0)
    expect(source.y).toBeLessThan(114)
    expect(source.y + source.h).toBeGreaterThan(114)
  })

  it('joins a description that runs on to a second line', () => {
    const { lines } = parseOfferPdf(
      [
        ...header(100),
        ...row(114, '1', 'Verteilerschrank', '1', 'St', '980,00', '980,00'),
        at('IP 54, mit Sockel', 60, 123.5),
        ...row(136, '2', 'Kabelschuh', '40', 'St', '0,85', '34,00'),
      ],
      's',
    )
    expect(lines.map((line) => line.text)).toEqual([
      'Verteilerschrank IP 54, mit Sockel',
      'Kabelschuh',
    ])
  })

  it('splits two number columns that arrived as one piece of text', () => {
    // A PDF reader merges runs that sit close together: price and total here.
    const merged: PdfTextItem = {
      page: 1,
      text: '0,85 34,00',
      x: 382,
      w: 98,
      baseline: 114,
      size: 8,
    }
    const { lines, warnings } = parseOfferPdf(
      [
        ...header(100),
        at('1', 50, 114, { right: true }),
        at('Kabelschuh', 60, 114),
        at('40', 300, 114, { right: true }),
        at('St', 310, 114),
        merged,
      ],
      's',
    )
    expect(warnings).toEqual([])
    expect(lines[0]).toMatchObject({ unitPrice: 0.85, total: 34 })
  })

  it('reads columns whose headers are centred over them', () => {
    const { lines } = parseOfferPdf(
      [
        at('Bezeichnung', 60, 100),
        at('Menge', 290, 100, { centre: true }),
        at('Preis', 380, 100, { centre: true }),
        at('Gesamt', 460, 100, { centre: true }),
        at('Kabelschuh', 60, 114),
        at('40', 290, 114, { centre: true }),
        at('0,85', 380, 114, { centre: true }),
        at('34,00', 460, 114, { centre: true }),
      ],
      's',
    )
    expect(lines[0]).toMatchObject({ qty: 40, unitPrice: 0.85, total: 34 })
  })

  it('skips totals but keeps an article whose name starts like one', () => {
    const { lines } = parseOfferPdf(
      [
        ...header(100),
        ...row(
          114,
          '1',
          'Summenstromwandler 300 mA',
          '2',
          'St',
          '89,00',
          '178,00',
        ),
        ...row(126, '2', 'Nettoabdeckung grau', '5', 'St', '4,00', '20,00'),
        at('Summe netto', 60, 150),
        at('198,00', 480, 150, { right: true }),
        at('zzgl. 19 % MwSt.', 60, 162),
        at('37,62', 480, 162, { right: true }),
      ],
      's',
    )
    expect(lines.map((line) => line.text)).toEqual([
      'Summenstromwandler 300 mA',
      'Nettoabdeckung grau',
    ])
  })

  it('carries a table over a page that repeats the header', () => {
    const { lines, warnings } = parseOfferPdf(
      [
        ...header(100),
        ...row(114, '1', 'Kabelschuh', '40', 'St', '0,85', '34,00'),
        ...header(60, 2),
        ...row(74, '2', 'Erdungsband', '10', 'm', '3,00', '30,00', 2),
      ],
      's',
    )
    expect(warnings).toEqual([])
    expect(lines.map((line) => line.seq)).toEqual([0, 1])
    expect(lines[1]!.sources.total).toMatchObject({ page: 2 })
  })

  it('marks a line the supplier offers as an alternative', () => {
    const { lines } = parseOfferPdf(
      [
        ...header(100),
        ...row(
          114,
          '1',
          'Alternativ: Kabelschuh verzinnt',
          '40',
          'St',
          '0,80',
          '32,00',
        ),
      ],
      's',
    )
    expect(lines[0]!.alternative).toBe(true)
  })

  describe('says so instead of dropping text silently', () => {
    it('when no row is a header it knows', () => {
      const { lines, warnings } = parseOfferPdf(
        [
          at('Artikel', 60, 100),
          at('Stück', 300, 100, { right: true }),
          at('Kabelschuh', 60, 114),
          at('40', 300, 114, { right: true }),
        ],
        's',
      )
      expect(lines).toEqual([])
      expect(warnings.join(' ')).toMatch(/No table header found/)
    })

    it('when a later page has no header of its own', () => {
      const { lines, warnings } = parseOfferPdf(
        [
          ...header(100),
          ...row(114, '1', 'Kabelschuh', '40', 'St', '0,85', '34,00'),
          ...row(74, '2', 'Erdungsband', '10', 'm', '3,00', '30,00', 2),
        ],
        's',
      )
      expect(lines).toHaveLength(1)
      expect(warnings.join(' ')).toMatch(/Page 2 .* no header row/)
    })

    it('when a priced row has no description', () => {
      const { warnings } = parseOfferPdf(
        [
          ...header(100),
          at('40', 300, 114, { right: true }),
          at('0,85', 400, 114, { right: true }),
          at('34,00', 480, 114, { right: true }),
        ],
        's',
      )
      expect(warnings.join(' ')).toMatch(/no description/)
    })

    it('when a number cannot be read', () => {
      const { lines, warnings } = parseOfferPdf(
        [
          ...header(100),
          ...row(114, '1', 'Kabelschuh', '40', 'St', 'auf Anfrage', '34,00'),
        ],
        's',
      )
      expect(lines[0]!.unitPrice).toBeNull()
      expect(warnings.join(' ')).toMatch(
        /"auf Anfrage" in unitPrice is not a number/,
      )
    })
  })
})

describe('layouts a second audit built against the reader', () => {
  // Headers set flush left over figures set flush right: common in offers
  // printed from a spreadsheet.
  const leftHeader = (baseline: number, page = 1) => [
    at('Pos.', 30, baseline, { page }),
    at('Bezeichnung', 60, baseline, { page }),
    at('Menge', 262, baseline, { page }),
    at('ME', 310, baseline, { page }),
    at('Preis', 352, baseline, { page }),
    at('Betrag', 432, baseline, { page }),
  ]

  it('reads figures set flush right under headers set flush left', () => {
    const { lines, warnings } = parseOfferPdf(
      [
        ...leftHeader(100),
        ...row(114, '1', 'Kabelschuh 16 mm²', '40', 'St', '0,85', '34,00'),
        ...row(
          126,
          '2',
          'Erdungsband 30 x 3,5',
          '1.250',
          'm',
          '1.204,10',
          '15.051,25',
        ),
      ],
      's',
    )
    expect(warnings).toEqual([])
    expect(lines).toHaveLength(2)
    expect(lines[1]).toMatchObject({
      text: 'Erdungsband 30 x 3,5',
      qty: 1250,
      unit: 'm',
      unitPrice: 1204.1,
      total: 15051.25,
    })
  })

  it('keeps a continuation line that runs under the quantity column', () => {
    const { lines, warnings } = parseOfferPdf(
      [
        ...header(100),
        ...row(114, '1', 'Standverteiler', '1', 'St', '965,73', '965,73'),
        // Indented, and long enough to end where the quantities end.
        at(
          '2000 x 600 x 400 mm, IP 54, Stahlblech, mit Montageplatte',
          75,
          124,
        ),
      ],
      's',
    )
    expect(warnings).toEqual([])
    expect(lines).toHaveLength(1)
    expect(lines[0]!.text).toBe(
      'Standverteiler 2000 x 600 x 400 mm, IP 54, Stahlblech, mit Montageplatte',
    )
  })

  it('says nothing about a closing page of terms or a bare page number', () => {
    const { lines, warnings } = parseOfferPdf(
      [
        ...header(100),
        ...row(114, '1', 'Kabelschuh', '40', 'St', '0,85', '34,00'),
        at('2', 480, 800, { right: true }),
        at('Allgemeine Lieferbedingungen', 60, 80, { page: 2 }),
        at('Die Preise gelten 30 Tage ab Angebotsdatum.', 60, 100, { page: 2 }),
        at('Lieferung frei Baustelle ab 250,00 EUR netto.', 60, 112, {
          page: 2,
        }),
      ],
      's',
    )
    expect(lines).toHaveLength(1)
    expect(warnings).toEqual([])
  })

  it('still reports priced rows on a page without a header', () => {
    const { lines, warnings } = parseOfferPdf(
      [
        ...header(100),
        ...row(114, '1', 'Kabelschuh', '40', 'St', '0,85', '34,00'),
        ...row(60, '2', 'Erdungsband', '12', 'm', '4,10', '49,20', 2),
      ],
      's',
    )
    expect(lines).toHaveLength(1)
    expect(warnings).toEqual([
      'Page 2 has priced rows after a table but no header row of its own; nothing on it was read.',
    ])
  })

  it('reads a table that has a column it has no field for', () => {
    const { lines, warnings } = parseOfferPdf(
      [
        ...header(100),
        at('Lieferzeit', 500, 100),
        ...row(114, '1', 'Kabelschuh', '40', 'St', '0,85', '34,00'),
        at('3 Tage', 500, 114),
      ],
      's',
    )
    expect(warnings).toEqual([])
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ text: 'Kabelschuh', total: 34 })
  })

  it('reads under a header whose first cell wraps onto a second row', () => {
    const { lines, warnings } = parseOfferPdf(
      [
        at('Artikel-', 60, 92),
        at('Bezeichnung', 120, 92),
        at('Menge', 300, 92, { right: true }),
        at('Einzel-', 400, 92, { right: true }),
        at('Gesamt-', 480, 92, { right: true }),
        at('Nr.', 60, 101),
        at('preis', 400, 101, { right: true }),
        at('preis', 480, 101, { right: true }),
        at('7799724', 60, 114),
        at('Kabelschuh 16 mm²', 120, 114),
        at('40', 300, 114, { right: true }),
        at('0,85', 400, 114, { right: true }),
        at('34,00', 480, 114, { right: true }),
      ],
      's',
    )
    expect(warnings).toEqual([])
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      articleNo: '7799724',
      text: 'Kabelschuh 16 mm²',
      qty: 40,
      unitPrice: 0.85,
      total: 34,
    })
  })

  it('warns when a header is found and nothing can be read under it', () => {
    const { lines, warnings } = parseOfferPdf(
      [...header(100), at('Preise auf Anfrage', 60, 114)],
      's',
    )
    expect(lines).toHaveLength(0)
    expect(warnings).toEqual([
      'Page 1 has a table header but no line could be read under it.',
    ])
  })
})
