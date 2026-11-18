/**
 * How often the public functions may be used.
 *
 * Each limit is kept per browser id and overall. The id is made up by the
 * browser, so a script can make up as many as it likes; the overall limit is
 * what bounds it, and is set well above what visitors do by hand. Counting
 * goes through the rate limiter component, inside the calling mutation's
 * transaction, so two requests at once cannot both take the last unit.
 */
import { HOUR, MINUTE, RateLimiter } from '@convex-dev/rate-limiter'
import { components } from './_generated/api'
import type { MutationCtx } from './_generated/server'

export const limiter = new RateLimiter(components.rateLimiter, {
  // Wrong access codes: five per browser in ten minutes. Overall, past 300
  // an hour a wrong code is answered as locked, but the right code is still
  // read: a script making up browser ids must not be able to lock the owner
  // out. The code is at least 16 characters (agent/gate.ts), so the length,
  // not this count, is what makes guessing hopeless.
  wrongCode: { kind: 'token bucket', rate: 5, period: 10 * MINUTE },
  wrongCodeAll: { kind: 'fixed window', rate: 300, period: HOUR },
  // Reading the stored answers back: three per browser in ten minutes. No
  // overall limit: one run of a tender at a time already bounds it, and an
  // overall one would let a script use up every visitor's read-backs.
  replay: { kind: 'token bucket', rate: 3, period: 10 * MINUTE },
  // Decisions: a person working through the queue by keyboard stays far
  // below this; a script filling the table does not. The overall bucket is
  // sharded, so decisions from many visitors do not contend for one row.
  decide: { kind: 'token bucket', rate: 120, period: MINUTE, capacity: 60 },
  decideAll: {
    kind: 'token bucket',
    rate: 3000,
    period: HOUR,
    capacity: 600,
    shards: 4,
  },
})

type PerBrowser = 'wrongCode' | 'replay' | 'decide'
type Overall = 'wrongCodeAll' | 'decideAll'

/** Whether this browser may do one more, without counting it. */
export async function allows(
  ctx: MutationCtx,
  name: PerBrowser,
  session: string,
): Promise<boolean> {
  return (await limiter.check(ctx, name, { key: session })).ok
}

/** Whether everyone together may do one more, without counting it. */
export async function overallAllows(
  ctx: MutationCtx,
  name: Overall,
): Promise<boolean> {
  return (await limiter.check(ctx, name)).ok
}

/**
 * Counts one for this browser, and overall where a limit is named, but only
 * when both allow it: a refusal costs the browser nothing.
 */
export async function take(
  ctx: MutationCtx,
  name: PerBrowser,
  session: string,
  overall?: Overall,
): Promise<boolean> {
  if (!(await allows(ctx, name, session))) return false
  if (overall !== undefined && !(await overallAllows(ctx, overall))) {
    return false
  }
  await limiter.limit(ctx, name, { key: session })
  if (overall !== undefined) await limiter.limit(ctx, overall)
  return true
}
