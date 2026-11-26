/**
 * The agent runtime: a run, as three kinds of step.
 *
 * 1. `prepare` works out, for every position, which lines could answer it.
 * 2. `read` takes the next batch of positions, has the model read the ones
 *    nobody has read before, checks every answer against its sources, and
 *    stores the batch in one transaction. Then it schedules itself again.
 * 3. `escalate`, only where the escalation role has a model: the questions
 *    the matcher could not settle are read again by that larger model, and
 *    its verified answer replaces the first (`planEscalation` in core).
 * 4. `decide` runs the checks and the triage over everything that was read.
 *
 * Each step is scheduled by the one before it, so a run survives a restart
 * of the deployment and a step can fail without losing the steps before.
 * A step that runs twice writes nothing the second time. Every model call
 * is on the ledger, and the run stops by itself when a budget is reached.
 */
import {
  buildQuestions,
  planEscalation,
  triage,
  verifyAnswer,
} from '@preisspiegel/core'
import { v } from 'convex/values'
import { internal } from '../_generated/api'
import { internalAction, internalMutation } from '../_generated/server'
import { utcDay } from '../llm/call'
import { llmCall, roleModel, spendLimits } from '../llm/client'
import { beginRun, runUnderWay } from './store'
import {
  SYSTEM,
  answerSchema,
  questionKey,
  renderQuestion,
  withLineIds,
} from './prompt'
import type {
  Judgement,
  OfferLine,
  Position,
  Question,
  RawJudgement,
} from '@preisspiegel/core'
import type { Id } from '../_generated/dataModel'
import type { ActionCtx } from '../_generated/server'
import type { LedgerEntry } from '../llm/call'

/** Positions per step. Small enough to finish well inside an action's time. */
const BATCH = 30
/**
 * The pause between the steps of a replay. Stored answers are read back in
 * about two seconds, too fast to see; with this a tender takes about twenty.
 */
const REPLAY_PACE_MS = 450
/** Model calls made side by side. */
const SIDE_BY_SIDE = 8
const PAGE = 400

type RunEvent = {
  kind: string
  data: Record<string, string | number | boolean | null>
}

/** Starts a run over a tender, or over its first `limit` positions. */
export const start = internalMutation({
  args: { slug: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { slug, limit }): Promise<Id<'runs'>> => {
    const tender = await ctx.db
      .query('tenders')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()
    if (tender === null) throw new Error(`No tender "${slug}".`)
    // One run of a tender at a time, from here as from the interface: two
    // would write the same positions and each clear the other's when done.
    if (await runUnderWay(ctx, slug)) {
      throw new Error(`A run of "${slug}" is under way.`)
    }
    const model = roleModel('match')
    if (model === null) throw new Error('The match role has no model.')

    return beginRun(ctx, {
      slug,
      positions: Math.min(limit ?? Infinity, tender.positionCount),
      model,
      mode: 'live',
    })
  },
})

async function loadTender(
  ctx: ActionCtx,
  slug: string,
): Promise<{ positions: Array<Position>; lines: Array<OfferLine> }> {
  const positions: Array<Position> = []
  for (;;) {
    const page: Array<Position> = await ctx.runQuery(
      internal.agent.store.positions,
      { slug, fromSeq: positions.length, limit: PAGE },
    )
    positions.push(...page)
    if (page.length < PAGE) break
  }

  const lines: Array<OfferLine> = []
  const keys: Array<string> = await ctx.runQuery(
    internal.agent.store.offerKeys,
    { slug },
  )
  for (const supplierKey of [...keys].sort()) {
    let fromSeq = 0
    for (;;) {
      const page: Array<OfferLine> = await ctx.runQuery(
        internal.agent.store.offerLines,
        { slug, supplierKey, fromSeq, limit: PAGE },
      )
      lines.push(...page)
      fromSeq += page.length
      if (page.length < PAGE) break
    }
  }
  return { positions, lines }
}

