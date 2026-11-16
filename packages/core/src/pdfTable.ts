/**
 * Reads a supplier's offer table out of the text of a PDF.
 *
 * The input is every piece of text on every page with its position. The
 * output is one offer line per table row, and for every field the rectangle
 * it was read from, so a price can be shown at its place in the document.
 *
 * Nothing here knows a supplier. Columns are found from the table's own
 * header row, matched against the names German offers use for them.
 */
import { parseGermanNumber } from './numbers'
import type { OfferField, OfferLine, PdfBox } from './model'

/** One run of text on a page. Distances are in points from the top-left. */
export interface PdfTextItem {
  page: number
  text: string
  /** Left edge. */
  x: number
  w: number
  /** Distance from the top of the page to the text baseline. */
  baseline: number
  /** Font size. */
  size: number
}

type Column = OfferField | 'lineNo'

/** What German offers call their columns. Compared lower-case, without a trailing colon. */
const HEADER_NAMES: Partial<Record<string, Column>> = {
  'pos.': 'lineNo',
  pos: 'lineNo',
  'lfd. nr.': 'lineNo',
  'lv-pos.': 'posRef',
  'lv-position': 'posRef',
  oz: 'posRef',
  'artikel-nr.': 'articleNo',
  'art.-nr.': 'articleNo',
  artikelnummer: 'articleNo',
  bezeichnung: 'text',
  artikelbezeichnung: 'text',
  beschreibung: 'text',
  artikel: 'text',
  menge: 'qty',
  me: 'unit',
  'einh.': 'unit',
  einheit: 'unit',
  preis: 'unitPrice',
  'e-preis': 'unitPrice',
  einzelpreis: 'unitPrice',
  'ep netto': 'unitPrice',
  pe: 'priceBasis',
  preiseinheit: 'priceBasis',
  listenpreis: 'listPrice',
  rabatt: 'discountPct',
  'rabatt %': 'discountPct',
  betrag: 'total',
  gesamt: 'total',
  gesamtpreis: 'total',
}

/** Rows that total or continue the table rather than offer something. */
const SUMMARY_ROW =
  /^(übertrag|zwischensumme|summe|gesamtsumme|gesamtbetrag|nettosumme|gesamt netto|netto|zzgl\.|mwst|umsatzsteuer|seite)(?![a-zäöüß])/i

const ARTICLE_IN_TEXT = /\bArt\.?-?\s?Nr\.?:?\s*([A-Z0-9][A-Z0-9\-._/]*)/i
const ALTERNATIVE = /\balternativ/i

interface Cell {
  text: string
  box: PdfBox
}

interface Row {
  page: number
  baseline: number
  size: number
  items: Array<PdfTextItem>
}

interface ColumnSpec {
  column: Column
  left: number
  right: number
}

interface OpenLine {
  cells: Partial<Record<Column, Cell>>
  page: number
  lastBaseline: number
  size: number
}

export interface ParsedOffer {
  lines: Array<OfferLine>
  /** Rows that looked like offer lines but could not be read in full. */
  warnings: Array<string>
}

