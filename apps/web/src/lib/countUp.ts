import { useEffect, useState } from 'react'
import { INTRO_MS, introPlaying } from './intro'

/** Once a figure has counted up in this page load, the others do not again. */
let counted = false

/**
 * How long the opening still holds the page, in seconds, for what should
 * arrive only after it: nothing, unless the opening plays on this load and
 * has not lifted yet.
 */
export function introDelay(): number {
  if (!introPlaying()) return 0
  return Math.max(0, INTRO_MS - performance.now()) / 1000
}

/**
 * A figure that counts up from nothing as the lights come on, the first time
 * the overview opens in a visit, starting when the opening lifts. The server
 * renders the figure itself, and so does every later render: a figure that
 * changes because something was decided changes at once.
 */
export function useCountUp(value: number, durationMs = 1300): number {
  const [shown, setShown] = useState(value)
  useEffect(() => {
    // Landed elsewhere and came here later: the opening is long over.
    if (counted || !introPlaying() || performance.now() > INTRO_MS + 2500) {
      setShown(value)
      return
    }
    setShown(0)
    const start = Math.max(performance.now(), INTRO_MS)
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, Math.max(0, (now - start) / durationMs))
      const eased = 1 - (1 - progress) ** 3
      setShown(value * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
      else counted = true
    })
    return () => cancelAnimationFrame(frame)
  }, [value, durationMs])
  return shown
}
