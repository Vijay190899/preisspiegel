import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

/** Where a value was read from. Mirrors `SourceRef` in `@preisspiegel/core`. */
export const sourceRef = v.union(
  v.object({
    kind: v.literal('pdf'),
    page: v.number(),
    x: v.number(),
    y: v.number(),
    w: v.number(),
    h: v.number(),
  }),
  v.object({
    kind: v.literal('gaeb'),
    itemId: v.string(),
    element: v.string(),
  }),
)

export default defineSchema({
  // --- The tender and its documents, loaded by `pnpm seed` ----------------
  //
  // Rows refer to their tender by slug, not by document id, so a tender can
  // be reloaded without its address changing.

  tenders: defineTable({
    slug: v.string(),
    projectNo: v.string(),
    project: v.string(),
    lot: v.string(),
    client: v.string(),
    contractor: v.string(),
    currency: v.string(),
    positionCount: v.number(),
  }).index('by_slug', ['slug']),

  documents: defineTable({
    tenderSlug: v.string(),
    /** `tender`, or the supplier's key. */
    key: v.string(),
    kind: v.union(v.literal('tender'), v.literal('offer')),
    supplierName: v.union(v.string(), v.null()),
    format: v.union(v.literal('x83'), v.literal('x84'), v.literal('pdf')),
    fileName: v.string(),
    date: v.string(),
    pageCount: v.union(v.number(), v.null()),
    /** Positions in a tender, offer lines in an offer. */
    lineCount: v.number(),
  }).index('by_tenderSlug_and_key', ['tenderSlug', 'key']),

  // One position of the Leistungsverzeichnis.
  positions: defineTable({
    tenderSlug: v.string(),
    /** Ordinal number, e.g. `03.02.0040`. */
    oz: v.string(),
    seq: v.number(),
    path: v.array(v.object({ rno: v.string(), label: v.string() })),
    shortText: v.string(),
    longText: v.string(),
    qty: v.number(),
    unit: v.string(),
    gaebId: v.string(),
  })
    .index('by_tenderSlug_and_seq', ['tenderSlug', 'seq'])
    .index('by_tenderSlug_and_oz', ['tenderSlug', 'oz']),

  // One line of a supplier's offer, as read from the document. Every number
  // here was parsed by code, and `sources` says where each field was found.
  offerLines: defineTable({
    tenderSlug: v.string(),
    supplierKey: v.string(),
    seq: v.number(),
    posRef: v.union(v.string(), v.null()),
    articleNo: v.union(v.string(), v.null()),
    text: v.string(),
    qty: v.union(v.number(), v.null()),
    unit: v.union(v.string(), v.null()),
    unitPrice: v.union(v.number(), v.null()),
    priceBasis: v.number(),
    listPrice: v.union(v.number(), v.null()),
    discountPct: v.union(v.number(), v.null()),
    total: v.union(v.number(), v.null()),
    alternative: v.boolean(),
    sources: v.record(v.string(), sourceRef),
  })
    .index('by_tenderSlug_and_supplierKey_and_seq', [
      'tenderSlug',
      'supplierKey',
      'seq',
    ])
    .index('by_tenderSlug_and_posRef', ['tenderSlug', 'posRef']),

  // --- The cost meter ------------------------------------------------------

  // One row per model call. Append-only.
  llmLedger: defineTable({
    /** UTC day, `YYYY-MM-DD`. */
    day: v.string(),
    at: v.number(),
    provider: v.string(),
    role: v.string(),
    /** Canonical model ID. */
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cacheReadTokens: v.number(),
    cacheWriteTokens: v.number(),
    usd: v.number(),
    stopReason: v.union(v.string(), v.null()),
  }).index('by_day', ['day']),

  // Running total per day, so the budget guard reads one document instead of
  // summing the ledger. Written in the same mutation as each ledger row.
  llmSpend: defineTable({
    day: v.string(),
    usd: v.number(),
    calls: v.number(),
  }).index('by_day', ['day']),
})
