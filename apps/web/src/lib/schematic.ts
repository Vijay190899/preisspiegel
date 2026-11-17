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
  /** Positions of the title that need a decision. `null` before a run. */
  open: number | null
  /** Length of the end of the bar that stands for them. */
  barOpen: number
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
  /** The shortest a part of a bar is drawn, so that it can be seen. */
  partMin: 4,
  /** The gap between the two parts of a bar. */
  partGap: 2,
} as const

/** Places the incomers and feeders evenly and sizes each load bar by count. */
export function layoutPlan(
  titles: ReadonlyArray<{ rno: string; label: string; positionCount: number }>,
  incomerKeys: ReadonlyArray<string>,
  /** One letter per position in document order, `r` for one that is open. */
  statuses: string | null = null,
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
    feeders: titles.map((title, index) => {
      // Length is proportional to the count; anything that exists is visible.
      const bar =
        title.positionCount === 0
          ? 0
          : Math.max(PLAN.barMin, (title.positionCount / largest) * PLAN.barMax)
      // Titles follow each other in the document, so a title's positions
      // are a stretch of the status letters.
      const from = titles
        .slice(0, index)
        .reduce((sum, earlier) => sum + earlier.positionCount, 0)
      const open =
        statuses === null
          ? null
          : [...statuses.slice(from, from + title.positionCount)].filter(
              (letter) => letter === 'r',
            ).length
      const share =
        open === null || open === 0 || title.positionCount === 0
          ? 0
          : open / title.positionCount
      // Whatever is open can be seen, and so can whatever is not.
      const room = Math.max(0, bar - PLAN.partGap - PLAN.partMin)
      const barOpen =
        share === 0
          ? 0
          : share === 1
            ? bar
            : Math.min(room, Math.max(PLAN.partMin, bar * share))
      return {
        rno: title.rno,
        label: title.label,
        count: title.positionCount,
        x: x1 + slot * (index + 0.5),
        bar,
        open,
        barOpen,
      }
    }),
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
