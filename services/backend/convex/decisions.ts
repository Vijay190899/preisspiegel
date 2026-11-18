/**
 * What an estimator decides about a position that needed a person.
 *
 * A run leaves some positions open. For each of them the estimator takes one
 * of the offers as it stands, knowing what was found on it, or sets a price
 * of their own. The price of an offer is read here from what the run stored,
 * never taken from the browser. A price the estimator types is theirs.
 */
import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'

/** The id a browser keeps for itself. Random, and nothing else. */
const SESSION = /^[A-Za-z0-9_-]{16,64}$/
/** No unit of anything in a tender costs more than this. */
const HIGHEST_PRICE = 10_000_000

function known(session: string): string {
  if (!SESSION.test(session)) throw new ConvexError('Unknown session.')
  return session
}

const own = (
  ctx: QueryCtx | MutationCtx,
  slug: string,
  session: string,
  oz: string,
) =>
  ctx.db
    .query('decisions')
    .withIndex('by_tenderSlug_and_session_and_oz', (q) =>
      q.eq('tenderSlug', slug).eq('session', session).eq('oz', oz),
    )
    .unique()

/** Everything this browser has decided for a tender. */
export const mine = query({
  args: { slug: v.string(), session: v.string() },
  handler: async (ctx, { slug, session }) => {
    if (!SESSION.test(session)) return []
    // A tender has a few thousand positions at most, and a decision is one
    // row per position.
    const rows = await ctx.db
      .query('decisions')
      .withIndex('by_tenderSlug_and_session_and_oz', (q) =>
        q.eq('tenderSlug', slug).eq('session', session),
      )
      .take(5000)
    return rows.map((row) => ({
      oz: row.oz,
      seq: row.seq,
      offerId: row.offerId,
      supplierKey: row.supplierKey,
      unitPrice: row.unitPrice,
      at: row.at,
    }))
  },
})

/** Takes an offer as it stands, or sets a price, for one position. */
export const decide = mutation({
  args: {
    slug: v.string(),
    session: v.string(),
    oz: v.string(),
    /** The offer to price the position with, or `null` with a price. */
    offerId: v.union(v.string(), v.null()),
    unitPrice: v.optional(v.number()),
  },
  handler: async (ctx, { slug, session, oz, offerId, unitPrice }) => {
    known(session)
    const position = await ctx.db
      .query('positions')
      .withIndex('by_tenderSlug_and_oz', (q) =>
        q.eq('tenderSlug', slug).eq('oz', oz),
      )
      .unique()
    if (position === null) throw new ConvexError('No such position.')

    let supplierKey: string | null = null
    let price: number
    if (offerId === null) {
      if (
        unitPrice === undefined ||
        !Number.isFinite(unitPrice) ||
        unitPrice <= 0 ||
        unitPrice > HIGHEST_PRICE
      ) {
        throw new ConvexError('A price has to be a positive amount.')
      }
      price = Math.round(unitPrice * 10000) / 10000
    } else {
      // The newest run that reached its decisions is what the pages show.
      const recent = await ctx.db
        .query('runs')
        .withIndex('by_tenderSlug_and_startedAt', (q) =>
          q.eq('tenderSlug', slug),
        )
        .order('desc')
        .take(10)
      const done = recent.find((run) => run.status === 'done')
      const match =
        done === undefined
          ? null
          : await ctx.db
              .query('matches')
              .withIndex('by_runId_and_oz', (q) =>
                q.eq('runId', done._id).eq('oz', oz),
              )
              .unique()
      const offer = match?.offers.find((entry) => entry.id === offerId)
      if (offer === undefined || offer.unitPrice === null) {
        throw new ConvexError('That offer has no price for this position.')
      }
      supplierKey = offer.supplierKey
      price = offer.unitPrice
    }

    const row = {
      tenderSlug: slug,
      session,
      oz,
      seq: position.seq,
      offerId,
      supplierKey,
      unitPrice: price,
      at: Date.now(),
    }
    const before = await own(ctx, slug, session, oz)
    if (before === null) await ctx.db.insert('decisions', row)
    else await ctx.db.replace('decisions', before._id, row)
    return null
  },
})

/** Takes a decision back: the position is open again. */
export const reopen = mutation({
  args: { slug: v.string(), session: v.string(), oz: v.string() },
  handler: async (ctx, { slug, session, oz }) => {
    known(session)
    const before = await own(ctx, slug, session, oz)
    if (before !== null) await ctx.db.delete('decisions', before._id)
    return null
  },
})
