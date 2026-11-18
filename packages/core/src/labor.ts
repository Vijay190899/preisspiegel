/**
 * Labor: which entry of the contractor's labor time table a position takes.
 *
 * The model proposes an entry and quotes the position; this decides. An
 * entry is taken only if it exists, the quote stands in the position, the
 * units agree, and, where the entry's label states a size or a count ("bis
 * 2,5 mm²", "über 250 A", "3-polig"), the position states one that fits.
 * The number is read here, from the words the model quoted or, where it
 * quoted none, from the position's short text and then its long text; the
 * model never gives it.
 */
import { canonicalUnit } from './measure'
import { containsWhole, squash } from './text'

export interface LaborEntry {
  key: string
  /** What the work is, e.g. `Kabel 10 bis 16 mm² verlegen`. */
  label: string
  unit: string
  /** Minutes per unit. */
  minutes: number
}

/** What the model answers about one position. */
export interface LaborProposal {
  /** Key of the entry, or `null` when it says no entry describes the work. */
  entry: string | null
  /** The position's words for what is to be installed. */
  quote: string
  /** The position's words for the size or count the entry's label limits. */
  limitQuote: string | null
}

export type LaborReason =
  /** Nothing was read: the call failed, or no answer is stored. */
  | 'unread'
  /** The key is not in the table. */
  | 'unknown_entry'
  /** A quote is not in the position, word for word. */
  | 'quote'
  /** The entry is by the metre and the position by the piece, or the reverse. */
  | 'unit'
  /** The label limits a size the quote does not state. */
  | 'limit_unstated'
  /** The position's size is outside what the label covers. */
  | 'limit'
  /** The words quoted state another size than the position itself does. */
  | 'limit_conflict'

export type LaborOutcome =
  | {
      status: 'set'
      entry: LaborEntry
      quote: string
      limitQuote: string | null
    }
  /** No entry describes the work, and the quote shows what the work is. */
  | { status: 'none'; quote: string }
  | {
      status: 'review'
      reason: LaborReason
      /** What was compared, for a person to read. */
      detail: string
      entry: LaborEntry | null
    }

type LimitUnit = 'mm²' | 'mm' | 'A' | 'polig'

/** The sizes or counts an entry covers, read from its label. */
export interface Limit {
  unit: LimitUnit
  /** Inclusive, or `null` for none. */
  min: number | null
  max: number | null
  /** `über 250 A`: the bound itself is not covered. */
  minExclusive: boolean
  /** The words of the label that state it. */
  text: string
}

