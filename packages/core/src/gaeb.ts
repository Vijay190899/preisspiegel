/**
 * GAEB DA XML: the exchange format German tenders travel in.
 *
 * Phase 83 (X83) is the request for prices: positions with quantities and
 * texts, no prices. Phase 84 (X84) is the offer: the same positions with a
 * unit price and a total each.
 *
 * This reads and writes the subset of DA XML 3.2 a bill of quantities needs:
 * project info, the breakdown of the ordinal number, nested categories, and
 * items with quantity, unit, short text, long text and prices.
 */
import { XMLParser } from 'fast-xml-parser'
import type { OfferLine, Position, SourceRef } from './model'

export type GaebPhase = 83 | 84

export interface GaebItem {
  id: string
  /** This item's part of the ordinal number. */
  rno: string
  qty: number
  unit: string
  shortText: string
  /** Paragraphs are separated by a newline. */
  longText: string
  /** Unit price. Phase 84 only. */
  unitPrice?: number
  /** Item total. Phase 84 only. */
  total?: number
}

export interface GaebCategory {
  id: string
  rno: string
  label: string
  categories: Array<GaebCategory>
  items: Array<GaebItem>
}

export interface GaebLevel {
  type: 'BoQLevel' | 'Item'
  label?: string
  /** Number of digits of this part of the ordinal number. */
  length: number
}

export interface GaebDocument {
  phase: GaebPhase
  date: string
  time: string
  program: { system: string; name: string }
  project: { name: string; label: string; currency: string }
  boq: {
    id: string
    name: string
    label: string
    date: string
    levels: Array<GaebLevel>
    categories: Array<GaebCategory>
    items: Array<GaebItem>
  }
}

