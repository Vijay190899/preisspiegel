import { v } from 'convex/values'
import { internalMutation, internalQuery } from '../_generated/server'

/** Model spend so far on a UTC day. The caller passes the day in. */
export const spentOn = internalQuery({
  args: { day: v.string() },
  handler: async (ctx, { day }) => {
    const total = await ctx.db
      .query('llmSpend')
      .withIndex('by_day', (q) => q.eq('day', day))
      .unique()
    return { usd: total?.usd ?? 0, calls: total?.calls ?? 0 }
  },
})

/** Appends one call to the ledger and adds it to that day's running total. */
export const record = internalMutation({
  args: {
    day: v.string(),
    at: v.number(),
    provider: v.string(),
    role: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cacheReadTokens: v.number(),
    cacheWriteTokens: v.number(),
    usd: v.number(),
    stopReason: v.union(v.string(), v.null()),
  },
  handler: async (ctx, entry) => {
    await ctx.db.insert('llmLedger', entry)

    const total = await ctx.db
      .query('llmSpend')
      .withIndex('by_day', (q) => q.eq('day', entry.day))
      .unique()
    if (total === null) {
      await ctx.db.insert('llmSpend', {
        day: entry.day,
        usd: entry.usd,
        calls: 1,
      })
    } else {
      await ctx.db.patch('llmSpend', total._id, {
        usd: total.usd + entry.usd,
        calls: total.calls + 1,
      })
    }
    return null
  },
})
