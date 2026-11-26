// @vitest-environment edge-runtime
/// <reference types="vite/client" />
/**
 * The second reading, run against an in-memory Convex without a model: the
 * larger model's answer comes from the answer cache, as in a replay.
 */
import rateLimiter from '@convex-dev/rate-limiter/test'
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { internal } from './_generated/api'
import schema from './schema'
import { questionKey } from './agent/prompt'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')
const LARGER = 'claude-sonnet-5-5'

function setup() {
  const t = convexTest(schema, modules)
  rateLimiter.register(t)
  return t
}
type T = ReturnType<typeof setup>

/**
 * A position as the model was shown it. Every position offers its own line
 * (`k.4`, `k.5`, ...) under the same text: positions that share a question
 * share an answer but not their lines.
 */
const lineOf = (seq: number) => `k.${seq + 4}`
const question = (seq: number) => ({
  oz: `01.00${String(seq + 1).padStart(2, '0')}`,
  seq,
  shortText: 'Mantelleitung NYM-J 3x1,5 mm²',
  longText: 'Mantelleitung NYM-J 3x1,5 mm², im Rohr verlegt.',
  unit: 'm',
  candidates: [
    {
      id: lineOf(seq),
      referenced: false,
      text: 'NYM-J 3x1,5 mm² Ring 100 m',
      articleNo: null,
      unit: 'm',
    },
  ],
  echoes: [],
  key: 'matcher-key',
})

/** What the matcher left on a position's line: unconfirmed (it was unsure). */
const unsure = (seq: number) => [
  {
    id: lineOf(seq),
    verdict: 'unconfirmed' as const,
    by: 'model' as const,
    said: 'unsure' as const,
    pairs: [],
    rejected: 0,
    pack: null,
    alternative: null,
  },
]
const settled = (seq: number) =>
  unsure(seq).map((line) => ({
    ...line,
    verdict: 'confirmed' as const,
    said: 'same' as const,
  }))

/**
 * A run that has read ten positions; the first two share a question whose
 * line the matcher left unconfirmed.
 */
async function readRun(
  t: T,
  mode: 'live' | 'replay',
  {
    status = 'escalating',
    usd = 0,
  }: { status?: 'escalating' | 'reading'; usd?: number } = {},
): Promise<Id<'runs'>> {
  return t.run(async (ctx) => {
    const runId = await ctx.db.insert('runs', {
      tenderSlug: 'demo',
      status,
      model: 'claude-haiku-5-5',
      mode,
      startedAt: 1,
      finishedAt: null,
      positions: 10,
      cursor: 10,
      nextEvent: 0,
      calls: 0,
      cached: 0,
      failed: 0,
      usd,
      auto: null,
      review: null,
      materialTotal: null,
      atRisk: null,
      statuses: null,
      note: null,
    })
    for (let seq = 0; seq < 10; seq++) {
      const shown = { ...question(seq), key: seq < 2 ? 'shared' : `own-${seq}` }
      await ctx.db.insert('questions', { runId, ...shown })
      await ctx.db.insert('judgements', {
        runId,
        oz: shown.oz,
        seq,
        source: 'model',
        judgements: seq < 2 ? unsure(seq) : settled(seq),
      })
    }
    return runId
  })
}

/** The larger model's answer, stored under the key it would be asked by. */
async function storeLargerAnswer(t: T) {
  const shown = { ...question(0), key: 'shared' }
  const key = await questionKey(shown, LARGER)
  await t.run((ctx) =>
    ctx.db.insert('matchCache', {
      key,
      model: LARGER,
      at: 0,
      answer: [
        {
          id: '1',
          verdict: 'same',
          pairs: [
            {
              attribute: 'Querschnitt',
              tenderValue: '3x1,5 mm²',
              tenderQuote: 'NYM-J 3x1,5 mm²',
              offerValue: '3x1,5 mm²',
              offerQuote: 'NYM-J 3x1,5 mm²',
              agrees: true,
            },
          ],
          packSize: null,
          packQuote: null,
          alternativeQuote: null,
        },
      ],
    }),
  )
}

const judgementsOf = (t: T, runId: Id<'runs'>) =>
  t.run((ctx) =>
    ctx.db
      .query('judgements')
      .withIndex('by_runId_and_seq', (q) => q.eq('runId', runId).lt('seq', 3))
      .collect(),
  )
