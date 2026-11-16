/**
 * Number and date formatting. Figures follow German convention in both
 * languages, because that is how they are printed in the documents they come
 * from: 1.234,56.
 */

const money = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const precise = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})
const whole = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 })

/** 4505.36 -> `4.505,36` */
export function formatMoney(value: number): string {
  return money.format(value)
}

/** A price per single unit, which for cable can need more than two decimals. */
export function formatUnitPrice(value: number): string {
  return precise.format(value)
}

/** 1250 -> `1.250`, 120.5 -> `120,5` */
export function formatQty(value: number): string {
  return whole.format(value)
}

/** `2026-11-05` -> `05.11.2026` */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return year === undefined || month === undefined || day === undefined
    ? iso
    : `${day}.${month}.${year}`
}

/** Units as an estimator writes them, whatever a supplier printed. */
const UNIT_LABELS: Partial<Record<string, string>> = {
  st: 'St',
  stck: 'St',
  stk: 'St',
  m: 'm',
  mtr: 'm',
  h: 'h',
  psch: 'psch',
}

export function unitLabel(unit: string | null): string {
  if (unit === null) return ''
  return UNIT_LABELS[unit.toLowerCase()] ?? unit
}
