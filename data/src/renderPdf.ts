/**
 * Renders the two PDF offers. The layouts differ on purpose: the wholesaler
 * prints one dense line per position, the specialist two lines per article
 * under group headings. Both are plain text PDFs, as offers exported from an
 * ERP system are.
 *
 * Output is deterministic: fixed dates, no random identifiers.
 */
import { formatGermanNumber } from '@preisspiegel/core'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { TENDER } from './names'
import type { PDFFont, PDFPage } from 'pdf-lib'
import type { Supplier } from './names'
import type { OfferDraft } from './offers'

const PAGE = { w: 595.28, h: 841.89 }
const LEFT = 36
const RIGHT = 559
const INK = rgb(0.1, 0.1, 0.12)
const GREY = rgb(0.42, 0.44, 0.47)
const RULE = rgb(0.75, 0.76, 0.78)
const VAT = 0.19

const money = (value: number) => formatGermanNumber(value, 2)
const amount = (value: number) =>
  formatGermanNumber(value, Number.isInteger(value) ? 0 : 2)
const germanDate = (iso: string) => iso.split('-').reverse().join('.')

interface Fonts {
  regular: PDFFont
  bold: PDFFont
}

interface Pen {
  page: PDFPage
  fonts: Fonts
}

interface TextStyle {
  size?: number
  bold?: boolean
  grey?: boolean
  /** Right-align the text so it ends at `x`. */
  right?: boolean
}

/** Draws text with its baseline `baseline` points below the top of the page. */
function write(
  pen: Pen,
  text: string,
  x: number,
  baseline: number,
  style: TextStyle = {},
): void {
  const size = style.size ?? 8
  const font = style.bold === true ? pen.fonts.bold : pen.fonts.regular
  const width = font.widthOfTextAtSize(text, size)
  pen.page.drawText(text, {
    x: style.right === true ? x - width : x,
    y: PAGE.h - baseline,
    size,
    font,
    color: style.grey === true ? GREY : INK,
  })
}

function rule(pen: Pen, baseline: number, x1 = LEFT, x2 = RIGHT): void {
  pen.page.drawLine({
    start: { x: x1, y: PAGE.h - baseline },
    end: { x: x2, y: PAGE.h - baseline },
    thickness: 0.5,
    color: RULE,
  })
}