export function parseOfferPdf(
  items: Array<PdfTextItem>,
  supplierKey: string,
): ParsedOffer {
  const lines: Array<OfferLine> = []
  const warnings: Array<string> = []
  const rows = groupRows(items)

  let columns: Array<ColumnSpec> | null = null
  let sawHeader = false
  const unheaded = new Set<number>()
  let columnsPage = -1
  let headerBaseline = 0
  let open: OpenLine | null = null

  const close = () => {
    if (open === null) return
    lines.push(toOfferLine(open, supplierKey, lines.length, warnings))
    open = null
  }

  for (const row of rows) {
    const header = readHeader(row)
    if (header !== null) {
      // A header starts a table, or repeats it at the top of a new page.
      columns = header
      sawHeader = true
      unheaded.delete(row.page)
      columnsPage = row.page
      headerBaseline = row.baseline
      continue
    }
    if (columns === null) continue
    if (row.page !== columnsPage) {
      // A page without its own header: the table has ended. If that page
      // still has rows that look priced, say so instead of dropping them.
      close()
      columns = null
      unheaded.add(row.page)
      continue
    }
    if (row.baseline <= headerBaseline) continue

    const cells = assignCells(row, columns)
    const text = cells.text?.text ?? ''
    if (SUMMARY_ROW.test(text) || SUMMARY_ROW.test(firstText(row))) {
      close()
      continue
    }

    const priced =
      isNumber(cells.unitPrice) || isNumber(cells.total) || isNumber(cells.qty)
    if (priced && text === '') {
      warnings.push(
        `Page ${row.page}: a row with a price or quantity has no description and was not read.`,
      )
    }
    if (priced && text !== '') {
      close()
      open = {
        cells,
        page: row.page,
        lastBaseline: row.baseline,
        size: row.size,
      }
      continue
    }

    // A row of text only, straight under an offer line, continues its description.
    const onlyText = Object.keys(cells).every((column) => column === 'text')
    const current: OpenLine | null = open
    if (
      current !== null &&
      onlyText &&
      text !== '' &&
      row.page === current.page &&
      row.baseline - current.lastBaseline <= current.size * 1.9
    ) {
      const previous = current.cells.text
      current.cells.text =
        previous === undefined
          ? cells.text
          : {
              text: `${previous.text}\n${text}`,
              box: union(previous.box, cells.text!.box),
            }
      current.lastBaseline = row.baseline
      continue
    }

    // Anything else is a group heading or free text between lines.
    close()
  }
  close()

  if (!sawHeader) {
    warnings.push(
      'No table header found: no row names a description column and a price or total column.',
    )
  }
  for (const page of unheaded) {
    warnings.push(
      `Page ${page} has text after a table but no header row of its own; nothing on it was read.`,
    )
  }

  return { lines, warnings }
}

// ---------------------------------------------------------------------------
// Rows and columns
// ---------------------------------------------------------------------------

/** Groups text into visual rows: same page, same baseline within a point or two. */
function groupRows(items: Array<PdfTextItem>): Array<Row> {
  const sorted = items
    .filter((item) => item.text.trim() !== '')
    .flatMap(splitNumberRun)
    .sort((a, b) => a.page - b.page || a.baseline - b.baseline || a.x - b.x)

  const rows: Array<Row> = []
  for (const item of sorted) {
    const last = rows.at(-1)
    if (
      last !== undefined &&
      last.page === item.page &&
      Math.abs(last.baseline - item.baseline) <= 2
    ) {
      last.items.push(item)
      last.size = Math.max(last.size, item.size)
    } else {
      rows.push({
        page: item.page,
        baseline: item.baseline,
        size: item.size,
        items: [item],
      })
    }
  }
  for (const row of rows) row.items.sort((a, b) => a.x - b.x)
  return rows
}

/**
 * PDF readers join runs of text that sit close together, so two neighbouring
 * number columns can arrive as one piece: `100 2.004,89`. Where every word of
 * a piece is a number, the piece is split back into its words. Their positions
 * are estimated from the character count; the outer edges, which are what
 * column matching uses, stay exact.
 */
function splitNumberRun(item: PdfTextItem): Array<PdfTextItem> {
  const text = item.text.trim()
  const words = text.split(/\s+/)
  if (
    words.length < 2 ||
    words.some((word) => parseGermanNumber(word) === null)
  ) {
    return [item]
  }

  const perChar = item.w / text.length
  let offset = 0
  return words.map((word) => {
    const start = text.indexOf(word, offset)
    offset = start + word.length
    return {
      ...item,
      text: word,
      x: item.x + start * perChar,
      w: word.length * perChar,
    }
  })
}

/** A header row names at least a description, a price or total, and one more column. */
function readHeader(row: Row): Array<ColumnSpec> | null {
  const specs: Array<ColumnSpec> = []
  for (const item of row.items) {
    const name = item.text.trim().toLowerCase().replace(/:$/, '')
    const column = HEADER_NAMES[name]
    if (column === undefined) return null
    specs.push({ column, left: item.x, right: item.x + item.w })
  }
  const has = (column: Column) => specs.some((spec) => spec.column === column)
  const isHeader =
    specs.length >= 3 && has('text') && (has('unitPrice') || has('total'))
  return isHeader ? specs : null
}

