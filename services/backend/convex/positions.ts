import { v } from 'convex/values'
import { query } from './_generated/server'

/** A Leistungsverzeichnis in this product has a few thousand positions at most. */
const MAX_POSITIONS = 5000

/**
 * Every position of a tender in document order, without the long texts, for
 * the list an estimator scrolls and searches.
 */
export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const positions = await ctx.db
      .query('positions')
      .withIndex('by_tenderSlug_and_seq', (q) => q.eq('tenderSlug', slug))
      .take(MAX_POSITIONS)

    return positions.map((position) => ({
      oz: position.oz,
      seq: position.seq,
      shortText: position.shortText,
      qty: position.qty,
      unit: position.unit,
      path: position.path,
    }))
  },
})

/** One position by its ordinal number, with the offer lines that name it. */
export const get = query({
  args: { slug: v.string(), oz: v.string() },
  handler: async (ctx, { slug, oz }) => {
    const position = await ctx.db
      .query('positions')
      .withIndex('by_tenderSlug_and_oz', (q) =>
        q.eq('tenderSlug', slug).eq('oz', oz),
      )
      .unique()
    if (position === null) return null

    // A supplier names a position once, or twice where it offers a choice.
    const referring = await ctx.db
      .query('offerLines')
      .withIndex('by_tenderSlug_and_posRef', (q) =>
        q.eq('tenderSlug', slug).eq('posRef', oz),
      )
      .take(20)

    return {
      position: {
        oz: position.oz,
        seq: position.seq,
        path: position.path,
        shortText: position.shortText,
        longText: position.longText,
        qty: position.qty,
        unit: position.unit,
        gaebId: position.gaebId,
      },
      referring: referring.map((line) => ({
        supplierKey: line.supplierKey,
        seq: line.seq,
        articleNo: line.articleNo,
        text: line.text,
        qty: line.qty,
        unit: line.unit,
        unitPrice: line.unitPrice,
        priceBasis: line.priceBasis,
        listPrice: line.listPrice,
        discountPct: line.discountPct,
        total: line.total,
        alternative: line.alternative,
        sources: line.sources,
      })),
    }
  },
})
