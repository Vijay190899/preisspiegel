import { describe, expect, it } from 'vitest'
import {
  BLOCK,
  TOWER,
  layoutFacade,
  paneAt,
  paneBeside,
  paneStates,
} from './facade'
import type { FacadeInput, FacadeLayout } from './facade'

/**
 * A small house: two titles on three storeys, with a few positions that
 * serve the whole building before and after them.
 */
const house: FacadeInput = {
  titles: [
    { rno: '01', label: 'Allgemeines', positionCount: 2 },
    { rno: '02', label: 'Unterverteilungen', positionCount: 9 },
    { rno: '03', label: 'Beleuchtung', positionCount: 7 },
  ],
  storeys: ['EG', '1. OG', '2. OG'],
  // 01: two central. 02: three per storey. 03: two per storey and one central.
  storeyByPosition: '--' + '000111222' + '001122-',
}

function overlaps(layout: FacadeLayout): number {
  let count = 0
  layout.panes.forEach((a, at) => {
    for (const b of layout.panes.slice(at + 1)) {
      const apart =
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y
      if (!apart) count++
    }
  })
  return count
}

describe('layoutFacade as a block', () => {
  const layout = layoutFacade(house, BLOCK)
  const pane = (index: number) => {
    const found = layout.panes[index]
    if (found === undefined) throw new Error(`no pane ${index}`)
    return found
  }

  it('gives every position one window, in document order', () => {
    expect(layout.panes.map((p) => p.index)).toEqual(
      Array.from({ length: 18 }, (_, index) => index),
    )
    expect(overlaps(layout)).toBe(0)
  })

  it('keeps every window inside the wall', () => {
    const { wall } = layout
    for (const p of layout.panes) {
      expect(p.x).toBeGreaterThanOrEqual(wall.x)
      expect(p.x + p.width).toBeLessThanOrEqual(wall.x + wall.width)
      expect(p.y).toBeGreaterThanOrEqual(wall.y)
      expect(p.y + p.height).toBeLessThanOrEqual(wall.y + wall.height)
    }
  })

  it('stacks the storeys from the ground up', () => {
    // Position 2 is on the ground floor, 5 on the first, 8 on the second.
    expect(pane(2).y).toBeGreaterThan(pane(5).y)
    expect(pane(5).y).toBeGreaterThan(pane(8).y)
    expect(layout.storeys.map((storey) => storey.label)).toEqual([
      '2. OG',
      '1. OG',
      'EG',
    ])
  })

  it('makes a bay of every title that has a storey', () => {
    expect(layout.bays.map((bay) => bay.rno)).toEqual(['02', '03'])
    const [first, second] = layout.bays
    // Windows of one title on different storeys stand above each other.
    expect(pane(2).x).toBe(pane(5).x)
    expect(pane(2).x).toBe(first?.x)
    expect(pane(11).x).toBe(second?.x)
    expect(second?.x).toBeGreaterThan((first?.x ?? 0) + (first?.width ?? 0))
  })

  it('puts what has no storey in the plinth, under everything else', () => {
    const lowest = Math.max(pane(2).y + pane(2).height)
    for (const index of [0, 1, 17]) {
      expect(pane(index).y).toBeGreaterThan(lowest)
    }
    expect(layout.plinth).not.toBeNull()
    // Spread over the width: the first group starts at the left, the last
    // ends at the right.
    const right = Math.max(...layout.panes.map((p) => p.x + p.width))
    expect(pane(0).x).toBe(pane(2).x)
    expect(pane(17).x + pane(17).width).toBeCloseTo(right, 6)
  })

  it('draws a slab under every storey', () => {
    expect(layout.slabs).toHaveLength(3)
  })
})

describe('layoutFacade as a tower', () => {
  const narrow = { ...TOWER, columns: 2 }
  const layout = layoutFacade(house, narrow)

  it('wraps a storey into rows and still places everything once', () => {
    expect(layout.panes).toHaveLength(18)
    expect(overlaps(layout)).toBe(0)
    const rows = new Map<number, number>()
    for (const p of layout.panes) rows.set(p.row, (rows.get(p.row) ?? 0) + 1)
    expect(Math.max(...rows.values())).toBe(2)
    expect(layout.bays).toEqual([])
  })

  it('is taller than it is wide', () => {
    expect(layout.height).toBeGreaterThan(layout.wall.width)
  })
})

describe('layoutFacade without storeys', () => {
  it('still gives every position a window', () => {
    const flat = layoutFacade(
      { titles: house.titles, storeys: [], storeyByPosition: '' },
      BLOCK,
    )
    expect(flat.panes).toHaveLength(18)
    expect(overlaps(flat)).toBe(0)
    expect(flat.storeys).toEqual([])
  })

  it('treats a storey it does not know as none', () => {
    const odd = layoutFacade(
      { ...house, storeyByPosition: 'z'.repeat(18) },
      BLOCK,
    )
    expect(odd.panes).toHaveLength(18)
    expect(odd.bays).toEqual([])
  })
})

describe('paneStates', () => {
  it('shows the decisions of a finished run', () => {
    expect(paneStates(4, 'ar', null)).toEqual(['priced', 'open', 'off', 'off'])
  })

  it('shows how far a run that is under way has read', () => {
    expect(paneStates(3, 'aaa', 2)).toEqual(['read', 'read', 'off'])
  })

  it('is dark before any run', () => {
    expect(paneStates(2, null, null)).toEqual(['off', 'off'])
  })
})

describe('finding a window', () => {
  const layout = layoutFacade(house, BLOCK)
  const pane = (index: number) => {
    const found = layout.panes[index]
    if (found === undefined) throw new Error(`no pane ${index}`)
    return found
  }

  it('finds the window under a point, and near it', () => {
    const target = pane(5)
    expect(paneAt(layout, target.x + 1, target.y + 1)?.index).toBe(5)
    expect(paneAt(layout, target.x - 1, target.y + 1)?.index).toBe(5)
    expect(paneAt(layout, 0, 0)).toBeNull()
  })

  it('steps along a storey and across bays', () => {
    expect(paneBeside(layout, pane(2), 'right')?.index).toBe(3)
    // The last window of the first bay leads to the first of the second.
    expect(paneBeside(layout, pane(4), 'right')?.index).toBe(11)
    expect(paneBeside(layout, pane(2), 'left')).toBeNull()
  })

  it('steps up and down between storeys and into the plinth', () => {
    expect(paneBeside(layout, pane(2), 'up')?.index).toBe(5)
    expect(paneBeside(layout, pane(8), 'up')).toBeNull()
    expect(paneBeside(layout, pane(2), 'down')?.index).toBe(0)
  })
})
