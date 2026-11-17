/**
 * From positions and offer lines to a decision per position.
 *
 * The steps, each a pure function:
 *
 * 1. `buildQuestions`: for every position, the lines that could answer it.
 *    A line that names the position is one; so are the lines a text search
 *    finds among those that name none.
 * 2. A model reads each question and answers per line: the same product, a
 *    different one, unrelated, or unsure, with the attributes it compared
 *    and a quote for each. That step lives outside this file.
 * 3. `verifyAnswer`: every quote is looked up in its source. Values that can
 *    be compared by arithmetic are compared here, and that result stands
 *    whatever the model said.
 * 4. `assess`: unit, arithmetic, quantity and ambiguity checks per line.
 * 5. `attribute`: a line that names no position is tied to the positions
 *    its quantity accounts for.
 * 6. `decide`: a position needs a person exactly when its cheapest offer is
 *    not a clean one.
 *
 * No number in the result comes from a model. Prices, quantities and totals
 * are the ones the readers parsed; what is derived from them is derived here.
 */
import { canonicalText, canonicalUnit, compareValues } from './measure'
import { parseGermanNumber, roundCents } from './numbers'
import { buildIndex } from './retrieval'
import { containsQuote, squash } from './text'
import type { OfferLine, Position } from './model'

export const REASON_CODES = [
  'SPEC_MISMATCH',
  'UNIT_BASIS',
  'PRICE_OUTLIER',
  'QTY_MISMATCH',
  'ALTERNATIVE_PRODUCT',
  'NO_OFFER',
  'AMBIGUOUS',
  'ARITHMETIC',
] as const
export type ReasonCode = (typeof REASON_CODES)[number]

/** How many lines without a reference a search returns, per supplier. */
export const SEARCH_DEPTH = 3
/**
 * A search result is put to the model only if it scores at least this share
 * of the best score its line reaches for any position. A line fits the
 * positions it was written for far better than the ones it merely shares a
 * word with, so this drops most of what a search drags in.
 */
export const LINE_SHARE = 0.5
/**
 * A line is also put to the model for positions it does not read like, if
 * their quantities add up to its own and that is true of at most this many
 * kinds of position. A quantity that fits many kinds says nothing.
 */
export const QUANTITY_FITS = 2
/** A supplier may round a quantity up by this share without being asked why. */
export const QUANTITY_ALLOWANCE = 0.3
/** How many groups of positions are tried against a line's quantity. */
const MAX_GROUPS = 12
/** A price this many times the others', or this fraction of them, stands out. */
export const OUTLIER_FACTOR = 3

export const lineId = (line: { supplierKey: string; seq: number }) =>
  `${line.supplierKey}.${line.seq}`

// ---------------------------------------------------------------------------
// 1. Questions
// ---------------------------------------------------------------------------

export interface Candidate {
  /** `supplierKey.seq`. */
  id: string
  /** The line names this position. */
  referenced: boolean
  text: string
  articleNo: string | null
  unit: string | null
}

export interface Question {
  oz: string
  shortText: string
  longText: string
  unit: string
  /** Lines for the model to read. */
  candidates: Array<Candidate>
  /**
   * Lines that name the position and repeat its own text, as an offer in the
   * tender's own format does. There is nothing to read: they are the same.
   */
  echoes: Array<string>
}

const candidateOf = (line: OfferLine, referenced: boolean): Candidate => ({
  id: lineId(line),
  referenced,
  text: line.text,
  articleNo: line.articleNo,
  unit: line.unit,
})

