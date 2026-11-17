import { describe, expect, it } from 'vitest'
import { PLAN, layoutPlan, openContact } from './schematic'

const titles = [
  { rno: '01', label: 'Baustrom', positionCount: 12 },
  { rno: '02', label: 'Hauptverteilung', positionCount: 34 },
  { rno: '03', label: 'Unterverteilungen', positionCount: 364 },
  { rno: '04', label: 'Leer', positionCount: 0 },
]

describe('layoutPlan', () => {
  const plan = layoutPlan(titles, ['a', 'b', 'c'])

  it('spaces the feeders evenly along the busbar, inside its ends', () => {
    const xs = plan.feeders.map((feeder) => feeder.x)
    const gaps = xs.slice(1).map((x, index) => x - xs[index]!)
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!, 6)
    expect(xs[0]).toBeGreaterThan(plan.busbar.x1)
    expect(xs.at(-1)).toBeLessThan(plan.busbar.x2)
  })

  it('spaces the incomers evenly and symmetrically', () => {
    const [a, b, c] = plan.incomers.map((incomer) => incomer.x)
    expect(b! - a!).toBeCloseTo(c! - b!, 6)
    expect(a! - plan.busbar.x1).toBeCloseTo(plan.busbar.x2 - c!, 6)
  })

  it('gives every incomer the same room for its name, without overlap', () => {
    const [a, b] = plan.incomers.map((incomer) => incomer.x)
    expect(plan.incomerRoom).toBeCloseTo(b! - a!, 6)
    expect(a! - plan.incomerRoom / 2).toBeCloseTo(plan.busbar.x1, 6)
  })

  it('makes the longest bar the full length and the rest proportional', () => {
    const [small, , largest] = plan.feeders
    expect(largest!.bar).toBe(PLAN.barMax)
    // 34 of 364 is long enough to draw to scale.
    expect(plan.feeders[1]!.bar).toBeCloseTo((34 / 364) * PLAN.barMax, 6)
    // 12 of 364 would be under the minimum, so it gets the minimum.
    expect(small!.bar).toBe(PLAN.barMin)
  })

  it('draws no bar for a title with no positions', () => {
    expect(plan.feeders[3]!.bar).toBe(0)
  })

  it('keeps every bar inside the drawing', () => {
    for (const feeder of plan.feeders) {
      expect(PLAN.barTop + feeder.bar).toBeLessThan(plan.height)
    }
  })

  it('copes with a tender that has no titles yet', () => {
    const empty = layoutPlan([], ['a'])
    expect(empty.feeders).toEqual([])
    expect(empty.incomers).toHaveLength(1)
  })
})

describe('openContact', () => {
  it('swings the tip of the contact to the left of its closed place', () => {
    const tip = openContact(30)
    expect(tip.x).toBeLessThan(0)
    expect(tip.y).toBeGreaterThan(-30)
    expect(Math.hypot(tip.x, tip.y)).toBeCloseTo(30, 6)
  })
})
