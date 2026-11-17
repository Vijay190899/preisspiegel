/**
 * Ground truth: what a careful estimator would conclude for every position,
 * written down by the generator that knows what it planted.
 *
 * The pipeline never reads this file. Benchmarks score against it.
 *
 * The rule for a position, in one sentence: it needs a person exactly when
 * its cheapest offer is not a clean one. An offer is clean when it is for the
 * product that was asked for and carries no trap. A trapped offer that is
 * dearer than a clean one changes nothing about the price that goes into the
 * bid, so it is noted and nobody is asked. A trapped offer that is cheaper
 * than every clean one, or whose price per unit cannot be worked out, or
 * that is the only offer there is, is a decision. So is a price far off the
 * only other one, because with two suppliers nobody can say which is wrong.
 */
import { ZEITWERTE } from './catalog'
import { ODDITY_KINDS, TRAP_KINDS } from './offers'
import type { Product } from './catalog'
import type { SupplierKey } from './names'
import type {
  OddityKind,
  OfferDraft,
  Offers,
  PlantedTrap,
  TrapKind,
} from './offers'
import type { TenderPosition } from './tender'

export interface TruthOffer {
  supplier: SupplierKey
  /** Index of the line in the supplier's document. */
  seq: number
  /** The line offers the product the position asks for. */
  valid: boolean
  /**
   * Price per tender unit as it follows from the printed line. `null` where
   * the line is in packs or rings and does not say how much one holds.
   */
  unitPrice: number | null
  /** The trap on this line, if it affects this position. */
  trap: TrapKind | null
  /** A harmless oddity on this line. */
  oddity: OddityKind | null
}

export interface TruthPosition {
  oz: string
  productId: string
  /** The contractor's own work: no supplier is expected to quote it. */
  ownWork: boolean
  /** The entry of the labor time table the work takes; `null` for own work. */
  laborKey: string | null
  /** Minutes of labor per unit, from the labor time table. */
  laborMinutes: number | null
  offers: Array<TruthOffer>
  expected: {
    decision: 'auto' | 'review'
    /** Why a person has to look. Empty for `auto`. */
    reasons: Array<TrapKind>
    /** Traps on offers dearer than the clean one chosen: seen, nothing to decide. */
    noted: Array<TrapKind>
    /** Cheapest clean offer, if there is one. */
    bestSupplier: SupplierKey | null
    bestSeq: number | null
    bestUnitPrice: number | null
  }
}

export interface Truth {
  seed: number
  summary: {
    positions: number
    expectedAuto: number
    expectedReview: number
    offerLines: Record<SupplierKey, number>
    /** Lines that name the position they answer. */
    referencedLines: Record<SupplierKey, number>
    /** Planted traps by kind. */
    traps: Record<TrapKind, number>
    /** Positions in review by reason. A position can have several. */
    reviewReasons: Record<TrapKind, number>
    /** Positions where a trap was seen but a cheaper clean offer decides. */
    notedOnly: number
    /** Clean lines that carry a harmless oddity, by kind. */
    oddities: Record<OddityKind, number>
  }
  traps: Array<PlantedTrap>
  positions: Array<TruthPosition>
}

const fourDecimals = (value: number) => Number(value.toFixed(4))

/** What one tender unit costs according to the line, if that can be said. */
function apparentPrice(line: OfferDraft): number | null {
  if (line.packSize !== null && !line.packStated) return null
  return fourDecimals(line.pricePerUnit)
}

