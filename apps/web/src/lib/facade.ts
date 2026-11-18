/**
 * Geometry of the overview's picture: the front of the building the tender
 * is for, with one window for every position.
 *
 * A tender for a building is cut by trade and by storey, so its positions
 * already have a place on the front: the storey is the row, the title is the
 * bay. What serves the whole building (the main distribution, earthing,
 * hourly work) has no storey and sits in the plinth. This lays that out in
 * drawing units; the component only draws.
 */

export interface FacadeInput {
  /** The titles in document order, with how many positions each has. */
  titles: ReadonlyArray<{ rno: string; label: string; positionCount: number }>
  /** The storeys from the ground up. */
  storeys: ReadonlyArray<string>
  /** One character per position: the storey's index in base 36, or `-`. */
  storeyByPosition: string
}

/** The two shapes the building is drawn in. */
export interface FacadeShape {
  /** Windows in a row. `null` gives every title its own bay, side by side. */
  columns: number | null
  paneWidth: number
  paneHeight: number
  /** Height of a window in the plinth. */
  plinthPaneHeight: number
  gapX: number
  /** Between two rows of windows on one storey. */
  gapY: number
  /** The wall between two bays. */
  pier: number
  /** The floor between two storeys. */
  slab: number
  /** Wall left and right of the outermost windows. */
  edge: number
  /** Wall above the top windows, up to the roof line. */
  parapet: number
  /** Room beside the wall for the names of the storeys. */
  labelRoom: number
  /** Room above the roof edge for what stands on the roof. */
  headRoom: number
}

/** A long office block: what a wide screen shows. */
export const BLOCK: FacadeShape = {
  columns: null,
  paneWidth: 5,
  paneHeight: 31,
  plinthPaneHeight: 11,
  gapX: 2.2,
  gapY: 0,
  pier: 13,
  slab: 12,
  edge: 15,
  parapet: 18,
  labelRoom: 46,
  headRoom: 62,
}

/** The same house standing upright, for a narrow screen. */
export const TOWER: FacadeShape = {
  columns: 38,
  paneWidth: 5.6,
  paneHeight: 10,
  plinthPaneHeight: 5,
  gapX: 2.2,
  gapY: 3,
  pier: 0,
  slab: 9,
  edge: 10,
  parapet: 12,
  labelRoom: 34,
  headRoom: 40,
}

export interface Pane {
  /** The position's place in document order. */
  index: number
  x: number
  y: number
  width: number
  height: number
  /** Rows count from the top of the building; panes in one row share it. */
  row: number
}

export interface FacadeLayout {
  width: number
  height: number
  wall: { x: number; y: number; width: number; height: number }
  /** The names of the storeys with the band each one takes, top first. */
  storeys: Array<{ label: string; y: number; height: number }>
  /** The top edge of every floor slab that shows between two bands. */
  slabs: Array<number>
  /** The bays of a block. A tower has none. */
  bays: Array<{ rno: string; label: string; x: number; width: number }>
  /** The band under the lowest storey for what serves the whole building. */
  plinth: { y: number; height: number } | null
  /** One pane per position, in document order. */
  panes: Array<Pane>
}

export interface Placed {
  index: number
  /** Index into the titles. */
  title: number
  /** Index into the storeys, or -1 for the plinth. */
  storey: number
}

/** Which title and storey every position belongs to, in document order. */
export function place(input: FacadeInput): Array<Placed> {
  const placed: Array<Placed> = []
  const known = input.storeys.length
  input.titles.forEach((title, at) => {
    for (let n = 0; n < title.positionCount; n++) {
      const index = placed.length
      const letter = input.storeyByPosition[index]
      const storey =
        letter === undefined || letter === '-' ? -1 : parseInt(letter, 36)
      placed.push({
        index,
        title: at,
        storey: Number.isNaN(storey) || storey >= known ? -1 : storey,
      })
    }
  })
  return placed
}

/** Groups items by a key, keeping the order in which keys first appear. */
function groupBy<T>(
  items: ReadonlyArray<T>,
  key: (item: T) => number,
): Array<{ key: number; items: Array<T> }> {
  const groups = new Map<number, Array<T>>()
  for (const item of items) {
    const group = groups.get(key(item))
    if (group === undefined) groups.set(key(item), [item])
    else group.push(item)
  }
  return [...groups.entries()].map(([k, list]) => ({ key: k, items: list }))
}