/** Runs a step and marks the run failed if the step throws. */
async function guarded(
  ctx: ActionCtx,
  runId: Id<'runs'>,
  step: () => Promise<void>,
): Promise<null> {
  try {
    await step()
  } catch (error) {
    await ctx.runMutation(internal.agent.store.setStatus, {
      runId,
      status: 'failed',
      note: (error instanceof Error ? error.message : String(error)).slice(
        0,
        500,
      ),
    })
  }
  return null
}

export const prepare = internalAction({
  args: { runId: v.id('runs') },
  handler: (ctx, { runId }): Promise<null> =>
    guarded(ctx, runId, async () => {
      const current = await ctx.runQuery(internal.agent.store.run, { runId })
      if (current === null || current.status !== 'preparing') return
      const { positions, lines } = await loadTender(ctx, current.tenderSlug)

      // Questions are built over the whole tender even for a trial run, so
      // a search result counts the same either way.
      const questions = buildQuestions(positions, lines).slice(
        0,
        current.positions,
      )
      const model = current.model ?? ''
      const rows = await Promise.all(
        questions.map(async (question, seq) => ({
          ...question,
          seq,
          key: await questionKey(question, model),
        })),
      )
      for (let from = 0; from < rows.length; from += 100) {
        await ctx.runMutation(internal.agent.store.saveQuestions, {
          runId,
          questions: rows.slice(from, from + 100),
        })
      }
      await ctx.runMutation(internal.agent.store.beginReading, {
        runId,
        lines: rows.reduce((sum, row) => sum + row.candidates.length, 0),
        distinct: new Set(
          rows.filter((row) => row.candidates.length > 0).map((row) => row.key),
        ).size,
      })
      await ctx.scheduler.runAfter(0, internal.agent.run.read, { runId })
    }),
})

/** Runs `work` over `items`, at most `width` at a time, keeping their order. */
async function sideBySide<TItem, TResult>(
  items: ReadonlyArray<TItem>,
  width: number,
  work: (item: TItem) => Promise<TResult>,
): Promise<Array<TResult>> {
  const results = new Array<TResult>(items.length)
  const waiting = [...items.entries()]
  const worker = async () => {
    for (;;) {
      const next = waiting.shift()
      if (next === undefined) return
      const [index, item] = next
      results[index] = await work(item)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(width, items.length) }, worker),
  )
  return results
}

