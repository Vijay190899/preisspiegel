/**
 * Who may start a run from the interface, and what kind.
 *
 * Anyone may have the stored answers read back: that calls no model and
 * costs nothing. A run in which the model reads costs money, so it needs the
 * deployment's access code. One run of a tender at a time.
 */

export type RunMode = 'live' | 'replay'

export type Admission =
  | { ok: true; mode: RunMode }
  | { ok: false; reason: 'running' | 'code' | 'locked' | 'closed' }

/** Wrong codes allowed inside `LOCK_WINDOW_MS` before the code is refused unread. */
export const WRONG_CODES_ALLOWED = 5
export const LOCK_WINDOW_MS = 10 * 60 * 1000

/** A code nobody has set, or the placeholder from `.env.example`. */
function unset(configured: string | undefined): boolean {
  return (
    configured === undefined ||
    configured.trim() === '' ||
    configured === 'change-me'
  )
}

/** Compares in time that does not depend on where the two differ. */
export function sameCode(given: string, configured: string): boolean {
  let differs = given.length ^ configured.length
  for (let at = 0; at < configured.length; at++) {
    differs |=
      (given.charCodeAt(at % (given.length || 1)) || 0) ^
      configured.charCodeAt(at)
  }
  return differs === 0
}

export function admit(request: {
  /** The code typed in, or `undefined` to have the stored answers read back. */
  code: string | undefined
  /** `DEMO_ACCESS_CODE` of the deployment. */
  configured: string | undefined
  /** Whether a run of this tender is under way. */
  running: boolean
  /** Wrong codes given in the last `LOCK_WINDOW_MS`. */
  wrongCodes: number
}): Admission {
  if (request.code === undefined) {
    return request.running
      ? { ok: false, reason: 'running' }
      : { ok: true, mode: 'replay' }
  }
  // The code is judged before anything else is said, so a wrong one learns
  // nothing about the deployment's state.
  if (unset(request.configured)) return { ok: false, reason: 'closed' }
  if (request.wrongCodes >= WRONG_CODES_ALLOWED) {
    return { ok: false, reason: 'locked' }
  }
  if (!sameCode(request.code, request.configured ?? '')) {
    return { ok: false, reason: 'code' }
  }
  return request.running
    ? { ok: false, reason: 'running' }
    : { ok: true, mode: 'live' }
}