export function buildQuestions(
  positions: ReadonlyArray<Position>,
  lines: ReadonlyArray<OfferLine>,
): Array<Question> {
  const byReference = new Map<string, Array<OfferLine>>()
  const unreferenced = new Map<string, Array<OfferLine>>()
  for (const line of lines) {
    const bucket = line.posRef === null ? unreferenced : byReference
    const key = line.posRef ?? line.supplierKey
    bucket.set(key, [...(bucket.get(key) ?? []), line])
  }
  const indexes = [...unreferenced.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, supplierLines]) =>
      buildIndex(
        supplierLines,
        (line) => `${line.text} ${line.articleNo ?? ''}`,
      ),
    )

  // Search for every position first: whether a result counts depends on how
  // well its line fits elsewhere.
  const found = positions.map((position) =>
    indexes.flatMap((index) =>
      index.search(`${position.shortText} ${position.longText}`, SEARCH_DEPTH),
    ),
  )
  const best = new Map<string, number>()
  for (const results of found) {
    for (const { item, score } of results) {
      const id = lineId(item)
      best.set(id, Math.max(best.get(id) ?? 0, score))
    }
  }

  const byText = positions.map((_, index) =>
    (found[index] ?? [])
      .filter(
        ({ item, score }) =>
          score >= (best.get(lineId(item)) ?? 0) * LINE_SHARE,
      )
      .map(({ item }) => item),
  )
  const byQuantity = quotedInPlace(
    positions,
    [...unreferenced.values()].flat(),
    byText,
  )

  return positions.map((position, index) => {
    const named = byReference.get(position.oz) ?? []
    const repeats = (line: OfferLine) =>
      canonicalText(line.text) === canonicalText(position.shortText)
    return {
      oz: position.oz,
      shortText: position.shortText,
      longText: position.longText,
      unit: position.unit,
      echoes: named.filter(repeats).map(lineId),
      candidates: [
        ...named
          .filter((line) => !repeats(line))
          .map((line) => candidateOf(line, true)),
        ...(byText[index] ?? []).map((line) => candidateOf(line, false)),
        ...(byQuantity[index] ?? []).map((line) => candidateOf(line, false)),
      ],
    }
  })
}

/**
 * Lines the text search did not find for a position, but whose quantity
 * says they were quoted for it.
 *
 * A supplier that quotes by article adds up the quantities of every
 * position asking for it. If it quotes another article in place of the one
 * asked for, the text no longer leads to the line, but the quantity still
 * does: it is the total of exactly those positions. So a line whose
 * quantity is the total of one kind of position, and of few kinds at all,
 * is put to the model for that kind as well. Whether it is the right
 * product is still the model's to read and the checks' to decide.
 */
function quotedInPlace(
  positions: ReadonlyArray<Position>,
  lines: ReadonlyArray<OfferLine>,
  byText: ReadonlyArray<ReadonlyArray<OfferLine>>,
): Array<Array<OfferLine>> {
  // Positions asking for the same thing have the same short text.
  const kinds = new Map<string, Array<number>>()
  positions.forEach((position, index) => {
    const key = `${canonicalText(position.shortText)}|${canonicalUnit(position.unit).unit}`
    kinds.set(key, [...(kinds.get(key) ?? []), index])
  })
  const totals = [...kinds.values()].map((members) => ({
    members,
    total: members.reduce(
      (sum, index) => sum + (positions[index]?.qty ?? 0),
      0,
    ),
    unit: canonicalUnit(positions[members[0] ?? 0]?.unit ?? '').unit,
  }))
  const shown = byText.map((found) => new Set(found.map(lineId)))

  const added: Array<Array<OfferLine>> = positions.map(() => [])
  for (const line of lines) {
    const quantity = line.qty
    if (quantity === null || quantity <= 0) continue
    const unit = line.unit === null ? null : canonicalUnit(line.unit).unit
    const fitting = totals.filter(
      (kind) =>
        Math.abs(kind.total - quantity) < 0.5 &&
        (unit === null || unit === kind.unit),
    )
    if (fitting.length === 0 || fitting.length > QUANTITY_FITS) continue
    const id = lineId(line)
    // The text search already led to a kind this quantity belongs to.
    const accounted = fitting.some((kind) =>
      kind.members.every((index) => shown[index]?.has(id) === true),
    )
    if (accounted) continue
    for (const kind of fitting) {
      for (const index of kind.members) {
        if (shown[index]?.has(id) !== true) added[index]?.push(line)
      }
    }
  }
  return added
}