export const read = internalAction({
  args: { runId: v.id('runs') },
  handler: (ctx, { runId }): Promise<null> =>
    guarded(ctx, runId, async () => {
      const plan = await ctx.runQuery(internal.agent.store.nextBatch, {
        runId,
        size: BATCH,
        day: utcDay(Date.now()),
      })
      if (plan === null || plan.status !== 'reading') return
      if (plan.questions.length === 0) {
        await afterReading(ctx, runId)
        return
      }

      // A replay calls no model, so it has nothing to spend.
      const replay = plan.mode === 'replay'

      // The guards. Checked before a batch, so the most a run can overshoot
      // is what one batch costs.
      const limits = spendLimits()
      const over = replay
        ? null
        : plan.runUsd >= limits.runUsd
          ? `The run reached its budget of ${limits.runUsd} USD.`
          : plan.dayUsd >= limits.dailyUsd
            ? `Model spend for today reached ${limits.dailyUsd} USD.`
            : null
      if (over !== null) {
        await ctx.runMutation(internal.agent.store.setStatus, {
          runId,
          status: 'stopped',
          note: over,
        })
        return
      }

      const questions: Array<Question & { seq: number; key: string }> =
        plan.questions
      const answers = new Map<string, Array<RawJudgement>>(
        plan.cached.map((entry) => [entry.key, entry.answer]),
      )

      // One call per question nobody has answered, however many positions
      // of this batch ask it.
      const unanswered = new Map<string, Question>()
      for (const question of questions) {
        if (question.candidates.length === 0) continue
        if (!answers.has(question.key) && !unanswered.has(question.key)) {
          unanswered.set(question.key, question)
        }
      }

      const entries: Array<LedgerEntry> = []
      const events: Array<RunEvent> = []
      const fresh = new Map<string, Array<RawJudgement>>()
      const failed = new Set<string>()
      // In a replay a question nobody has answered stays unanswered: its
      // lines are unconfirmed, as after a call that failed.
      if (replay) {
        for (const [key, question] of unanswered) {
          failed.add(key)
          events.push({
            kind: 'read.skipped',
            data: { oz: question.oz, reason: 'no stored answer' },
          })
        }
      }
      await sideBySide(
        replay ? [] : [...unanswered.entries()],
        SIDE_BY_SIDE,
        async ([key, question]) => {
          const started = Date.now()
          const outcome = await llmCall({
            role: 'match',
            system: SYSTEM,
            user: renderQuestion(question),
            schema: answerSchema,
            maxTokens: 8000,
            runId,
          })
          if (outcome === null) {
            failed.add(key)
            return
          }
          if (outcome.entry !== null) {
            // On the ledger as soon as it is billed, so a step that dies
            // later in the batch leaves no paid call unrecorded.
            await ctx.runMutation(internal.llm.ledger.recordMany, {
              entries: [outcome.entry],
            })
            entries.push(outcome.entry)
          }
          const tokens = {
            ms: Date.now() - started,
            usd: outcome.entry?.usd ?? 0,
            inputTokens: outcome.entry?.inputTokens ?? 0,
            outputTokens: outcome.entry?.outputTokens ?? 0,
            cacheReadTokens: outcome.entry?.cacheReadTokens ?? 0,
          }
          if (!outcome.result.ok) {
            failed.add(key)
            events.push({
              kind: 'read.failed',
              data: {
                oz: question.oz,
                reason: outcome.result.reason,
                detail: outcome.result.detail ?? null,
                ...tokens,
              },
            })
            return
          }
          const answer = outcome.result.value.lines
          fresh.set(key, answer)
          const count = (verdict: RawJudgement['verdict']) =>
            answer.filter((line) => line.verdict === verdict).length
          events.push({
            kind: 'read',
            data: {
              oz: question.oz,
              text: question.shortText,
              lines: question.candidates.length,
              same: count('same'),
              different: count('different'),
              ...tokens,
            },
          })
        },
      )

      // Every answer is checked against its sources here, whether it is
      // fresh or from the cache.
      const asked = new Set<string>()
      const rows = questions.map((question) => {
        const answer = fresh.get(question.key) ?? answers.get(question.key)
        const source: 'model' | 'cache' | 'code' | 'failed' =
          question.candidates.length === 0
            ? 'code'
            : failed.has(question.key)
              ? 'failed'
              : fresh.has(question.key) && !asked.has(question.key)
                ? 'model'
                : 'cache'
        asked.add(question.key)
        const judgements: Array<Judgement> = verifyAnswer(
          question,
          withLineIds(question, answer ?? []),
        )
        return { oz: question.oz, seq: question.seq, source, judgements }
      })

      const model = roleModel('match') ?? ''
      const nextCursor = plan.cursor + questions.length
      const saved = await ctx.runMutation(internal.agent.store.saveBatch, {
        runId,
        cursor: plan.cursor,
        nextCursor,
        rows,
        cache: [...fresh.entries()].map(([key, answer]) => ({
          key,
          model,
          answer,
        })),
        entries,
        events,
      })
      if (!saved.stored) return
      if (saved.done) {
        await afterReading(ctx, runId)
      } else {
        await ctx.scheduler.runAfter(
          replay ? REPLAY_PACE_MS : 0,
          internal.agent.run.read,
          { runId },
        )
      }
    }),
})

/** Questions the escalation model reads per step. */
const ESCALATION_BATCH = 8

