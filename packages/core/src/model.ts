/**
 * The shapes every part of the system agrees on: what a tender position is,
 * what a supplier's offer line is, and where each value came from.
 */

/** A rectangle on a PDF page, in points, measured from the top-left corner. */
export interface PdfBox {
  page: number
  x: number
  y: number
  w: number
  h: number
}

/** Where a value was read from. Every displayed number carries one of these. */
export type SourceRef =
  ({ kind: 'pdf' } & PdfBox) | { kind: 'gaeb'; itemId: string; element: string }

/** One position of the Leistungsverzeichnis. */
export interface Position {
  /** Ordinal number, e.g. `03.02.0040`. */
  oz: string
  /** Running index in document order, from 0. */
  seq: number
  /** The titles the position sits under, outermost first. */
  path: Array<{ rno: string; label: string }>
  shortText: string
  longText: string
  qty: number
  unit: string
  /** The `ID` attribute of the GAEB item. */
  gaebId: string
}

export const OFFER_FIELDS = [
  'posRef',
  'articleNo',
  'text',
  'qty',
  'unit',
  'unitPrice',
  'priceBasis',
  'listPrice',
  'discountPct',
  'total',
] as const
export type OfferField = (typeof OFFER_FIELDS)[number]

/** One line of a supplier's offer, as read from the document. */
export interface OfferLine {
  supplierKey: string
  /** Running index within the supplier's document, from 0. */
  seq: number
  /** The tender position the supplier says this line answers, if stated. */
  posRef: string | null
  articleNo: string | null
  text: string
  qty: number | null
  unit: string | null
  /** Price for `priceBasis` units, as printed. */
  unitPrice: number | null
  /** The quantity the price applies to (Preiseinheit): 1, 100 or 1000. */
  priceBasis: number
  listPrice: number | null
  discountPct: number | null
  total: number | null
  /** The supplier marked the line as an alternative to what was asked for. */
  alternative: boolean
  /** Where each field was read. A field that was not found has no entry. */
  sources: Partial<Record<OfferField, SourceRef>>
}
