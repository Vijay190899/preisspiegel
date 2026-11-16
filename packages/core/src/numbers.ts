/**
 * German number handling. Supplier documents write 1.234,56; code works in
 * plain numbers. Parsing is strict on purpose: a value that does not look
 * like a number is `null`, never a guess.
 */

const GERMAN_NUMBER = /^-?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/

/** Parses `1.234,56`, `1234,5` or `12`. Returns `null` for anything else. */
export function parseGermanNumber(raw: string): number | null {
  const text = raw
    .replace(/\u00a0/g, ' ')
    .replace(/(€|EUR|%)/g, '')
    .trim()
  if (!GERMAN_NUMBER.test(text)) return null
  return Number(text.replace(/\./g, '').replace(',', '.'))
}

/** Formats with a comma decimal and dot thousands separators: 1234.5 -> `1.234,50`. */
export function formatGermanNumber(
  value: number,
  decimals: number = 2,
): string {
  const fixed = Math.abs(value).toFixed(decimals)
  const [whole = '0', fraction] = fixed.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const sign = value < 0 && Number(fixed) !== 0 ? '-' : ''
  return fraction === undefined
    ? `${sign}${grouped}`
    : `${sign}${grouped},${fraction}`
}

/** Rounds to cents without the usual binary surprises (1.005 -> 1.01). */
export function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