// ---------------------------------------------------------------------------
// 3. Verifying what the model said
// ---------------------------------------------------------------------------

/** One attribute as the model compared it. Every field is its claim. */
export interface RawPair {
  attribute: string
  tenderValue: string
  tenderQuote: string
  offerValue: string
  offerQuote: string
  agrees: boolean
}

export interface RawJudgement {
  id: string
  verdict: 'same' | 'different' | 'unrelated' | 'unsure'
  pairs: Array<RawPair>
  /** Units of the tender in one pack or ring, if the line says so. */
  packSize: string | null
  packQuote: string | null
  /** Where the line says it is an alternative or another make. */
  alternativeQuote: string | null
}

export interface Pair {
  attribute: string
  tender: { value: string; quote: string }
  offer: { value: string; quote: string }
  agrees: boolean
  decidedBy: 'code' | 'model'
  /** The conversion behind the comparison, where there was one. */
  arithmetic?: string
  /** Both values as numbers in one unit, where they were compared as measures. */
  scale?: { asked: number; offered: number; unit: string }
}

export interface Judgement {
  id: string
  /**
   * `confirmed`: the same product, with at least one compared attribute to
   * show for it. `mismatch`: at least one compared attribute differs.
   * `unrelated`: not the kind of thing asked for. `unconfirmed`: none of
   * the above could be established.
   */
  verdict: 'confirmed' | 'mismatch' | 'unrelated' | 'unconfirmed'
  /** Who established the verdict. */
  by: 'code' | 'model'
  /** What the model itself called the line, before anything was checked. */
  said: RawJudgement['verdict'] | null
  pairs: Array<Pair>
  /** Claims left out because a quote was not found in its source. */
  rejected: number
  pack: { size: number; quote: string } | null
  alternative: string | null
}

const valueIn = (quote: string, value: string) =>
  canonicalText(value) !== '' &&
  canonicalText(quote).includes(canonicalText(value))

export function verifyAnswer(
  question: Question,
  answer: ReadonlyArray<RawJudgement>,
): Array<Judgement> {
  const tenderText = `${question.shortText}\n${question.longText}`
  const given = new Map(answer.map((judgement) => [judgement.id, judgement]))

  const echoed = question.echoes.map((id): Judgement => ({
    id,
    verdict: 'confirmed',
    by: 'code',
    said: null,
    pairs: [],
    rejected: 0,
    pack: null,
    alternative: null,
  }))

  const read = question.candidates.map((candidate): Judgement => {
    const raw = given.get(candidate.id)
    const lineText = `${candidate.text}\n${candidate.articleNo ?? ''}`
    if (raw === undefined) {
      return {
        id: candidate.id,
        verdict: 'unconfirmed',
        by: 'model',
        said: null,
        pairs: [],
        rejected: 0,
        pack: null,
        alternative: null,
      }
    }

    const pairs: Array<Pair> = []
    let rejected = 0
    for (const pair of raw.pairs) {
      const sound =
        containsQuote(tenderText, pair.tenderQuote) &&
        containsQuote(lineText, pair.offerQuote) &&
        valueIn(pair.tenderQuote, pair.tenderValue) &&
        valueIn(pair.offerQuote, pair.offerValue)
      if (!sound) {
        rejected++
        continue
      }
      const compared = compareValues(pair.tenderValue, pair.offerValue)
      pairs.push({
        attribute: pair.attribute,
        tender: {
          value: squash(pair.tenderValue),
          quote: squash(pair.tenderQuote),
        },
        offer: {
          value: squash(pair.offerValue),
          quote: squash(pair.offerQuote),
        },
        agrees: compared.decidedBy === 'code' ? compared.agrees : pair.agrees,
        decidedBy: compared.decidedBy,
        ...(compared.arithmetic === undefined
          ? {}
          : { arithmetic: compared.arithmetic }),
        ...(compared.scale === undefined ? {} : { scale: compared.scale }),
      })
    }

    const differs = pairs.some((pair) => !pair.agrees)
    const verdict: Judgement['verdict'] =
      raw.verdict === 'unrelated'
        ? 'unrelated'
        : differs
          ? 'mismatch'
          : raw.verdict === 'same' && pairs.length > 0
            ? 'confirmed'
            : 'unconfirmed'

    let pack: Judgement['pack'] = null
    if (raw.packSize !== null && raw.packQuote !== null) {
      const size = parseGermanNumber(raw.packSize.trim())
      if (
        size !== null &&
        size > 1 &&
        containsQuote(candidate.text, raw.packQuote) &&
        valueIn(raw.packQuote, raw.packSize)
      ) {
        pack = { size, quote: squash(raw.packQuote) }
      } else {
        rejected++
      }
    }

    let alternative: string | null = null
    if (raw.alternativeQuote !== null) {
      if (containsQuote(candidate.text, raw.alternativeQuote)) {
        alternative = squash(raw.alternativeQuote)
      } else {
        rejected++
      }
    }

    return {
      id: candidate.id,
      verdict,
      // Code overruled the model where it called a line the same and a
      // compared value says otherwise.
      by:
        differs &&
        raw.verdict === 'same' &&
        pairs.some((pair) => !pair.agrees && pair.decidedBy === 'code')
          ? 'code'
          : 'model',
      said: raw.verdict,
      pairs,
      rejected,
      pack,
      alternative,
    }
  })

  return [...echoed, ...read]
}

