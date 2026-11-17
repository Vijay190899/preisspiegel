/**
 * Everything a run reads and writes. The steps in `run.ts` are actions, so
 * they have no database of their own: they come through here.
 */
import { v } from 'convex/values'
import { internal } from '../_generated/api'
import { internalMutation, internalQuery } from '../_generated/server'
import { ledgerEntry, recordEntries } from '../llm/ledger'
import {
  candidate,
  judgement,
  offer,
  rawJudgement,
  reasonCode,
} from '../schema'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

const eventInput = v.object({
  kind: v.string(),
  data: v.record(
    v.string(),
    v.union(v.string(), v.number(), v.boolean(), v.null()),
  ),
})

async function appendEvents(
  ctx: MutationCtx,
  runId: Id<'runs'>,
  from: number,
  events: ReadonlyArray<{
    kind: string
    data: Record<string, string | number | boolean | null>
  }>,
): Promise<number> {
  const at = Date.now()
  let seq = from
  for (const event of events) {
    await ctx.db.insert('runEvents', { runId, seq, at, ...event })
    seq++
  }
  return seq
}

// --- Reading the tender ----------------------------------------------------

export const positions = internalQuery({
  args: { slug: v.string(), fromSeq: v.number(), limit: v.number() },
  handler: async (ctx, { slug, fromSeq, limit }) => {
    const rows = await ctx.db
      .query('positions')
      .withIndex('by_tenderSlug_and_seq', (q) =>
        q.eq('tenderSlug', slug).gte('seq', fromSeq),
      )
      .take(limit)
    return rows.map(
      ({ _id, _creationTime, tenderSlug, ...position }) => position,
    )
  },
})

export const offerKeys = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const documents = await ctx.db
      .query('documents')
      .withIndex('by_tenderSlug_and_key', (q) => q.eq('tenderSlug', slug))
      .take(50)
    return documents
      .filter((document) => document.kind === 'offer')
      .map((document) => document.key)
  },
})

export const offerLines = internalQuery({
  args: {
    slug: v.string(),
    supplierKey: v.string(),
    fromSeq: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, { slug, supplierKey, fromSeq, limit }) => {
    const rows = await ctx.db
      .query('offerLines')
      .withIndex('by_tenderSlug_and_supplierKey_and_seq', (q) =>
        q
          .eq('tenderSlug', slug)
          .eq('supplierKey', supplierKey)
          .gte('seq', fromSeq),
      )
      .take(limit)
    return rows.map(({ _id, _creationTime, tenderSlug, ...line }) => line)
  },
})

// --- A run's own rows ------------------------------------------------------

export const createRun = internalMutation({
  args: {
    slug: v.string(),
    positions: v.number(),
    model: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { slug, positions: count, model }) => {
    const runId = await ctx.db.insert('runs', {
      tenderSlug: slug,
      status: 'preparing',
      model,
      startedAt: Date.now(),
      finishedAt: null,
      positions: count,
      cursor: 0,
      nextEvent: 0,
      calls: 0,
      cached: 0,
      failed: 0,
      usd: 0,
      auto: null,
      review: null,
      materialTotal: null,
      atRisk: null,
      statuses: null,
      note: null,
    })
    const nextEvent = await appendEvents(ctx, runId, 0, [
      { kind: 'run.started', data: { positions: count, model } },
    ])
    await ctx.db.patch('runs', runId, { nextEvent })
    return runId
  },
})

export const run = internalQuery({
  args: { runId: v.id('runs') },
  handler: (ctx, { runId }) => ctx.db.get('runs', runId),
})

export const saveQuestions = internalMutation({
  args: {
    runId: v.id('runs'),
    questions: v.array(
      v.object({
        oz: v.string(),
        seq: v.number(),
        shortText: v.string(),
        longText: v.string(),
        unit: v.string(),
        candidates: v.array(candidate),
        echoes: v.array(v.string()),
        key: v.string(),
      }),
    ),
  },
  handler: async (ctx, { runId, questions }) => {
    for (const question of questions) {
      await ctx.db.insert('questions', { runId, ...question })
    }
    return null
  },
})

export const beginReading = internalMutation({
  args: { runId: v.id('runs'), lines: v.number(), distinct: v.number() },
  handler: async (ctx, { runId, lines, distinct }) => {
    const current = await ctx.db.get('runs', runId)
    if (current === null || current.status !== 'preparing') return null
    const nextEvent = await appendEvents(ctx, runId, current.nextEvent, [
      {
        kind: 'questions.ready',
        data: { positions: current.positions, lines, distinct },
      },
    ])
    await ctx.db.patch('runs', runId, { status: 'reading', nextEvent })
    return null
  },
})

