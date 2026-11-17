/**
 * Builds the three supplier offers and plants the traps.
 *
 * Each supplier answers in its own way: the wholesaler in shorthand, line by
 * line for most of the tender and by article for bulk material; the
 * specialist one line per article with list price and discount; the third as
 * a GAEB phase 84 file. A supplier has one price per article.
 *
 * Sixty lines are then altered the way real offers go wrong, and every
 * alteration is recorded so a benchmark can check whether it was caught.
 * Other lines get the same surface features harmlessly (a stated pack size,
 * a quantity split over two lines, a total a cent off), so that a trap cannot
 * be told from a clean line by its looks.
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
  note: string
}

/**
 * What a clean line can look like without anything being wrong. Each of
 * these shares its surface with a trap kind.
 */
export const ODDITY_KINDS = [
  /** Quoted in packs or rings, with the size stated in the text. */
  'PACK',
  /** One position answered on two lines whose quantities add up. */
  'SPLIT',
  /** The quantity rounded up to a round number. */
  'ROUNDED',
  /** The line total a cent or two off, from rounding. */
  'CENTS',
  /** Priced per 1000 where the supplier usually prices per 100. */
  'PE1000',
] as const
export type OddityKind = (typeof ODDITY_KINDS)[number]

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
  /** The price for one tender unit that follows from what the line prints. */
  pricePerUnit: number
  /**
   * How many tender units one unit of this line holds, where the line is
   * quoted in packs or rings. `null` where the line counts in the tender's unit.
   */
  packSize: number | null
  /** Whether the pack size can be read from the line's text. */
  packStated: boolean
  trap: Trap | null
  oddity: OddityKind | null
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
 * Quantities a supplier may round up to without anyone asking why: at most
 * this share over what was asked for.
 */
export const ROUNDING_ALLOWANCE = 0.3

/**
 * How many of each trap, and with which supplier. Roughly three in a hundred
 * lines of each offer are altered; the specialist's lines each answer several
 * positions, so it gets fewer.
 */
const TRAP_PLAN = {
  NO_OFFER: 8,
  SPEC_MISMATCH: { a: 10, b: 2 },
  UNIT_BASIS: 8,
  PRICE_OUTLIER: { a: 4, b: 1, c: 3 },
  QTY_MISMATCH: { a: 4, c: 4 },
  ALTERNATIVE_PRODUCT: { a: 6, b: 2 },
  AMBIGUOUS: 4,
  ARITHMETIC: { a: 2, b: 1, c: 1 },
} as const

/** How many clean lines carry each harmless oddity. */
const ODDITY_PLAN = {
  PACK: 24,
  SPLIT: 12,
  ROUNDED: 20,
  CENTS: { a: 24, b: 3, c: 10 },
  PE1000: 10,
} as const

/** How a supplier says a line is not what was asked for. */
const ALTERNATIVE_MARKS = ['Alternativ:', 'Alt.:', 'abweichend:'] as const

