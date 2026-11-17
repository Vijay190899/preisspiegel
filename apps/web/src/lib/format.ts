/**
 * Number and date formatting, in the convention of the language the page is
 * shown in: 1.234,56 in German, 1,234.56 in English. The documents print
 * German figures; the document shown beside a number is the place to see it
 * as it was printed.
 */
import { activeLocale } from './locale'
import type { Locale } from './locale'

const TAG: Record<Locale, string> = { de: 'de-DE', en: 'en-GB' }

const build = (tag: string) => ({
  money: new Intl.NumberFormat(tag, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  precise: new Intl.NumberFormat(tag, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }),
  whole: new Intl.NumberFormat(tag, { maximumFractionDigits: 3 }),
  date: new Intl.DateTimeFormat(tag, {
    day: tag === 'de-DE' ? '2-digit' : 'numeric',
    month: tag === 'de-DE' ? '2-digit' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }),
})
const FORMATS = { de: build(TAG.de), en: build(TAG.en) }
const formats = () => FORMATS[activeLocale()]

/** 4505.36 -> `4.505,36`, or `4,505.36` in English */
export function formatMoney(value: number): string {
  return formats().money.format(value)
}

/** A price per single unit, which for cable can need more than two decimals. */
export function formatUnitPrice(value: number): string {
  return formats().precise.format(value)
}

/** 1250 -> `1.250`, 120.5 -> `120,5`; `1,250` and `120.5` in English */
export function formatQty(value: number): string {
  return formats().whole.format(value)
}

/** `2026-11-05` -> `05.11.2026`, or `5 Nov 2026` in English */
export function formatDate(iso: string): string {
  const time = Date.parse(`${iso}T00:00:00Z`)
  return Number.isNaN(time) ? iso : formats().date.format(time)
}

/** Units as an estimator writes them, whatever a supplier printed. */
const UNIT_LABELS: Record<Locale, Partial<Record<string, string>>> = {
  de: {
    st: 'St',
    stck: 'St',
    stk: 'St',
    m: 'm',
    mtr: 'm',
    h: 'h',
    psch: 'psch',
  },
  en: {
    st: 'pcs',
    stck: 'pcs',
    stk: 'pcs',
    m: 'm',
    mtr: 'm',
    h: 'h',
    psch: 'lump sum',
    // How suppliers pack what they sell.
    ve: 'pack',
    rg: 'coil',
    ring: 'coil',
    tr: 'drum',
    rl: 'roll',
  },
}

/** A unit, for the quantity it stands beside: `1 pc`, `2 pcs`. */
export function unitLabel(unit: string | null, quantity?: number): string {
  if (unit === null) return ''
  const label = UNIT_LABELS[activeLocale()][unit.toLowerCase()] ?? unit
  return quantity === 1 && label === 'pcs' ? 'pc' : label
}

/** How a quotation is set off in the language of the page. */
export function quoted(text: string): string {
  return activeLocale() === 'en' ? `\u201c${text}\u201d` : `\u201e${text}\u201c`
}

/** A unit after "per": `je St`, `per piece`. */
export function perUnitLabel(unit: string | null): string {
  const label = unitLabel(unit)
  return activeLocale() === 'en' && label === 'pcs' ? 'piece' : label
}