/** The next positions to read, and what is already known about them. */
export const nextBatch = internalQuery({
  args: { runId: v.id('runs'), size: v.number(), day: v.string() },
  handler: async (ctx, { runId, size, day }) => {
    const current = await ctx.db.get('runs', runId)
    if (current === null) return null
    const questions = await ctx.db
      .query('questions')
      .withIndex('by_runId_and_seq', (q) =>
        q.eq('runId', runId).gte('seq', current.cursor),
      )
      .take(size)

    const cached: Array<{
      key: string
      answer: Array<typeof rawJudgement.type>
    }> = []
    for (const key of new Set(questions.map((question) => question.key))) {
      const hit = await ctx.db
        .query('matchCache')
        .withIndex('by_key', (q) => q.eq('key', key))
        .first()
      if (hit !== null) cached.push({ key, answer: hit.answer })
    }
    const spent = await ctx.db
      .query('llmSpend')
      .withIndex('by_day', (q) => q.eq('day', day))
      .unique()

    return {
      status: current.status,
      cursor: current.cursor,
      positions: current.positions,
      runUsd: current.usd,
      dayUsd: spent?.usd ?? 0,
      questions: questions.map(
        ({ _id, _creationTime, runId: _run, ...question }) => question,
      ),
      cached,
    }
  },
})

/**
 * Stores what a batch read: the answers, the new cache entries, what the
 * calls cost and what happened, and moves the run on. One transaction, so a
 * batch is either all there or not at all, and a step that runs twice does
 * nothing the second time.
 */
export const saveBatch = internalMutation({
  args: {
    runId: v.id('runs'),
    cursor: v.number(),
    nextCursor: v.number(),
    rows: v.array(
      v.object({
        oz: v.string(),
        seq: v.number(),
        source: v.union(
          v.literal('model'),
          v.literal('cache'),
          v.literal('code'),
          v.literal('failed'),
        ),
        judgements: v.array(judgement),
      }),
    ),
    cache: v.array(
      v.object({
        key: v.string(),
        model: v.string(),
        answer: v.array(rawJudgement),
      }),
    ),
    entries: v.array(ledgerEntry),
    events: v.array(eventInput),
  },
  handler: async (ctx, args) => {
    const current = await ctx.db.get('runs', args.runId)
    if (
      current === null ||
      current.status !== 'reading' ||
      current.cursor !== args.cursor
    ) {
      return { stored: false, done: false }
    }

    for (const row of args.rows) {
      await ctx.db.insert('judgements', { runId: args.runId, ...row })
    }
    const at = Date.now()
    for (const entry of args.cache) {
      const existing = await ctx.db
        .query('matchCache')
        .withIndex('by_key', (q) => q.eq('key', entry.key))
        .first()
      if (existing === null) await ctx.db.insert('matchCache', { ...entry, at })
    }
    await recordEntries(ctx, args.entries)

    const count = (source: string) =>
      args.rows.filter((row) => row.source === source).length
    const usd = args.entries.reduce((sum, entry) => sum + entry.usd, 0)
    const nextEvent = await appendEvents(ctx, args.runId, current.nextEvent, [
      ...args.events,
      {
        kind: 'batch.read',
        data: {
          from: args.cursor,
          to: args.nextCursor,
          calls: args.entries.length,
          cached: count('cache'),
          failed: count('failed'),
          usd,
        },
      },
    ])
    await ctx.db.patch('runs', args.runId, {
      cursor: args.nextCursor,
      nextEvent,
      calls: current.calls + args.entries.length,
      cached: current.cached + count('cache'),
      failed: current.failed + count('failed'),
      usd: current.usd + usd,
    })
    return { stored: true, done: args.nextCursor >= current.positions }
  },
})

export const setStatus = internalMutation({
  args: {
    runId: v.id('runs'),
    status: v.union(
      v.literal('deciding'),
      v.literal('stopped'),
      v.literal('failed'),
    ),
    note: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { runId, status, note }) => {
    const current = await ctx.db.get('runs', runId)
    if (current === null || current.status === 'done') return null
    const nextEvent = await appendEvents(ctx, runId, current.nextEvent, [
      { kind: `run.${status}`, data: { note } },
    ])
    await ctx.db.patch('runs', runId, {
      status,
      note,
      nextEvent,
      ...(status === 'deciding' ? {} : { finishedAt: Date.now() }),
    })
    return null
  },
})

export const judgements = internalQuery({
  args: { runId: v.id('runs'), fromSeq: v.number(), limit: v.number() },
  handler: async (ctx, { runId, fromSeq, limit }) => {
    const rows = await ctx.db
      .query('judgements')
      .withIndex('by_runId_and_seq', (q) =>
        q.eq('runId', runId).gte('seq', fromSeq),
      )
      .take(limit)
    return rows.map((row) => ({
      oz: row.oz,
      seq: row.seq,
      judgements: row.judgements,
    }))
  },
})