export function buildTruth(
  seed: number,
  catalog: Array<Product>,
  positions: Array<TenderPosition>,
  offers: Offers,
): Truth {
  const products = new Map(catalog.map((product) => [product.id, product]))
  const minutes = new Map(ZEITWERTE.map((entry) => [entry.key, entry.minutes]))
  const kinds = (trapped: Array<TruthOffer>) =>
    TRAP_KINDS.filter((kind) => trapped.some((offer) => offer.trap === kind))

  const truthPositions = positions.map((position): TruthPosition => {
    const product = products.get(position.productId)
    if (product === undefined) throw new Error(`unknown ${position.productId}`)
    const ownWork = product.group === 'own_work'

    const found: Array<TruthOffer> = []
    for (const supplier of ['a', 'b', 'c'] as const) {
      offers.lines[supplier].forEach((line, seq) => {
        // A line that names a position is an offer for that position. A line
        // that names none offers its article to every position asking for
        // it, and is also an offer for the positions it was quoted against,
        // which differ where an article was substituted.
        const byArticle =
          line.posRef === null && line.productId === position.productId
        if (!line.positions.includes(position.oz) && !byArticle) return
        const valid = line.productId === position.productId
        // A substituted article is only a problem for positions that asked
        // for the other one.
        const applies =
          line.trap !== null && (line.trap.kind !== 'SPEC_MISMATCH' || !valid)
        found.push({
          supplier,
          seq,
          valid,
          unitPrice: apparentPrice(line),
          trap: applies ? (line.trap?.kind ?? null) : null,
          oddity: line.oddity,
        })
      })
    }

    const clean = found
      .filter(
        (offer): offer is TruthOffer & { unitPrice: number } =>
          offer.valid && offer.trap === null && offer.unitPrice !== null,
      )
      .sort((x, y) => x.unitPrice - y.unitPrice)
    const best = clean[0]

    const trapped = found.filter((offer) => offer.trap !== null)
    // With two suppliers, a price ten times the other's could be either
    // one's mistake, so it is a decision whichever of them is the dearer.
    const pricedSuppliers = new Set(
      found
        .filter((offer) => offer.unitPrice !== null)
        .map((offer) => offer.supplier),
    ).size
    const decisive = trapped.filter(
      (offer) =>
        best === undefined ||
        offer.unitPrice === null ||
        offer.unitPrice < best.unitPrice ||
        (offer.trap === 'PRICE_OUTLIER' && pricedSuppliers <= 2),
    )
    const reasons: Array<TrapKind> =
      found.length === 0 ? ['NO_OFFER'] : kinds(decisive)

    return {
      oz: position.oz,
      productId: position.productId,
      ownWork,
      laborKey: ownWork ? null : product.zeitwert,
      laborMinutes: ownWork ? null : (minutes.get(product.zeitwert) ?? null),
      offers: found,
      expected: {
        decision: reasons.length === 0 ? 'auto' : 'review',
        reasons,
        noted: kinds(trapped.filter((offer) => !decisive.includes(offer))),
        bestSupplier: best?.supplier ?? null,
        bestSeq: best?.seq ?? null,
        bestUnitPrice: best?.unitPrice ?? null,
      },
    }
  })

  const count = <TName extends string>(
    names: ReadonlyArray<TName>,
    of: (name: TName) => number,
  ) =>
    Object.fromEntries(names.map((name) => [name, of(name)])) as Record<
      TName,
      number
    >
  const suppliers = ['a', 'b', 'c'] as const
  const allLines = suppliers.flatMap((supplier) => offers.lines[supplier])

  const expectedAuto = truthPositions.filter(
    (position) => position.expected.decision === 'auto',
  ).length

  return {
    seed,
    summary: {
      positions: truthPositions.length,
      expectedAuto,
      expectedReview: truthPositions.length - expectedAuto,
      offerLines: count(suppliers, (supplier) => offers.lines[supplier].length),
      referencedLines: count(
        suppliers,
        (supplier) =>
          offers.lines[supplier].filter((line) => line.posRef !== null).length,
      ),
      traps: count(
        TRAP_KINDS,
        (kind) => offers.traps.filter((trap) => trap.kind === kind).length,
      ),
      reviewReasons: count(
        TRAP_KINDS,
        (kind) =>
          truthPositions.filter((position) =>
            position.expected.reasons.includes(kind),
          ).length,
      ),
      notedOnly: truthPositions.filter(
        (position) =>
          position.expected.decision === 'auto' &&
          position.expected.noted.length > 0,
      ).length,
      oddities: count(
        ODDITY_KINDS,
        (kind) => allLines.filter((line) => line.oddity === kind).length,
      ),
    },
    traps: offers.traps,
    positions: truthPositions,
  }
}
