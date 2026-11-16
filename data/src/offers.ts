/**
 * Builds the three supplier offers and plants the traps.
 *
 * Each supplier answers in its own way: the wholesaler line by line in
 * shorthand with prices per price unit, the specialist one line per article
 * with list price and discount, the third as a GAEB phase 84 file. Sixty
 * lines are then altered the way real offers go wrong, and every alteration
 * is recorded so a benchmark can check whether it was caught.
 */
import { roundCents } from '@preisspiegel/core'
import { ALTERNATIVE_BRAND } from './names'
import type { Product, ProductGroup } from './catalog'
import type { SupplierKey } from './names'
import type { Rng } from './rng'
import type { TenderPosition } from './tender'

export const TRAP_KINDS = [
  'SPEC_MISMATCH',
  'UNIT_BASIS',
  'PRICE_OUTLIER',
  'QTY_MISMATCH',
  'ALTERNATIVE_PRODUCT',
  'NO_OFFER',
  'AMBIGUOUS',
  'ARITHMETIC',
] as const
export type TrapKind = (typeof TRAP_KINDS)[number]

export interface Trap {
  kind: TrapKind
  /**
   * Whether a person has to look. False only where the line is unusual but
   * fully determined, such as a price quoted per 1000 instead of per 100.
   */
  mustFlag: boolean
  note: string
}

/** One printed line of a supplier's offer. */
export interface OfferDraft {
  supplier: SupplierKey
  /** The tender positions this line answers. */
  positions: Array<string>
  /** The product actually offered, which a trap can make the wrong one. */
  productId: string
  posRef: string | null
  articleNo: string
  text: string
  /** Second line: the specialist's detail line. */
  detail: string | null
  /** The specialist's group heading. */
  heading: string | null
  qty: number
  unit: string
  /** Printed price, for `priceBasis` units. */
  unitPrice: number
  priceBasis: number
  listPrice: number | null
  discountPct: number | null
  total: number
  /** True price per tender unit, whatever the line prints. */
  pricePerUnit: number
  trap: Trap | null
}

export interface PlantedTrap extends Trap {
  supplier: SupplierKey | null
  /** Index of the line in its supplier's document, `null` for a missing offer. */
  seq: number | null
  positions: Array<string>
}

export interface Offers {
  lines: Record<SupplierKey, Array<OfferDraft>>
  traps: Array<PlantedTrap>
}

/**
 * How many of each trap, and with which supplier. Roughly three in a hundred
 * lines of each offer are altered; the specialist's lines each answer several
 * positions, so it gets fewer.
 */
const TRAP_PLAN = {
  NO_OFFER: 8,
  SPEC_MISMATCH: { a: 10, b: 2 },
  UNIT_BASIS: { determined: 4, unclear: 4 },
  PRICE_OUTLIER: { a: 4, b: 1, c: 3 },
  QTY_MISMATCH: { a: 4, c: 4 },
  ALTERNATIVE_PRODUCT: { a: 6, b: 2 },
  AMBIGUOUS: 4,
  ARITHMETIC: { a: 2, b: 1, c: 1 },
} as const

/** The position the demo opens on: a 250 A site cabinet, offered one size too small. */
const FEATURED = { productId: 'site-cabinet-250', offered: 'site-cabinet-200' }

// ---------------------------------------------------------------------------
// Supplier behaviour
// ---------------------------------------------------------------------------

type Family =
  | 'switchgear'
  | 'cable'
  | 'routing'
  | 'device'
  | 'lighting'
  | 'data'
  | 'earthing'

function family(group: ProductGroup): Family {
  if (group.startsWith('cable')) return 'cable'
  if (group.startsWith('routing')) return 'routing'
  if (group.startsWith('data')) return 'data'
  if (group.startsWith('luminaire') || group === 'emergency') return 'lighting'
  if (group === 'device') return 'device'
  if (group === 'earthing' || group === 'lightning' || group === 'surge') {
    return 'earthing'
  }
  return 'switchgear'
}

