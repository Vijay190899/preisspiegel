import { describe, expect, it } from 'vitest'
import { WRONG_CODES_ALLOWED, admit, sameCode } from './gate'

const base = { configured: 'weide-7Q', running: false, wrongCodes: 0 }

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
    expect(admit({ ...base, code: 'weide-7Q' })).toEqual({
      ok: true,
      mode: 'live',
    })
    for (const code of ['', 'weide-7q', 'weide-7Q ', 'weide', 'x']) {
      expect(admit({ ...base, code })).toEqual({ ok: false, reason: 'code' })
    }
  })

  it('has no live runs where no code is set', () => {
    for (const configured of [undefined, '', '  ', 'change-me']) {
      expect(admit({ ...base, configured, code: configured ?? '' })).toEqual({
        ok: false,
        reason: 'closed',
      })
    }
  })

  it('stops reading codes after too many wrong ones, the right one included', () => {
    expect(
      admit({ ...base, code: 'weide-7Q', wrongCodes: WRONG_CODES_ALLOWED }),
    ).toEqual({ ok: false, reason: 'locked' })
    expect(
      admit({ ...base, code: 'weide-7Q', wrongCodes: WRONG_CODES_ALLOWED - 1 }),
    ).toEqual({ ok: true, mode: 'live' })
  })

  it('starts one run of a tender at a time', () => {
    expect(admit({ ...base, code: undefined, running: true })).toEqual({
      ok: false,
      reason: 'running',
    })
    expect(admit({ ...base, code: 'weide-7Q', running: true })).toEqual({
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