/** Places every position's window on the front of the building. */
export function layoutFacade(
  input: FacadeInput,
  shape: FacadeShape,
): FacadeLayout {
  const placed = place(input)
  const pitch = shape.paneWidth + shape.gapX
  const upper = placed.filter((item) => item.storey >= 0)
  const central = placed.filter((item) => item.storey < 0)
  const storeyCount = input.storeys.length

  // How wide the building is: a block is as wide as its bays, a tower as
  // wide as one row.
  const perBay =
    shape.columns === null
      ? groupBy(upper, (item) => item.title).map((bay) => ({
          title: bay.key,
          columns: Math.max(
            ...groupBy(bay.items, (item) => item.storey).map(
              (cell) => cell.items.length,
            ),
          ),
        }))
      : []
  const columns =
    shape.columns ??
    (perBay.length === 0
      ? Math.min(60, Math.max(1, central.length))
      : perBay.reduce((sum, bay) => sum + bay.columns, 0))
  const piers = shape.columns === null ? Math.max(0, perBay.length - 1) : 0
  const inner = columns * pitch - shape.gapX + piers * shape.pier
  const wallX = shape.labelRoom
  const wallWidth = inner + 2 * shape.edge
  const left = wallX + shape.edge

  const panes: Array<Pane> = []
  const storeys: FacadeLayout['storeys'] = []
  const slabs: Array<number> = []
  const bays: FacadeLayout['bays'] = []
  let row = 0
  let y = shape.headRoom + shape.parapet

  if (shape.columns === null) {
    // Bays stand side by side; a storey is one row across all of them.
    let x = left
    const bayX = new Map<number, number>()
    for (const bay of perBay) {
      const title = input.titles[bay.title]
      const width = bay.columns * pitch - shape.gapX
      bayX.set(bay.title, x)
      bays.push({
        rno: title?.rno ?? '',
        label: title?.label ?? '',
        x,
        width,
      })
      x += width + shape.pier
    }
    for (let storey = storeyCount - 1; storey >= 0; storey--) {
      const taken = new Map<number, number>()
      for (const item of upper) {
        if (item.storey !== storey) continue
        const nth = taken.get(item.title) ?? 0
        taken.set(item.title, nth + 1)
        panes.push({
          index: item.index,
          x: (bayX.get(item.title) ?? left) + nth * pitch,
          y,
          width: shape.paneWidth,
          height: shape.paneHeight,
          row,
        })
      }
      storeys.push({
        label: input.storeys[storey] ?? '',
        y,
        height: shape.paneHeight,
      })
      row++
      y += shape.paneHeight
      slabs.push(y)
      y += shape.slab
    }
  } else {
    // A storey takes as many rows as its positions need.
    for (let storey = storeyCount - 1; storey >= 0; storey--) {
      const items = upper.filter((item) => item.storey === storey)
      const rows = Math.max(1, Math.ceil(items.length / columns))
      const top = y
      items.forEach((item, nth) => {
        const line = Math.floor(nth / columns)
        panes.push({
          index: item.index,
          x: left + (nth % columns) * pitch,
          y: top + line * (shape.paneHeight + shape.gapY),
          width: shape.paneWidth,
          height: shape.paneHeight,
          row: row + line,
        })
      })
      const height = rows * shape.paneHeight + (rows - 1) * shape.gapY
      storeys.push({ label: input.storeys[storey] ?? '', y: top, height })
      row += rows
      y += height
      slabs.push(y)
      y += shape.slab
    }
  }

  // The plinth: what has no storey, title by title.
  let plinth: FacadeLayout['plinth'] = null
  if (central.length > 0) {
    const top = y
    const groups = groupBy(central, (item) => item.title)
    const oneRow =
      shape.columns === null &&
      central.length * pitch + (groups.length - 1) * shape.gapX <= inner
    if (oneRow) {
      // Spread the titles across the whole width, so the base carries the house.
      const taken = groups.reduce(
        (sum, group) => sum + group.items.length * pitch - shape.gapX,
        0,
      )
      const between =
        groups.length < 2 ? 0 : (inner - taken) / (groups.length - 1)
      let x = left
      for (const group of groups) {
        group.items.forEach((item, nth) => {
          panes.push({
            index: item.index,
            x: x + nth * pitch,
            y: top,
            width: shape.paneWidth,
            height: shape.plinthPaneHeight,
            row,
          })
        })
        x += group.items.length * pitch - shape.gapX + between
      }
      row++
      y += shape.plinthPaneHeight
    } else {
      const rows = Math.ceil(central.length / columns)
      central.forEach((item, nth) => {
        const line = Math.floor(nth / columns)
        panes.push({
          index: item.index,
          x: left + (nth % columns) * pitch,
          y: top + line * (shape.plinthPaneHeight + shape.gapY),
          width: shape.paneWidth,
          height: shape.plinthPaneHeight,
          row: row + line,
        })
      })
      row += rows
      y += rows * shape.plinthPaneHeight + (rows - 1) * shape.gapY
    }
    plinth = { y: top, height: y - top }
    y += shape.slab
  } else {
    // The last slab is the ground the building stands on.
    slabs.pop()
  }

  panes.sort((a, b) => a.index - b.index)
  return {
    width: wallWidth + 2 * shape.labelRoom,
    height: y,
    wall: {
      x: wallX,
      y: shape.headRoom,
      width: wallWidth,
      height: y - shape.headRoom,
    },
    storeys,
    slabs,
    bays,
    plinth,
    panes,
  }
}

