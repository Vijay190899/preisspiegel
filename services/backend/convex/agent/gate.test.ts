import { describe, expect, it } from 'vitest'
import { MIN_CODE_LENGTH, admit, sameCode } from './gate'

const base = {
  configured: 'weide-7Q-hafen-2031',
  running: false,
  locked: false,
  crowded: false,
  replayAllowed: true,
}

describe('admit', () => {
  it('reads the stored answers back for anyone', () => {
    expect(admit({ ...base, code: undefined })).toEqual({
      ok: true,
      mode: 'replay',
    })
    expect(admit({ ...base, code: undefined, configured: undefined })).toEqual({
      ok: true,
      mode: 'replay',
    })
  })

  it('lets the model read only with the code', () => {
    expect(admit({ ...base, code: 'weide-7Q-hafen-2031' })).toEqual({
      ok: true,
      mode: 'live',
    })
    for (const code of [
      '',
      'weide-7q-hafen-2031',
      'weide-7Q-hafen-2031 ',
      'weide',
      'x',
    ]) {
      expect(admit({ ...base, code })).toEqual({ ok: false, reason: 'code' })
    }
  })

  it('has no live runs where no code is set', () => {
    const short = 'x'.repeat(MIN_CODE_LENGTH - 1)
    for (const configured of [undefined, '', '  ', 'change-me', short]) {
      expect(admit({ ...base, configured, code: configured ?? '' })).toEqual({
        ok: false,
        reason: 'closed',
      })
    }
  })

  it('stops reading codes after too many wrong ones, the right one included', () => {
    expect(
      admit({ ...base, code: 'weide-7Q-hafen-2031', locked: true }),
    ).toEqual({
      ok: false,
      reason: 'locked',
    })
  })

  it('past the overall ceiling answers a wrong code as locked, and still lets the right one in', () => {
    expect(admit({ ...base, code: 'guess', crowded: true })).toEqual({
      ok: false,
      reason: 'locked',
    })
    expect(
      admit({ ...base, code: 'weide-7Q-hafen-2031', crowded: true }),
    ).toEqual({ ok: true, mode: 'live' })
  })

  it('reads the answers back only as often as the limit allows', () => {
    expect(admit({ ...base, code: undefined, replayAllowed: false })).toEqual({
      ok: false,
      reason: 'busy',
    })
    // The limit on read-backs does not touch a run with the code.
    expect(
      admit({ ...base, code: 'weide-7Q-hafen-2031', replayAllowed: false }),
    ).toEqual({ ok: true, mode: 'live' })
  })

  it('starts one run of a tender at a time', () => {
    expect(admit({ ...base, code: undefined, running: true })).toEqual({
      ok: false,
      reason: 'running',
    })
    expect(
      admit({ ...base, code: 'weide-7Q-hafen-2031', running: true }),
    ).toEqual({
      ok: false,
      reason: 'running',
    })
    // A wrong code is told it is wrong, not that a run is under way.
    expect(admit({ ...base, code: 'nope', running: true })).toEqual({
      ok: false,
      reason: 'code',
    })
  })
})

describe('sameCode', () => {
  it('is equality', () => {
    expect(sameCode('abc', 'abc')).toBe(true)
    expect(sameCode('abd', 'abc')).toBe(false)
    expect(sameCode('ab', 'abc')).toBe(false)
    expect(sameCode('abcabc', 'abc')).toBe(false)
    expect(sameCode('', 'abc')).toBe(false)
  })
})