// ---------------------------------------------------------------------------
// 4. Checks on a line
// ---------------------------------------------------------------------------

export interface Finding {
  code: ReasonCode
  /** The figures and words behind the finding, for the interface to phrase. */
  detail: Record<string, string | number>
}

export interface Offer {
  /** `supplierKey.seq`. */
  id: string
  supplierKey: string
  seq: number
  referenced: boolean
  verdict: Judgement['verdict']
  by: Judgement['by']
  pairs: Array<Pair>
  pack: Judgement['pack']
  /** Price for one unit of the tender, or `null` where the line does not say. */
  unitPrice: number | null
  /** Quantity offered, in units of the tender, where that can be said. */
  quantity: number | null
  findings: Array<Finding>
}

/** What one unit of the tender costs according to a line. */
export function unitPriceOf(
  line: OfferLine,
  tenderUnit: string,
  pack: Judgement['pack'],
): number | null {
  if (line.unitPrice === null || line.priceBasis <= 0) return null
  const perLineUnit = line.unitPrice / line.priceBasis
  const lineUnit = canonicalUnit(line.unit)
  if (line.unit === null || lineUnit.unit === canonicalUnit(tenderUnit).unit) {
    return perLineUnit
  }
  if (lineUnit.pack && pack !== null) return perLineUnit / pack.size
  return null
}

const TOTAL_TOLERANCE = 0.05

function arithmeticFinding(line: OfferLine): Finding | null {
  if (line.qty === null || line.unitPrice === null || line.total === null) {
    return null
  }
  const expected = roundCents((line.qty * line.unitPrice) / line.priceBasis)
  const off = Math.abs(expected - line.total)
  return off <= Math.max(TOTAL_TOLERANCE, expected * 0.002)
    ? null
    : { code: 'ARITHMETIC', detail: { expected, printed: line.total } }
}

/** Whether a quantity offered covers the one asked for, give or take rounding. */
export function quantityCovers(
  asked: number,
  offered: number,
  packSize: number | null,
): boolean {
  if (offered < asked * 0.999) return false
  const allowance = Math.max(packSize ?? 0, asked * QUANTITY_ALLOWANCE)
  return offered - asked <= allowance + 1e-9
}

/**
 * The lines that answer one position, checked one by one. Lines that name
 * no position are kept if the model called them the same or a mismatch;
 * `attribute` settles afterwards which positions they really answer.
 */