/** Where each supplier is cheap or dear, relative to the reference price. */
const PRICE_LEVEL: Record<SupplierKey, Record<Family, number>> = {
  a: {
    switchgear: 1.0,
    cable: 0.96,
    routing: 0.98,
    device: 0.98,
    lighting: 1.05,
    data: 1.02,
    earthing: 1.0,
  },
  b: {
    switchgear: 1.1,
    cable: 1.1,
    routing: 1.1,
    device: 1.03,
    lighting: 0.93,
    data: 0.97,
    earthing: 1.1,
  },
  c: {
    switchgear: 0.95,
    cable: 1.02,
    routing: 1.01,
    device: 1.04,
    lighting: 1.04,
    data: 1.04,
    earthing: 1.03,
  },
}

/** The specialist quotes lighting, devices and data only. */
const SPECIALIST_HEADINGS: Partial<Record<ProductGroup, string>> = {
  luminaire: 'Leuchten',
  'luminaire.outdoor': 'Außenleuchten',
  emergency: 'Sicherheitsbeleuchtung',
  device: 'Schalter und Steckdosen',
  'data.cable': 'Datennetz',
  'data.outlet': 'Datennetz',
  'data.rack': 'Datennetz',
  'data.patch': 'Datennetz',
}

/** The wholesaler's price unit: cable per 100 m, small parts per 100 pieces. */
function wholesalerBasis(product: Product): number {
  if (product.unit === 'm' && family(product.group) === 'cable') return 100
  if (product.group === 'data.cable' || product.group === 'routing.conduit') {
    return 100
  }
  if (
    product.id.includes('frame') ||
    product.id.includes('wall-box') ||
    product.id === 'earth-roof-holder' ||
    product.id === 'earth-cross-connector'
  ) {
    return 100
  }
  return 1
}

