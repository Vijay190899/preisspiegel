/**
 * Ground truth: what a careful estimator would conclude for every position,
 * written down by the generator that knows what it planted.
 *
 * The pipeline never reads this file. Benchmarks score against it.
 */
import { ZEITWERTE } from './catalog'
import { TRAP_KINDS } from './offers'
import type { Product } from './catalog'
import type { SupplierKey } from './names'
import type { Offers, PlantedTrap, TrapKind } from './offers'
import type { TenderPosition } from './tender'

export interface TruthOffer {
  supplier: SupplierKey
  /** Index of the line in the supplier's document. */
  seq: number
  /** The line offers the product the position asks for. */
  valid: boolean
  /** True net price per tender unit. */
  unitPrice: number
  /** The trap on this line, if it affects this position. */
  trap: TrapKind | null
  mustFlag: boolean
}

export interface TruthPosition {
  oz: string
  productId: string
  /** The contractor's own work: no supplier is expected to quote it. */
  ownWork: boolean
  /** Minutes of labor per unit, from the labor time table. */
  laborMinutes: number | null
  offers: Array<TruthOffer>
  expected: {
    decision: 'auto' | 'review'
    reasons: Array<TrapKind>
    /** Cheapest offer that is valid and carries no flag. */
    bestSupplier: SupplierKey | null
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
    traps: Record<TrapKind, number>
  }
  traps: Array<PlantedTrap>
  positions: Array<TruthPosition>
}

const fourDecimals = (value: number) => Number(value.toFixed(4))

export function buildTruth(
  seed: number,
  catalog: Array<Product>,
  positions: Array<TenderPosition>,
  offers: Offers,
): Truth {
  const products = new Map(catalog.map((product) => [product.id, product]))
  const minutes = new Map(ZEITWERTE.map((entry) => [entry.key, entry.minutes]))

  const truthPositions = positions.map((position): TruthPosition => {
    const product = products.get(position.productId)
    if (product === undefined) throw new Error(`unknown ${position.productId}`)
    const ownWork = product.group === 'own_work'

    const found: Array<TruthOffer> = []
    for (const supplier of ['a', 'b', 'c'] as const) {
      offers.lines[supplier].forEach((line, seq) => {
        if (!line.positions.includes(position.oz)) return
        const valid = line.productId === position.productId
        // A substituted article is only a problem for positions that asked
        // for the other one.
        const applies =
          line.trap !== null && (line.trap.kind !== 'SPEC_MISMATCH' || !valid)
        found.push({
          supplier,
          seq,
          valid,
          unitPrice: fourDecimals(line.pricePerUnit),
          trap: applies ? (line.trap?.kind ?? null) : null,
          mustFlag: applies ? (line.trap?.mustFlag ?? false) : false,
        })
      })
    }

    const flagged = found.filter((offer) => offer.mustFlag)
    const clean = found
      .filter((offer) => offer.valid && !offer.mustFlag)
      .sort((x, y) => x.unitPrice - y.unitPrice)
    const best = clean[0]

    const reasons: Array<TrapKind> =
      found.length === 0
        ? ['NO_OFFER']
        : TRAP_KINDS.filter((kind) =>
            flagged.some((offer) => offer.trap === kind),
          )

    return {
      oz: position.oz,
      productId: position.productId,
      ownWork,
      laborMinutes: ownWork ? null : (minutes.get(product.zeitwert) ?? null),
      offers: found,
      expected: {
        decision: reasons.length === 0 ? 'auto' : 'review',
        reasons,
        bestSupplier: best?.supplier ?? null,
        bestUnitPrice: best?.unitPrice ?? null,
      },
    }
  })

  const trapCounts = Object.fromEntries(
    TRAP_KINDS.map((kind) => [
      kind,
      offers.traps.filter((trap) => trap.kind === kind).length,
    ]),
  ) as Record<TrapKind, number>

  const expectedAuto = truthPositions.filter(
    (position) => position.expected.decision === 'auto',
  ).length

  return {
    seed,
    summary: {
      positions: truthPositions.length,
      expectedAuto,
      expectedReview: truthPositions.length - expectedAuto,
      offerLines: {
        a: offers.lines.a.length,
        b: offers.lines.b.length,
        c: offers.lines.c.length,
      },
      traps: trapCounts,
    },
    traps: offers.traps,
    positions: truthPositions,
  }
}
