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
  // Wrong access codes. Five per browser in ten minutes; past the overall
  // ceiling the code field is closed for everyone until the window turns.
  // The owner can always start a run from the command line.
  wrongCode: { kind: 'token bucket', rate: 5, period: 10 * MINUTE },
  wrongCodeAll: { kind: 'fixed window', rate: 30, period: HOUR },
  // Reading the stored answers back: free, but each one rewrites the run.
  replay: { kind: 'token bucket', rate: 3, period: 10 * MINUTE },
  replayAll: { kind: 'fixed window', rate: 60, period: HOUR },
  // Decisions: a person working through the queue by keyboard stays far
  // below this; a script filling the table does not.
  decide: { kind: 'token bucket', rate: 120, period: MINUTE, capacity: 60 },
  decideAll: { kind: 'token bucket', rate: 3000, period: HOUR, capacity: 600 },
})

type Pair = readonly [
  'wrongCode' | 'replay' | 'decide',
  'wrongCodeAll' | 'replayAll' | 'decideAll',
]

export const WRONG_CODE: Pair = ['wrongCode', 'wrongCodeAll']
export const REPLAY: Pair = ['replay', 'replayAll']
export const DECIDE: Pair = ['decide', 'decideAll']

/** Whether one more is allowed, without counting it. */
export async function allows(
  ctx: MutationCtx,
  [own, all]: Pair,
  session: string,
): Promise<boolean> {
  const mine = await limiter.check(ctx, own, { key: session })
  if (!mine.ok) return false
  return (await limiter.check(ctx, all)).ok
}

/** Counts one, and says whether it was allowed. */
export async function take(
  ctx: MutationCtx,
  [own, all]: Pair,
  session: string,
): Promise<boolean> {
  const mine = await limiter.limit(ctx, own, { key: session })
  if (!mine.ok) return false
  return (await limiter.limit(ctx, all)).ok
}
