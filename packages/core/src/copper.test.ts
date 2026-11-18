import { describe, expect, it } from 'vitest'
import {
  cableLines,
  copperNumber,
  copperSurcharge,
  surchargePerKm,
} from './copper'

describe('copperNumber', () => {
  it('counts cores times cross-section times 9.6', () => {
    // The figures wholesalers print for these cables: 43 and 120.
    expect(copperNumber('Mantelleitung NYM-J 3x1,5 mm²')).toBe(43.2)
    expect(copperNumber('Mantelleitung NYM-J 5x2,5 mm²')).toBe(120)
    expect(copperNumber('Starkstromkabel NYY-J 4x95 mm²')).toBe(3648)
    expect(copperNumber('Aderleitung grün-gelb H07V-K 1x16 mm²')).toBe(153.6)
    expect(copperNumber('NYM-J 3 x 2.5 mm2')).toBe(72)
  })

  it('finds none where no cores and cross-section are named', () => {
    expect(
      copperNumber('Datenkabel Cat.7 S/FTP Simplex, halogenfrei'),
    ).toBeNull()
    expect(copperNumber('LWL-Kabel OM4, 12 Fasern, Innen/Außen')).toBeNull()
    // Millimetres, not square millimetres: a tray, not a cable.
    expect(copperNumber('Kabelrinne 60 x 100 mm, gelocht')).toBeNull()
  })
})

describe('surchargePerKm', () => {
  it('follows the published examples', () => {
    // A wholesaler's own example: copper number 43, base 130, the day's
    // figure 198.89 with the costs already in it.
    expect(surchargePerKm(43, 198.89, 130, 0)).toBeCloseTo(29.62, 2)
    // Another's: copper number 39, notation 600, 2 % costs, base 150.
    expect(surchargePerKm(39, 600, 150, 0.02)).toBeCloseTo(180.18, 2)
  })

  it('is nothing while copper costs no more than the base', () => {
    expect(surchargePerKm(120, 140)).toBe(0)
  })
})

describe('copperSurcharge', () => {
  const lines = cableLines([
    {
      oz: '04.01.0010',
      shortText: 'Mantelleitung NYM-J 3x1,5 mm²',
      qty: 2000,
      unit: 'm',
    },
    {
      oz: '04.01.0020',
      shortText: 'Starkstromkabel NYY-J 4x95 mm²',
      qty: 60,
      unit: 'm',
    },
    {
      oz: '06.01.0010',
      shortText: 'SCHUKO-Steckdose 16 A',
      qty: 40,
      unit: 'St',
    },
    {
      oz: '10.01.0010',
      shortText: 'Datenkabel Cat.7 S/FTP Simplex',
      qty: 900,
      unit: 'm',
    },
  ])

  it('takes only cable by the metre that names its copper', () => {
    expect(lines.map((line) => line.oz)).toEqual(['04.01.0010', '04.01.0020'])
    expect(lines[0]?.copperKg).toBeCloseTo(86.4, 5)
  })

  it('adds up over the lengths asked for', () => {
    // 2 km × 43.2/100 × (1000 × 1.01 − 150) + 0.06 km × 3648/100 × 860
    expect(copperSurcharge(lines, 1000)).toBeCloseTo(743.04 + 1882.37, 1)
  })

  it('rises with the notation', () => {
    expect(copperSurcharge(lines, 1200)).toBeGreaterThan(
      copperSurcharge(lines, 800),
    )
  })
})
