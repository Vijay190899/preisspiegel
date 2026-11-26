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

const question = (seq: number) => ({
  oz: `01.00${String(seq + 1).padStart(2, '0')}`,
  seq,
  shortText: 'Mantelleitung NYM-J 3x1,5 mm²',
  longText: 'Mantelleitung NYM-J 3x1,5 mm², im Rohr verlegt.',
  unit: 'm',
  candidates: [
    {
      id: 'k.4',
      referenced: false,
      text: 'NYM-J 3x1,5 mm² Ring 100 m',
      articleNo: null,
      unit: 'm',
    },
  ],
  echoes: [],
  key: 'matcher-key',
})

/** What the matcher left: the line unconfirmed (it was unsure). */
const unsure = [
  {
    id: 'k.4',
    verdict: 'unconfirmed' as const,
    by: 'model' as const,
    said: 'unsure' as const,
    pairs: [],
    rejected: 0,
    pack: null,
    alternative: null,
  },
]
const settled = [
  { ...unsure[0], verdict: 'confirmed' as const, said: 'same' as const },
]

/**
 * A run that has read ten positions; the first two share a question whose
 * line the matcher left unconfirmed.
 */
async function readRun(t: T, mode: 'live' | 'replay'): Promise<Id<'runs'>> {
  return t.run(async (ctx) => {
    const runId = await ctx.db.insert('runs', {
      tenderSlug: 'demo',
      status: 'escalating',
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
      usd: 0,
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
        judgements: seq < 2 ? unsure : settled,
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

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('the second reading', () => {
  it('plans the unsettled question once, for both positions that ask it', async () => {
    vi.stubEnv('LLM_ESCALATION_MODEL', LARGER)
    const t = setup()
    const runId = await readRun(t, 'replay')
    await t.action(internal.agent.run.escalate, { runId })
    const run = await t.run((ctx) => ctx.db.get('runs', runId))
    expect(run?.status).toBe('escalating')
    expect(run?.escalation).toMatchObject({
      model: LARGER,
      items: [{ key: 'shared', seqs: [0, 1] }],
      unsettled: 2,
      capped: 0,
      next: 0,
    })
  })

  it('puts the larger model’s verified answer in place of the first, then decides', async () => {
    vi.stubEnv('LLM_ESCALATION_MODEL', LARGER)
    const t = setup()
    const runId = await readRun(t, 'replay')
    await storeLargerAnswer(t)
    await t.action(internal.agent.run.escalate, { runId }) // plans
    await t.action(internal.agent.run.escalate, { runId }) // reads

    const rows = await t.run((ctx) =>
      ctx.db
        .query('judgements')
        .withIndex('by_runId_and_seq', (q) => q.eq('runId', runId).lt('seq', 3))
        .collect(),
    )
    expect(rows.map((row) => [row.source, row.judgements[0]?.verdict])).toEqual(
      [
        ['escalated', 'confirmed'],
        ['escalated', 'confirmed'],
        ['model', 'confirmed'],
      ],
    )
    const run = await t.run((ctx) => ctx.db.get('runs', runId))
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
    const first = await t.run((ctx) =>
      ctx.db
        .query('judgements')
        .withIndex('by_runId_and_seq', (q) => q.eq('runId', runId).eq('seq', 0))
        .unique(),
    )
    expect(first?.source).toBe('model')
    const run = await t.run((ctx) => ctx.db.get('runs', runId))
    expect(run?.escalation).toMatchObject({ answered: 0, failed: 1 })
    expect(run?.status).toBe('deciding')
  })

  it('goes straight to deciding when the role has no model', async () => {
    const t = setup()
    const runId = await readRun(t, 'live')
    await t.action(internal.agent.run.escalate, { runId })
    const run = await t.run((ctx) => ctx.db.get('runs', runId))
    expect(run?.status).toBe('deciding')
    expect(run?.escalation).toBeUndefined()
  })
})
