import { describe, expect, it } from 'vitest'
import { searchFlag, searchText } from './searchParams'

describe('searchFlag', () => {
  it('is on for true in any of the ways a URL can say it', () => {
    expect(searchFlag(true)).toBe(true)
    expect(searchFlag('true')).toBe(true)
    expect(searchFlag(1)).toBe(true)
  })

  it('is absent otherwise, so it leaves no trace in the address', () => {
    expect(searchFlag(false)).toBeUndefined()
    expect(searchFlag('nein')).toBeUndefined()
    expect(searchFlag(undefined)).toBeUndefined()
  })
})

describe('searchText', () => {
  it('keeps text', () => {
    expect(searchText('07')).toBe('07')
    expect(searchText('a.0.unitPrice')).toBe('a.0.unitPrice')
  })

  it('turns a number the router parsed back into text', () => {
    expect(searchText(10)).toBe('10')
  })

  it('drops everything else', () => {
    expect(searchText('')).toBeUndefined()
    expect(searchText(undefined)).toBeUndefined()
    expect(searchText(null)).toBeUndefined()
    expect(searchText(true)).toBeUndefined()
    expect(searchText(['a'])).toBeUndefined()
    expect(searchText({ a: 1 })).toBeUndefined()
    expect(searchText(Number.NaN)).toBeUndefined()
  })
})