const WHOLESALER_UNIT: Record<string, string> = { St: 'ST', m: 'M' }
const SPECIALIST_UNIT: Record<string, string> = { St: 'Stck', m: 'Mtr' }

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export function buildOffers(
  catalog: Array<Product>,
  positions: Array<TenderPosition>,
  rng: Rng,
): Offers {
  const products = new Map(catalog.map((product) => [product.id, product]))
  const productOf = (id: string): Product => {
    const product = products.get(id)
    if (product === undefined) throw new Error(`unknown product ${id}`)
    return product
  }
  const supplied = positions.filter(
    (position) => productOf(position.productId).group !== 'own_work',
  )

  const price = (supplier: SupplierKey, product: Product, draw: Rng) =>
    product.price *
    PRICE_LEVEL[supplier][family(product.group)] *
    (0.95 + draw.next() * 0.1)

  // --- Positions nobody quotes -------------------------------------------
  const trapRng = rng.fork('traps')
  const featured = supplied.find(
    (position) => position.productId === FEATURED.productId,
  )
  if (featured === undefined) throw new Error('featured position is missing')

  const taken = new Set<string>([featured.oz])
  const takePositions = (pool: Array<TenderPosition>, count: number) => {
    const free = pool.filter((position) => !taken.has(position.oz))
    const chosen = trapRng.sample(free, count)
    for (const position of chosen) taken.add(position.oz)
    return chosen
  }
  const unquoted = new Set(
    takePositions(supplied, TRAP_PLAN.NO_OFFER).map((position) => position.oz),
  )

  // --- The wholesaler: one line per position ------------------------------
  const a: Array<OfferDraft> = []
  const drawA = rng.fork('supplier-a')
  for (const position of supplied) {
    const covered = drawA.chance(0.88)
    const withRef = drawA.chance(0.94)
    const level = price('a', productOf(position.productId), drawA)
    if (unquoted.has(position.oz)) continue
    if (!covered && position.oz !== featured.oz) continue
    a.push(
      wholesalerLine(
        productOf(position.productId),
        position,
        level,
        withRef || position.oz === featured.oz,
      ),
    )
  }

  // --- The specialist: one line per article -------------------------------
  const b: Array<OfferDraft> = []
  const drawB = rng.fork('supplier-b')
  for (const product of catalog) {
    const heading = SPECIALIST_HEADINGS[product.group]
    if (heading === undefined) continue
    const answered = supplied.filter(
      (position) =>
        position.productId === product.id && !unquoted.has(position.oz),
    )
    const covered = drawB.chance(0.92)
    const level = price('b', product, drawB)
    const discount = drawB.pick([30, 35, 38, 40, 42])
    if (answered.length === 0 || !covered) continue
    b.push(specialistLine(product, answered, level, discount, heading))
  }

  // --- The GAEB supplier: a unit price per position -----------------------
  const c: Array<OfferDraft> = []
  const drawC = rng.fork('supplier-c')
  for (const position of supplied) {
    const covered = drawC.chance(0.72)
    const level = price('c', productOf(position.productId), drawC)
    if (unquoted.has(position.oz) || !covered) continue
    const unitPrice = roundCents(level)
    c.push({
      supplier: 'c',
      positions: [position.oz],
      productId: position.productId,
      posRef: position.oz,
      articleNo: '',
      text: position.shortText,
      detail: null,
      heading: null,
      qty: position.qty,
      unit: position.unit,
      unitPrice,
      priceBasis: 1,
      listPrice: null,
      discountPct: null,
      total: roundCents(position.qty * unitPrice),
      pricePerUnit: unitPrice,
      trap: null,
    })
  }

  // --- Traps ---------------------------------------------------------------
  const lineFor = (lines: Array<OfferDraft>, oz: string) =>
    lines.find((line) => line.positions.includes(oz))
  const quotedBy = (oz: string) =>
    [a, b, c].filter((lines) => lineFor(lines, oz) !== undefined).length

  /** Untouched lines of one supplier, on positions no other trap uses. */
  const takeLines = (
    lines: Array<OfferDraft>,
    count: number,
    accept: (line: OfferDraft) => boolean = () => true,
  ): Array<OfferDraft> => {
    const free = lines.filter(
      (line) =>
        line.trap === null &&
        line.positions.every((oz) => !taken.has(oz)) &&
        accept(line),
    )
    const chosen = trapRng.sample(free, count)
    for (const line of chosen) for (const oz of line.positions) taken.add(oz)
    return chosen
  }

  /** Products that differ from this one in exactly one attribute that matters. */
  const mismatches = (
    product: Product,
  ): Array<{ other: Product; attr: string }> => {
    const keys = Object.keys(product.attrs).sort().join(',')
    const found: Array<{ other: Product; attr: string }> = []
    for (const other of catalog) {
      if (
        other.id === product.id ||
        other.group !== product.group ||
        other.unit !== product.unit ||
        Object.keys(other.attrs).sort().join(',') !== keys
      ) {
        continue
      }
      const differing = product.critical.filter(
        (attr) => other.attrs[attr] !== product.attrs[attr],
      )
      const [attr] = differing
      if (differing.length === 1 && attr !== undefined) {
        found.push({ other, attr })
      }
    }
    return found
  }
  const describe = (product: Product, other: Product, attr: string) =>
    `${attr}: tender ${String(product.attrs[attr])}, offered ${String(other.attrs[attr])}`

  // SPEC_MISMATCH, wholesaler. The featured position goes first.
  const substitute = (line: OfferDraft, other: Product, note: string) => {
    const position = positions.find((entry) => entry.oz === line.positions[0])
    if (position === undefined) throw new Error('line without a position')
    const level =
      (line.pricePerUnit / productOf(line.productId).price) * other.price
    Object.assign(
      line,
      wholesalerLine(other, position, level, line.posRef !== null),
      { trap: { kind: 'SPEC_MISMATCH', mustFlag: true, note } },
    )
  }
  const featuredLine = lineFor(a, featured.oz)
  if (featuredLine === undefined) throw new Error('featured line is missing')
  substitute(
    featuredLine,
    productOf(FEATURED.offered),
    'ratedCurrentA: tender 250, offered 200 (stated as 138 kVA)',
  )
  for (const line of takeLines(
    a,
    TRAP_PLAN.SPEC_MISMATCH.a - 1,
    (candidate) => mismatches(productOf(candidate.productId)).length > 0,
  )) {
    const product = productOf(line.productId)
    const { other, attr } = trapRng.pick(mismatches(product))
    substitute(line, other, describe(product, other, attr))
  }

  // SPEC_MISMATCH, specialist: one article quoted in place of another. If the
  // specialist also quotes that other article, the two become one line, which
  // then answers both articles' positions.
  for (let planted = 0; planted < TRAP_PLAN.SPEC_MISMATCH.b; planted++) {
    const untouched = (line: OfferDraft | undefined) =>
      line === undefined ||
      (line.trap === null && line.positions.every((oz) => !taken.has(oz)))
    const options = (line: OfferDraft) =>
      mismatches(productOf(line.productId)).filter(({ other }) =>
        untouched(b.find((entry) => entry.productId === other.id)),
      )

    const [line] = takeLines(b, 1, (candidate) => options(candidate).length > 0)
    if (line === undefined) throw new Error('no specialist line to substitute')
    const product = productOf(line.productId)
    const { other, attr } = trapRng.pick(options(line))
    const existing = b.find((entry) => entry.productId === other.id)

    if (existing === undefined) {
      const answered = positions.filter((position) =>
        line.positions.includes(position.oz),
      )
      Object.assign(
        line,
        specialistLine(
          other,
          answered,
          (line.pricePerUnit / product.price) * other.price,
          line.discountPct ?? 35,
          line.heading ?? '',
        ),
      )
      line.trap = {
        kind: 'SPEC_MISMATCH',
        mustFlag: true,
        note: describe(product, other, attr),
      }
    } else {
      for (const oz of existing.positions) taken.add(oz)
      existing.positions.push(...line.positions)
      existing.qty += line.qty
      existing.total = roundCents(existing.qty * existing.unitPrice)
      existing.trap = {
        kind: 'SPEC_MISMATCH',
        mustFlag: true,
        note: `${describe(product, other, attr)}; quoted on one line with the positions that do ask for it`,
      }
      b.splice(b.indexOf(line), 1)
    }
  }

  // UNIT_BASIS, determined: the usual price unit times ten. Still exact.
  for (const line of takeLines(
    a,
    TRAP_PLAN.UNIT_BASIS.determined,
    (candidate) => candidate.priceBasis === 100,
  )) {
    line.priceBasis = 1000
    line.unitPrice = roundCents(line.unitPrice * 10)
    line.total = roundCents((line.qty * line.unitPrice) / 1000)
    line.pricePerUnit = line.unitPrice / 1000
    line.trap = {
      kind: 'UNIT_BASIS',
      mustFlag: false,
      note: 'priced per 1000 where this supplier prices per 100',
    }
  }

  // UNIT_BASIS, unclear: quoted in rings or packs, not in the tender's unit.
  for (const line of takeLines(
    a,
    TRAP_PLAN.UNIT_BASIS.unclear,
    (candidate) =>
      candidate.qty >= 40 &&
      (candidate.unit === 'M' || candidate.pricePerUnit < 15),
  )) {
    const product = productOf(line.productId)
    const pack = product.unit === 'm' ? trapRng.pick([50, 100]) : 10
    const perUnit = line.pricePerUnit
    line.unit = product.unit === 'm' ? 'RG' : 'VE'
    line.qty = Math.ceil(line.qty / pack)
    line.priceBasis = 1
    line.unitPrice = roundCents(perUnit * pack)
    line.total = roundCents(line.qty * line.unitPrice)
    line.pricePerUnit = line.unitPrice / pack
    line.trap = {
      kind: 'UNIT_BASIS',
      mustFlag: true,
      note: `quoted per ${line.unit} of ${pack}, the tender counts in ${product.unit}`,
    }
  }

  // PRICE_OUTLIER: a decimal point one place off. Needs a second offer to show.
  const outlier = (line: OfferDraft) => {
    const up = line.pricePerUnit < 20 && trapRng.chance(0.6)
    const factor = up ? 10 : 0.1
    line.unitPrice = roundCents(line.unitPrice * factor)
    if (line.listPrice !== null) {
      line.listPrice = roundCents(line.listPrice * factor)
    }
    line.total = roundCents((line.qty * line.unitPrice) / line.priceBasis)
    line.pricePerUnit = line.unitPrice / line.priceBasis
    line.trap = {
      kind: 'PRICE_OUTLIER',
      mustFlag: true,
      note: `price ${up ? 'ten times' : 'a tenth of'} what was meant`,
    }
  }
  const compared = (line: OfferDraft) =>
    line.positions.every((oz) => quotedBy(oz) >= 2) && line.unitPrice >= 1
  for (const line of [
    ...takeLines(a, TRAP_PLAN.PRICE_OUTLIER.a, compared),
    ...takeLines(b, TRAP_PLAN.PRICE_OUTLIER.b, compared),
    ...takeLines(c, TRAP_PLAN.PRICE_OUTLIER.c, compared),
  ]) {
    outlier(line)
  }

  // QTY_MISMATCH: the supplier priced a different quantity than was asked.
  for (const line of [
    ...takeLines(
      a,
      TRAP_PLAN.QTY_MISMATCH.a,
      (candidate) => candidate.qty >= 20,
    ),
    ...takeLines(
      c,
      TRAP_PLAN.QTY_MISMATCH.c,
      (candidate) => candidate.qty >= 20,
    ),
  ]) {
    const asked = line.qty
    line.qty = asked % 10 === 0 ? asked / 10 : asked * 10
    line.total = roundCents((line.qty * line.unitPrice) / line.priceBasis)
    line.trap = {
      kind: 'QTY_MISMATCH',
      mustFlag: true,
      note: `tender asks for ${asked}, offer is for ${line.qty}`,
    }
  }

  // ALTERNATIVE_PRODUCT: another make, marked as such, a little cheaper.
  for (const line of [
    ...takeLines(a, TRAP_PLAN.ALTERNATIVE_PRODUCT.a),
    ...takeLines(b, TRAP_PLAN.ALTERNATIVE_PRODUCT.b),
  ]) {
    line.text = `Alternativ: ${ALTERNATIVE_BRAND} ${line.text.replace(/^(Trennox|Lumfeld|Tastwerk|Quorix) /, '')}`
    line.articleNo =
      line.supplier === 'a'
        ? String(Number(line.articleNo) + 13)
        : `EM-${line.articleNo.replace(/^[A-Z]+-/, '')}`
    cheapen(line, 0.9)
    line.trap = {
      kind: 'ALTERNATIVE_PRODUCT',
      mustFlag: true,
      note: `offered as an alternative make (${ALTERNATIVE_BRAND})`,
    }
  }

  // AMBIGUOUS: two lines for one position, neither marked as an alternative.
  for (const line of takeLines(
    a,
    TRAP_PLAN.AMBIGUOUS,
    (candidate) => candidate.posRef !== null,
  )) {
    const note = 'two lines answer this position at different prices'
    line.trap = { kind: 'AMBIGUOUS', mustFlag: true, note }
    const twin: OfferDraft = {
      ...line,
      positions: [...line.positions],
      articleNo: String(Number(line.articleNo) + 7),
      text: `${line.text} Serie E`,
    }
    cheapen(twin, 1.12)
    a.splice(a.indexOf(line) + 1, 0, twin)
  }

  // ARITHMETIC: quantity times price is not the printed total.
  for (const line of [
    ...takeLines(
      a,
      TRAP_PLAN.ARITHMETIC.a,
      (candidate) => candidate.total >= 50,
    ),
    ...takeLines(
      b,
      TRAP_PLAN.ARITHMETIC.b,
      (candidate) => candidate.total >= 50,
    ),
    ...takeLines(
      c,
      TRAP_PLAN.ARITHMETIC.c,
      (candidate) => candidate.total >= 50,
    ),
  ]) {
    const right = line.total
    line.total = roundCents(right * trapRng.pick([1.1, 0.9, 1.25]))
    line.trap = {
      kind: 'ARITHMETIC',
      mustFlag: true,
      note: `quantity times price is ${right.toFixed(2)}, the line total says ${line.total.toFixed(2)}`,
    }
  }

  // --- Collect -------------------------------------------------------------
  const lines = { a, b, c }
  const traps: Array<PlantedTrap> = [...unquoted].sort().map((oz) => ({
    kind: 'NO_OFFER',
    mustFlag: true,
    note: 'no supplier quoted this position',
    supplier: null,
    seq: null,
    positions: [oz],
  }))
  for (const supplier of ['a', 'b', 'c'] as const) {
    lines[supplier].forEach((line, seq) => {
      if (line.trap === null) return
      // The second line of an ambiguous pair is the same trap, not a new one.
      const previous = lines[supplier][seq - 1]
      if (
        line.trap.kind === 'AMBIGUOUS' &&
        previous?.trap?.kind === 'AMBIGUOUS' &&
        previous.positions[0] === line.positions[0]
      ) {
        return
      }
      const asked = new Map(
        positions.map((position) => [position.oz, position.productId]),
      )
      const affected =
        line.trap.kind === 'SPEC_MISMATCH'
          ? line.positions.filter((oz) => asked.get(oz) !== line.productId)
          : line.positions
      traps.push({
        ...line.trap,
        supplier,
        seq,
        positions: [...affected].sort(),
      })
    })
  }

  return { lines, traps }
}

