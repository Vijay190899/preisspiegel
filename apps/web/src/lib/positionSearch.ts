import { itemInEnglish } from './tenderText'
import type { PositionRow } from './queries'

/** Ordinal number first, then words anywhere in the short text. */
export function searchPositions(
  rows: Array<PositionRow>,
  query: string,
  limit: number,
): Array<PositionRow> {
  const needle = query.trim().toLowerCase()
  if (needle === '') return rows.slice(0, limit)

  const words = needle.split(/\s+/)
  const byOz: Array<PositionRow> = []
  const byText: Array<PositionRow> = []
  for (const row of rows) {
    if (
      row.oz.startsWith(needle) ||
      row.oz.replaceAll('.', '').startsWith(needle)
    ) {
      byOz.push(row)
    } else {
      const text =
        `${row.shortText} ${itemInEnglish(row.shortText)}`.toLowerCase()
      if (words.every((word) => text.includes(word))) byText.push(row)
    }
    if (byOz.length >= limit) break
  }
  return [...byOz, ...byText].slice(0, limit)
}

/** The positions of one title, or all, that contain every word of the query. */
export function filterPositions(
  rows: Array<PositionRow>,
  query: string,
  title: string | undefined,
): Array<PositionRow> {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return rows.filter((row) => {
    if (title !== undefined && row.path[0]?.rno !== title) return false
    const haystack =
      `${row.oz} ${row.shortText} ${itemInEnglish(row.shortText)}`.toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}