/** On to the second reading if the escalation role is on, else to deciding. */
async function afterReading(ctx: ActionCtx, runId: Id<'runs'>): Promise<void> {
  const escalating = roleModel('escalation') !== null
  await ctx.runMutation(internal.agent.store.setStatus, {
    runId,
    status: escalating ? 'escalating' : 'deciding',
    note: null,
  })
  await ctx.scheduler.runAfter(
    0,
    escalating ? internal.agent.run.escalate : internal.agent.run.decide,
    { runId },
  )
}

async function toDeciding(ctx: ActionCtx, runId: Id<'runs'>): Promise<void> {
  await ctx.runMutation(internal.agent.store.setStatus, {
    runId,
    status: 'deciding',
    note: null,
  })
  await ctx.scheduler.runAfter(0, internal.agent.run.decide, { runId })
}

/**
 * The second reading. The first step plans which questions go to the larger
 * model; every step after reads a batch of them. A question it cannot answer
 * keeps the matcher's answer, and its positions go to a person as before.
 */
export const escalate = internalAction({
  args: { runId: v.id('runs') },
  handler: (ctx, { runId }): Promise<null> =>
    guarded(ctx, runId, async () => {
      const current = await ctx.runQuery(internal.agent.store.run, { runId })
      if (current === null || current.status !== 'escalating') return
      const model = roleModel('escalation')

      if (current.escalation === undefined) {
        if (model === null) {
          await toDeciding(ctx, runId)
          return
        }
        const rows = []
        for (let fromSeq = 0; ; fromSeq += PAGE) {
          const page = await ctx.runQuery(internal.agent.store.readOutcomes, {
            runId,
            fromSeq,
            limit: PAGE,
          })
          rows.push(...page)
          if (page.length < PAGE) break
        }
        const plan = planEscalation(rows)
        await ctx.runMutation(internal.agent.store.planEscalation, {
          runId,
          model,
          ...plan,
        })
        await ctx.scheduler.runAfter(0, internal.agent.run.escalate, { runId })
        return
      }

      const state = current.escalation
      if (state.next >= state.items.length) {
        await toDeciding(ctx, runId)
        return
      }
      const replay = current.mode === 'replay'
      if (!replay) {
        const limits = spendLimits()
        const day = await ctx.runQuery(internal.llm.ledger.spentOn, {
          day: utcDay(Date.now()),
        })
        const over =
          current.usd >= limits.runUsd
            ? `The run reached its budget of ${limits.runUsd} USD.`
            : day.usd >= limits.dailyUsd
              ? `Model spend for today reached ${limits.dailyUsd} USD.`
              : null
        if (over !== null) {
          await ctx.runMutation(internal.agent.store.setStatus, {
            runId,
            status: 'stopped',
            note: over,
          })
          return
        }
      }

      const to = Math.min(state.next + ESCALATION_BATCH, state.items.length)
      const batch = state.items.slice(state.next, to)
      const shown: Array<Question & { seq: number; key: string }> =
        await ctx.runQuery(internal.agent.store.questionsAt, {
          runId,
          seqs: batch.map((item) => item.seqs[0] ?? -1),
        })
      const bySeq = new Map(shown.map((question) => [question.seq, question]))
      const keyed = await Promise.all(
        batch.map(async (item) => {
          const question = bySeq.get(item.seqs[0] ?? -1)
          return question === undefined
            ? null
            : { item, question, key: await questionKey(question, state.model) }
        }),
      )
      const work = keyed.filter((entry) => entry !== null)
      const stored = new Map<string, Array<RawJudgement>>(
        (
          await ctx.runQuery(internal.agent.store.cachedAnswers, {
            keys: work.map((entry) => entry.key),
          })
        ).map((hit) => [hit.key, hit.answer]),
      )

      const entries: Array<LedgerEntry> = []
      const events: Array<RunEvent> = []
      const cache: Array<{
        key: string
        model: string
        answer: Array<RawJudgement>
      }> = []
      let failed = 0
      const results = await sideBySide(
        work,
        SIDE_BY_SIDE,
        async ({ item, question, key }) => {
          let answer = stored.get(key)
          if (answer === undefined && !replay) {
            const outcome = await llmCall({
              role: 'escalation',
              system: SYSTEM,
              user: renderQuestion(question),
              schema: answerSchema,
              maxTokens: 16000,
              runId,
            })
            if (outcome?.entry != null) {
              await ctx.runMutation(internal.llm.ledger.recordMany, {
                entries: [outcome.entry],
              })
              entries.push(outcome.entry)
            }
            if (outcome !== null && outcome.result.ok) {
              answer = outcome.result.value.lines
              cache.push({ key, model: state.model, answer })
            } else {
              events.push({
                kind: 'escalation.failed',
                data: {
                  oz: question.oz,
                  reason:
                    outcome === null
                      ? 'role off'
                      : outcome.result.ok
                        ? 'unknown'
                        : outcome.result.reason,
                },
              })
            }
          }
          if (answer === undefined) {
            failed++
            return null
          }
          const judgements: Array<Judgement> = verifyAnswer(
            question,
            withLineIds(question, answer),
          )
          events.push({
            kind: 'escalated',
            data: {
              oz: question.oz,
              positions: item.seqs.length,
              confirmed: judgements.filter((j) => j.verdict === 'confirmed')
                .length,
              unconfirmed: judgements.filter((j) => j.verdict === 'unconfirmed')
                .length,
            },
          })
          return { seqs: item.seqs, judgements }
        },
      )

      const saved = await ctx.runMutation(internal.agent.store.saveEscalation, {
        runId,
        from: state.next,
        to,
        results: results.filter((result) => result !== null),
        failed: failed + (batch.length - work.length),
        cache,
        entries,
        events,
      })
      if (!saved.stored) return
      if (saved.done) await toDeciding(ctx, runId)
      else
        await ctx.scheduler.runAfter(
          replay ? REPLAY_PACE_MS : 0,
          internal.agent.run.escalate,
          { runId },
        )
    }),
})

