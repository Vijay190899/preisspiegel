/**
 * What the interface reads about a run: its state, what happened in it, and
 * the decisions it reached. And the one thing it may start: the stored
 * answers read back, which calls no model, or, with the deployment's access
 * code, a run in which the model reads.
 */
import { v } from 'convex/values'
import { env, mutation, query } from './_generated/server'
import { LOCK_WINDOW_MS, WRONG_CODES_ALLOWED, admit } from './agent/gate'
import { beginRun, runUnderWay } from './agent/store'
import { roleModel } from './llm/client'
import type { Admission } from './agent/gate'
import type { Doc } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'

async function latestOf(
  ctx: QueryCtx,
  slug: string,
): Promise<Doc<'runs'> | null> {
  return ctx.db
    .query('runs')
    .withIndex('by_tenderSlug_and_startedAt', (q) => q.eq('tenderSlug', slug))
    .order('desc')
    .first()
}

/** The newest run that reached its decisions, which is what the pages show. */
async function latestDone(
  ctx: QueryCtx,
  slug: string,
): Promise<Doc<'runs'> | null> {
  const recent = await ctx.db
    .query('runs')
    .withIndex('by_tenderSlug_and_startedAt', (q) => q.eq('tenderSlug', slug))
    .order('desc')
    .take(10)
  return recent.find((run) => run.status === 'done') ?? null
}

const summary = (run: Doc<'runs'>) => ({
  id: run._id,
  status: run.status,
  model: run.model,
  mode: run.mode ?? ('live' as const),
  startedAt: run.startedAt,
  finishedAt: run.finishedAt,
  positions: run.positions,
  read: run.cursor,
  calls: run.calls,
  cached: run.cached,
  failed: run.failed,
  usd: run.usd,
  auto: run.auto,
  review: run.review,
  materialTotal: run.materialTotal,
  atRisk: run.atRisk,
  wins: run.wins ?? {},
  note: run.note,
})

/** The newest run and the newest finished one, which may be the same. */
export const latest = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const current = await latestOf(ctx, slug)
    const done = await latestDone(ctx, slug)
    return {
      current: current === null ? null : summary(current),
      done: done === null ? null : summary(done),
    }
  },
})

/**
 * Starts a run from the interface. Without a code the stored answers are
 * read back; with the right one the model reads, under the same budgets as
 * any run. What it refuses, it refuses by returning the reason.
 */
export const start = mutation({
  args: { slug: v.string(), code: v.optional(v.string()) },
  handler: async (ctx, { slug, code }): Promise<Admission> => {
    const tender = await ctx.db
      .query('tenders')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()
    if (tender === null) throw new Error(`No tender "${slug}".`)

    const now = Date.now()
    const wrong =
      code === undefined
        ? []
        : await ctx.db
            .query('codeAttempts')
            .withIndex('by_at', (q) => q.gte('at', now - LOCK_WINDOW_MS))
            .take(WRONG_CODES_ALLOWED)
    const admission = admit({
      code: code?.slice(0, 200),
      configured: env.DEMO_ACCESS_CODE,
      running: await runUnderWay(ctx, slug),
      wrongCodes: wrong.length,
    })
    if (!admission.ok) {
      if (admission.reason === 'code') {
        await ctx.db.insert('codeAttempts', { at: now })
        // Attempts that no longer count are not kept.
        const stale = await ctx.db
          .query('codeAttempts')
          .withIndex('by_at', (q) => q.lt('at', now - LOCK_WINDOW_MS))
          .take(50)
        for (const row of stale) await ctx.db.delete('codeAttempts', row._id)
      }
      return admission
    }

    const model = roleModel('match')
    if (model === null) throw new Error('The match role has no model.')
    await beginRun(ctx, {
      slug,
      positions: tender.positionCount,
      model,
      mode: admission.mode,
    })
    return admission
  },
})

/** One letter per position in document order: `a` priced, `r` needs a person. */
export const statuses = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) =>
    (await latestDone(ctx, slug))?.statuses ?? null,
})

/** The last things that happened in a run, newest first. */
export const events = query({
  args: { runId: v.id('runs'), limit: v.number() },
  handler: async (ctx, { runId, limit }) => {
    const rows = await ctx.db
      .query('runEvents')
      .withIndex('by_runId_and_seq', (q) => q.eq('runId', runId))
      .order('desc')
      .take(Math.min(limit, 100))
    return rows.map((row) => ({
      seq: row.seq,
      at: row.at,
      kind: row.kind,
      data: row.data,
    }))
  },
})

/**
 * The decision for one position, with every offer, what was found on it,
 * and the offer line each one is, so the page can show its numbers with
 * their sources.
 */
export const match = query({
  args: { slug: v.string(), oz: v.string() },
  handler: async (ctx, { slug, oz }) => {
    const done = await latestDone(ctx, slug)
    if (done === null) return null
    const row = await ctx.db
      .query('matches')
      .withIndex('by_runId_and_oz', (q) => q.eq('runId', done._id).eq('oz', oz))
      .unique()
    if (row === null) return null

    const lines = []
    for (const entry of row.offers) {
      const line = await ctx.db
        .query('offerLines')
        .withIndex('by_tenderSlug_and_supplierKey_and_seq', (q) =>
          q
            .eq('tenderSlug', slug)
            .eq('supplierKey', entry.supplierKey)
            .eq('seq', entry.seq),
        )
        .unique()
      if (line === null) continue
      const { _id, _creationTime, tenderSlug, posRef, ...shown } = line
      lines.push(shown)
    }
    const { _id, _creationTime, runId, weight, ...decision } = row
    return { ...decision, lines }
  },
})

/** The positions that need a person, the costliest decisions first. */
export const reviewQueue = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const done = await latestDone(ctx, slug)
    if (done === null) return []
    const rows = await ctx.db
      .query('matches')
      .withIndex('by_runId_and_status_and_weight', (q) =>
        q.eq('runId', done._id).eq('status', 'review'),
      )
      .order('desc')
      .take(300)

    const queue = []
    for (const row of rows) {
      const position = await ctx.db
        .query('positions')
        .withIndex('by_tenderSlug_and_oz', (q) =>
          q.eq('tenderSlug', slug).eq('oz', row.oz),
        )
        .unique()
      if (position === null) continue
      queue.push({
        oz: row.oz,
        seq: row.seq,
        shortText: position.shortText,
        qty: position.qty,
        unit: position.unit,
        reasons: row.reasons,
        atRisk: row.atRisk,
        best: row.best,
        offers: row.offers.length,
        // What each offer comes to for the whole quantity, and whether
        // anything was found on it: the shape of the decision at a glance.
        quotes: row.offers.map((entry) => ({
          supplierKey: entry.supplierKey,
          total:
            entry.unitPrice === null
              ? null
              : Math.round(position.qty * entry.unitPrice * 100) / 100,
          clean: entry.verdict === 'confirmed' && entry.findings.length === 0,
        })),
      })
    }
    return queue
  },
})
