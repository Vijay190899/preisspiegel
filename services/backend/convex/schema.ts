import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // The cost meter: one row per model call. Append-only.
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
