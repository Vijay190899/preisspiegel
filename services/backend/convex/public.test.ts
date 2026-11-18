// @vitest-environment edge-runtime
/// <reference types="vite/client" />
/**
 * The public functions, run against an in-memory Convex: what a visitor's
 * browser can call, and what it is refused.
 */
import rateLimiter from '@convex-dev/rate-limiter/test'
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import { KEPT_FOR_MS } from './decisions'

const modules = import.meta.glob('./**/*.ts')
const SLUG = 'demo'
const ME = 'a'.repeat(32)
const SOMEONE = 'b'.repeat(32)

function setup() {
  const t = convexTest(schema, modules)
  rateLimiter.register(t)
  return t
}

type T = ReturnType<typeof setup>

/** A tender of two positions and one finished run that left both for a person. */
async function seed(t: T) {
  await t.run(async (ctx) => {
    await ctx.db.insert('tenders', {
      slug: SLUG,
      projectNo: 'P-1',
      project: 'Haus am Ufer',
      lot: 'Elektro',
      client: 'Bauherr',
      contractor: 'Bieter',
      currency: 'EUR',
      positionCount: 2,
      referencedPositionCount: 2,
      titles: [],
    })
    for (const [seq, oz] of ['01.0010', '01.0020'].entries()) {
      await ctx.db.insert('positions', {
        tenderSlug: SLUG,
        oz,
        seq,
        path: [],
        shortText: 'Leitung',
        longText: 'Leitung',
        qty: 10,
        unit: 'm',
        gaebId: `g${seq}`,
      })
    }
    const runId = await ctx.db.insert('runs', {
      tenderSlug: SLUG,
      status: 'done',
      model: 'test-model',
      mode: 'replay',
      startedAt: 1,
      finishedAt: 2,
      positions: 2,
      cursor: 2,
      nextEvent: 0,
      calls: 0,
      cached: 0,
      failed: 0,
      usd: 0,
      auto: 0,
      review: 2,
      materialTotal: 0,
      atRisk: 0,
      statuses: 'rr',
      note: null,
    })
    await ctx.db.insert('matches', {
      runId,
      oz: '01.0010',
      seq: 0,
      status: 'review',
      reasons: ['SPEC_MISMATCH'],
      noted: [],
      best: null,
      materialTotal: null,
      atRisk: null,
      weight: 0,
      offers: [
        {
          id: 'k.4',
          supplierKey: 'k',
          seq: 4,
          referenced: true,
          verdict: 'mismatch',
          by: 'code',
          pairs: [],
          pack: null,
          unitPrice: 2.5,
          quantity: 10,
          findings: [],
        },
        {
          id: 'o.9',
          supplierKey: 'o',
          seq: 9,
          referenced: true,
          verdict: 'unconfirmed',
          by: 'model',
          pairs: [],
          pack: null,
          unitPrice: null,
          quantity: 10,
          findings: [],
        },
      ],
    })
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('DEMO_ACCESS_CODE', 'weide-7Q-hafen-2031')
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('decisions', () => {
  it('takes the price of an offer from the stored run, not from the browser', async () => {
    const t = setup()
    await seed(t)
    await t.mutation(api.decisions.decide, {
      slug: SLUG,
      session: ME,
      oz: '01.0010',
      offerId: 'k.4',
      unitPrice: 0.01,
    })
    const mine = await t.query(api.decisions.mine, {
      slug: SLUG,
      session: ME,
    })
    expect(mine).toMatchObject([
      { oz: '01.0010', offerId: 'k.4', supplierKey: 'k', unitPrice: 2.5 },
    ])
    // Another browser sees none of it.
    expect(
      await t.query(api.decisions.mine, { slug: SLUG, session: SOMEONE }),
    ).toEqual([])
  })

  it('refuses an offer without a price, a bad price and a made-up id', async () => {
    const t = setup()
    await seed(t)
    const decide = (args: {
      session?: string
      oz?: string
      offerId: string | null
      unitPrice?: number
    }) =>
      t.mutation(api.decisions.decide, {
        slug: SLUG,
        session: args.session ?? ME,
        oz: args.oz ?? '01.0010',
        offerId: args.offerId,
        unitPrice: args.unitPrice,
      })
    await expect(decide({ offerId: 'o.9' })).rejects.toThrow(/no price/)
    await expect(decide({ offerId: 'x.1' })).rejects.toThrow(/no price/)
    for (const unitPrice of [0, -3, Number.NaN, 1e9, undefined]) {
      await expect(decide({ offerId: null, unitPrice })).rejects.toThrow(
        /positive amount/,
      )
    }
    await expect(
      decide({ offerId: null, unitPrice: 3, oz: '99.9999' }),
    ).rejects.toThrow(/No such position/)
    await expect(
      decide({ offerId: null, unitPrice: 3, session: 'short' }),
    ).rejects.toThrow(/Unknown session/)
  })

  it('keeps one decision per position, and takes it back', async () => {
    const t = setup()
    await seed(t)
    const own = { slug: SLUG, session: ME, oz: '01.0020', offerId: null }
    await t.mutation(api.decisions.decide, { ...own, unitPrice: 3 })
    await t.mutation(api.decisions.decide, { ...own, unitPrice: 4.123456 })
    expect(
      await t.query(api.decisions.mine, { slug: SLUG, session: ME }),
    ).toMatchObject([{ oz: '01.0020', unitPrice: 4.1235 }])
    await t.mutation(api.decisions.reopen, {
      slug: SLUG,
      session: ME,
      oz: '01.0020',
    })
    expect(
      await t.query(api.decisions.mine, { slug: SLUG, session: ME }),
    ).toEqual([])
  })

  it('refuses a browser that decides faster than a person can', async () => {
    const t = setup()
    await seed(t)
    const own = { slug: SLUG, oz: '01.0020', offerId: null, unitPrice: 3 }
    let refused = 0
    for (let at = 0; at < 70; at++) {
      try {
        await t.mutation(api.decisions.decide, { ...own, session: ME })
      } catch {
        refused++
      }
    }
    // A burst of 60 is allowed, and the clock does not move here.
    expect(refused).toBe(10)
    // Taking a decision back counts the same way.
    await expect(
      t.mutation(api.decisions.reopen, {
        slug: SLUG,
        session: ME,
        oz: '01.0020',
      }),
    ).rejects.toThrow(/Too many decisions/)
    // Another browser is not held up by it.
    await t.mutation(api.decisions.decide, { ...own, session: SOMEONE })
  })

  it('lets go of decisions nobody touched for a month', async () => {
    const t = setup()
    await seed(t)
    await t.mutation(api.decisions.decide, {
      slug: SLUG,
      session: ME,
      oz: '01.0020',
      offerId: null,
      unitPrice: 3,
    })
    await t.mutation(internal.decisions.forgetOld, {})
    expect(
      await t.query(api.decisions.mine, { slug: SLUG, session: ME }),
    ).toHaveLength(1)
    vi.advanceTimersByTime(KEPT_FOR_MS + 1000)
    expect(await t.mutation(internal.decisions.forgetOld, {})).toEqual({
      forgotten: 1,
      more: false,
    })
  })

  it('clears a month of decisions however many there are, a batch after another', async () => {
    const t = setup()
    await seed(t)
    await t.run(async (ctx) => {
      for (let at = 0; at < 1203; at++) {
        await ctx.db.insert('decisions', {
          tenderSlug: SLUG,
          session: `s${String(at).padStart(20, '0')}`,
          oz: '01.0020',
          seq: 1,
          offerId: null,
          supplierKey: null,
          unitPrice: 3,
          at: Date.now(),
        })
      }
    })
    vi.advanceTimersByTime(KEPT_FOR_MS + 1000)
    expect(await t.mutation(internal.decisions.forgetOld, {})).toEqual({
      forgotten: 500,
      more: true,
    })
    // The next batches were scheduled by the one before.
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(
      await t.run(
        async (ctx) => (await ctx.db.query('decisions').collect()).length,
      ),
    ).toBe(0)
  })
})

describe('starting a run', () => {
  const start = (t: T, session: string, code?: string) =>
    t.mutation(api.runs.start, { slug: SLUG, session, code })

  /** The run that `start` began is taken away again, so the next may start. */
  const clearRuns = (t: T) =>
    t.run(async (ctx) => {
      for (const run of await ctx.db.query('runs').collect()) {
        if (run.status !== 'done') await ctx.db.delete('runs', run._id)
      }
    })

  it('locks out the browser that guesses, not everyone', async () => {
    const t = setup()
    await seed(t)
    for (let at = 0; at < 5; at++) {
      expect(await start(t, ME, 'guess')).toEqual({
        ok: false,
        reason: 'code',
      })
    }
    // The right code from the guessing browser is not even read now.
    expect(await start(t, ME, 'weide-7Q-hafen-2031')).toEqual({
      ok: false,
      reason: 'locked',
    })
    // Another browser, the owner's say, still gets in.
    expect(await start(t, SOMEONE, 'weide-7Q-hafen-2031')).toEqual({
      ok: true,
      mode: 'live',
    })
  })

  it('past the overall ceiling refuses wrong codes from anyone, but never the right one', async () => {
    const t = setup()
    await seed(t)
    // A script making up a new browser id for every guess.
    for (let at = 0; at < 300; at++) {
      await start(t, `guesser${String(at).padStart(12, '0')}`, 'guess')
    }
    expect(await start(t, SOMEONE, 'another-guess')).toEqual({
      ok: false,
      reason: 'locked',
    })
    expect(await start(t, SOMEONE, 'weide-7Q-hafen-2031')).toEqual({
      ok: true,
      mode: 'live',
    })
  })

  it('reads the answers back a few times per browser, then asks it to wait', async () => {
    const t = setup()
    await seed(t)
    for (let at = 0; at < 3; at++) {
      expect(await start(t, ME)).toEqual({ ok: true, mode: 'replay' })
      await clearRuns(t)
    }
    expect(await start(t, ME)).toEqual({ ok: false, reason: 'busy' })
    expect(await start(t, SOMEONE)).toEqual({ ok: true, mode: 'replay' })
  })

  it('starts one run of a tender at a time, and does not count the refusal', async () => {
    const t = setup()
    await seed(t)
    expect(await start(t, ME)).toEqual({ ok: true, mode: 'replay' })
    for (let at = 0; at < 5; at++) {
      expect(await start(t, ME)).toEqual({ ok: false, reason: 'running' })
    }
    await clearRuns(t)
    expect(await start(t, ME)).toEqual({ ok: true, mode: 'replay' })
  })

  it('starts no second run from the command line while one is under way', async () => {
    const t = setup()
    await seed(t)
    await t.mutation(internal.agent.run.start, { slug: SLUG, limit: 2 })
    await expect(
      t.mutation(internal.agent.run.start, { slug: SLUG, limit: 2 }),
    ).rejects.toThrow(/under way/)
  })

  it('refuses a browser id it does not make', async () => {
    const t = setup()
    await seed(t)
    await expect(start(t, 'x')).rejects.toThrow(/Unknown session/)
  })
})
