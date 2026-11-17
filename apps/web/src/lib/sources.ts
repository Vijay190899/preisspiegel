/**
 * What "where did this number come from" points at. A source is named in the
 * URL, so a link to a position can carry the marked place with it:
 *
 *   ?quelle=a.0.unitPrice   line 0 of supplier a's offer, its unit price
 *   ?quelle=lv.qty          the tender position itself, its quantity
 */
import { offers, tenderDocument } from './queries'
import type {
  PositionDetail,
  ReferringLine,
  SourceRef,
  Tender,
  TenderDocument,
} from './queries'
import type { MessageKey } from './i18n'

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

export const FIELD_LABELS: Record<OfferField, MessageKey> = {
  posRef: 'field.posRef',
  articleNo: 'field.articleNo',
  text: 'field.text',
  qty: 'field.qty',
  unit: 'field.unit',
  unitPrice: 'field.unitPrice',
  priceBasis: 'field.priceBasis',
  listPrice: 'field.listPrice',
  discountPct: 'field.discountPct',
  total: 'field.total',
}

export function offerSource(
  supplierKey: string,
  seq: number,
  field: OfferField,
): string {
  return `${supplierKey}.${seq}.${field}`
}

export const tenderSource = (field: 'qty' | 'text') => `lv.${field}`

export interface ResolvedSource {
  document: TenderDocument
  ref: SourceRef
  /** Which field this is, for the caption. */
  label: MessageKey
}

/** Looks a source name up in the position it belongs to. `null` if it names nothing. */
export function resolveSource(
  name: string | undefined,
  tender: Tender,
  detail: PositionDetail,
  /** The offer lines on the page, where they are more than the ones that name the position. */
  lines: ReadonlyArray<ReferringLine> = detail.referring,
): ResolvedSource | null {
  if (name === undefined) return null
  const [key, second, third] = name.split('.')

  if (key === 'lv') {
    const document = tenderDocument(tender)
    if (document === undefined || third !== undefined) return null
    if (second !== 'qty' && second !== 'text') return null
    const isQty = second === 'qty'
    return {
      document,
      ref: {
        kind: 'gaeb',
        itemId: detail.position.gaebId,
        // The short and the long text sit together in <Description>.
        element: isQty ? 'Qty' : 'Description',
      },
      label: isQty ? 'field.qty' : 'field.description',
    }
  }

  const document = offers(tender).find((offer) => offer.key === key)
  const line = lines.find(
    (candidate) =>
      candidate.supplierKey === key && String(candidate.seq) === second,
  )
  const field = OFFER_FIELDS.find((candidate) => candidate === third)
  if (document === undefined || line === undefined || field === undefined) {
    return null
  }
  const ref = line.sources[field]
  return ref === undefined
    ? null
    : { document, ref, label: FIELD_LABELS[field] }
}

export const documentUrl = (document: TenderDocument) =>
  `/demo/${document.fileName}`