/** A German number: `16`, `2,5`, `1.250` (thousands), `1.250,5`. */
const NUMBER = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?`
/** Not inside a longer number. */
const FRONT = String.raw`(?<![\d,.])`
const UNIT = String.raw`(mm²|mm|A)(?![\p{L}\d²])`
const number = (text: string) =>
  Number(text.replaceAll('.', '').replace(',', '.'))

/** `Kabel 10 bis 16 mm² verlegen` covers 10 to 16 mm²; `Leuchte montieren` nothing. */
export function entryLimit(label: string): Limit | null {
  const between = new RegExp(
    String.raw`(${NUMBER}) bis (${NUMBER}) ${UNIT}`,
    'u',
  ).exec(label)
  if (between !== null) {
    return {
      unit: between[3] as LimitUnit,
      min: number(between[1] ?? ''),
      max: number(between[2] ?? ''),
      minExclusive: false,
      text: between[0],
    }
  }
  const bound = new RegExp(
    String.raw`(?<![\p{L}])(bis|über|ab) (${NUMBER}) ${UNIT}`,
    'u',
  ).exec(label)
  if (bound !== null) {
    const value = number(bound[2] ?? '')
    const word = bound[1]
    return {
      unit: bound[3] as LimitUnit,
      min: word === 'bis' ? null : value,
      max: word === 'bis' ? value : null,
      minExclusive: word === 'über',
      text: bound[0],
    }
  }
  const poles = /(?<![\p{L}\d])(\d)-polig/u.exec(label)
  if (poles !== null) {
    const count = Number(poles[1])
    return {
      unit: 'polig',
      min: count,
      max: count,
      minExclusive: false,
      text: poles[0],
    }
  }
  return null
}

/**
 * The size or count a quote states, in the unit asked for. `5x16 mm²` is a
 * cross-section of 16; `3 x 2,5 mm²` one of 2,5. A quote that states none
 * in that unit gives `null`, and so does one that states two different ones.
 */
export function statedSize(quote: string, unit: LimitUnit): number | null {
  const text = squash(quote)
  const patterns: Record<LimitUnit, RegExp> = {
    // The last factor of a designation is the cross-section.
    'mm²': new RegExp(
      String.raw`${FRONT}(?:\d+\s*[xX×]\s*)*(${NUMBER})\s*mm²`,
      'gu',
    ),
    // Likewise the last factor of `60 x 300 mm` is the width, which is what
    // a tray or a trunking is sized by.
    mm: new RegExp(
      String.raw`${FRONT}(?:\d+\s*[xX×]\s*)*(${NUMBER})\s*mm(?![\p{L}\d²])`,
      'gu',
    ),
    A: new RegExp(String.raw`${FRONT}(${NUMBER})\s*A(?![\p{L}\d])`, 'gu'),
    polig: /(?<![\d,.])(\d)\s*-?\s*pol(?:ig)?(?![\p{L}])/gu,
  }
  const found = new Set<number>()
  for (const match of text.matchAll(patterns[unit])) {
    found.add(number(match[1] ?? ''))
  }
  const [only] = found
  return found.size === 1 && only !== undefined ? only : null
}

/** Whether a size is one the limit covers. */
export function within(limit: Limit, size: number): boolean {
  if (limit.max !== null && size > limit.max) return false
  if (limit.min === null) return true
  return limit.minExclusive ? size > limit.min : size >= limit.min
}

const say = (value: number) => String(value).replace('.', ',')

/** Decides what a proposal is worth for a position. */
export function assessLabor(
  position: { shortText: string; longText: string; unit: string },
  proposal: LaborProposal | null,
  table: ReadonlyArray<LaborEntry>,
): LaborOutcome {
  if (proposal === null) {
    return {
      status: 'review',
      reason: 'unread',
      detail: 'No answer.',
      entry: null,
    }
  }
  const source = `${position.shortText}\n${position.longText}`
  const review = (
    reason: LaborReason,
    detail: string,
    entry: LaborEntry | null,
  ): LaborOutcome => ({ status: 'review', reason, detail, entry })

  if (!containsWhole(source, proposal.quote)) {
    return review('quote', `"${proposal.quote}" is not in the position.`, null)
  }
  if (proposal.entry === null) {
    return { status: 'none', quote: proposal.quote }
  }
  const entry = table.find((candidate) => candidate.key === proposal.entry)
  if (entry === undefined) {
    return review(
      'unknown_entry',
      `"${proposal.entry}" is not in the table.`,
      null,
    )
  }

  const asked = canonicalUnit(position.unit).unit
  const timed = canonicalUnit(entry.unit).unit
  if (asked !== timed) {
    return review(
      'unit',
      `The position is by ${asked}, the entry by ${timed}.`,
      entry,
    )
  }

  const limit = entryLimit(entry.label)
  if (limit === null) {
    return { status: 'set', entry, quote: proposal.quote, limitQuote: null }
  }
  // The position's own texts are read, the short one first; a text that
  // states two different sizes says nothing, and the next is read. Where
  // they state one, that is the size, and words quoted for another are not
  // taken: a tray of 60 x 300 mm is not sized by its 60 mm sides.
  const own = [position.shortText, position.longText].find(
    (text) => statedSize(text, limit.unit) !== null,
  )
  if (
    proposal.limitQuote !== null &&
    !containsWhole(source, proposal.limitQuote)
  ) {
    return review(
      'quote',
      `"${proposal.limitQuote}" is not in the position.`,
      entry,
    )
  }
  const quote = own ?? proposal.limitQuote ?? null
  if (quote === null) {
    return review(
      'limit_unstated',
      `The entry covers "${limit.text}"; the position states no single ${limit.unit}.`,
      entry,
    )
  }
  if (!containsWhole(source, quote)) {
    return review('quote', `"${quote}" is not in the position.`, entry)
  }
  const size = statedSize(quote, limit.unit)
  const quoted =
    proposal.limitQuote === null
      ? null
      : statedSize(proposal.limitQuote, limit.unit)
  if (size !== null && quoted !== null && quoted !== size) {
    return review(
      'limit_conflict',
      `The position states ${say(size)} ${limit.unit}; "${proposal.limitQuote ?? ''}" states ${say(quoted)}.`,
      entry,
    )
  }
  if (size === null) {
    return review(
      'limit_unstated',
      `The entry covers "${limit.text}"; "${quote}" states no single ${limit.unit}.`,
      entry,
    )
  }
  if (!within(limit, size)) {
    return review(
      'limit',
      `${say(size)} ${limit.unit} is not "${limit.text}".`,
      entry,
    )
  }
  return { status: 'set', entry, quote: proposal.quote, limitQuote: quote }
}

/** Hours of labor for a quantity at so many minutes per unit. */
export function laborHours(minutes: number, quantity: number): number {
  return (minutes * quantity) / 60
}

/** What hours cost at an hourly rate, to the cent. */
export function laborCost(hours: number, ratePerHour: number): number {
  return Math.round(hours * ratePerHour * 100) / 100
}
