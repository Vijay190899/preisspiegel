/**
 * Text handling shared by retrieval and by the check that a quote really
 * stands in its source.
 */

// Built from code points, so that no invisible character stands in this file.
const of = (...codes: Array<number>) => String.fromCodePoint(...codes)
/** No-break space, figure space, narrow no-break space. */
const SPACES = new RegExp(`[${of(0xa0, 0x2007, 0x202f)}]`, 'g')
/** Hyphen to em dash. */
const DASHES = new RegExp(`[${of(0x2010)}-${of(0x2014)}]`, 'g')
const DOUBLE_QUOTES = new RegExp(`[${of(0x201c, 0x201d, 0x201e)}]`, 'g')
const SINGLE_QUOTES = new RegExp(`[${of(0x2018, 0x2019)}]`, 'g')

/** Text with every run of white space as one space, and typographic variants evened out. */
export function squash(text: string): string {
  return text
    .replace(SPACES, ' ')
    .replace(DASHES, '-')
    .replace(DOUBLE_QUOTES, '"')
    .replace(SINGLE_QUOTES, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Whether `quote` stands in `source` word for word. Case and spacing do not
 * count; nothing else is forgiven, so a quote cannot be a paraphrase.
 */
export function containsQuote(source: string, quote: string): boolean {
  const hay = squash(source).toLowerCase()
  const needle = squash(quote).toLowerCase()
  if (needle === '') return false
  // A number is not cut out of a longer one: `50 A` is not in `250 A`, and
  // `2` is not in `2,5`. A word may be the tail of a compound, as German
  // writes them: `Ausschaltvermögen` stands in `Bemessungsausschaltvermögen`.
  const digit = (char: string | undefined) =>
    char !== undefined && char >= '0' && char <= '9'
  const joins = (mark: string | undefined, next: string | undefined) =>
    (mark === ',' || mark === '.') && digit(next)
  for (let from = 0; ;) {
    const at = hay.indexOf(needle, from)
    if (at < 0) return false
    const end = at + needle.length
    const cutsFront =
      digit(needle[0]) &&
      (digit(hay[at - 1]) || joins(hay[at - 1], hay[at - 2]))
    const cutsBack =
      digit(needle.at(-1)) && (digit(hay[end]) || joins(hay[end], hay[end + 1]))
    if (!cutsFront && !cutsBack) return true
    from = at + 1
  }
}

/**
 * Whether `quote` stands in `source` word for word and at word boundaries:
 * `50 A` is not in `250 A`, and `10` is not in `(100 m/Ring)`. Case and
 * spacing do not count.
 */
export function containsWhole(source: string, quote: string): boolean {
  const hay = squash(source).toLowerCase()
  const needle = squash(quote).toLowerCase()
  if (needle === '') return false
  const wordy = (char: string | undefined) =>
    char !== undefined && /[\p{L}\p{N}]/u.test(char)
  for (let from = 0; ;) {
    const at = hay.indexOf(needle, from)
    if (at < 0) return false
    const cutsFront = wordy(hay[at - 1]) && wordy(needle[0])
    const cutsBack = wordy(hay[at + needle.length]) && wordy(needle.at(-1))
    if (!cutsFront && !cutsBack) return true
    from = at + 1
  }
}

/**
 * The search terms of a text: its words, its numbers, and the pieces of its
 * longer words. German writes `Leitungsschutzschalter` where a wholesaler
 * writes `LS-Schalter`; the two share no word but they share `schalter`,
 * which the pieces catch. A piece starts with `#` and counts for less than
 * a whole word (see `PIECE_WEIGHT`).
 */
export function searchTerms(text: string): Array<string> {
  const lower = text.toLowerCase().replace(/²/g, '2').replace(/[×✕]/g, 'x')
  const terms: Array<string> = []
  for (const match of lower.matchAll(/[a-zäöüß]+|\d+(?:,\d+)?/g)) {
    const word = match[0]
    terms.push(word)
    if (/^[a-zäöüß]/.test(word) && word.length >= 5) {
      for (let start = 0; start + 4 <= word.length; start++) {
        terms.push(`#${word.slice(start, start + 4)}`)
      }
    }
  }
  return terms
}

/** How much a shared piece of a word counts, beside a shared whole word. */
export const PIECE_WEIGHT = 0.25