export function assess(
  position: Position,
  lines: ReadonlyMap<string, OfferLine>,
  judgements: ReadonlyArray<Judgement>,
): Array<Offer> {
  const offers: Array<Offer> = []
  const referencedIds = new Set(
    judgements
      .map((judgement) => lines.get(judgement.id))
      .filter((line) => line?.posRef === position.oz)
      .map((line) => (line === undefined ? '' : lineId(line))),
  )

  for (const judgement of judgements) {
    const line = lines.get(judgement.id)
    if (line === undefined) continue
    const referenced = referencedIds.has(judgement.id)
    const findings: Array<Finding> = []

    // A line that names no position is kept whatever it was called, with
    // nothing held against it yet: `attribute` looks at its quantity before
    // deciding which positions it is an offer for.
    if (judgement.verdict === 'mismatch') {
      for (const pair of judgement.pairs.filter((entry) => !entry.agrees)) {
        findings.push({
          code: 'SPEC_MISMATCH',
          detail: {
            attribute: pair.attribute,
            tender: pair.tender.value,
            offer: pair.offer.value,
            ...(pair.arithmetic === undefined
              ? {}
              : { arithmetic: pair.arithmetic }),
            ...(pair.scale === undefined
              ? {}
              : {
                  askedValue: pair.scale.asked,
                  offeredValue: Math.round(pair.scale.offered * 100) / 100,
                  scaleUnit: pair.scale.unit,
                }),
          },
        })
      }
    } else if (judgement.verdict !== 'confirmed' && referenced) {
      // The supplier says this line is for the position; that could not be
      // established from the two texts. Where the model called it another
      // product and its evidence did not hold, it is still a doubt about
      // the product, not about which line is meant.
      const doubted =
        judgement.verdict === 'unrelated' || judgement.said === 'different'
      findings.push({
        code: doubted ? 'SPEC_MISMATCH' : 'AMBIGUOUS',
        detail: { unconfirmed: 1 },
      })
    }

    const unitPrice = unitPriceOf(line, position.unit, judgement.pack)
    if (line.unitPrice !== null && unitPrice === null) {
      findings.push({
        code: 'UNIT_BASIS',
        detail: { lineUnit: line.unit ?? '', tenderUnit: position.unit },
      })
    }
    const arithmetic = arithmeticFinding(line)
    if (arithmetic !== null) findings.push(arithmetic)
    if (line.alternative || judgement.alternative !== null) {
      findings.push({
        code: 'ALTERNATIVE_PRODUCT',
        detail: { quote: judgement.alternative ?? '' },
      })
    }

    const inTenderUnits =
      line.qty === null
        ? null
        : canonicalUnit(line.unit).pack
          ? judgement.pack === null
            ? null
            : line.qty * judgement.pack.size
          : line.qty

    offers.push({
      id: judgement.id,
      supplierKey: line.supplierKey,
      seq: line.seq,
      referenced,
      verdict: judgement.verdict,
      by: judgement.by,
      pairs: judgement.pairs,
      pack: judgement.pack,
      unitPrice,
      quantity: inTenderUnits,
      findings,
    })
  }

  // Lines of one supplier that name the same position: either one quantity
  // split over several lines, or two answers to one question.
  const bySupplier = new Map<string, Array<Offer>>()
  for (const offer of offers.filter((entry) => entry.referenced)) {
    bySupplier.set(offer.supplierKey, [
      ...(bySupplier.get(offer.supplierKey) ?? []),
      offer,
    ])
  }
  for (const group of bySupplier.values()) {
    const [first] = group
    if (first === undefined) continue
    const firstLine = lines.get(first.id)
    const split = group.every((offer) => {
      const line = lines.get(offer.id)
      return (
        line !== undefined &&
        firstLine !== undefined &&
        line.articleNo === firstLine.articleNo &&
        line.unitPrice === firstLine.unitPrice &&
        line.priceBasis === firstLine.priceBasis &&
        line.unit === firstLine.unit
      )
    })
    if (group.length > 1 && !split) {
      for (const offer of group) {
        offer.findings.push({
          code: 'AMBIGUOUS',
          detail: { lines: group.length },
        })
      }
      continue
    }
    const quantities = group.map((offer) => offer.quantity)
    if (quantities.some((quantity) => quantity === null)) continue
    const offered = quantities.reduce<number>(
      (sum, quantity) => sum + (quantity ?? 0),
      0,
    )
    if (!quantityCovers(position.qty, offered, first.pack?.size ?? null)) {
      for (const offer of group) {
        offer.findings.push({
          code: 'QTY_MISMATCH',
          detail: { asked: position.qty, offered },
        })
      }
    }
  }

  return offers
}

