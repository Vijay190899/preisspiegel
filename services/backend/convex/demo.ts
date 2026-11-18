/**
 * `pnpm demo:reset`: puts the demo back the way a visitor should find it.
 * Every decision anyone made is taken back, wrong access codes are
 * forgotten, and the stored answers are read once more, which leaves one
 * finished run and clears the ones before it. No model is called.
 */
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { beginRun, runUnderWay } from './agent/store'
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
    const attempts = await ctx.db.query('codeAttempts').take(400)
    for (const row of attempts) await ctx.db.delete('codeAttempts', row._id)
    if (decided.length === 400 || attempts.length === 400) {
      await ctx.scheduler.runAfter(0, internal.demo.reset, { slug })
      return { done: false, started: false }
    }

    const tender = await ctx.db
      .query('tenders')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()
    if (tender === null) throw new Error(`No tender "${slug}".`)
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