/** Breaks text into lines that fit `maxWidth`, at spaces. */
function wrap(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): Array<string> {
  const lines: Array<string> = []
  let current = ''
  for (const word of text.split(' ')) {
    const candidate = current === '' ? word : `${current} ${word}`
    if (current !== '' && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current !== '') lines.push(current)
  return lines
}

async function open(
  title: string,
  supplier: Supplier,
): Promise<{ doc: PDFDocument; fonts: Fonts }> {
  const doc = await PDFDocument.create()
  const stamp = new Date(`${supplier.offerDate}T09:00:00Z`)
  doc.setTitle(title)
  doc.setAuthor(supplier.name)
  doc.setSubject(`${TENDER.project}, ${TENDER.lot}`)
  doc.setCreator('Preisspiegel demo generator')
  doc.setProducer('Preisspiegel demo generator')
  doc.setCreationDate(stamp)
  doc.setModificationDate(stamp)
  return {
    doc,
    fonts: {
      regular: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
    },
  }
}

function footers(doc: PDFDocument, fonts: Fonts, left: string): void {
  const pages = doc.getPages()
  pages.forEach((page, index) => {
    const pen = { page, fonts }
    rule(pen, 800)
    write(pen, left, LEFT, 812, { size: 7, grey: true })
    write(pen, `Seite ${index + 1} von ${pages.length}`, RIGHT, 812, {
      size: 7,
      grey: true,
      right: true,
    })
  })
}

function totals(pen: Pen, baseline: number, net: number, labelX: number): void {
  rule(pen, baseline - 9, labelX)
  write(pen, 'Summe netto', labelX, baseline)
  write(pen, money(net), RIGHT, baseline, { right: true })
  write(pen, 'zzgl. 19 % MwSt.', labelX, baseline + 12)
  write(pen, money(net * VAT), RIGHT, baseline + 12, { right: true })
  write(pen, 'Gesamtbetrag', labelX, baseline + 26, { bold: true, size: 9 })
  write(pen, money(net * (1 + VAT)), RIGHT, baseline + 26, {
    bold: true,
    size: 9,
    right: true,
  })
}

// ---------------------------------------------------------------------------
// Layout A: the wholesaler
// ---------------------------------------------------------------------------

/** Column anchors. Text columns give their left edge, number columns their right. */
const A = {
  lineNo: 58,
  posRef: 68,
  articleNo: 126,
  text: 176,
  textWidth: 178,
  qty: 396,
  unit: 408,
  unitPrice: 472,
  // Wide gaps on both sides: a PDF reader merges runs of text that sit
  // closer than about half the font size.
  priceBasis: 498,
  total: RIGHT,
} as const

export async function renderWholesalerOffer(
  supplier: Supplier,
  lines: Array<OfferDraft>,
): Promise<Uint8Array> {
  const { doc, fonts } = await open(`Angebot ${supplier.offerNo}`, supplier)
  let pen: Pen = { page: doc.addPage([PAGE.w, PAGE.h]), fonts }

  // Letterhead and address block.
  write(pen, supplier.name, LEFT, 52, { bold: true, size: 13 })
  write(pen, `${supplier.street} · ${supplier.city}`, LEFT, 65, {
    grey: true,
  })
  write(pen, 'Angebot', 400, 52, { bold: true, size: 14 })
  write(pen, `Angebot-Nr.: ${supplier.offerNo}`, 400, 68)
  write(pen, `Datum: ${germanDate(supplier.offerDate)}`, 400, 79)
  write(pen, `Bearbeitung: ${supplier.contact}`, 400, 90)
  write(pen, TENDER.contractor, LEFT, 122, { size: 9 })
  write(pen, 'Kalkulation', LEFT, 134, { size: 9 })
  write(pen, TENDER.contractorCity, LEFT, 146, { size: 9 })
  write(pen, `Bauvorhaben: ${TENDER.project}, ${TENDER.lot}`, LEFT, 178, {
    bold: true,
    size: 9,
  })
  write(
    pen,
    `Ihre Anfrage vom ${germanDate(TENDER.issued)}. Wir bieten Ihnen freibleibend an:`,
    LEFT,
    191,
  )

  const header = (baseline: number) => {
    write(pen, 'Pos.', A.lineNo, baseline, { bold: true, right: true })
    write(pen, 'LV-Pos.', A.posRef, baseline, { bold: true })
    write(pen, 'Artikel-Nr.', A.articleNo, baseline, { bold: true })
    write(pen, 'Bezeichnung', A.text, baseline, { bold: true })
    write(pen, 'Menge', A.qty, baseline, { bold: true, right: true })
    write(pen, 'ME', A.unit, baseline, { bold: true })
    write(pen, 'Preis', A.unitPrice, baseline, { bold: true, right: true })
    write(pen, 'PE', A.priceBasis, baseline, { bold: true, right: true })
    write(pen, 'Betrag', A.total, baseline, { bold: true, right: true })
    rule(pen, baseline + 4)
  }

  const BOTTOM = 770
  let baseline = 216
  header(baseline)
  baseline += 15
  let running = 0

  lines.forEach((line, index) => {
    const text = wrap(line.text, fonts.regular, 8, A.textWidth)
    const height = 11.5 + (text.length - 1) * 9.5

    if (baseline + height > BOTTOM) {
      write(pen, 'Übertrag', A.text, baseline + 4, { grey: true })
      write(pen, money(running), A.total, baseline + 4, {
        grey: true,
        right: true,
      })
      pen = { page: doc.addPage([PAGE.w, PAGE.h]), fonts }
      baseline = 60
      header(baseline)
      baseline += 15
      write(pen, 'Übertrag', A.text, baseline, { grey: true })
      write(pen, money(running), A.total, baseline, { grey: true, right: true })
      baseline += 13
    }

    write(pen, String(index + 1), A.lineNo, baseline, { right: true })
    if (line.posRef !== null) write(pen, line.posRef, A.posRef, baseline)
    write(pen, line.articleNo, A.articleNo, baseline)
    text.forEach((part, row) => write(pen, part, A.text, baseline + row * 9.5))
    write(pen, amount(line.qty), A.qty, baseline, { right: true })
    write(pen, line.unit, A.unit, baseline)
    write(pen, money(line.unitPrice), A.unitPrice, baseline, { right: true })
    write(pen, String(line.priceBasis), A.priceBasis, baseline, { right: true })
    write(pen, money(line.total), A.total, baseline, { right: true })

    running += line.total
    baseline += height
  })

  if (baseline + 110 > BOTTOM) {
    pen = { page: doc.addPage([PAGE.w, PAGE.h]), fonts }
    baseline = 70
  }
  totals(pen, baseline + 16, running, A.text)
  const notes = [
    'Lieferzeit ca. 10 Werktage nach Auftragseingang. Preise freibleibend, gültig bis 31.12.2026.',
    'PE = Preiseinheit: Der Preis gilt je 1, 100 oder 1000 Mengeneinheiten.',
    'Kabel und Leitungen auf Basis Kupfer 150,00 EUR/100 kg, zuzüglich Kupferzuschlag nach DEL-Notierung am Liefertag.',
  ]
  notes.forEach((note, row) =>
    write(pen, note, LEFT, baseline + 70 + row * 11, { size: 7.5, grey: true }),
  )

  footers(doc, fonts, `${supplier.name} · Angebot ${supplier.offerNo}`)
  return doc.save({ useObjectStreams: false })
}

// ---------------------------------------------------------------------------
// Layout B: the specialist
// ---------------------------------------------------------------------------

const B = {
  text: LEFT,
  textWidth: 240,
  qty: 326,
  unit: 338,
  listPrice: 420,
  discount: 464,
  unitPrice: 514,
  total: RIGHT,
} as const

export async function renderSpecialistOffer(
  supplier: Supplier,
  lines: Array<OfferDraft>,
): Promise<Uint8Array> {
  const { doc, fonts } = await open(`Angebot ${supplier.offerNo}`, supplier)
  let pen: Pen = { page: doc.addPage([PAGE.w, PAGE.h]), fonts }

  write(pen, supplier.name, LEFT, 58, { bold: true, size: 16 })
  write(pen, 'Licht · Schalterprogramme · Datennetz', LEFT, 72, {
    size: 8.5,
    grey: true,
  })
  write(pen, supplier.street, RIGHT, 52, { right: true, grey: true })
  write(pen, supplier.city, RIGHT, 63, { right: true, grey: true })
  rule(pen, 84)

  write(pen, 'An', LEFT, 108, { grey: true })
  write(pen, TENDER.contractor, LEFT, 120, { size: 9 })
  write(pen, TENDER.contractorCity, LEFT, 132, { size: 9 })
  write(pen, `ANGEBOT ${supplier.offerNo}`, RIGHT, 120, {
    bold: true,
    size: 11,
    right: true,
  })
  write(pen, `vom ${germanDate(supplier.offerDate)}`, RIGHT, 132, {
    right: true,
  })
  write(pen, `Projekt: ${TENDER.project}`, LEFT, 166, { bold: true, size: 9 })
  write(
    pen,
    'Mengen je Artikel über alle Geschosse zusammengefasst. Preise netto in EUR.',
    LEFT,
    179,
  )

  const header = (baseline: number) => {
    rule(pen, baseline - 11)
    write(pen, 'Bezeichnung', B.text, baseline, { bold: true })
    write(pen, 'Menge', B.qty, baseline, { bold: true, right: true })
    write(pen, 'Einh.', B.unit, baseline, { bold: true })
    write(pen, 'Listenpreis', B.listPrice, baseline, {
      bold: true,
      right: true,
    })
    write(pen, 'Rabatt %', B.discount, baseline, { bold: true, right: true })
    write(pen, 'EP netto', B.unitPrice, baseline, { bold: true, right: true })
    write(pen, 'Gesamt', B.total, baseline, { bold: true, right: true })
    rule(pen, baseline + 4)
  }

  const BOTTOM = 770
  let baseline = 208
  header(baseline)
  baseline += 8
  let running = 0
  let heading: string | null = null

  for (const line of lines) {
    const name = wrap(line.text, fonts.regular, 8.5, B.textWidth)
    const detail = wrap(
      `${line.detail ?? ''} · Art.-Nr. ${line.articleNo}`,
      fonts.regular,
      7,
      B.textWidth + 40,
    )
    const height = 14 + (name.length - 1) * 10 + detail.length * 9
    const withHeading = line.heading !== heading
    const needed = height + (withHeading ? 26 : 0)

    if (baseline + needed > BOTTOM) {
      pen = { page: doc.addPage([PAGE.w, PAGE.h]), fonts }
      baseline = 70
      header(baseline)
      baseline += 8
    }
    if (withHeading && line.heading !== null) {
      heading = line.heading
      baseline += 20
      write(pen, heading, B.text, baseline, { bold: true, size: 9.5 })
      baseline += 6
    }

    baseline += 14
    name.forEach((part, row) =>
      write(pen, part, B.text, baseline + row * 10, { size: 8.5 }),
    )
    write(pen, amount(line.qty), B.qty, baseline, { size: 8.5, right: true })
    write(pen, line.unit, B.unit, baseline, { size: 8.5 })
    write(pen, money(line.listPrice ?? 0), B.listPrice, baseline, {
      size: 8.5,
      right: true,
    })
    write(pen, amount(line.discountPct ?? 0), B.discount, baseline, {
      size: 8.5,
      right: true,
    })
    write(pen, money(line.unitPrice), B.unitPrice, baseline, {
      size: 8.5,
      right: true,
    })
    write(pen, money(line.total), B.total, baseline, {
      size: 8.5,
      right: true,
    })

    baseline += (name.length - 1) * 10
    detail.forEach((part, row) =>
      write(pen, part, B.text, baseline + 9 + row * 9, { size: 7, grey: true }),
    )
    baseline += detail.length * 9
    running += line.total
  }

  if (baseline + 110 > BOTTOM) {
    pen = { page: doc.addPage([PAGE.w, PAGE.h]), fonts }
    baseline = 70
  }
  totals(pen, baseline + 34, running, B.listPrice - 80)
  write(
    pen,
    'Angebot freibleibend. Lieferung frei Baustelle ab 500 EUR Nettowarenwert. Zahlung 30 Tage netto.',
    LEFT,
    baseline + 92,
    { size: 7.5, grey: true },
  )

  footers(doc, fonts, `${supplier.name} · ${supplier.offerNo}`)
  return doc.save({ useObjectStreams: false })
}