// ---------------------------------------------------------------------------
// 5. Lines that name no position
// ---------------------------------------------------------------------------

export interface Assessed {
  position: Position
  offers: Array<Offer>
}

const sum = (values: Iterable<number>) => {
  let total = 0
  for (const value of values) total += value
  return total
}

/**
 * Settles which positions a line without a reference answers.
 *
 * Such a line offers an article for all the positions that ask for it, with
 * their quantities added up. So its quantity says what it was quoted
 * against, and that is used three ways. Positions asking for the same thing
 * have the same short text and stand or fall together.
 *
 * - Reading is not perfectly even: the same line is called the same for
 *   most positions of a kind and left open, or called different, for a few.
 *   If whole kinds of positions add up to the line's quantity, and only one
 *   choice of them does, those are what the line was quoted for, all of
 *   them, and nothing else is. A difference that arithmetic found is never
 *   overruled this way.
 * - If the quantity is that of positions the line only nearly matches, the
 *   supplier quoted this article in place of the one they ask for. For them
 *   it is an offer of the wrong product. A supplier that already answers a
 *   position exactly has not answered it a second time with something else.
 * - If nothing accounts for the quantity, the line stays an offer for the
 *   positions it matches, with a finding where the gap is more than rounding.
 */
export function attribute(assessed: ReadonlyArray<Assessed>): Array<Assessed> {
  interface Use {
    position: Position
    offer: Offer
  }
  const uses = new Map<string, Array<Use>>()
  for (const { position, offers } of assessed) {
    for (const offer of offers) {
      if (offer.referenced) continue
      uses.set(offer.id, [...(uses.get(offer.id) ?? []), { position, offer }])
    }
  }

  /** `supplierKey|oz` for every position a supplier answers exactly. */
  const answered = new Set<string>()
  for (const { position, offers } of assessed) {
    for (const offer of offers) {
      if (offer.verdict === 'confirmed') {
        answered.add(`${offer.supplierKey}|${position.oz}`)
      }
    }
  }

  // Positions asking for the same thing have the same short text. The long
  // text will not do: it also says where in the building the thing goes.
  const groupsOf = (entries: Array<Use>) => {
    const groups = new Map<string, Array<Use>>()
    for (const use of entries) {
      const key = canonicalText(use.position.shortText)
      groups.set(key, [...(groups.get(key) ?? []), use])
    }
    return [...groups.values()]
  }
  const asked = (group: Array<Use>) => sum(group.map((use) => use.position.qty))
  const is = (verdict: Offer['verdict']) => (use: Use) =>
    use.offer.verdict === verdict
  /** A difference found by arithmetic, which no quantity argues away. */
  const provenDifferent = (use: Use) =>
    use.offer.pairs.some((pair) => !pair.agrees && pair.decidedBy === 'code')

  /** Line id to the ordinal numbers it is no offer for. */
  const dropped = new Map<string, Set<string>>()
  const drop = (id: string, entries: Array<Use>) => {
    const set = dropped.get(id) ?? new Set<string>()
    for (const use of entries) set.add(use.position.oz)
    dropped.set(id, set)
  }
  /** The quantity says this is the same product after all. */
  const confirm = (use: Use) => {
    if (use.offer.verdict === 'confirmed') return
    use.offer.verdict = 'confirmed'
    use.offer.by = 'code'
    use.offer.findings = use.offer.findings.filter(
      (finding) => finding.code !== 'SPEC_MISMATCH',
    )
  }

  for (const [id, entries] of uses) {
    const exact = entries.filter(is('confirmed'))
    const near = entries.filter(is('mismatch'))
    const open = entries.filter(
      (use) =>
        use.offer.verdict === 'unconfirmed' ||
        use.offer.verdict === 'unrelated',
    )
    const quantity = entries[0]?.offer.quantity ?? null
    if (quantity === null) {
      drop(id, [...near, ...open])
      continue
    }
    const same = (total: number) => Math.abs(total - quantity) < 0.5

    // 1. Read evenly, and it adds up: nothing to settle.
    if (exact.length > 0 && same(asked(exact))) {
      drop(id, [...near, ...open])
      continue
    }

    // 2. Whole kinds of positions that add up to the quantity. A kind
    // counts only if the line was read as the same for at least one of its
    // positions and proven different for none.
    const kinds = groupsOf(entries).filter(
      (group) => group.some(is('confirmed')) && !group.some(provenDifferent),
    )
    if (kinds.length > 0 && kinds.length <= MAX_GROUPS) {
      const fitting: Array<Array<Use>> = []
      for (let mask = 1; mask < 1 << kinds.length; mask++) {
        const chosen = kinds.filter((_, index) => mask & (1 << index)).flat()
        if (same(asked(chosen))) fitting.push(chosen)
      }
      const [only] = fitting
      if (fitting.length === 1 && only !== undefined) {
        only.forEach(confirm)
        drop(
          id,
          entries.filter((use) => !only.includes(use)),
        )
        continue
      }
    }
    drop(id, open)

    // 3. Quoted in place of another article: the plainest account first,
    // one kind's quantities are the line's. Only then: the exact matches
    // and one kind together.
    const candidates = groupsOf(
      near.filter(
        (use) => !answered.has(`${use.offer.supplierKey}|${use.position.oz}`),
      ),
    )
    const substituted =
      candidates.find((group) => same(asked(group))) ??
      (exact.length > 0
        ? candidates.find((group) => same(asked(exact) + asked(group)))
        : undefined)
    drop(
      id,
      near.filter(
        (use) => substituted === undefined || !substituted.includes(use),
      ),
    )
    if (substituted !== undefined) continue

    // 4. Nothing accounts for the quantity. For the positions the line
    // does match, say so if it is more than rounding.
    if (
      exact.length > 0 &&
      !quantityCovers(
        asked(exact),
        quantity,
        exact[0]?.offer.pack?.size ?? null,
      )
    ) {
      for (const use of exact) {
        use.offer.findings.push({
          code: 'QTY_MISMATCH',
          detail: { asked: asked(exact), offered: quantity },
        })
      }
    }
  }

  return assessed.map(({ position, offers }) => ({
    position,
    offers: offers.filter(
      (offer) => dropped.get(offer.id)?.has(position.oz) !== true,
    ),
  }))
}

