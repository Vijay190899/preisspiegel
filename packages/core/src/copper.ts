/**
 * The copper surcharge on cable.
 *
 * A cable's list price holds copper at a fixed base, commonly 150 EUR per
 * 100 kg. What copper costs on the day is charged on top: the difference
 * between the day's notation, plus procurement costs, and that base, for the
 * copper the cable is counted to hold. Copper is most of what a cable costs,
 * so on a tender with tens of kilometres of it the surcharge moves the bid
 * by five figures.
 *
 *   surcharge per km = copper number / 100 × (notation × (1 + costs) − base)
 *
 * The copper number is in kg per km, the notation and the base in EUR per
 * 100 kg. It is a figure agreed for the calculation, not the weight of the
 * metal in the cable; for the usual installation cables it is the conductor
 * cross-section times 9.6 for every core. Sources for the formula and the
 * factor are in docs/DATA.md.
 */

/** Kilograms of copper per kilometre and square millimetre of conductor. */
export const COPPER_PER_MM2 = 9.6
/** What a list price usually already holds, in EUR per 100 kg. */
export const COPPER_BASE = 150
/** Procurement costs added to the notation, as a share of it. */
export const PROCUREMENT_SHARE = 0.01

/**
 * The copper number of a cable from its designation: `NYM-J 3x1,5 mm²` has
 * three cores of 1.5 mm², so 43.2 kg/km. `null` for anything that does not
 * name cores and a cross-section in square millimetres, such as a data
 * cable or a fibre.
 */
export function copperNumber(designation: string): number | null {
  const match = /(\d+)\s?[x×]\s?(\d+(?:[.,]\d+)?)\s?mm(?:²|2)/i.exec(
    designation,
  )
  if (match === null) return null
  const cores = Number(match[1])
  const area = Number((match[2] ?? '').replace(',', '.'))
  if (!(cores > 0) || !(area > 0)) return null
  return Math.round(cores * area * COPPER_PER_MM2 * 10) / 10
}

/** The surcharge for one kilometre of a cable, in EUR. Never below zero. */
export function surchargePerKm(
  copper: number,
  notation: number,
  base = COPPER_BASE,
  procurement = PROCUREMENT_SHARE,
): number {
  return Math.max(0, (copper / 100) * (notation * (1 + procurement) - base))
}

export interface CableLine {
  oz: string
  shortText: string
  /** Metres asked for. */
  metres: number
  /** Kilograms of copper per kilometre. */
  copper: number
  /** Kilograms of copper the whole length is counted to hold. */
  copperKg: number
}

/** The positions of a tender that are cable by the metre, with their copper. */
export function cableLines(
  positions: ReadonlyArray<{
    oz: string
    shortText: string
    qty: number
    unit: string
  }>,
): Array<CableLine> {
  const lines: Array<CableLine> = []
  for (const position of positions) {
    if (position.unit.trim().toLowerCase() !== 'm') continue
    const copper = copperNumber(position.shortText)
    if (copper === null) continue
    lines.push({
      oz: position.oz,
      shortText: position.shortText,
      metres: position.qty,
      copper,
      copperKg: (position.qty / 1000) * copper,
    })
  }
  return lines
}

/** The surcharge on a set of cable positions at a notation, in EUR. */
export function copperSurcharge(
  lines: ReadonlyArray<CableLine>,
  notation: number,
  base = COPPER_BASE,
  procurement = PROCUREMENT_SHARE,
): number {
  const total = lines.reduce(
    (sum, line) =>
      sum +
      (line.metres / 1000) *
        surchargePerKm(line.copper, notation, base, procurement),
    0,
  )
  return Math.round(total * 100) / 100
}