const runOf = (t: T, runId: Id<'runs'>) =>
  t.run((ctx) => ctx.db.get('runs', runId))

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('after reading', () => {
  it('goes on to the second reading when the role has a model', async () => {
    vi.stubEnv('LLM_ESCALATION_MODEL', LARGER)
    const t = setup()
    const runId = await readRun(t, 'live', { status: 'reading' })
    await t.action(internal.agent.run.read, { runId })
    expect((await runOf(t, runId))?.status).toBe('escalating')
  })

  it('goes straight to deciding when it has none', async () => {
    const t = setup()
    const runId = await readRun(t, 'live', { status: 'reading' })
    await t.action(internal.agent.run.read, { runId })
    expect((await runOf(t, runId))?.status).toBe('deciding')
  })
})

describe('the second reading', () => {
  it('plans the unsettled question once, for both positions that ask it', async () => {
    vi.stubEnv('LLM_ESCALATION_MODEL', LARGER)
    const t = setup()
    const runId = await readRun(t, 'replay')
    await t.action(internal.agent.run.escalate, { runId })
    const run = await runOf(t, runId)
    expect(run?.status).toBe('escalating')
    expect(run?.escalation).toMatchObject({
      model: LARGER,
      items: [{ key: 'shared', seqs: [0, 1] }],
      unsettled: 2,
      capped: 0,
      next: 0,
    })
  })

  it('checks the answer against each position\u2019s own line, then decides', async () => {
    vi.stubEnv('LLM_ESCALATION_MODEL', LARGER)
    const t = setup()
    const runId = await readRun(t, 'replay')
    await storeLargerAnswer(t)
    await t.action(internal.agent.run.escalate, { runId }) // plans
    await t.action(internal.agent.run.escalate, { runId }) // reads

    const rows = await judgementsOf(t, runId)
    expect(
      rows.map((row) => [
        row.source,
        row.judgements[0]?.id,
        row.judgements[0]?.verdict,
      ]),
    ).toEqual([
      ['escalated', 'k.4', 'confirmed'],
      ['escalated', 'k.5', 'confirmed'],
      ['model', 'k.6', 'confirmed'],
    ])
    const run = await runOf(t, runId)
    expect(run?.status).toBe('deciding')
    // A replay calls no model: the answer came from the cache.
    expect(run?.escalation).toMatchObject({ next: 1, answered: 1, calls: 0 })
    expect(run?.calls).toBe(0)
  })

  it('keeps the first reading where the larger model has no answer to give', async () => {
    vi.stubEnv('LLM_ESCALATION_MODEL', LARGER)
    const t = setup()
    const runId = await readRun(t, 'replay')
    await t.action(internal.agent.run.escalate, { runId })
    await t.action(internal.agent.run.escalate, { runId })
    const first = (await judgementsOf(t, runId)).at(0)
    expect(first?.source).toBe('model')
    expect(first?.judgements[0]?.verdict).toBe('unconfirmed')
    const run = await runOf(t, runId)
    expect(run?.escalation).toMatchObject({ answered: 0, failed: 1 })
    expect(run?.status).toBe('deciding')
  })

  it('decides what the matcher read when the budget runs out, rather than stopping', async () => {
    vi.stubEnv('LLM_ESCALATION_MODEL', LARGER)
    vi.stubEnv('RUN_MAX_USD', '0.5')
    const t = setup()
    const runId = await readRun(t, 'live', { usd: 1 })
    await t.action(internal.agent.run.escalate, { runId }) // plans
    await t.action(internal.agent.run.escalate, { runId }) // over budget
    const run = await runOf(t, runId)
    expect(run?.status).toBe('deciding')
    expect(run?.note).toMatch(/second reading stopped/)
    expect(run?.escalation).toMatchObject({ next: 0, calls: 0 })
  })

  it('stores a batch once, however often its step runs', async () => {
    vi.stubEnv('LLM_ESCALATION_MODEL', LARGER)
    const t = setup()
    const runId = await readRun(t, 'replay')
    await t.action(internal.agent.run.escalate, { runId })
    const stale = await t.mutation(internal.agent.store.saveEscalation, {
      runId,
      from: 5,
      to: 6,
      results: [{ seq: 0, judgements: settled(0) }],
      answered: 1,
      failed: 0,
      cache: [],
      entries: [],
      events: [],
    })
    expect(stale).toEqual({ stored: false, done: false })
    const first = (await judgementsOf(t, runId)).at(0)
    expect(first?.source).toBe('model')
  })

  it('goes straight to deciding when the role has no model', async () => {
    const t = setup()
    const runId = await readRun(t, 'live')
    await t.action(internal.agent.run.escalate, { runId })
    const run = await runOf(t, runId)
    expect(run?.status).toBe('deciding')
    expect(run?.escalation).toBeUndefined()
  })
})