/** What a window shows. */
export type PaneState = 'off' | 'read' | 'priced' | 'open'

/**
 * The state of every window. While a run is reading, the windows it has got
 * to are lit dimly; once it has decided, each one shows its decision.
 */
export function paneStates(
  count: number,
  /** One letter per position from the last finished run: `r` needs a person. */
  statuses: string | null,
  /** How far a run that is under way has read, or `null` if none is. */
  reading: number | null,
): Array<PaneState> {
  return Array.from({ length: count }, (_, index) => {
    if (reading !== null) return index < reading ? 'read' : 'off'
    const letter = statuses?.[index]
    return letter === 'r' ? 'open' : letter === 'a' ? 'priced' : 'off'
  })
}

/** The window under a point, with a little grace around its edges. */
export function paneAt(
  layout: FacadeLayout,
  x: number,
  y: number,
  grace = 2,
): Pane | null {
  let best: Pane | null = null
  let bestDistance = Infinity
  for (const pane of layout.panes) {
    const dx = Math.max(pane.x - x, 0, x - (pane.x + pane.width))
    const dy = Math.max(pane.y - y, 0, y - (pane.y + pane.height))
    if (dx > grace || dy > grace) continue
    const distance = dx + dy
    if (distance < bestDistance) {
      best = pane
      bestDistance = distance
    }
  }
  return best
}

export type Step = 'left' | 'right' | 'up' | 'down'

/** The window one step from another, for the arrow keys. */
export function paneBeside(
  layout: FacadeLayout,
  from: Pane,
  step: Step,
): Pane | null {
  const centre = from.x + from.width / 2
  if (step === 'left' || step === 'right') {
    const inRow = layout.panes
      .filter((pane) => pane.row === from.row)
      .sort((a, b) => a.x - b.x)
    const at = inRow.findIndex((pane) => pane.index === from.index)
    return inRow[at + (step === 'left' ? -1 : 1)] ?? null
  }
  // Up and down go to the nearest row that has a window, then to the one
  // closest to straight above or below.
  const rows = [...new Set(layout.panes.map((pane) => pane.row))].sort(
    (a, b) => a - b,
  )
  const row = rows[rows.indexOf(from.row) + (step === 'up' ? -1 : 1)]
  if (row === undefined) return null
  let best: Pane | null = null
  let bestDistance = Infinity
  for (const pane of layout.panes) {
    if (pane.row !== row) continue
    const distance = Math.abs(pane.x + pane.width / 2 - centre)
    if (distance < bestDistance) {
      best = pane
      bestDistance = distance
    }
  }
  return best
}

const hundredths = (value: number) => Math.round(value * 100) / 100

/** Every window of a set as one outline, for drawing them as a single shape. */
export function outline(panes: ReadonlyArray<Pane>): string {
  return panes
    .map(
      (pane) =>
        `M${hundredths(pane.x)} ${hundredths(pane.y)}h${hundredths(pane.width)}v${hundredths(pane.height)}h${hundredths(-pane.width)}z`,
    )
    .join('')
}