// ---------------------------------------------------------------------------
// 6. The decision
// ---------------------------------------------------------------------------

export interface Decision {
  status: 'auto' | 'review'
  /** Why a person has to look. Empty for `auto`. */
  reasons: Array<ReasonCode>
  /** Findings on offers dearer than the one chosen: seen, nothing to decide. */
  noted: Array<ReasonCode>
  /** The cheapest clean offer, if there is one. */
  best: { id: string; supplierKey: string; unitPrice: number } | null
  /** Quantity times the best clean price. */
  materialTotal: number | null
  /**
   * For a review: what the decision is worth. The difference between the
   * clean price and the cheaper flagged one, or the whole amount where no
   * clean offer exists. `null` where no price can be put on it.
   */
  atRisk: number | null
}

/**
 * Marks a price that stands far off what every other supplier asks. Where
 * two suppliers agree and a third is far away, the third is marked. With two
 * suppliers nobody can say which of them is off, so both are.
 */
export function markOutliers(offers: Array<Offer>): void {
  const priced = offers.filter(
    (offer): offer is Offer & { unitPrice: number } => offer.unitPrice !== null,
  )
  const far = (price: number, other: number) =>
    price > other * OUTLIER_FACTOR || price < other / OUTLIER_FACTOR
  for (const offer of priced) {
    const others = priced
      .filter((other) => other.supplierKey !== offer.supplierKey)
      .map((other) => other.unitPrice)
    if (others.length === 0) continue
    if (!others.every((other) => far(offer.unitPrice, other))) continue
    const nearest = others.reduce((a, b) =>
      Math.abs(b - offer.unitPrice) < Math.abs(a - offer.unitPrice) ? b : a,
    )
    offer.findings.push({
      code: 'PRICE_OUTLIER',
      detail: {
        price: roundCents(offer.unitPrice),
        others: roundCents(nearest),
      },
    })
  }
}

