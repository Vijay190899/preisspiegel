import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  formatGermanNumber,
  gaebOfferLines,
  gaebPositions,
  kvaToAmps,
  parseGaeb,
  parseOfferPdf,
} from '@preisspiegel/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { extractPdfText } from './extractPdf'
import { FILES, SEED, generate } from './generate'
import { TRAP_KINDS } from './offers'
import { POSITION_COUNT } from './tender'
import type { OfferLine, PdfTextItem } from '@preisspiegel/core'
import type { ExtractedPdf } from './extractPdf'
import type { Generated } from './generate'
import type { OfferDraft } from './offers'

const seedDir = resolve(dirname(fileURLToPath(import.meta.url)), '../seed')
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

let generated: Generated
let pdfA: ExtractedPdf
let pdfB: ExtractedPdf
let linesA: Array<OfferLine>
let linesB: Array<OfferLine>

beforeAll(async () => {
  generated = await generate(SEED)
  pdfA = await extractPdfText(generated.files.get(FILES.offerA)!)
  pdfB = await extractPdfText(generated.files.get(FILES.offerB)!)
  linesA = parseOfferPdf(pdfA.items, 'a').lines
  linesB = parseOfferPdf(pdfB.items, 'b').lines
})

describe('the generator', () => {
  it('writes the same bytes for the same seed', async () => {
    const again = await generate(SEED)
    for (const [name, bytes] of generated.files) {
      expect(
        Buffer.from(again.files.get(name)!).equals(Buffer.from(bytes)),
        name,
      ).toBe(true)
    }
  })

  it('writes different files for a different seed', async () => {
    const other = await generate(SEED + 1)
    expect(text(other.files.get(FILES.tender)!)).not.toBe(
      text(generated.files.get(FILES.tender)!),
    )
  })

  it('matches the files committed under data/seed', () => {
    for (const [name, bytes] of generated.files) {
      const path = resolve(seedDir, name)
      expect(
        existsSync(path),
        `${name} is missing: run pnpm seed generate`,
      ).toBe(true)
      expect(
        readFileSync(path).equals(Buffer.from(bytes)),
        `${name} is out of date: run pnpm seed generate`,
      ).toBe(true)
    }
  })

  it(`builds a tender of ${POSITION_COUNT} positions with unique ordinal numbers`, () => {
    expect(generated.positions).toHaveLength(POSITION_COUNT)
    expect(new Set(generated.positions.map((p) => p.oz)).size).toBe(
      POSITION_COUNT,
    )
  })
})

describe('the planted traps', () => {
  it('number sixty, across all eight kinds', () => {
    const { traps } = generated.truth.summary
    expect(Object.values(traps).reduce((sum, count) => sum + count, 0)).toBe(60)
    for (const kind of TRAP_KINDS) expect(traps[kind], kind).toBeGreaterThan(0)
  })

  it('each point at a line that carries that trap', () => {
    for (const trap of generated.truth.traps) {
      if (trap.supplier === null || trap.seq === null) continue
      const line = generated.offers.lines[trap.supplier][trap.seq]
      expect(
        line?.trap?.kind,
        `${trap.kind} at ${trap.supplier}#${trap.seq}`,
      ).toBe(trap.kind)
      expect(trap.positions.length).toBeGreaterThan(0)
    }
  })

  it('include the cabinet offered one size too small, stated in kVA', () => {
    const position = generated.positions.find(
      (p) => p.productId === 'site-cabinet-250',
    )!
    const line = linesA.find((candidate) => candidate.posRef === position.oz)!
    expect(position.longText).toMatch(/(Bemessungsstrom|Nennstrom) 250 A/)
    expect(line.text).toContain('138 kVA')
    expect(kvaToAmps(138)).toBeLessThan(250)

    const truth = generated.truth.positions.find((p) => p.oz === position.oz)!
    expect(truth.expected).toMatchObject({
      decision: 'review',
      reasons: ['SPEC_MISMATCH'],
    })
  })

  it('leave every expectation consistent with its offers', () => {
    const { summary, positions } = generated.truth
    expect(summary.expectedAuto + summary.expectedReview).toBe(POSITION_COUNT)
    for (const position of positions) {
      const mustFlag = position.offers.some((offer) => offer.mustFlag)
      const expectReview = mustFlag || position.offers.length === 0
      expect(position.expected.decision, position.oz).toBe(
        expectReview ? 'review' : 'auto',
      )
      if (position.expected.decision === 'auto') {
        expect(position.expected.bestUnitPrice, position.oz).toBeGreaterThan(0)
      }
    }
  })
})