/**
 * Puts each piece of text in a column. A cell lines up with its header on the
 * left edge, the right edge or the centre, so a piece belongs to the column
 * it lines up with most closely on any of the three.
 */
function assignCells(
  row: Row,
  columns: Array<ColumnSpec>,
): Partial<Record<Column, Cell>> {
  const cells: Partial<Record<Column, Cell>> = {}
  for (const item of row.items) {
    let best: ColumnSpec | null = null
    let bestDistance = Infinity
    for (const spec of columns) {
      const distance = Math.min(
        Math.abs(item.x - spec.left),
        Math.abs(item.x + item.w - spec.right),
        Math.abs(item.x + item.w / 2 - (spec.left + spec.right) / 2),
      )
      if (distance < bestDistance) {
        best = spec
        bestDistance = distance
      }
    }
    if (best === null) continue

    const box = boxOf(item)
    const existing = cells[best.column]
    cells[best.column] =
      existing === undefined
        ? { text: item.text.trim(), box }
        : {
            text: `${existing.text} ${item.text.trim()}`,
            box: union(existing.box, box),
          }
  }
  return cells
}

function firstText(row: Row): string {
  return row.items[0]?.text.trim() ?? ''
}

function isNumber(cell: Cell | undefined): boolean {
  return cell !== undefined && parseGermanNumber(cell.text) !== null
}

/** The rectangle a run of text covers, with room for descenders. */
function boxOf(item: PdfTextItem): PdfBox {
  return {
    page: item.page,
    x: round(item.x - 1),
    y: round(item.baseline - item.size * 0.95),
    w: round(item.w + 2),
    h: round(item.size * 1.3),
  }
}

function union(a: PdfBox, b: PdfBox): PdfBox {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    page: a.page,
    x: round(x),
    y: round(y),
    w: round(Math.max(a.x + a.w, b.x + b.w) - x),
    h: round(Math.max(a.y + a.h, b.y + b.h) - y),
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

// ---------------------------------------------------------------------------
// From cells to an offer line
// ---------------------------------------------------------------------------

function toOfferLine(
  open: OpenLine,
  supplierKey: string,
  seq: number,
  warnings: Array<string>,
): OfferLine {
  const { cells } = open
  const sources: OfferLine['sources'] = {}
  const source = (field: OfferField, cell: Cell | undefined) => {
    if (cell !== undefined) sources[field] = { kind: 'pdf', ...cell.box }
  }

  const number = (field: OfferField): number | null => {
    const cell = cells[field]
    if (cell === undefined) return null
    const value = parseGermanNumber(cell.text)
    if (value === null) {
      warnings.push(
        `Line ${seq + 1}, page ${open.page}: "${cell.text}" in ${field} is not a number.`,
      )
      return null
    }
    source(field, cell)
    return value
  }

  // An article number printed inside the description, when it has no column.
  let text = cells.text?.text ?? ''
  let articleNo = cells.articleNo?.text ?? null
  source('articleNo', cells.articleNo)
  if (articleNo === null) {
    const found = ARTICLE_IN_TEXT.exec(text)
    if (found !== null) {
      articleNo = found[1] ?? null
      text = text.replace(found[0], '')
      if (cells.text !== undefined) {
        sources.articleNo = { kind: 'pdf', ...cells.text.box }
      }
    }
  }
  text = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '')
    .join(' ')
    // What is left where an article number was cut out of a detail line.
    .replace(/\s*[·|;,]\s*$/, '')
  source('text', cells.text)

  const posRef = cells.posRef?.text ?? null
  source('posRef', cells.posRef)
  const unit = cells.unit?.text ?? null
  source('unit', cells.unit)

  return {
    supplierKey,
    seq,
    posRef,
    articleNo,
    text,
    qty: number('qty'),
    unit,
    unitPrice: number('unitPrice'),
    priceBasis: number('priceBasis') ?? 1,
    listPrice: number('listPrice'),
    discountPct: number('discountPct'),
    total: number('total'),
    alternative: ALTERNATIVE.test(text),
    sources,
  }
}
