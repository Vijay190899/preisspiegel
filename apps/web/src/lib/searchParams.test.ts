import { describe, expect, it } from 'vitest'
import { searchText } from './searchParams'

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