const matchInput = v.object({
  oz: v.string(),
  seq: v.number(),
  status: v.union(v.literal('auto'), v.literal('review')),
  reasons: v.array(reasonCode),
  noted: v.array(reasonCode),
  best: v.union(
    v.object({
      id: v.string(),
      supplierKey: v.string(),
      unitPrice: v.number(),
    }),
    v.null(),
  ),
  materialTotal: v.union(v.number(), v.null()),
  atRisk: v.union(v.number(), v.null()),
  offers: v.array(offer),
})

export const saveMatches = internalMutation({
  args: { runId: v.id('runs'), matches: v.array(matchInput) },
  handler: async (ctx, { runId, matches }) => {
    for (const match of matches) {
      // Storing a decision twice would count it twice.
      const existing = await ctx.db
        .query('matches')
        .withIndex('by_runId_and_oz', (q) =>
          q.eq('runId', runId).eq('oz', match.oz),
        )
        .first()
      if (existing !== null) continue
      await ctx.db.insert('matches', {
        runId,
        ...match,
        weight: match.atRisk ?? 0,
      })
    }
    return null
  },
})

export const finishRun = internalMutation({
  args: {
    runId: v.id('runs'),
    auto: v.number(),
    review: v.number(),
    materialTotal: v.number(),
    atRisk: v.number(),
    statuses: v.string(),
  },
  handler: async (ctx, { runId, ...totals }) => {
    const current = await ctx.db.get('runs', runId)
    if (current === null || current.status !== 'deciding') return null
    const nextEvent = await appendEvents(ctx, runId, current.nextEvent, [
      {
        kind: 'run.done',
        data: {
          auto: totals.auto,
          review: totals.review,
          materialTotal: totals.materialTotal,
          atRisk: totals.atRisk,
          usd: current.usd,
        },
      },
    ])
    await ctx.db.patch('runs', runId, {
      ...totals,
      status: 'done',
      finishedAt: Date.now(),
      nextEvent,
    })
    return null
  },
})

/** A run's decisions, for the benchmarks. */
export const matches = internalQuery({
  args: { runId: v.id('runs'), fromSeq: v.number(), limit: v.number() },
  handler: async (ctx, { runId, fromSeq, limit }) => {
    const rows = await ctx.db
      .query('matches')
      .withIndex('by_runId_and_seq', (q) =>
        q.eq('runId', runId).gte('seq', fromSeq),
      )
      .take(limit)
    return rows.map(
      ({ _id, _creationTime, runId: _run, weight, ...match }) => match,
    )
  },
})

/** What the model answered to the questions with these keys, where it has. */
export const cachedAnswers = internalQuery({
  args: { keys: v.array(v.string()) },
  handler: async (ctx, { keys }) => {
    const found: Array<{
      key: string
      answer: Array<typeof rawJudgement.type>
    }> = []
    for (const key of keys.slice(0, 200)) {
      const hit = await ctx.db
        .query('matchCache')
        .withIndex('by_key', (q) => q.eq('key', key))
        .first()
      if (hit !== null) found.push({ key, answer: hit.answer })
    }
    return found
  },
})

export const latestRun = internalQuery({
  args: { slug: v.string() },
  handler: (ctx, { slug }) =>
    ctx.db
      .query('runs')
      .withIndex('by_tenderSlug_and_startedAt', (q) => q.eq('tenderSlug', slug))
      .order('desc')
      .first(),
})

// --- Clearing a tender's runs ----------------------------------------------

const RUN_TABLES = ['runEvents', 'questions', 'judgements', 'matches'] as const

/**
 * Deletes every run of a tender and what belongs to it. Reloading a tender
 * replaces its positions and lines, and decisions made about the old ones
 * would point at nothing. The answer cache stays: it is keyed by what was
 * asked, not by which run asked it.
 */
export const reset = internalMutation({
  args: { slug: v.string(), before: v.optional(v.number()) },
  handler: async (ctx, { slug, before }) => {
    // Only runs that existed when the reset was asked for. A run started
    // while the old ones are still being cleared is not one of them.
    const cutoff = before ?? Date.now()
    const target = await ctx.db
      .query('runs')
      .withIndex('by_tenderSlug_and_startedAt', (q) =>
        q.eq('tenderSlug', slug).lt('startedAt', cutoff),
      )
      .first()
    if (target === null) return { done: true }

    let removed = 0
    for (const table of RUN_TABLES) {
      const rows = await ctx.db
        .query(table)
        .withIndex('by_runId_and_seq', (q) => q.eq('runId', target._id))
        .take(400)
      for (const row of rows) await ctx.db.delete(table, row._id)
      removed += rows.length
    }
    if (removed === 0) await ctx.db.delete('runs', target._id)
    await ctx.scheduler.runAfter(0, internal.agent.store.reset, {
      slug,
      before: cutoff,
    })
    return { done: false }
  },
})