describe('reading the files back', () => {
  it('finds every position of the X83 as it was written', () => {
    const read = gaebPositions(
      parseGaeb(text(generated.files.get(FILES.tender)!)),
    )
    expect(read).toHaveLength(POSITION_COUNT)
    read.forEach((position, index) => {
      const written = generated.positions[index]!
      expect(position).toMatchObject({
        oz: written.oz,
        qty: written.qty,
        unit: written.unit,
        shortText: written.shortText,
        longText: written.longText,
      })
    })
  })

  const sameLine = (
    read: OfferLine,
    written: OfferDraft,
    textWritten: string,
  ) => {
    expect(read, `line ${read.seq + 1}`).toMatchObject({
      posRef: written.posRef,
      articleNo: written.articleNo,
      // A PDF reader returns the micro sign as the Greek letter mu.
      text: textWritten.replaceAll('\u00b5', '\u03bc'),
      qty: written.qty,
      unit: written.unit,
      unitPrice: written.unitPrice,
      priceBasis: written.priceBasis,
      listPrice: written.listPrice,
      discountPct: written.discountPct,
      total: written.total,
      alternative: written.text.startsWith('Alternativ'),
    })
  }

  it('finds every line of the wholesaler PDF, field for field', () => {
    const written = generated.offers.lines.a
    expect(parseOfferPdf(pdfA.items, 'a').warnings).toEqual([])
    expect(linesA).toHaveLength(written.length)
    linesA.forEach((line, index) =>
      sameLine(line, written[index]!, written[index]!.text),
    )
  })

  it('finds every line of the specialist PDF, field for field', () => {
    const written = generated.offers.lines.b
    expect(parseOfferPdf(pdfB.items, 'b').warnings).toEqual([])
    expect(linesB).toHaveLength(written.length)
    linesB.forEach((line, index) => {
      const draft = written[index]!
      sameLine(line, draft, `${draft.text} ${draft.detail}`)
    })
  })

  it('finds every priced position of the X84', () => {
    const written = generated.offers.lines.c
    const read = gaebOfferLines(
      parseGaeb(text(generated.files.get(FILES.offerC)!)),
      'c',
    )
    expect(read).toHaveLength(written.length)
    read.forEach((line, index) => {
      expect(line).toMatchObject({
        posRef: written[index]!.posRef,
        qty: written[index]!.qty,
        unitPrice: written[index]!.unitPrice,
        total: written[index]!.total,
      })
    })
  })
})

describe('where each number was found', () => {
  /** The text printed inside a rectangle on a page. */
  const printedIn = (
    items: Array<PdfTextItem>,
    box: { page: number; x: number; y: number; w: number; h: number },
  ) =>
    items
      .filter(
        (item) =>
          item.page === box.page &&
          item.x >= box.x - 0.5 &&
          item.x + item.w <= box.x + box.w + 0.5 &&
          item.baseline >= box.y &&
          item.baseline <= box.y + box.h,
      )
      .map((item) => item.text)
      .join(' ')

  it.each([
    ['wholesaler', () => [linesA, pdfA] as const],
    ['specialist', () => [linesB, pdfB] as const],
  ])(
    '%s: every price, quantity and total has a rectangle that contains it',
    (_name, get) => {
      const [lines, pdf] = get()
      let checked = 0
      for (const line of lines) {
        for (const [field, decimals] of [
          ['unitPrice', 2],
          ['total', 2],
          ['qty', 0],
        ] as const) {
          const value = line[field]
          const source = line.sources[field]
          expect(value, `${field} of line ${line.seq + 1}`).not.toBeNull()
          expect(source?.kind, `${field} of line ${line.seq + 1}`).toBe('pdf')
          if (value === null || source?.kind !== 'pdf') continue

          const page = pdf.pages[source.page - 1]!
          expect(source.x).toBeGreaterThanOrEqual(0)
          expect(source.x + source.w).toBeLessThanOrEqual(page.width)
          expect(source.y + source.h).toBeLessThanOrEqual(page.height)
          expect(printedIn(pdf.items, source)).toContain(
            formatGermanNumber(value, Number.isInteger(value) ? decimals : 2),
          )
          checked++
        }
      }
      expect(checked).toBe(lines.length * 3)
    },
  )
})
