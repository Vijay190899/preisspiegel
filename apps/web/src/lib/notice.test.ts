import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NOTICE_MS, dismiss, peekNotice, say } from './notice'

describe('the notice', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    dismiss()
    vi.useRealTimers()
  })

  it('says a line for a few seconds, then nothing', () => {
    expect(peekNotice()).toBeNull()
    say('decision.failed')
    vi.advanceTimersByTime(NOTICE_MS - 1)
    expect(peekNotice()?.message).toBe('decision.failed')
    vi.advanceTimersByTime(1)
    expect(peekNotice()).toBeNull()
  })

  it('takes a second line in place of the first, for the full time', () => {
    say('decision.failed')
    vi.advanceTimersByTime(NOTICE_MS - 1000)
    say('run.refused.failed')
    vi.advanceTimersByTime(NOTICE_MS - 1)
    expect(peekNotice()?.message).toBe('run.refused.failed')
  })

  it('makes the same line twice two announcements', () => {
    say('decision.failed')
    const first = peekNotice()?.n
    say('decision.failed')
    expect(peekNotice()?.n).not.toBe(first)
  })

  it('goes when dismissed', () => {
    say('decision.failed')
    dismiss()
    expect(peekNotice()).toBeNull()
  })
})