/** How a wholesaler writes a pack size into the article text. */
const PACK_WORDING = {
  m: [
    (size: number) => `Ring ${size}m`,
    (size: number) => `Rg. à ${size} m`,
    (size: number) => `(${size} m/Ring)`,
  ],
  St: [
    (size: number) => `VE=${size}`,
    (size: number) => `(VE ${size} St)`,
    (size: number) => `${size}er-Pack`,
  ],
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

/**
 * Bulk material the wholesaler quotes by article, with the quantities of all
 * positions added up and no reference to any of them.
 */
const COLLECTIVE: ReadonlyArray<Family> = ['routing', 'device']

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

  // A supplier has one price per article, a little above or below its usual
  // level for that kind of product.
  const priceBook = (supplier: SupplierKey) => {
    const draw = rng.fork(`prices-${supplier}`)
    return new Map(
      catalog.map((product) => [
        product.id,
        product.price *
          PRICE_LEVEL[supplier][family(product.group)] *
          (0.9 + draw.next() * 0.22),
      ]),
    )
  }
  const prices = { a: priceBook('a'), b: priceBook('b'), c: priceBook('c') }
  const price = (supplier: SupplierKey, product: Product): number => {
    const value = prices[supplier].get(product.id)
    if (value === undefined) throw new Error(`no price for ${product.id}`)
    return value
  }

  // The position the demo opens on. The undersized cabinet has to be the
  // cheaper offer there, or there is nothing for anyone to decide.
  prices.a.set(
    FEATURED.offered,
    Math.min(
      price('a', productOf(FEATURED.offered)),
      price('c', productOf(FEATURED.productId)) * 0.92,
    ),
  )

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
  // A line that names no position offers its article to every position that
  // asks for it. So a position nobody quotes has to be one whose suppliers
  // all answer position by position.
  const byArticleA = (product: Product) =>
    COLLECTIVE.includes(family(product.group))
  const byArticle = (product: Product) =>
    byArticleA(product) || SPECIALIST_HEADINGS[product.group] !== undefined
  const unquoted = new Set(
    takePositions(
      supplied.filter((position) => !byArticle(productOf(position.productId))),
      TRAP_PLAN.NO_OFFER,
    ).map((position) => position.oz),
  )

  // --- The wholesaler -----------------------------------------------------
  // One line per position, naming it, for most of the tender. Bulk material
  // comes after that, one line per article, with nothing to say which
  // positions it is for.
  const a: Array<OfferDraft> = []
  const drawA = rng.fork('supplier-a')
  for (const position of supplied) {
    const product = productOf(position.productId)
    const covered = drawA.chance(0.88)
    if (byArticleA(product) || unquoted.has(position.oz)) continue
    if (!covered && position.oz !== featured.oz) continue
    a.push(wholesalerLine(product, [position], price('a', product), true))
  }
  const drawCollective = rng.fork('supplier-a-collective')
  for (const product of catalog) {
    if (!byArticleA(product)) continue
    const answered = supplied.filter(
      (position) => position.productId === product.id,
    )
    const covered = drawCollective.chance(0.9)
    if (answered.length === 0 || !covered) continue
    a.push(wholesalerLine(product, answered, price('a', product), false))
  }

  // --- The specialist: one line per article -------------------------------
  const b: Array<OfferDraft> = []
  const drawB = rng.fork('supplier-b')
  for (const product of catalog) {
    const heading = SPECIALIST_HEADINGS[product.group]
    if (heading === undefined) continue
    const answered = supplied.filter(
      (position) => position.productId === product.id,
    )
    const covered = drawB.chance(0.92)
    const level = price('b', product)
    const discount = drawB.pick([30, 35, 38, 40, 42])
    if (answered.length === 0 || !covered) continue
    b.push(specialistLine(product, answered, level, discount, heading))
  }

  // --- The GAEB supplier: a unit price per position -----------------------
  const c: Array<OfferDraft> = []
  const drawC = rng.fork('supplier-c')
  for (const position of supplied) {
    const covered = drawC.chance(0.72)
    const level = price('c', productOf(position.productId))
    if (unquoted.has(position.oz)) continue
    if (!covered && position.oz !== featured.oz) continue
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
      packSize: null,
      packStated: false,
      trap: null,
      oddity: null,
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
        line.oddity === null &&
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
    const level = price('a', other)
    Object.assign(
      line,
      wholesalerLine(other, [position], level, line.posRef !== null),
      { trap: { kind: 'SPEC_MISMATCH', note } },
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
    (candidate) =>
      candidate.positions.length === 1 &&
      mismatches(productOf(candidate.productId)).length > 0,
  )) {
    const product = productOf(line.productId)
    const { other, attr } = trapRng.pick(mismatches(product))
    substitute(line, other, describe(product, other, attr))
  }

  // SPEC_MISMATCH, specialist: one article quoted in place of another, which
  // the specialist does not quote anywhere else.
  for (let planted = 0; planted < TRAP_PLAN.SPEC_MISMATCH.b; planted++) {
    const options = (line: OfferDraft) =>
      mismatches(productOf(line.productId)).filter(({ other }) =>
        b.every((entry) => entry.productId !== other.id),
      )
    const [line] = takeLines(b, 1, (candidate) => options(candidate).length > 0)
    if (line === undefined) throw new Error('no specialist line to substitute')
    const product = productOf(line.productId)
    const { other, attr } = trapRng.pick(options(line))
    const answered = positions.filter((position) =>
      line.positions.includes(position.oz),
    )
    Object.assign(
      line,
      specialistLine(
        other,
        answered,
        price('b', other),
        line.discountPct ?? 35,
        line.heading ?? '',
      ),
      { trap: { kind: 'SPEC_MISMATCH', note: describe(product, other, attr) } },
    )
  }

  // UNIT_BASIS: quoted in rings or packs, with nothing to say how much one
  // of them holds.
  const packable = (candidate: OfferDraft) =>
    candidate.positions.length === 1 &&
    candidate.qty >= 40 &&
    (candidate.unit === 'M' || candidate.pricePerUnit < 15)
  const quoteInPacks = (line: OfferDraft, stated: boolean, draw: Rng) => {
    const product = productOf(line.productId)
    const size = product.unit === 'm' ? draw.pick([50, 100]) : 10
    const perUnit = line.pricePerUnit
    line.unit = product.unit === 'm' ? 'RG' : 'VE'
    line.qty = Math.ceil(line.qty / size)
    line.priceBasis = 1
    line.unitPrice = roundCents(perUnit * size)
    line.total = roundCents(line.qty * line.unitPrice)
    line.pricePerUnit = line.unitPrice / size
    line.packSize = size
    line.packStated = stated
    if (stated) {
      const wording = draw.pick(PACK_WORDING[product.unit === 'm' ? 'm' : 'St'])
      line.text = `${line.text} ${wording(size)}`
    }
    return { size, unit: line.unit, tenderUnit: product.unit }
  }
  for (const line of takeLines(a, TRAP_PLAN.UNIT_BASIS, packable)) {
    const { size, unit, tenderUnit } = quoteInPacks(line, false, trapRng)
    line.trap = {
      kind: 'UNIT_BASIS',
      note: `quoted per ${unit} without saying how much one holds (${size} ${tenderUnit}); the tender counts in ${tenderUnit}`,
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
      note: `price ${up ? 'ten times' : 'a tenth of'} what was meant`,
    }
  }
  const compared = (line: OfferDraft) =>
    line.positions.every((oz) => quotedBy(oz) >= 2) && line.unitPrice >= 1
  for (const line of [
    ...takeLines(
      a,
      TRAP_PLAN.PRICE_OUTLIER.a,
      (candidate) => candidate.positions.length === 1 && compared(candidate),
    ),
    ...takeLines(b, TRAP_PLAN.PRICE_OUTLIER.b, compared),
    ...takeLines(c, TRAP_PLAN.PRICE_OUTLIER.c, compared),
  ]) {
    outlier(line)
  }

  // QTY_MISMATCH: the supplier priced a different quantity than was asked,
  // by more than rounding up would explain.
  const countable = (candidate: OfferDraft) =>
    candidate.positions.length === 1 && candidate.qty >= 20
  for (const line of [
    ...takeLines(a, TRAP_PLAN.QTY_MISMATCH.a, countable),
    ...takeLines(c, TRAP_PLAN.QTY_MISMATCH.c, countable),
  ]) {
    const asked = line.qty
    const factor = trapRng.pick([0.1, 0.5, 3, 10])
    line.qty = Math.max(1, Math.round(asked * factor))
    line.total = roundCents((line.qty * line.unitPrice) / line.priceBasis)
    line.trap = {
      kind: 'QTY_MISMATCH',
      note: `tender asks for ${asked}, offer is for ${line.qty}`,
    }
  }

  // ALTERNATIVE_PRODUCT: another make, marked as such, a little cheaper.
  for (const line of [
    ...takeLines(
      a,
      TRAP_PLAN.ALTERNATIVE_PRODUCT.a,
      (candidate) => candidate.positions.length === 1,
    ),
    ...takeLines(b, TRAP_PLAN.ALTERNATIVE_PRODUCT.b),
  ]) {
    line.text = `${trapRng.pick(ALTERNATIVE_MARKS)} ${ALTERNATIVE_BRAND} ${line.text.replace(/^(Trennox|Lumfeld|Tastwerk|Quorix) /, '')}`
    line.articleNo =
      line.supplier === 'a'
        ? String(Number(line.articleNo) + 13)
        : `EM-${line.articleNo.replace(/^[A-Z]+-/, '')}`
    cheapen(line, 0.9)
    line.trap = {
      kind: 'ALTERNATIVE_PRODUCT',
      note: `offered as an alternative make (${ALTERNATIVE_BRAND})`,
    }
  }

  // AMBIGUOUS: two lines for one position, neither marked as an alternative.
  for (const line of takeLines(
    a,
    TRAP_PLAN.AMBIGUOUS,
    (candidate) => candidate.posRef !== null,
  )) {
    // Both lines name the position, so a reader finds both.
    const note = 'two lines answer this position at different prices'
    line.trap = { kind: 'AMBIGUOUS', note }
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
      note: `quantity times price is ${right.toFixed(2)}, the line total says ${line.total.toFixed(2)}`,
    }
  }

  // --- Harmless oddities ---------------------------------------------------
  // The same surface as a trap, with nothing wrong underneath. They go on
  // lines no trap touched; the position may still carry a trap elsewhere.
  const oddRng = rng.fork('oddities')
  const cleanLines = (
    lines: Array<OfferDraft>,
    count: number,
    accept: (line: OfferDraft) => boolean,
  ): Array<OfferDraft> =>
    oddRng.sample(
      lines.filter(
        (line) => line.trap === null && line.oddity === null && accept(line),
      ),
      count,
    )

  // PACK: rings and packs, with the size in the text.
  for (const line of cleanLines(a, ODDITY_PLAN.PACK, packable)) {
    quoteInPacks(line, true, oddRng)
    line.oddity = 'PACK'
  }

  // PE1000: the usual price unit times ten. Still exact.
  for (const line of cleanLines(
    a,
    ODDITY_PLAN.PE1000,
    (candidate) => candidate.priceBasis === 100,
  )) {
    line.priceBasis = 1000
    line.unitPrice = roundCents(line.unitPrice * 10)
    line.total = roundCents((line.qty * line.unitPrice) / 1000)
    line.pricePerUnit = line.unitPrice / 1000
    line.oddity = 'PE1000'
  }

  // ROUNDED: a few more than asked for, up to a round number.
  const roundedUp = (line: OfferDraft): number | null => {
    for (const step of line.unit === 'M' ? [50, 25, 10] : [10, 5]) {
      const up = Math.ceil(line.qty / step) * step
      if (up > line.qty && up <= line.qty * (1 + ROUNDING_ALLOWANCE)) return up
    }
    return null
  }
  for (const line of cleanLines(
    a,
    ODDITY_PLAN.ROUNDED,
    (candidate) =>
      candidate.positions.length === 1 && roundedUp(candidate) !== null,
  )) {
    line.qty = roundedUp(line) ?? line.qty
    line.total = roundCents((line.qty * line.unitPrice) / line.priceBasis)
    line.oddity = 'ROUNDED'
  }

  // SPLIT: one position on two lines, same article, same price.
  for (const line of cleanLines(
    a,
    ODDITY_PLAN.SPLIT,
    (candidate) =>
      candidate.positions.length === 1 &&
      candidate.posRef !== null &&
      candidate.qty >= 10,
  )) {
    const first = Math.round(line.qty * oddRng.pick([0.4, 0.5, 0.6]))
    const rest: OfferDraft = {
      ...line,
      positions: [...line.positions],
      qty: line.qty - first,
      oddity: 'SPLIT',
    }
    line.qty = first
    line.oddity = 'SPLIT'
    for (const part of [line, rest]) {
      part.total = roundCents((part.qty * part.unitPrice) / part.priceBasis)
    }
    a.splice(a.indexOf(line) + 1, 0, rest)
  }

  // CENTS: the total a cent or two off what quantity times price gives.
  const offByCents = (lines: Array<OfferDraft>, count: number) => {
    for (const line of cleanLines(
      lines,
      count,
      (candidate) => candidate.total >= 5,
    )) {
      line.total = roundCents(
        line.total + oddRng.pick([-0.02, -0.01, 0.01, 0.02]),
      )
      line.oddity = 'CENTS'
    }
  }
  offByCents(a, ODDITY_PLAN.CENTS.a)
  offByCents(b, ODDITY_PLAN.CENTS.b)
  offByCents(c, ODDITY_PLAN.CENTS.c)

  // --- Collect -------------------------------------------------------------
  const lines = { a, b, c }
  const traps: Array<PlantedTrap> = [...unquoted].sort().map((oz) => ({
    kind: 'NO_OFFER',
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
  answered: Array<TenderPosition>,
  pricePerUnit: number,
  withRef: boolean,
): OfferDraft {
  const basis = wholesalerBasis(product)
  const unitPrice = roundCents(pricePerUnit * basis)
  const qty = answered.reduce((sum, position) => sum + position.qty, 0)
  const [only] = answered
  return {
    supplier: 'a',
    positions: answered.map((position) => position.oz),
    productId: product.id,
    posRef: withRef && answered.length === 1 && only ? only.oz : null,
    articleNo: product.articleA,
    text: product.a,
    detail: null,
    heading: null,
    qty,
    unit: WHOLESALER_UNIT[product.unit] ?? product.unit,
    unitPrice,
    priceBasis: basis,
    listPrice: null,
    discountPct: null,
    total: roundCents((qty * unitPrice) / basis),
    pricePerUnit: unitPrice / basis,
    packSize: null,
    packStated: false,
    trap: null,
    oddity: null,
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
    packSize: null,
    packStated: false,
    trap: null,
    oddity: null,
  }
}
