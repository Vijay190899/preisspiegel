/**
 * The demo has no accounts. A browser makes up a random id the first time it
 * needs one and sends it with what it asks for: its decisions are kept under
 * it, and the limits in `limits.ts` count per id. An id proves nothing about
 * who sends it, so every limit kept per id has an overall one beside it.
 */
import { ConvexError } from 'convex/values'

const SESSION = /^[A-Za-z0-9_-]{16,64}$/

export function isSession(session: string): boolean {
  return SESSION.test(session)
}

/** The id as given, or a refusal when it is not one this app makes. */
export function known(session: string): string {
  if (!isSession(session)) throw new ConvexError('Unknown session.')
  return session
}
