/**
 * Geometry of the overview's single-line diagram.
 *
 * An electrician reads a distribution as incomers feeding a busbar, with
 * outgoing feeders below it. A tender has the same shape: the suppliers'
 * offers feed the Leistungsverzeichnis, and its titles go out from it. This
 * lays that out in drawing units; the component only draws.
 */

export interface PlanFeeder {
  rno: string
  label: string
  count: number
  /** Centre of the feeder. */
  x: number
  /** Length of the load bar that hangs from it. */
  bar: number
}

export interface PlanIncomer {
  key: string
  x: number
}

export interface Plan {
  width: number
  height: number
  busbar: { x1: number; x2: number; y: number; thickness: number }
  incomers: Array<PlanIncomer>
  /** Room each incomer has for its name. */
  incomerRoom: number
  feeders: Array<PlanFeeder>
  /** Width of a load bar. */
  barWidth: number
}

export const PLAN = {
  width: 1160,
  margin: 28,
  /** Top of an incomer's wire. */
  incomerTop: 92,
  busbarY: 232,
  busbarThickness: 12,
  /** Top of the load bars. */
  barTop: 322,
  barMax: 132,
  barMin: 10,
} as const

/** Places the incomers and feeders evenly and sizes each load bar by count. */
export function layoutPlan(
  titles: ReadonlyArray<{ rno: string; label: string; positionCount: number }>,
  incomerKeys: ReadonlyArray<string>,
): Plan {
  const { width, margin } = PLAN
  const x1 = margin
  const x2 = width - margin
  const span = x2 - x1

  const largest = Math.max(1, ...titles.map((title) => title.positionCount))
  const slot = titles.length === 0 ? span : span / titles.length

  return {
    width,
    height: PLAN.barTop + PLAN.barMax + 58,
    busbar: {
      x1,
      x2,
      y: PLAN.busbarY,
      thickness: PLAN.busbarThickness,
    },
    incomers: incomerKeys.map((key, index) => ({
      key,
      x: x1 + (span * (index + 0.5)) / incomerKeys.length,
    })),
    incomerRoom: incomerKeys.length === 0 ? span : span / incomerKeys.length,
    feeders: titles.map((title, index) => ({
      rno: title.rno,
      label: title.label,
      count: title.positionCount,
      x: x1 + slot * (index + 0.5),
      // Length is proportional to the count; anything that exists is visible.
      bar:
        title.positionCount === 0
          ? 0
          : Math.max(
              PLAN.barMin,
              (title.positionCount / largest) * PLAN.barMax,
            ),
    })),
    barWidth: Math.min(30, Math.max(12, slot * 0.3)),
  }
}

/**
 * The moving contact of a switch: where its tip is when open. A closed switch
 * has its tip at (0, -gap) from the pivot.
 */
export function openContact(
  gap: number,
  degrees = 28,
): { x: number; y: number } {
  const angle = (degrees * Math.PI) / 180
  return { x: -gap * Math.sin(angle), y: -gap * Math.cos(angle) }
}
