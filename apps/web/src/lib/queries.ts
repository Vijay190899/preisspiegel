import { convexQuery } from '@convex-dev/react-query'
import { api } from '@preisspiegel/backend/api'
import type { FunctionReturnType } from 'convex/server'

/** The demo has one tender. Routes would carry the slug once there are more. */
export const TENDER_SLUG = 'demo'

export const tenderQuery = convexQuery(api.tenders.get, { slug: TENDER_SLUG })
export const positionsQuery = convexQuery(api.positions.list, {
  slug: TENDER_SLUG,
})
/**
 * Every position's number and short text, in document order: what the
 * building says about a window. Small, so the overview sends it with the page.
 */
export const positionNamesQuery = convexQuery(api.positions.names, {
  slug: TENDER_SLUG,
})
export const positionQuery = (oz: string) =>
  convexQuery(api.positions.get, { slug: TENDER_SLUG, oz })

/** The newest run of the tender, and the newest one that reached its decisions. */
export const runQuery = convexQuery(api.runs.latest, { slug: TENDER_SLUG })
/** One letter per position in document order: `a` priced, `r` needs a person. */
export const statusesQuery = convexQuery(api.runs.statuses, {
  slug: TENDER_SLUG,
})
export const reviewQueueQuery = convexQuery(api.runs.reviewQueue, {
  slug: TENDER_SLUG,
})
export const matchQuery = (oz: string) =>
  convexQuery(api.runs.match, { slug: TENDER_SLUG, oz })

/** Labor across the tender, and the labor of one position. */
export const laborQuery = convexQuery(api.labor.summary, { slug: TENDER_SLUG })
export const positionLaborQuery = (oz: string) =>
  convexQuery(api.labor.forPosition, { slug: TENDER_SLUG, oz })

export type Tender = NonNullable<FunctionReturnType<typeof api.tenders.get>>
export type TenderDocument = Tender['documents'][number]
export type PositionRow = FunctionReturnType<typeof api.positions.list>[number]
export type PositionDetail = NonNullable<
  FunctionReturnType<typeof api.positions.get>
>
export type ReferringLine = PositionDetail['referring'][number]
export type RunSummary = NonNullable<
  FunctionReturnType<typeof api.runs.latest>['done']
>
export type Match = NonNullable<FunctionReturnType<typeof api.runs.match>>
export type MatchOffer = Match['offers'][number]
export type Finding = MatchOffer['findings'][number]
export type ReasonCode = Finding['code']
export type ReviewItem = FunctionReturnType<typeof api.runs.reviewQueue>[number]
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
export type LaborSummary = NonNullable<
  FunctionReturnType<typeof api.labor.summary>
>
export type PositionLabor = NonNullable<
  FunctionReturnType<typeof api.labor.forPosition>
>