export class GaebError extends Error {
  override name = 'GaebError'
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

const CURRENCY_LABELS: Partial<Record<string, string>> = { EUR: 'Euro' }

/** Serialises a document. The output is stable: same input, same bytes. */
export function writeGaeb(doc: GaebDocument): string {
  const out: Array<string> = []
  const line = (depth: number, text: string) =>
    out.push(`${'  '.repeat(depth)}${text}`)
  const leaf = (depth: number, name: string, value: string | number) =>
    line(depth, `<${name}>${escapeXml(String(value))}</${name}>`)
  const currencyLabel = CURRENCY_LABELS[doc.project.currency] ?? ''

  const paragraphs = (depth: number, text: string) => {
    for (const paragraph of text.split('\n')) {
      line(depth, `<p><span>${escapeXml(paragraph)}</span></p>`)
    }
  }

  const item = (depth: number, entry: GaebItem) => {
    line(
      depth,
      `<Item ID="${escapeXml(entry.id)}" RNoPart="${escapeXml(entry.rno)}">`,
    )
    leaf(depth + 1, 'Qty', entry.qty.toFixed(3))
    leaf(depth + 1, 'QU', entry.unit)
    if (entry.unitPrice !== undefined) {
      leaf(depth + 1, 'UP', entry.unitPrice.toFixed(2))
    }
    if (entry.total !== undefined) leaf(depth + 1, 'IT', entry.total.toFixed(2))
    line(depth + 1, '<Description>')
    line(depth + 2, '<CompleteText>')
    line(depth + 3, '<DetailTxt>')
    line(depth + 4, '<Text>')
    paragraphs(depth + 5, entry.longText)
    line(depth + 4, '</Text>')
    line(depth + 3, '</DetailTxt>')
    line(depth + 3, '<OutlineText>')
    line(depth + 4, '<OutlTxt>')
    line(depth + 5, '<TextOutlTxt>')
    paragraphs(depth + 6, entry.shortText)
    line(depth + 5, '</TextOutlTxt>')
    line(depth + 4, '</OutlTxt>')
    line(depth + 3, '</OutlineText>')
    line(depth + 2, '</CompleteText>')
    line(depth + 1, '</Description>')
    line(depth, '</Item>')
  }

  const body = (
    depth: number,
    categories: Array<GaebCategory>,
    items: Array<GaebItem>,
  ) => {
    line(depth, '<BoQBody>')
    for (const category of categories) {
      line(
        depth + 1,
        `<BoQCtgy ID="${escapeXml(category.id)}" RNoPart="${escapeXml(category.rno)}">`,
      )
      line(depth + 2, '<LblTx>')
      paragraphs(depth + 3, category.label)
      line(depth + 2, '</LblTx>')
      body(depth + 2, category.categories, category.items)
      line(depth + 1, '</BoQCtgy>')
    }
    if (items.length > 0) {
      line(depth + 1, '<Itemlist>')
      for (const entry of items) item(depth + 2, entry)
      line(depth + 1, '</Itemlist>')
    }
    line(depth, '</BoQBody>')
  }

  line(0, '<?xml version="1.0" encoding="UTF-8"?>')
  line(0, `<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/DA${doc.phase}/3.2">`)
  line(1, '<GAEBInfo>')
  leaf(2, 'Version', '3.2')
  leaf(2, 'VersDate', '2013-10')
  leaf(2, 'Date', doc.date)
  leaf(2, 'Time', doc.time)
  leaf(2, 'ProgSystem', doc.program.system)
  leaf(2, 'ProgName', doc.program.name)
  line(1, '</GAEBInfo>')
  line(1, '<PrjInfo>')
  leaf(2, 'NamePrj', doc.project.name)
  leaf(2, 'LblPrj', doc.project.label)
  leaf(2, 'Cur', doc.project.currency)
  leaf(2, 'CurLbl', currencyLabel)
  leaf(2, 'UPFracDig', 2)
  line(1, '</PrjInfo>')
  line(1, '<Award>')
  leaf(2, 'DP', doc.phase)
  line(2, '<AwardInfo>')
  leaf(3, 'Cur', doc.project.currency)
  leaf(3, 'CurLbl', currencyLabel)
  line(2, '</AwardInfo>')
  line(2, `<BoQ ID="${escapeXml(doc.boq.id)}">`)
  line(3, '<BoQInfo>')
  leaf(4, 'Name', doc.boq.name)
  leaf(4, 'LblBoQ', doc.boq.label)
  leaf(4, 'Date', doc.boq.date)
  leaf(4, 'OutlCompl', 'AllTxt')
  for (const level of doc.boq.levels) {
    line(4, '<BoQBkdn>')
    leaf(5, 'Type', level.type)
    if (level.label !== undefined) leaf(5, 'LblBoQBkdn', level.label)
    leaf(5, 'Length', level.length)
    leaf(5, 'Num', 'Yes')
    line(4, '</BoQBkdn>')
  }
  line(3, '</BoQInfo>')
  body(3, doc.boq.categories, doc.boq.items)
  line(2, '</BoQ>')
  line(1, '</Award>')
  line(0, '</GAEB>')
  return `${out.join('\n')}\n`
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** A parsed XML element: its children by name, plus `#text` and attributes. */
type XmlNode = { [key: string]: XmlValue }
type XmlValue = string | XmlNode | Array<XmlValue> | undefined

const REPEATING = new Set(['BoQCtgy', 'Item', 'BoQBkdn', 'p', 'span'])

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  // Values stay strings: `0010` must not become the number 10.
  parseTagValue: false,
  parseAttributeValue: false,
  // Whitespace inside a text matters: two spans of one sentence meet at a
  // space. Values are trimmed where they are read instead.
  trimValues: false,
  isArray: (name) => REPEATING.has(name),
})

