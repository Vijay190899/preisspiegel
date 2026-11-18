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
  | { ok: false; reason: 'running' | 'code' | 'locked' | 'closed' | 'busy' }

/**
 * The shortest access code a deployment may set. A shorter one leaves live
 * runs closed: the limits on wrong codes slow guessing down, the length is
 * what makes it hopeless.
 */
export const MIN_CODE_LENGTH = 16

/** A code nobody has set, the placeholder from `.env.example`, or one too short. */
function unset(configured: string | undefined): boolean {
  return (
    configured === undefined ||
    configured === 'change-me' ||
    configured.trim().length < MIN_CODE_LENGTH
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
  /** Whether this browser gave too many wrong codes: its codes are not read. */
  locked: boolean
  /**
   * Whether everyone together gave too many wrong codes. A wrong code is
   * then answered as locked, but the right one is still let in.
   */
  crowded: boolean
  /** Whether this browser may have the answers read back once more. */
  replayAllowed: boolean
}): Admission {
  if (request.code === undefined) {
    if (request.running) return { ok: false, reason: 'running' }
    return request.replayAllowed
      ? { ok: true, mode: 'replay' }
      : { ok: false, reason: 'busy' }
  }
  // The code is judged before anything else is said, so a wrong one learns
  // nothing about the deployment's state.
  if (unset(request.configured)) return { ok: false, reason: 'closed' }
  if (request.locked) return { ok: false, reason: 'locked' }
  if (!sameCode(request.code, request.configured ?? '')) {
    return { ok: false, reason: request.crowded ? 'locked' : 'code' }
  }
  return request.running
    ? { ok: false, reason: 'running' }
    : { ok: true, mode: 'live' }
}
