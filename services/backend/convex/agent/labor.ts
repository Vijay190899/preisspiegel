/**
 * The labor pass: every position of a tender is tied to an entry of the
 * contractor's labor time table, or sent to a person.
 *
 * Labor does not depend on the offers, so this is not part of a run: it is
 * a pass of its own over the tender, in batches that schedule each other.
 * The model proposes an entry and quotes the position; `assessLabor`
 * decides. Minutes come from the table. Every call is on the ledger and the
 * pass stops by itself at the day's budget.
 */
import { assessLabor } from '@preisspiegel/core'
import { v } from 'convex/values'
import { internal } from '../_generated/api'
import {
  internalAction,
  internalMutation,
  internalQuery,
} from '../_generated/server'
import { utcDay } from '../llm/call'
import { llmCall, roleModel, spendLimits } from '../llm/client'
import { ledgerEntry, recordEntries } from '../llm/ledger'
import {
  laborAnswerSchema,
  laborKey,
  laborSystem,
  renderLaborQuestion,
} from './laborPrompt'
import type { LaborEntry, LaborProposal, Position } from '@preisspiegel/core'
import type { Id } from '../_generated/dataModel'
import type { LedgerEntry } from '../llm/call'

const BATCH = 40
const SIDE_BY_SIDE = 8

const proposal = v.object({
  entry: v.union(v.string(), v.null()),
  quote: v.string(),
  limitQuote: v.union(v.string(), v.null()),
})

/** Starts a labor pass over a tender. With `replay`, only stored answers are used. */
export const start = internalMutation({
  args: {
    slug: v.string(),
    replay: v.optional(v.boolean()),
    /** A trial over the first so many positions. */
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { slug, replay, limit }): Promise<Id<'laborJobs'>> => {
    const tender = await ctx.db
      .query('tenders')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()
    if (tender === null) throw new Error(`No tender "${slug}".`)
    const model = roleModel('match')
    if (model === null) throw new Error('The match role has no model.')
    const newest = await ctx.db
      .query('laborJobs')
      .withIndex('by_tenderSlug_and_startedAt', (q) => q.eq('tenderSlug', slug))
      .order('desc')
      .first()
    if (newest !== null && newest.status === 'reading') {
      throw new Error('A labor pass of this tender is under way.')
    }
    const anEntry = await ctx.db
      .query('laborTimes')
      .withIndex('by_tenderSlug_and_key', (q) => q.eq('tenderSlug', slug))
      .first()
    if (anEntry === null) {
      throw new Error(`Tender "${slug}" has no labor time table loaded.`)
    }

    const jobId = await ctx.db.insert('laborJobs', {
      tenderSlug: slug,
      status: 'reading',
      mode: replay === true ? 'replay' : 'live',
      model,
      startedAt: Date.now(),
      finishedAt: null,
      positions: Math.min(limit ?? Infinity, tender.positionCount),
      cursor: 0,
      calls: 0,
      cached: 0,
      failed: 0,
      usd: 0,
      note: null,
    })
    await ctx.scheduler.runAfter(0, internal.agent.labor.step, { jobId })
    return jobId
  },
})

/** The next positions of a pass, the table, and what has been spent today. */
export const nextBatch = internalQuery({
  args: { jobId: v.id('laborJobs'), size: v.number(), day: v.string() },
  handler: async (ctx, { jobId, size, day }) => {
    const job = await ctx.db.get('laborJobs', jobId)
    if (job === null) return null
    const positions = await ctx.db
      .query('positions')
      .withIndex('by_tenderSlug_and_seq', (q) =>
        q.eq('tenderSlug', job.tenderSlug).gte('seq', job.cursor),
      )
      .take(Math.min(size, job.positions - job.cursor))
    const table = await ctx.db
      .query('laborTimes')
      .withIndex('by_tenderSlug_and_key', (q) =>
        q.eq('tenderSlug', job.tenderSlug),
      )
      .take(500)
    const spent = await ctx.db
      .query('llmSpend')
      .withIndex('by_day', (q) => q.eq('day', day))
      .unique()
    return {
      status: job.status,
      mode: job.mode,
      model: job.model,
      cursor: job.cursor,
      dayUsd: spent?.usd ?? 0,
      positions: positions.map(
        ({ _id, _creationTime, tenderSlug, ...position }): Position => position,
      ),
      table: table.map(({ key, label, unit, minutes }): LaborEntry => ({
        key,
        label,
        unit,
        minutes,
      })),
    }
  },
})

/** What the model answered to the questions with these keys, where it has. */
export const cachedAnswers = internalQuery({
  args: { keys: v.array(v.string()) },
  handler: async (ctx, { keys }) => {
    const found: Array<{ key: string; answer: LaborProposal }> = []
    for (const key of keys.slice(0, 200)) {
      const hit = await ctx.db
        .query('laborCache')
        .withIndex('by_key', (q) => q.eq('key', key))
        .first()
      if (hit !== null) found.push({ key, answer: hit.answer })
    }
    return found
  },
})