/** Parses a GAEB DA XML file of phase 83 or 84. */
export function parseGaeb(xml: string): GaebDocument {
  let root: XmlNode
  try {
    root = parser.parse(xml) as XmlNode
  } catch (error) {
    throw new GaebError(
      `Not well-formed XML: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const gaeb = child(root, 'GAEB')
  if (gaeb === null) throw new GaebError('No <GAEB> root element.')

  const info = child(gaeb, 'GAEBInfo')
  const project = child(gaeb, 'PrjInfo')
  const award = child(gaeb, 'Award')
  const boq = award === null ? null : child(award, 'BoQ')
  if (award === null || boq === null) {
    throw new GaebError(
      'No <Award>/<BoQ>: this file has no bill of quantities.',
    )
  }

  const phase = Number(textOf(award, 'DP'))
  if (phase !== 83 && phase !== 84) {
    throw new GaebError(
      `Unsupported exchange phase "${textOf(award, 'DP')}". Only 83 and 84 are read.`,
    )
  }

  const boqInfo = child(boq, 'BoQInfo')
  const levels = (boqInfo === null ? [] : children(boqInfo, 'BoQBkdn')).map(
    (level): GaebLevel => {
      const label = textOf(level, 'LblBoQBkdn')
      return {
        type: textOf(level, 'Type') === 'Item' ? 'Item' : 'BoQLevel',
        ...(label === '' ? {} : { label }),
        length: Number(textOf(level, 'Length')),
      }
    },
  )

  const body = readBody(child(boq, 'BoQBody'), phase)
  return {
    phase,
    date: info === null ? '' : textOf(info, 'Date'),
    time: info === null ? '' : textOf(info, 'Time'),
    program: {
      system: info === null ? '' : textOf(info, 'ProgSystem'),
      name: info === null ? '' : textOf(info, 'ProgName'),
    },
    project: {
      name: project === null ? '' : textOf(project, 'NamePrj'),
      label: project === null ? '' : textOf(project, 'LblPrj'),
      currency: project === null ? '' : textOf(project, 'Cur'),
    },
    boq: {
      id: attribute(boq, 'ID'),
      name: boqInfo === null ? '' : textOf(boqInfo, 'Name'),
      label: boqInfo === null ? '' : textOf(boqInfo, 'LblBoQ'),
      date: boqInfo === null ? '' : textOf(boqInfo, 'Date'),
      levels,
      ...body,
    },
  }
}

function readBody(
  body: XmlNode | null,
  phase: GaebPhase,
): { categories: Array<GaebCategory>; items: Array<GaebItem> } {
  if (body === null) return { categories: [], items: [] }

  const categories = children(body, 'BoQCtgy').map(
    (category): GaebCategory => ({
      id: attribute(category, 'ID'),
      rno: attribute(category, 'RNoPart'),
      label: richText(child(category, 'LblTx')),
      ...readBody(child(category, 'BoQBody'), phase),
    }),
  )

  const itemlist = child(body, 'Itemlist')
  const items = (itemlist === null ? [] : children(itemlist, 'Item')).map(
    (item): GaebItem => {
      const id = attribute(item, 'ID')
      const complete = descend(item, ['Description', 'CompleteText'])
      const entry: GaebItem = {
        id,
        rno: attribute(item, 'RNoPart'),
        qty: decimal(textOf(item, 'Qty'), `Qty of item ${id}`),
        unit: textOf(item, 'QU'),
        shortText: richText(
          descend(complete, ['OutlineText', 'OutlTxt', 'TextOutlTxt']),
        ),
        longText: richText(descend(complete, ['DetailTxt', 'Text'])),
      }
      if (phase === 84) {
        const unitPrice = textOf(item, 'UP')
        const total = textOf(item, 'IT')
        if (unitPrice !== '') {
          entry.unitPrice = decimal(unitPrice, `UP of item ${id}`)
        }
        if (total !== '') entry.total = decimal(total, `IT of item ${id}`)
      }
      return entry
    },
  )

  return { categories, items }
}

/** GAEB decimals use a point. Anything else is an error, not a zero. */
function decimal(raw: string, what: string): number {
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new GaebError(`${what} is not a number: "${raw}"`)
  }
  return Number(raw)
}

function child(node: XmlNode, name: string): XmlNode | null {
  const value = node[name]
  const first = Array.isArray(value) ? value[0] : value
  return isNode(first) ? first : null
}

function children(node: XmlNode, name: string): Array<XmlNode> {
  const value = node[name]
  const list = Array.isArray(value) ? value : value === undefined ? [] : [value]
  return list.filter(isNode)
}

function descend(node: XmlNode | null, path: Array<string>): XmlNode | null {
  let current = node
  for (const name of path) {
    if (current === null) return null
    current = child(current, name)
  }
  return current
}

function textOf(node: XmlNode, name: string): string {
  const value = node[name]
  const first = Array.isArray(value) ? value[0] : value
  if (typeof first === 'string') return first.trim()
  return isNode(first) ? ownText(first) : ''
}

function attribute(node: XmlNode, name: string): string {
  const value = node[`@${name}`]
  return typeof value === 'string' ? value : ''
}

function ownText(node: XmlNode): string {
  const value = node['#text']
  return typeof value === 'string' ? value.trim() : ''
}

function isNode(value: XmlValue): value is XmlNode {
  return typeof value === 'object' && !Array.isArray(value)
}

/**
 * Formatted text: paragraphs of spans. Spans of one paragraph are joined, and
 * paragraphs are separated by a newline. Text placed directly in an element is
 * kept too, since not every exporter wraps it.
 */
function richText(node: XmlNode | null): string {
  if (node === null) return ''
  const paragraphs = children(node, 'p')
  const blocks = paragraphs.length === 0 ? [node] : paragraphs
  return blocks
    .map((block) => flatten(block).replace(/\s+/g, ' ').trim())
    .filter((block) => block !== '')
    .join('\n')
}

/** All text below a node, in document order, with attributes left out. */
function flatten(value: XmlValue): string {
  if (typeof value === 'string') return value
  if (value === undefined) return ''
  if (Array.isArray(value)) return value.map(flatten).join('')
  return Object.entries(value)
    .filter(([key]) => !key.startsWith('@'))
    .map(([, inner]) => flatten(inner))
    .join('')
}

// ---------------------------------------------------------------------------
// From a document to positions and offer lines
// ---------------------------------------------------------------------------

/** Every item of the bill of quantities, in document order, with its ordinal number. */
export function gaebPositions(doc: GaebDocument): Array<Position> {
  const positions: Array<Position> = []
  walkItems(doc, (item, path) => {
    positions.push({
      oz: [...path.map((part) => part.rno), item.rno].join('.'),
      seq: positions.length,
      path,
      shortText: item.shortText,
      longText: item.longText,
      qty: item.qty,
      unit: item.unit,
      gaebId: item.id,
    })
  })
  return positions
}

/**
 * The priced items of a phase 84 file as offer lines. An item without a unit
 * price is one the supplier did not quote, so it produces no line.
 */
export function gaebOfferLines(
  doc: GaebDocument,
  supplierKey: string,
): Array<OfferLine> {
  if (doc.phase !== 84) {
    throw new GaebError('Offer lines come from a phase 84 file.')
  }
  const lines: Array<OfferLine> = []
  walkItems(doc, (item, path) => {
    if (item.unitPrice === undefined) return
    const source = (element: string): SourceRef => ({
      kind: 'gaeb',
      itemId: item.id,
      element,
    })
    lines.push({
      supplierKey,
      seq: lines.length,
      posRef: [...path.map((part) => part.rno), item.rno].join('.'),
      articleNo: null,
      text: item.shortText,
      qty: item.qty,
      unit: item.unit,
      unitPrice: item.unitPrice,
      priceBasis: 1,
      listPrice: null,
      discountPct: null,
      total: item.total ?? null,
      alternative: false,
      sources: {
        posRef: source('RNoPart'),
        text: source('OutlineText'),
        qty: source('Qty'),
        unit: source('QU'),
        unitPrice: source('UP'),
        ...(item.total === undefined ? {} : { total: source('IT') }),
      },
    })
  })
  return lines
}

function walkItems(
  doc: GaebDocument,
  visit: (item: GaebItem, path: Array<{ rno: string; label: string }>) => void,
): void {
  const walk = (
    categories: Array<GaebCategory>,
    items: Array<GaebItem>,
    path: Array<{ rno: string; label: string }>,
  ) => {
    for (const category of categories) {
      walk(category.categories, category.items, [
        ...path,
        { rno: category.rno, label: category.label },
      ])
    }
    for (const item of items) visit(item, path)
  }
  walk(doc.boq.categories, doc.boq.items, [])
}
