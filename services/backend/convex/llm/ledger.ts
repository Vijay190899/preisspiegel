import { v } from 'convex/values'
import { internalMutation, internalQuery } from '../_generated/server'
import type { MutationCtx } from '../_generated/server'
import type { LedgerEntry } from './call'

/** One model call as the ledger keeps it. */
export const ledgerEntry = v.object({
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
  runId: v.optional(v.string()),
})

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

/**
 * Appends calls to the ledger and adds them to their day's running total,
 * one document per day. The runtime records each call as it returns; calls
 * that finish together may contend for the day's document, which Convex
 * settles by retrying the mutation.
 */
export async function recordEntries(
  ctx: MutationCtx,
  entries: ReadonlyArray<LedgerEntry>,
): Promise<void> {
  const byDay = new Map<string, { usd: number; calls: number }>()
  for (const entry of entries) {
    await ctx.db.insert('llmLedger', entry)
    const sum = byDay.get(entry.day) ?? { usd: 0, calls: 0 }
    byDay.set(entry.day, { usd: sum.usd + entry.usd, calls: sum.calls + 1 })
  }
  for (const [day, sum] of byDay) {
    const total = await ctx.db
      .query('llmSpend')
      .withIndex('by_day', (q) => q.eq('day', day))
      .unique()
    if (total === null) {
      await ctx.db.insert('llmSpend', { day, ...sum })
    } else {
      await ctx.db.patch('llmSpend', total._id, {
        usd: total.usd + sum.usd,
        calls: total.calls + sum.calls,
      })
    }
  }
}

export const recordMany = internalMutation({
  args: { entries: v.array(ledgerEntry) },
  handler: async (ctx, { entries }) => {
    await recordEntries(ctx, entries)
    return null
  },
})
