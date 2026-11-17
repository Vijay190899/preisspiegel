/**
 * Values as they are written in a tender and in an offer, made comparable.
 *
 * A position says `Bemessungsstrom 250 A`; an offer says `138 kVA`. Whether
 * those are the same is arithmetic, and arithmetic is for code. A model may
 * point at the two values; what they amount to is decided here.
 */
import { parseGermanNumber } from './numbers'
import { NOMINAL_LINE_VOLTAGE, kvaToAmps } from './units'

export interface Measure {
  value: number
  /** Lower case, with `²` written as `2`. Empty for a bare number. */
  unit: string
}

const MEASURE = /^(-?[\d.,]+)\s*([a-zäöüµμ°%]+[23²³]?)?$/i

/** Reads one number with an optional unit. `null` for anything else. */
export function parseMeasure(raw: string): Measure | null {
  const match = MEASURE.exec(raw.trim())
  if (match === null) return null
  const value = parseGermanNumber(match[1] ?? '')
  if (value === null) return null
  const unit = (match[2] ?? '')
    .toLowerCase()
    .replace('²', '2')
    .replace('³', '3')
    .replace('μ', 'µ')
  return { value, unit }
}

/** What a unit measures, and how many base units one of it is. */
const UNITS: Partial<Record<string, { of: string; factor: number }>> = {
  a: { of: 'current', factor: 1 },
  ma: { of: 'current', factor: 0.001 },
  ka: { of: 'current', factor: 1000 },
  v: { of: 'voltage', factor: 1 },
  kv: { of: 'voltage', factor: 1000 },
  w: { of: 'power', factor: 1 },
  kw: { of: 'power', factor: 1000 },
  va: { of: 'apparent power', factor: 0.001 },
  kva: { of: 'apparent power', factor: 1 },
  mm: { of: 'length', factor: 0.001 },
  cm: { of: 'length', factor: 0.01 },
  m: { of: 'length', factor: 1 },
  mm2: { of: 'area', factor: 1 },
  qmm: { of: 'area', factor: 1 },
  lm: { of: 'luminous flux', factor: 1 },
  k: { of: 'colour temperature', factor: 1 },
  h: { of: 'time', factor: 1 },
  min: { of: 'time', factor: 1 / 60 },
}

export interface Comparison {
  agrees: boolean
  /** `code` where arithmetic or spelling settled it, `model` where it could not. */
  decidedBy: 'code' | 'model'
  /** The conversion that was done, written out, where there was one. */
  arithmetic?: string
  /**
   * Both values as numbers in one unit, where they were compared as
   * measures. This is what lets a difference be drawn to scale.
   */
  scale?: { asked: number; offered: number; unit: string }
}

/** Ratings are rounded to catalogue sizes, so 1% apart is the same value. */
const TOLERANCE = 0.01

const close = (a: number, b: number) =>
  Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * TOLERANCE

const whole = (value: number) => String(Math.round(value))

/**
 * Compares what the tender asks for with what the offer states.
 *
 * Two measures of the same kind are converted and compared. A current
 * against an apparent power is compared at 400 V three-phase, where the
 * offered rating has to cover the current asked for. Codes are compared as
 * text. Where none of that applies, the answer is left to whoever read the
 * text (`decidedBy: 'model'`, with `agrees` as a placeholder).
 */
export function compareValues(tender: string, offer: string): Comparison {
  const asked = parseMeasure(tender)
  const given = parseMeasure(offer)
  /** The unit as the tender writes it, for showing. */
  const shown =
    /[a-zäöüµμ°%]+[23²³]?\s*$/i.exec(tender.trim())?.[0].trim() ?? ''

  if (asked !== null && given !== null) {
    if (asked.unit === given.unit) {
      return {
        agrees: close(asked.value, given.value),
        decidedBy: 'code',
        scale: { asked: asked.value, offered: given.value, unit: shown },
      }
    }
    // A bare number beside a number with a unit. The same number is the same
    // value with its unit left off. A different number may be a code for
    // the value (a lamp marked 830 has 3000 K), which is not arithmetic.
    if (asked.unit === '' || given.unit === '') {
      return close(asked.value, given.value)
        ? { agrees: true, decidedBy: 'code' }
        : { agrees: false, decidedBy: 'model' }
    }
    const a = UNITS[asked.unit]
    const g = UNITS[given.unit]
    if (a !== undefined && g !== undefined) {
      if (a.of === g.of) {
        const offered = (given.value * g.factor) / a.factor
        return {
          agrees: close(asked.value, offered),
          decidedBy: 'code',
          scale: { asked: asked.value, offered, unit: shown },
        }
      }
      if (a.of === 'current' && g.of === 'apparent power') {
        const amps = kvaToAmps(given.value * g.factor)
        const needed = asked.value * a.factor
        return {
          // The rating has to carry the current asked for.
          agrees: amps >= needed * (1 - TOLERANCE),
          decidedBy: 'code',
          arithmetic: `${offer.trim()} / (√3 × ${NOMINAL_LINE_VOLTAGE} V) = ${whole(amps)} A`,
          scale: { asked: needed, offered: amps, unit: 'A' },
        }
      }
      // Two known units of different kinds are not the same measure.
      return { agrees: false, decidedBy: 'code' }
    }
  }

  if (sameText(tender, offer)) return { agrees: true, decidedBy: 'code' }
  return { agrees: false, decidedBy: 'model' }
}

/** Text with case, spacing and the look of a multiplication sign taken out. */
export function canonicalText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[×✕*]/g, 'x')
    .replace(/²/g, '2')
    .replace(/\s+/g, '')
}

export function sameText(a: string, b: string): boolean {
  return canonicalText(a) === canonicalText(b)
}

const PIECES = new Set(['st', 'stck', 'stk', 'stück', 'stueck', 'pcs'])
const METRES = new Set(['m', 'mtr', 'lfm', 'meter'])
const PACKS = new Set([
  've',
  'vpe',
  'rg',
  'ring',
  'rolle',
  'rol',
  'pack',
  'pk',
  'pkg',
  'bund',
  'bd',
  'ktn',
  'karton',
  'tr',
  'trommel',
  'satz',
  'set',
])

/**
 * A unit as the tender would write it. `pack` is true for packs, rings and
 * the like, which hold some number of the tender's units and say nothing
 * about how many.
 */
export function canonicalUnit(raw: string | null): {
  unit: string
  pack: boolean
} {
  const key = (raw ?? '').trim().toLowerCase().replace(/\.$/, '')
  if (PIECES.has(key)) return { unit: 'St', pack: false }
  if (METRES.has(key)) return { unit: 'm', pack: false }
  if (PACKS.has(key)) return { unit: key.toUpperCase(), pack: true }
  return { unit: (raw ?? '').trim(), pack: false }
}
