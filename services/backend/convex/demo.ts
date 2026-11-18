/**
 * `pnpm demo:reset`: puts the demo back the way a visitor should find it.
 * Every decision anyone made is taken back, the overall limits on wrong
 * codes and read-backs start afresh, and the stored answers are read once more, which leaves one
 * finished run and clears the ones before it. No model is called.
 */
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { beginRun, runUnderWay } from './agent/store'
import { limiter } from './limits'
import { roleModel } from './llm/client'

export const reset = internalMutation({
  args: { slug: v.optional(v.string()) },
  handler: async (ctx, { slug = 'demo' }) => {
    const decided = await ctx.db
      .query('decisions')
      .withIndex('by_tenderSlug_and_session_and_oz', (q) =>
        q.eq('tenderSlug', slug),
      )
      .take(400)
    for (const row of decided) await ctx.db.delete('decisions', row._id)
    if (decided.length === 400) {
      await ctx.scheduler.runAfter(0, internal.demo.reset, { slug })
      return { done: false, started: false }
    }

    const tender = await ctx.db
      .query('tenders')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()
    if (tender === null) throw new Error(`No tender "${slug}".`)
    await limiter.reset(ctx, 'wrongCodeAll')
    await limiter.reset(ctx, 'replayAll')
    if (await runUnderWay(ctx, slug)) return { done: true, started: false }
    const model = roleModel('match')
    if (model === null) throw new Error('The match role has no model.')
    await beginRun(ctx, {
      slug,
      positions: tender.positionCount,
      model,
      mode: 'replay',
    })
    return { done: true, started: true }
  },
})
