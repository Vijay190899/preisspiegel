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
      documents: documents.map((document) => ({
        key: document.key,
        kind: document.kind,
        supplierName: document.supplierName,
        format: document.format,
        fileName: document.fileName,
        date: document.date,
        pageCount: document.pageCount,
        lineCount: document.lineCount,
      })),
    }
  },
})

/** One position by its ordinal number, with the offer lines that refer to it. */
export const position = query({
  args: { slug: v.string(), oz: v.string() },
  handler: async (ctx, { slug, oz }) => {
    const found = await ctx.db
      .query('positions')
      .withIndex('by_tenderSlug_and_oz', (q) =>
        q.eq('tenderSlug', slug).eq('oz', oz),
      )
      .unique()
    if (found === null) return null

    const referring = await ctx.db
      .query('offerLines')
      .withIndex('by_tenderSlug_and_posRef', (q) =>
        q.eq('tenderSlug', slug).eq('posRef', oz),
      )
      .take(20)

    return { position: found, referring }
  },
})
