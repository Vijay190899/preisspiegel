import { readFileSync } from 'node:fs'
import { parseOfferPdf } from '@preisspiegel/core'
import { describe, expect, it } from 'vitest'
import { extractPdfText } from './extractPdf'

/**
 * A supplier's offer made by other software: an HTML table printed to PDF by
 * Chrome (`scripts/printFixture.ts`). Nothing in it was laid out by this
 * project's own PDF writer. Its headers sit flush left over figures flush
 * right, one header and the article numbers wrap onto a second line, it has
 * a column for delivery times, and the PDF reader hands several neighbouring
 * cells over as one piece of text.
 *
 * The expectations are typed by hand from `data/fixtures/angebot-fremd.html`.
 */
const EXPECTED = [
  {
    articleNo: 'KB-5X16',
    text: 'Starkstromkabel NYY-J 5x16 mm², schwarz, Trommelware',
    qty: 120,
    unit: 'm',
    unitPrice: 781.4,
    priceBasis: 100,
    total: 937.68,
  },
  {
    articleNo: 'KB-3X1,5',
    text: 'Mantelleitung NYM-J 3x1,5 mm², grau, Ring 100 m, für feste Verlegung in trockenen, feuchten und nassen Räumen',
    qty: 14,
    unit: 'RG',
    unitPrice: 61.9,
    priceBasis: 1,
    total: 866.6,
  },
  {
    articleNo: 'LS-B16-1',
    text: 'Leitungsschutzschalter B16, 1-polig, 6 kA',
    qty: 1250,
    unit: 'St',
    unitPrice: 3.84,
    priceBasis: 1,
    total: 4800,
  },
  {
    articleNo: 'FI-40-30-4',
    text: 'Fehlerstrom-Schutzschalter 40 A / 30 mA, 4-polig, Typ A',
    qty: 18,
    unit: 'St',
    unitPrice: 56.2,
    priceBasis: 1,
    total: 1011.6,
  },
  {
    articleNo: 'RO-M20',
    text: 'Installationsrohr starr M20, grau',
    qty: 600,
    unit: 'm',
    unitPrice: 92,
    priceBasis: 100,
    total: 552,
  },
  {
    articleNo: 'SV-250',
    text: 'Anschlussverteilerschrank 250 A mit Zählerplatz, IP 44',
    qty: 1,
    unit: 'St',
    unitPrice: 5120,
    priceBasis: 1,
    total: 5120,
  },
]

describe('an offer printed by other software', () => {
  it('is read line for line, with nothing to warn about', async () => {
    const bytes = readFileSync(
      new URL('../fixtures/angebot-fremd.pdf', import.meta.url),
    )
    const pdf = await extractPdfText(new Uint8Array(bytes))
    const { lines, warnings } = parseOfferPdf(pdf.items, 'x')

    expect(warnings).toEqual([])
    expect(lines).toHaveLength(EXPECTED.length)
    lines.forEach((line, index) => {
      expect(line, `line ${index + 1}`).toMatchObject(EXPECTED[index]!)
    })
  })

  it('keeps a rectangle on the page for every figure it read', async () => {
    const bytes = readFileSync(
      new URL('../fixtures/angebot-fremd.pdf', import.meta.url),
    )
    const pdf = await extractPdfText(new Uint8Array(bytes))
    const { lines } = parseOfferPdf(pdf.items, 'x')
    const page = pdf.pages[0]!
    for (const line of lines) {
      for (const field of [
        'qty',
        'unitPrice',
        'priceBasis',
        'total',
      ] as const) {
        const source = line.sources[field]
        expect(source?.kind, `${field} of ${line.articleNo}`).toBe('pdf')
        if (source?.kind !== 'pdf') continue
        expect(source.x).toBeGreaterThanOrEqual(0)
        expect(source.x + source.w).toBeLessThanOrEqual(page.width)
        expect(source.w).toBeLessThan(60)
      }
    }
  })
})
