import { convexQuery } from '@convex-dev/react-query'
import { api } from '@preisspiegel/backend/api'
import type { FunctionReturnType } from 'convex/server'

/** The demo has one tender. Routes would carry the slug once there are more. */
export const TENDER_SLUG = 'demo'

export const tenderQuery = convexQuery(api.tenders.get, { slug: TENDER_SLUG })
export const positionsQuery = convexQuery(api.positions.list, {
  slug: TENDER_SLUG,
})
export const positionQuery = (oz: string) =>
  convexQuery(api.positions.get, { slug: TENDER_SLUG, oz })

export type Tender = NonNullable<FunctionReturnType<typeof api.tenders.get>>
export type TenderDocument = Tender['documents'][number]
export type PositionRow = FunctionReturnType<typeof api.positions.list>[number]
export type PositionDetail = NonNullable<
  FunctionReturnType<typeof api.positions.get>
>
export type ReferringLine = PositionDetail['referring'][number]
export type SourceRef = ReferringLine['sources'][string]

/** The offers of a tender in a fixed order, so a supplier keeps its column. */
export function offers(tender: Tender): Array<TenderDocument> {
  return tender.documents
    .filter((document) => document.kind === 'offer')
    .sort((a, b) => a.key.localeCompare(b.key))
}

export function tenderDocument(tender: Tender): TenderDocument | undefined {
  return tender.documents.find((document) => document.kind === 'tender')
}