export const decide = internalAction({
  args: { runId: v.id('runs') },
  handler: (ctx, { runId }): Promise<null> =>
    guarded(ctx, runId, async () => {
      const current = await ctx.runQuery(internal.agent.store.run, { runId })
      if (current === null || current.status !== 'deciding') return
      const tender = await loadTender(ctx, current.tenderSlug)
      const positions = tender.positions.slice(0, current.positions)

      const judged = new Map<string, Array<Judgement>>()
      for (let fromSeq = 0; ; fromSeq += PAGE) {
        const page = await ctx.runQuery(internal.agent.store.judgements, {
          runId,
          fromSeq,
          limit: PAGE,
        })
        for (const row of page) judged.set(row.oz, row.judgements)
        if (page.length < PAGE) break
      }

      const results = triage(positions, tender.lines, judged)
      const matches = results.map(({ position, offers, decision }) => ({
        oz: position.oz,
        seq: position.seq,
        ...decision,
        offers,
      }))
      for (let from = 0; from < matches.length; from += 100) {
        await ctx.runMutation(internal.agent.store.saveMatches, {
          runId,
          matches: matches.slice(from, from + 100),
        })
      }

      const cents = (value: number) => Math.round(value * 100) / 100
      await ctx.runMutation(internal.agent.store.finishRun, {
        runId,
        auto: matches.filter((match) => match.status === 'auto').length,
        review: matches.filter((match) => match.status === 'review').length,
        materialTotal: cents(
          matches.reduce((sum, match) => sum + (match.materialTotal ?? 0), 0),
        ),
        atRisk: cents(
          matches.reduce((sum, match) => sum + (match.atRisk ?? 0), 0),
        ),
        statuses: matches
          .map((match) => (match.status === 'auto' ? 'a' : 'r'))
          .join(''),
        wins: matches.reduce<Record<string, number>>((count, match) => {
          if (match.status === 'auto' && match.best !== null) {
            const key = match.best.supplierKey
            count[key] = (count[key] ?? 0) + 1
          }
          return count
        }, {}),
      })
    }),
})
