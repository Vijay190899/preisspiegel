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
    expect(peekNotice()).toBe('decision.failed')
    vi.advanceTimersByTime(1)
    expect(peekNotice()).toBeNull()
  })

  it('takes a second line in place of the first, for the full time', () => {
    say('decision.failed')
    vi.advanceTimersByTime(NOTICE_MS - 1000)
    say('run.refused.failed')
    vi.advanceTimersByTime(NOTICE_MS - 1)
    expect(peekNotice()).toBe('run.refused.failed')
  })

  it('goes when dismissed', () => {
    say('decision.failed')
    dismiss()
    expect(peekNotice()).toBeNull()
  })
})
