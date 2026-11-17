/**
 * What the interface reads about labor: the totals for the costing page and
 * the labor of one position. Minutes come from the contractor's table and
 * hours are worked out here, so the page shows nothing the model said
 * except the words of the position it quoted.
 */
import { v } from 'convex/values'
import { query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'

/** How many positions the costing page lists by the hours they take. */
const LISTED = 6

async function tableOf(
  ctx: QueryCtx,
  slug: string,
): Promise<Map<string, Doc<'laborTimes'>>> {
  const rows = await ctx.db
    .query('laborTimes')
    .withIndex('by_tenderSlug_and_key', (q) => q.eq('tenderSlug', slug))
    .take(500)
  return new Map(rows.map((row) => [row.key, row]))
}

async function newestJob(
  ctx: QueryCtx,
  slug: string,
): Promise<Doc<'laborJobs'> | null> {
  return ctx.db
    .query('laborJobs')
    .withIndex('by_tenderSlug_and_startedAt', (q) => q.eq('tenderSlug', slug))
    .order('desc')
    .first()
}

const hoursOf = (match: Doc<'laborMatches'>) =>
  match.status === 'set' && match.minutes !== null
    ? (match.minutes * match.qty) / 60
    : 0

/** Labor across the tender, for the costing page. `null` before any labor pass. */
export const summary = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const job = await newestJob(ctx, slug)
    if (job === null) return null
    const tender = await ctx.db
      .query('tenders')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()
    const table = await tableOf(ctx, slug)
    const matches = await ctx.db
      .query('laborMatches')
      .withIndex('by_tenderSlug_and_seq', (q) => q.eq('tenderSlug', slug))
      .take(5000)

    let hours = 0
    let set = 0
    let none = 0
    const review: Array<Doc<'laborMatches'>> = []
    for (const match of matches) {
      if (match.status === 'set') {
        set++
        hours += hoursOf(match)
      } else if (match.status === 'none') none++
      else review.push(match)
    }
    const heaviest = [...matches]
      .filter((match) => match.status === 'set')
      .sort((a, b) => hoursOf(b) - hoursOf(a))
      .slice(0, LISTED)

    const describe = async (match: Doc<'laborMatches'>) => {
      const position = await ctx.db
        .query('positions')
        .withIndex('by_tenderSlug_and_oz', (q) =>
          q.eq('tenderSlug', slug).eq('oz', match.oz),
        )
        .unique()
      const entry =
        match.entryKey === null ? undefined : table.get(match.entryKey)
      return {
        oz: match.oz,
        shortText: position?.shortText ?? '',
        qty: match.qty,
        unit: match.unit,
        entryLabel: entry?.label ?? null,
        minutes: match.minutes,
        // Exact: money is worked out from it, so it is rounded only when shown.
        hours: hoursOf(match),
        reason: match.reason,
        detail: match.detail,
      }
    }

    return {
      status: job.status,
      mode: job.mode,
      model: job.model,
      startedAt: job.startedAt,
      calls: job.calls,
      usd: job.usd,
      positions: job.positions,
      read: job.cursor,
      contractor: tender?.contractor ?? null,
      rate: tender?.laborRate ?? null,
      entries: table.size,
      set,
      none,
      hours,
      review: await Promise.all(review.slice(0, 50).map(describe)),
      reviewCount: review.length,
      heaviest: await Promise.all(heaviest.map(describe)),
    }
  },
})

/** The labor of one position, with the table entry it was tied to. */
export const forPosition = query({
  args: { slug: v.string(), oz: v.string() },
  handler: async (ctx, { slug, oz }) => {
    const match = await ctx.db
      .query('laborMatches')
      .withIndex('by_tenderSlug_and_oz', (q) =>
        q.eq('tenderSlug', slug).eq('oz', oz),
      )
      .unique()
    if (match === null) return null
    const tender = await ctx.db
      .query('tenders')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()
    const entry =
      match.entryKey === null
        ? null
        : await ctx.db
            .query('laborTimes')
            .withIndex('by_tenderSlug_and_key', (q) =>
              q.eq('tenderSlug', slug).eq('key', match.entryKey ?? ''),
            )
            .unique()
    return {
      status: match.status,
      quote: match.quote,
      limitQuote: match.limitQuote,
      reason: match.reason,
      detail: match.detail,
      entry:
        entry === null
          ? null
          : {
              key: entry.key,
              label: entry.label,
              unit: entry.unit,
              minutes: entry.minutes,
            },
      minutes: match.minutes,
      qty: match.qty,
      hours: hoursOf(match),
      rate: tender?.laborRate ?? null,
      contractor: tender?.contractor ?? null,
    }
  },
})