const codesOf = (offers: Array<Offer>): Array<ReasonCode> =>
  REASON_CODES.filter((code) =>
    offers.some((offer) =>
      offer.findings.some((finding) => finding.code === code),
    ),
  )

export function decide(position: Position, offers: Array<Offer>): Decision {
  if (offers.length === 0) {
    return {
      status: 'review',
      reasons: ['NO_OFFER'],
      noted: [],
      best: null,
      materialTotal: null,
      atRisk: null,
    }
  }

  const clean = offers
    .filter(
      (offer): offer is Offer & { unitPrice: number } =>
        offer.verdict === 'confirmed' &&
        offer.findings.length === 0 &&
        offer.unitPrice !== null,
    )
    .sort((a, b) => a.unitPrice - b.unitPrice || a.id.localeCompare(b.id))
  const best = clean[0]

  const flagged = offers.filter((offer) => offer.findings.length > 0)
  const decisive = flagged.filter(
    (offer) =>
      best === undefined ||
      offer.unitPrice === null ||
      offer.unitPrice < best.unitPrice,
  )
  const reasons = codesOf(decisive)
  const status = reasons.length === 0 ? 'auto' : 'review'

  const cheapestFlagged = Math.min(
    ...decisive.map((offer) => offer.unitPrice ?? Infinity),
  )
  let atRisk: number | null = null
  if (status === 'review') {
    if (best !== undefined && Number.isFinite(cheapestFlagged)) {
      atRisk = roundCents(position.qty * (best.unitPrice - cheapestFlagged))
    } else if (best !== undefined) {
      atRisk = null
    } else if (Number.isFinite(cheapestFlagged)) {
      atRisk = roundCents(position.qty * cheapestFlagged)
    }
  }

  return {
    status,
    reasons,
    noted: codesOf(flagged.filter((offer) => !decisive.includes(offer))),
    best:
      best === undefined
        ? null
        : {
            id: best.id,
            supplierKey: best.supplierKey,
            unitPrice: best.unitPrice,
          },
    materialTotal:
      best === undefined ? null : roundCents(position.qty * best.unitPrice),
    atRisk,
  }
}

/** Steps 4 to 6 for a whole tender. */
export function triage(
  positions: ReadonlyArray<Position>,
  lines: ReadonlyArray<OfferLine>,
  judgements: ReadonlyMap<string, ReadonlyArray<Judgement>>,
): Array<Assessed & { decision: Decision }> {
  const byId = new Map(lines.map((line) => [lineId(line), line]))
  const assessed = attribute(
    positions.map((position) => ({
      position,
      offers: assess(position, byId, judgements.get(position.oz) ?? []),
    })),
  )
  return assessed.map(({ position, offers }) => {
    markOutliers(offers)
    return { position, offers, decision: decide(position, offers) }
  })
}
