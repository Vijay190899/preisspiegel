import { describe, expect, it } from 'vitest'
import { storeyOf, storeyPlan } from './storeys'

describe('storeyOf', () => {
  it('reads the storey out of a section name', () => {
    expect(storeyOf('Unterverteilung Untergeschoss')).toEqual({
      rank: -1,
      label: 'UG',
    })
    expect(storeyOf('Leitungen Erdgeschoss')).toEqual({ rank: 0, label: 'EG' })
    expect(storeyOf('Beleuchtung 3. Obergeschoss')).toEqual({
      rank: 3,
      label: '3. OG',
    })
    expect(storeyOf('Datennetz 12. OG')).toEqual({ rank: 12, label: '12. OG' })
    expect(storeyOf('Lüftung 2. Untergeschoss')).toEqual({
      rank: -2,
      label: '2. UG',
    })
    expect(storeyOf('Technik Dachgeschoss')).toEqual({
      rank: 1000,
      label: 'DG',
    })
  })

  it('finds none in a section that serves the whole building', () => {
    expect(storeyOf('Hauptleitungen')).toBeNull()
    expect(storeyOf('Felder und Einspeisung')).toBeNull()
    expect(storeyOf('Erdung und Potentialausgleich')).toBeNull()
    // "Abgänge" ends in "ge" and "Zugang" has "ug" in it; neither is a storey.
    expect(storeyOf('Abgänge')).toBeNull()
    expect(storeyOf('Zugang und Augenschein')).toBeNull()
  })
})

describe('storeyPlan', () => {
  it('orders the storeys from the ground up and says where each position belongs', () => {
    const plan = storeyPlan([
      'Hauptleitungen',
      'Leitungen 1. Obergeschoss',
      'Leitungen Untergeschoss',
      'Leitungen Erdgeschoss',
      undefined,
      'Beleuchtung 1. Obergeschoss',
    ])
    expect(plan.storeys).toEqual(['UG', 'EG', '1. OG'])
    expect(plan.byPosition).toBe('-201-2')
  })

  it('is empty for a tender that is not cut by storey', () => {
    expect(storeyPlan(['Kabel', 'Schalter'])).toEqual({
      storeys: [],
      byPosition: '--',
    })
  })
})