const row = v.object({
  oz: v.string(),
  seq: v.number(),
  qty: v.number(),
  unit: v.string(),
  status: v.union(v.literal('set'), v.literal('none'), v.literal('review')),
  entryKey: v.union(v.string(), v.null()),
  minutes: v.union(v.number(), v.null()),
  quote: v.union(v.string(), v.null()),
  limitQuote: v.union(v.string(), v.null()),
  reason: v.union(v.string(), v.null()),
  detail: v.union(v.string(), v.null()),
  source: v.union(v.literal('model'), v.literal('cache'), v.literal('failed')),
})

/**
 * Stores what a batch decided and moves the pass on, in one transaction. A
 * step that runs twice writes nothing the second time.
 */
export const saveBatch = internalMutation({
  args: {
    jobId: v.id('laborJobs'),
    cursor: v.number(),
    nextCursor: v.number(),
    rows: v.array(row),
    cache: v.array(v.object({ key: v.string(), answer: proposal })),
    entries: v.array(ledgerEntry),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get('laborJobs', args.jobId)
    if (
      job === null ||
      job.status !== 'reading' ||
      job.cursor !== args.cursor
    ) {
      return { stored: false, done: false }
    }
    for (const decided of args.rows) {
      const existing = await ctx.db
        .query('laborMatches')
        .withIndex('by_tenderSlug_and_oz', (q) =>
          q.eq('tenderSlug', job.tenderSlug).eq('oz', decided.oz),
        )
        .unique()
      const next = { tenderSlug: job.tenderSlug, ...decided }
      if (existing === null) await ctx.db.insert('laborMatches', next)
      else await ctx.db.replace('laborMatches', existing._id, next)
    }
    const at = Date.now()
    for (const entry of args.cache) {
      const existing = await ctx.db
        .query('laborCache')
        .withIndex('by_key', (q) => q.eq('key', entry.key))
        .first()
      if (existing === null) {
        await ctx.db.insert('laborCache', { ...entry, model: job.model, at })
      }
    }
    await recordEntries(ctx, args.entries)

    const count = (source: string) =>
      args.rows.filter((decided) => decided.source === source).length
    const done = args.nextCursor >= job.positions
    await ctx.db.patch('laborJobs', args.jobId, {
      cursor: args.nextCursor,
      calls: job.calls + args.entries.length,
      cached: job.cached + count('cache'),
      failed: job.failed + count('failed'),
      usd: job.usd + args.entries.reduce((sum, entry) => sum + entry.usd, 0),
      ...(done ? { status: 'done' as const, finishedAt: at } : {}),
    })
    return { stored: true, done }
  },
})

export const end = internalMutation({
  args: {
    jobId: v.id('laborJobs'),
    status: v.union(v.literal('stopped'), v.literal('failed')),
    note: v.string(),
  },
  handler: async (ctx, { jobId, status, note }) => {
    const job = await ctx.db.get('laborJobs', jobId)
    if (job === null || job.status !== 'reading') return null
    await ctx.db.patch('laborJobs', jobId, {
      status,
      note,
      finishedAt: Date.now(),
    })
    return null
  },
})

/** Runs `work` over `items`, at most `width` at a time. */
async function sideBySide<TItem>(
  items: ReadonlyArray<TItem>,
  width: number,
  work: (item: TItem) => Promise<void>,
): Promise<void> {
  const waiting = [...items]
  const worker = async () => {
    for (;;) {
      const next = waiting.shift()
      if (next === undefined) return
      await work(next)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(width, items.length) }, worker),
  )
}

