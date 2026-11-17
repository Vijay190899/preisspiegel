import { useReducedMotion } from 'motion/react'
import type { Transition } from 'motion/react'

const AT_ONCE: Transition = { duration: 0 }

/**
 * How fast things move. Returns a function that passes a transition through,
 * or replaces it with none for a reader who asked for reduced motion.
 *
 * The starting state of an animation stays in the markup either way, so the
 * server and the browser render the same thing; only the way from there to
 * the final state differs.
 */
export function usePace(): {
  still: boolean
  pace: (transition: Transition) => Transition
} {
  const still = useReducedMotion() === true
  return { still, pace: (transition) => (still ? AT_ONCE : transition) }
}
