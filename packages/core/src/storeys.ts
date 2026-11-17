/**
 * Which storey of a building a part of a tender is for, read from the name
 * of its section. German tenders for a building are usually cut by storey
 * ("Unterverteilung 2. Obergeschoss"); what serves the whole building has
 * no storey ("Hauptleitungen").
 */

export interface Storey {
  /** Order from the ground up: basements below zero, ground floor 0, roof last. */
  rank: number
  /** The short name, as it stands on a plan: `UG`, `EG`, `2. OG`, `DG`. */
  label: string
}

const ORDINAL = String.raw`(\d+)\s*\.?\s*`
/** A storey word has to stand by itself: `Aufzug` is not a basement. */
const WORD = String.raw`(?<![\p{L}])`
const END = String.raw`(?![\p{L}\d])`
const PATTERNS: ReadonlyArray<{
  pattern: RegExp
  storey: (count: number | null) => Storey
}> = [
  {
    pattern: new RegExp(
      `(?:${ORDINAL})?${WORD}(?:Obergeschoss|OG)${END}`,
      'iu',
    ),
    storey: (n) => ({ rank: n ?? 1, label: `${n ?? 1}. OG` }),
  },
  {
    pattern: new RegExp(
      `(?:${ORDINAL})?${WORD}(?:Untergeschoss|Kellergeschoss|UG|KG)${END}`,
      'iu',
    ),
    storey: (n) => ({
      rank: -(n ?? 1),
      label: n === null || n === 1 ? 'UG' : `${n}. UG`,
    }),
  },
  {
    pattern: new RegExp(`${WORD}(?:Erdgeschoss|EG)${END}`, 'iu'),
    storey: () => ({ rank: 0, label: 'EG' }),
  },
  {
    pattern: new RegExp(
      `${WORD}(?:Dachgeschoss|Staffelgeschoss|DG)${END}`,
      'iu',
    ),
    storey: () => ({ rank: 1000, label: 'DG' }),
  },
]

/** The storey a section name speaks of, or `null` if it names none. */
export function storeyOf(sectionLabel: string): Storey | null {
  for (const { pattern, storey } of PATTERNS) {
    const match = pattern.exec(sectionLabel)
    if (match === null) continue
    const count = match[1] === undefined ? null : Number(match[1])
    return storey(count)
  }
  return null
}

/**
 * The storeys of a tender from the ground up, and for every position which
 * of them it belongs to: one character each, the storey's index in base 36,
 * or `-` for a position that serves the whole building.
 */
export function storeyPlan(sectionLabels: ReadonlyArray<string | undefined>): {
  storeys: Array<string>
  byPosition: string
} {
  const found = sectionLabels.map((label) =>
    label === undefined ? null : storeyOf(label),
  )
  const ranks = [
    ...new Map(
      found
        .filter((storey): storey is Storey => storey !== null)
        .map((storey) => [storey.rank, storey.label]),
    ).entries(),
  ].sort(([a], [b]) => a - b)
  // One character has to be enough for a storey's index.
  if (ranks.length > 36) return { storeys: [], byPosition: '' }
  const index = new Map(ranks.map(([rank], at) => [rank, at]))
  return {
    storeys: ranks.map(([, label]) => label),
    byPosition: found
      .map((storey) =>
        storey === null ? '-' : (index.get(storey.rank) ?? 0).toString(36),
      )
      .join(''),
  }
}
