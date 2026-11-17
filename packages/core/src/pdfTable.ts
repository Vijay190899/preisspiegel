/**
 * Reads a supplier's offer table out of the text of a PDF.
 *
 * The input is every piece of text on every page with its position. The
 * output is one offer line per table row, and for every field the rectangle
 * it was read from, so a price can be shown at its place in the document.
 *
 * Nothing here knows a supplier. Columns are found from the table's own
 * header row, matched against the names German offers use for them. Where a
 * column begins and ends is worked out from how the rows under the header
 * line up with it, because a header can sit flush left over figures that sit
 * flush right, and a PDF reader can hand over two neighbouring cells as one
 * piece of text.
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

/** `other` is a column the table has and an offer line has no field for. */
type Column = OfferField | 'lineNo' | 'other'

const NUMERIC: ReadonlyArray<Column> = [
  'qty',
  'unitPrice',
  'priceBasis',
  'listPrice',
  'discountPct',
  'total',
]

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
  gp: 'total',
  ep: 'unitPrice',
  anzahl: 'qty',
  // The first half of a header that wraps onto a second row.
  'artikel-': 'articleNo',
  'einzel-': 'unitPrice',
  'gesamt-': 'total',
}

/** A table may have this many columns nobody asked for, such as a delivery time. */
const MAX_UNKNOWN_COLUMNS = 2

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

/** A header cell: which column it names and where it sits. */
interface HeaderCell {
  column: Column
  left: number
  right: number
}

interface ColumnSpec extends HeaderCell {
  /** The column's share of the page. A piece of text belongs where it lies. */
  from: number
  to: number
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
  /** Pages with a header, and how many lines were read under it. */
  const headed = new Map<number, number>()
  /** Rows that turned out to be the other half of a wrapped header. */
  const headerParts = new Set<Row>()
  let columnsPage = -1
  let headerBaseline = 0
  let open: OpenLine | null = null

  const close = () => {
    if (open === null) return
    lines.push(toOfferLine(open, supplierKey, lines.length, warnings))
    headed.set(open.page, (headed.get(open.page) ?? 0) + 1)
    open = null
  }

