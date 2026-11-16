import { describe, expect, it } from 'vitest'
import { ampsToKva, kvaToAmps } from './units'

describe('three-phase power and current', () => {
  it('rates a 138 kVA cabinet at about 199 A on a 400 V supply', () => {
    expect(kvaToAmps(138)).toBeCloseTo(199.2, 1)
  })

  it('shows a 138 kVA cabinet falls short of a 250 A requirement', () => {
    expect(kvaToAmps(138)).toBeLessThan(250)
    expect(ampsToKva(250)).toBeCloseTo(173.2, 1)
  })

  it('round-trips between kVA and amps', () => {
    expect(kvaToAmps(ampsToKva(63))).toBeCloseTo(63, 9)
  })

  it('uses the line voltage it is given', () => {
    expect(kvaToAmps(100, 690)).toBeCloseTo(83.7, 1)
  })
})
