import { v } from 'convex/values'
import { query } from './_generated/server'

/** A tender with its documents, or `null` when nothing is loaded under that slug. */
export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const tender = await ctx.db
      .query('tenders')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()
    if (tender === null) return null

    // A tender has its own file and a handful of offers.
    const documents = await ctx.db
      .query('documents')
      .withIndex('by_tenderSlug_and_key', (q) => q.eq('tenderSlug', slug))
      .take(50)

    return {
      slug: tender.slug,
      projectNo: tender.projectNo,
      project: tender.project,
      lot: tender.lot,
      client: tender.client,
      contractor: tender.contractor,
      currency: tender.currency,
      positionCount: tender.positionCount,
      referencedPositionCount: tender.referencedPositionCount,
      titles: tender.titles,
      storeys: tender.storeys ?? [],
      storeyByPosition: tender.storeyByPosition ?? '',
      documents: documents.map((document) => ({
        key: document.key,
        kind: document.kind,
        supplierName: document.supplierName,
        format: document.format,
        fileName: document.fileName,
        date: document.date,
        pageCount: document.pageCount,
        lineCount: document.lineCount,
        referenceCount: document.referenceCount,
      })),
    }
  },
})