  for (const row of rows) {
    if (headerParts.has(row)) continue
    const header = readHeader(row)
    if (header !== null) {
      // A header starts a table, or repeats it at the top of a new page.
      close()
      // A header cell that wraps puts its halves on the rows just above and
      // below the others. Names found there are columns too.
      for (const near of rows) {
        const apart = Math.abs(near.baseline - row.baseline)
        if (
          near === row ||
          near.page !== row.page ||
          apart > row.size * 1.2 ||
          near.items.every((item) => headerName(item.text) === undefined)
        ) {
          continue
        }
        headerParts.add(near)
        for (const item of near.items) {
          const column = headerName(item.text)
          // A name right above or below a header cell is that cell's other
          // half, not a column of its own.
          const partOfAnother = header.some(
            (cell) => item.x < cell.right && item.x + item.w > cell.left,
          )
          if (column !== undefined && !partOfAnother) {
            header.push({ column, left: item.x, right: item.x + item.w })
          }
        }
      }
      header.sort((a, b) => a.left - b.left)
      const last = Math.max(
        row.baseline,
        ...[...headerParts]
          .filter((part) => part.page === row.page)
          .map((part) => part.baseline),
      )
      columns = columnsOf(
        header,
        rows.filter(
          (below) => below.page === row.page && below.baseline > last,
        ),
      )
      sawHeader = true
      unheaded.delete(row.page)
      if (!headed.has(row.page)) headed.set(row.page, 0)
      columnsPage = row.page
      headerBaseline = row.baseline
      continue
    }
    if (columns === null) {
      // After a table has ended: a page of terms is nothing to report, a
      // page whose rows still look priced is.
      if (sawHeader && !headed.has(row.page) && looksPriced(row)) {
        unheaded.add(row.page)
      }
      continue
    }
    if (row.page !== columnsPage) {
      // A page without its own header: the table has ended.
      close()
      columns = null
      if (looksPriced(row)) unheaded.add(row.page)
      continue
    }
    if (row.baseline <= headerBaseline) continue

    const cells = assignCells(row, columns)
    const text = cells.text?.text ?? ''
    if (SUMMARY_ROW.test(text) || SUMMARY_ROW.test(firstText(row))) {
      close()
      continue
    }

    const numbers = NUMERIC.filter((column) => isNumber(cells[column])).length
    const priced =
      isNumber(cells.unitPrice) || isNumber(cells.total) || isNumber(cells.qty)
    // One number alone is a page number or a stray figure, not a lost line.
    if (priced && text === '' && numbers >= 2) {
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

    // A row without a number, straight under an offer line, continues it.
    // Each piece goes to the column it starts in, whole, however far across
    // the page it runs: a description, or the rest of a wrapped article number.
    const current: OpenLine | null = open
    if (
      current !== null &&
      numbers === 0 &&
      row.page === current.page &&
      row.baseline - current.lastBaseline <= current.size * 1.9
    ) {
      const table = columns
      let continued = false
      for (const item of row.items) {
        const column = table.find(
          (spec) => item.x >= spec.from - 0.5 && item.x < spec.to,
        )?.column
        if (column !== 'text' && column !== 'articleNo') continue
        const piece = item.text.trim()
        const previous = current.cells[column]
        const glue =
          column === 'text' ? '\n' : previous?.text.endsWith('-') ? '' : ' '
        current.cells[column] =
          previous === undefined
            ? { text: piece, box: boxOf(item) }
            : {
                text: `${previous.text}${glue}${piece}`,
                box: union(previous.box, boxOf(item)),
              }
        continued = true
      }
      if (continued) {
        current.lastBaseline = row.baseline
        continue
      }
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
      `Page ${page} has priced rows after a table but no header row of its own; nothing on it was read.`,
    )
  }
  for (const [page, count] of headed) {
    if (count === 0) {
      warnings.push(
        `Page ${page} has a table header but no line could be read under it.`,
      )
    }
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
 * The words of a piece of text, each with its own place. The outer edges are
 * exact. Inside, a word is as wide as its letters usually are, and whatever
 * width is left over lies in the gaps: a piece much wider than its letters is
 * two cells with the space between two columns in the middle.
 */
function wordsOf(item: PdfTextItem): Array<PdfTextItem> {
  if (!/\S\s+\S/.test(item.text)) return [item]
  const matches = [...item.text.matchAll(/\S+/g)]
  const perChar = Math.min(item.size * 0.5, item.w / item.text.length)
  const spare = Math.max(0, item.w - item.text.length * perChar)
  const perGap = spare / Math.max(1, matches.length - 1)
  return matches.map((match, index) => ({
    ...item,
    text: match[0],
    x: item.x + match.index * perChar + index * perGap,
    w: match[0].length * perChar,
  }))
}

const headerName = (text: string) =>
  HEADER_NAMES[text.trim().toLowerCase().replace(/:$/, '')]

/**
 * A header row names at least a description, a price or total, and one more
 * column. It may also name a few columns an offer line has no field for. Two
 * header cells that arrive as one piece of text are told apart by name.
 */
function readHeader(row: Row): Array<HeaderCell> | null {
  const found: Array<HeaderCell> = []
  let unknown = 0
  const add = (
    column: Column | undefined,
    first: PdfTextItem,
    last = first,
  ) => {
    if (column === undefined) unknown++
    found.push({
      column: column ?? 'other',
      left: first.x,
      right: last.x + last.w,
    })
  }

  for (const item of row.items) {
    const whole = headerName(item.text)
    if (whole !== undefined) {
      add(whole, item)
      continue
    }
    // Longest names first, so "EP netto" is not read as "EP" and a stray word.
    const words = wordsOf(item)
    let index = 0
    while (index < words.length) {
      let taken = 0
      for (let end = words.length; end > index && taken === 0; end--) {
        const span = words.slice(index, end)
        const column = headerName(span.map((word) => word.text).join(' '))
        const [first] = span
        const last = span.at(-1)
        if (column !== undefined && first !== undefined && last !== undefined) {
          add(column, first, last)
          taken = span.length
        }
      }
      if (taken === 0) {
        const word = words[index]
        if (word !== undefined) add(undefined, word)
        taken = 1
      }
      index += taken
      if (unknown > MAX_UNKNOWN_COLUMNS) return null
    }
  }

  const has = (column: Column) => found.some((cell) => cell.column === column)
  const isHeader =
    unknown <= MAX_UNKNOWN_COLUMNS &&
    found.length - unknown >= 3 &&
    has('text') &&
    (has('unitPrice') || has('total'))
  return isHeader ? found.sort((a, b) => a.left - b.left) : null
}

/** How far an edge may be off its header's edge and still line up with it. */
const ALIGNED = 1.5

/**
 * Where each column begins and ends. A header says only where its own words
 * are. The rows under it say how the column is set: flush left with the
 * header, flush right with it, or centred. From that follows where one
 * column stops and the next starts:
 *
 * - two columns set flush left meet where the second header begins;
 * - two set flush right meet where the first header ends;
 * - text flush left before figures flush right meet just before the widest
 *   figure;
 * - anything else meets half way between the two headers.
 */
function columnsOf(
  header: Array<HeaderCell>,
  below: Array<Row>,
): Array<ColumnSpec> {
  const items = below.flatMap((row) => row.items)
  const set = header.map((cell) => {
    const flushLeft = items.filter(
      (item) => Math.abs(item.x - cell.left) <= ALIGNED,
    )
    const flushRight = items.filter(
      (item) => Math.abs(item.x + item.w - cell.right) <= ALIGNED,
    )
    const centred = items.filter(
      (item) =>
        Math.abs(item.x + item.w / 2 - (cell.left + cell.right) / 2) <= ALIGNED,
    ).length
    const most = Math.max(flushLeft.length, flushRight.length, centred)
    const align: 'left' | 'right' | 'centre' =
      most === 0 || flushLeft.length === most
        ? 'left'
        : flushRight.length === most
          ? 'right'
          : 'centre'
    return { cell, align, flushRight }
  })

  const boundary = (index: number): number => {
    const here = set[index]
    const next = set[index + 1]
    if (here === undefined || next === undefined) return Infinity
    const half = (here.cell.right + next.cell.left) / 2
    if (here.align === 'left' && next.align === 'left') {
      return next.cell.left - 0.5
    }
    if (here.align === 'right' && next.align === 'right') {
      return here.cell.right + 0.5
    }
    if (here.align === 'left' && next.align === 'right') {
      const widest = Math.min(...next.flushRight.map((item) => item.x))
      return Math.max(
        here.cell.right + 0.5,
        Math.min(widest, next.cell.left) - 1,
      )
    }
    return half
  }

  return header.map((cell, index) => ({
    ...cell,
    from: index === 0 ? -Infinity : boundary(index - 1),
    to: boundary(index),
  }))
}

/**
 * A row that carries at least two figures, one of them with decimals, and is
 * not a line of the totals under a table.
 */
function looksPriced(row: Row): boolean {
  if (row.items.some((item) => SUMMARY_ROW.test(item.text.trim()))) {
    return false
  }
  const figures = row.items
    .flatMap(wordsOf)
    .map((item) => item.text.trim())
    .filter((text) => parseGermanNumber(text) !== null)
  return figures.length >= 2 && figures.some((text) => /,\d{2}$/.test(text))
}

/**
 * Puts each piece of text in the column it lies in. A piece that reaches
 * across a column's edge is two cells that arrived as one, so it is taken
 * apart into its words and each word goes where its middle is.
 */
function assignCells(
  row: Row,
  columns: Array<ColumnSpec>,
): Partial<Record<Column, Cell>> {
  const cells: Partial<Record<Column, Cell>> = {}
  const put = (spec: ColumnSpec, item: PdfTextItem) => {
    if (spec.column === 'other') return
    const box = boxOf(item)
    const existing = cells[spec.column]
    cells[spec.column] =
      existing === undefined
        ? { text: item.text.trim(), box }
        : {
            text: `${existing.text} ${item.text.trim()}`,
            box: union(existing.box, box),
          }
  }
  const holding = (x: number) =>
    columns.find((spec) => x >= spec.from && x < spec.to)

  for (const item of row.items) {
    const within = columns.find(
      (spec) => item.x >= spec.from - 0.5 && item.x + item.w <= spec.to + 0.5,
    )
    if (within !== undefined) {
      put(within, item)
      continue
    }
    for (const word of wordsOf(item)) {
      const spec = holding(word.x + word.w / 2)
      if (spec !== undefined) put(spec, word)
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