function cheapen(line: OfferDraft, factor: number): void {
  line.unitPrice = roundCents(line.unitPrice * factor)
  if (line.listPrice !== null) {
    line.listPrice = roundCents(line.listPrice * factor)
  }
  line.total = roundCents((line.qty * line.unitPrice) / line.priceBasis)
  line.pricePerUnit = line.unitPrice / line.priceBasis
}

function wholesalerLine(
  product: Product,
  position: TenderPosition,
  pricePerUnit: number,
  withRef: boolean,
): OfferDraft {
  const basis = wholesalerBasis(product)
  const unitPrice = roundCents(pricePerUnit * basis)
  return {
    supplier: 'a',
    positions: [position.oz],
    productId: product.id,
    posRef: withRef ? position.oz : null,
    articleNo: product.articleA,
    text: product.a,
    detail: null,
    heading: null,
    qty: position.qty,
    unit: WHOLESALER_UNIT[product.unit] ?? product.unit,
    unitPrice,
    priceBasis: basis,
    listPrice: null,
    discountPct: null,
    total: roundCents((position.qty * unitPrice) / basis),
    pricePerUnit: unitPrice / basis,
    trap: null,
  }
}

function specialistLine(
  product: Product,
  answered: Array<TenderPosition>,
  pricePerUnit: number,
  discountPct: number,
  heading: string,
): OfferDraft {
  const listPrice = roundCents(pricePerUnit / (1 - discountPct / 100))
  const unitPrice = roundCents(listPrice * (1 - discountPct / 100))
  const qty = answered.reduce((sum, position) => sum + position.qty, 0)
  return {
    supplier: 'b',
    positions: answered.map((position) => position.oz),
    productId: product.id,
    posRef: null,
    articleNo: product.articleB,
    text: product.b.name,
    detail: product.b.detail,
    heading,
    qty,
    unit: SPECIALIST_UNIT[product.unit] ?? product.unit,
    unitPrice,
    priceBasis: 1,
    listPrice,
    discountPct,
    total: roundCents(qty * unitPrice),
    pricePerUnit: unitPrice,
    trap: null,
  }
}