export const step = internalAction({
  args: { jobId: v.id('laborJobs') },
  handler: async (ctx, { jobId }): Promise<null> => {
    try {
      const plan = await ctx.runQuery(internal.agent.labor.nextBatch, {
        jobId,
        size: BATCH,
        day: utcDay(Date.now()),
      })
      if (plan === null || plan.status !== 'reading') return null
      const replay = plan.mode === 'replay'
      if (!replay && plan.dayUsd >= spendLimits().dailyUsd) {
        await ctx.runMutation(internal.agent.labor.end, {
          jobId,
          status: 'stopped',
          note: `Model spend for today reached ${spendLimits().dailyUsd} USD.`,
        })
        return null
      }

      const system = laborSystem(plan.table)
      const asked = await Promise.all(
        plan.positions.map(async (position) => ({
          position,
          key: await laborKey(position, plan.model, system),
        })),
      )
      const stored: Array<{ key: string; answer: LaborProposal }> =
        await ctx.runQuery(internal.agent.labor.cachedAnswers, {
          keys: [...new Set(asked.map((question) => question.key))],
        })
      const answers = new Map(stored.map((hit) => [hit.key, hit.answer]))

      // One call per question nobody has answered, however many positions
      // of this batch ask it. A replay asks nobody.
      const unanswered = new Map<string, Position>()
      for (const { key, position } of asked) {
        if (!answers.has(key) && !unanswered.has(key)) {
          unanswered.set(key, position)
        }
      }
      const entries: Array<LedgerEntry> = []
      const fresh = new Map<string, LaborProposal>()
      await sideBySide(
        replay ? [] : [...unanswered.entries()],
        SIDE_BY_SIDE,
        async ([key, position]) => {
          const outcome = await llmCall({
            role: 'match',
            system,
            user: renderLaborQuestion(position),
            schema: laborAnswerSchema,
            maxTokens: 1000,
            runId: `labor:${jobId}`,
          })
          if (outcome === null) return
          if (outcome.entry !== null) entries.push(outcome.entry)
          if (outcome.result.ok) fresh.set(key, outcome.result.value)
        },
      )

      const credited = new Set<string>()
      const rows = asked.map(({ key, position }) => {
        const answer = fresh.get(key) ?? answers.get(key) ?? null
        const source: 'model' | 'cache' | 'failed' =
          answer === null
            ? 'failed'
            : fresh.has(key) && !credited.has(key)
              ? 'model'
              : 'cache'
        credited.add(key)
        const outcome = assessLabor(position, answer, plan.table)
        return {
          oz: position.oz,
          seq: position.seq,
          qty: position.qty,
          unit: position.unit,
          status: outcome.status,
          entryKey:
            outcome.status === 'none' ? null : (outcome.entry?.key ?? null),
          // The minutes are the table's, and only for an entry that was taken.
          minutes: outcome.status === 'set' ? outcome.entry.minutes : null,
          quote:
            outcome.status === 'review'
              ? (answer?.quote ?? null)
              : outcome.quote,
          limitQuote:
            outcome.status === 'set'
              ? outcome.limitQuote
              : (answer?.limitQuote ?? null),
          reason: outcome.status === 'review' ? outcome.reason : null,
          detail: outcome.status === 'review' ? outcome.detail : null,
          source,
        }
      })

      const saved = await ctx.runMutation(internal.agent.labor.saveBatch, {
        jobId,
        cursor: plan.cursor,
        nextCursor: plan.cursor + plan.positions.length,
        rows,
        cache: [...fresh.entries()].map(([key, answer]) => ({ key, answer })),
        entries,
      })
      if (saved.stored && !saved.done) {
        await ctx.scheduler.runAfter(0, internal.agent.labor.step, { jobId })
      }
    } catch (error) {
      await ctx.runMutation(internal.agent.labor.end, {
        jobId,
        status: 'failed',
        note: (error instanceof Error ? error.message : String(error)).slice(
          0,
          500,
        ),
      })
    }
    return null
  },
})

/**
 * Deletes what was decided about a tender's labor and its passes. Reloading
 * a tender replaces its positions, and labor decided for the old ones would
 * point at nothing. The answer cache stays.
 */
export const clear = internalMutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const decided = await ctx.db
      .query('laborMatches')
      .withIndex('by_tenderSlug_and_seq', (q) => q.eq('tenderSlug', slug))
      .take(500)
    for (const match of decided) await ctx.db.delete('laborMatches', match._id)
    const jobs = await ctx.db
      .query('laborJobs')
      .withIndex('by_tenderSlug_and_startedAt', (q) => q.eq('tenderSlug', slug))
      .take(100)
    for (const job of jobs) await ctx.db.delete('laborJobs', job._id)
    if (decided.length === 500 || jobs.length === 100) {
      await ctx.scheduler.runAfter(0, internal.agent.labor.clear, { slug })
      return { done: false }
    }
    return { done: true }
  },
})

/** Every decision of a tender's labor, for the benchmark. */
export const matches = internalQuery({
  args: { slug: v.string(), fromSeq: v.number(), limit: v.number() },
  handler: async (ctx, { slug, fromSeq, limit }) => {
    const rows = await ctx.db
      .query('laborMatches')
      .withIndex('by_tenderSlug_and_seq', (q) =>
        q.eq('tenderSlug', slug).gte('seq', fromSeq),
      )
      .take(limit)
    return rows.map(({ _id, _creationTime, tenderSlug, ...match }) => match)
  },
})

export const latestJob = internalQuery({
  args: { slug: v.string() },
  handler: (ctx, { slug }) =>
    ctx.db
      .query('laborJobs')
      .withIndex('by_tenderSlug_and_startedAt', (q) => q.eq('tenderSlug', slug))
      .order('desc')
      .first(),
})
