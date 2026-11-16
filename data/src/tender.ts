/**
 * Builds the Leistungsverzeichnis: titles, subtitles and 1,170 positions,
 * each one a catalogue product with a quantity and the planner's wording.
 */
import { TENDER } from './names'
import type { GaebCategory, GaebDocument } from '@preisspiegel/core'
import type { Product, ProductGroup } from './catalog'
import type { Rng } from './rng'

export interface TenderPosition {
  oz: string
  seq: number
  /** Subtitle key, e.g. `03.02`. */
  section: string
  productId: string
  qty: number
  unit: string
  shortText: string
  longText: string
}

export const POSITION_COUNT = 1170

const FLOORS = [
  'Untergeschoss',
  'Erdgeschoss',
  '1. Obergeschoss',
  '2. Obergeschoss',
  '3. Obergeschoss',
  '4. Obergeschoss',
  '5. Obergeschoss',
] as const

type Pool = (product: Product) => boolean
const groups =
  (...wanted: Array<ProductGroup>): Pool =>
  (product) =>
    wanted.includes(product.group)
const ids =
  (...wanted: Array<string>): Pool =>
  (product) =>
    wanted.includes(product.id)
const any =
  (...pools: Array<Pool>): Pool =>
  (product) =>
    pools.some((pool) => pool(product))

interface Subtitle {
  label: string
  pool: Pool
  /** How many positions; `all` takes the whole pool. */
  count: number | 'all'
  /** Scales the usual quantities, e.g. for main routes. */
  scale?: number
  /** Fixed quantities by product id, where the tender is specific. */
  fixed?: Readonly<Record<string, number>>
  floor?: string
}

interface Title {
  label: string
  subtitles: Array<Subtitle>
}

const perFloor = (prefix: string, pool: Pool, count: number): Array<Subtitle> =>
  FLOORS.map((floor) => ({ label: `${prefix} ${floor}`, pool, count, floor }))

const cat7 = ids('data-cable-cat7-simplex', 'data-cable-cat7-duplex')
const fibre = ids('data-fibre-om4-12', 'data-fibre-om4-24')
const feeders = (product: Product) =>
  product.group === 'mcb' &&
  product.attrs.poles === 3 &&
  Number(product.attrs.ratedCurrentA) >= 40

const TITLES: Array<Title> = [
  {
    label: 'Baustrom und allgemeine Leistungen',
    subtitles: [
      {
        label: 'Baustromversorgung',
        pool: ids(
          'site-cabinet-250',
          'site-cabinet-63',
          'cable-nyyj-4x95',
          'cable-nyyj-5x16',
          'device-cee-32-ip67',
          'device-cee-16',
          'earth-surge-t2',
          'earth-bonding-bar-small',
        ),
        count: 'all',
        fixed: {
          'site-cabinet-250': 1,
          'site-cabinet-63': 3,
          'cable-nyyj-4x95': 60,
          'cable-nyyj-5x16': 120,
          'device-cee-32-ip67': 4,
          'device-cee-16': 8,
          'earth-surge-t2': 1,
          'earth-bonding-bar-small': 1,
        },
      },
      {
        label: 'Allgemeine Leistungen',
        pool: ids(
          'own-site-setup',
          'own-testing',
          'own-documentation',
          'own-handover',
        ),
        count: 'all',
      },
    ],
  },
  {
    label: 'Niederspannungshauptverteilung',
    subtitles: [
      {
        label: 'Felder und Einspeisung',
        pool: any(groups('main_board', 'mccb', 'isolator'), (product) =>
          product.id.startsWith('board-floor'),
        ),
        count: 12,
      },
      {
        label: 'Abgänge',
        pool: any(groups('mccb', 'isolator'), feeders),
        count: 14,
      },
      { label: 'Schutz und Messung', pool: groups('rcd', 'surge'), count: 8 },
    ],
  },
  {
    label: 'Unterverteilungen',
    subtitles: perFloor(
      'Unterverteilung',
      any(
        groups('mcb', 'rcd', 'rcbo', 'isolator'),
        (product) => product.id.startsWith('board-wall'),
        ids('earth-surge-t2', 'earth-surge-t3'),
      ),
      52,
    ),
  },
  {
    label: 'Kabel und Leitungen',
    subtitles: [
      {
        label: 'Hauptleitungen',
        pool: groups('cable.nyy', 'cable.single'),
        count: 12,
        scale: 1.5,
      },
      ...perFloor(
        'Leitungen',
        groups('cable.nym', 'cable.halogenfree', 'cable.fire', 'cable.single'),
        15,
      ),
    ],
  },
  {
    label: 'Verlegesysteme',
    subtitles: [
      {
        label: 'Haupttrassen und Steigzonen',
        pool: groups('routing.tray', 'routing.fitting'),
        count: 14,
        scale: 2,
      },
      ...perFloor(
        'Verlegesysteme',
        groups(
          'routing.tray',
          'routing.fitting',
          'routing.conduit',
          'routing.trunking',
        ),
        16,
      ),
    ],
  },
  {
    label: 'Installationsgeräte',
    subtitles: perFloor('Installationsgeräte', groups('device'), 27),
  },
  {
    label: 'Beleuchtung',
    subtitles: [
      ...perFloor('Beleuchtung', groups('luminaire'), 24),
      {
        label: 'Außenbeleuchtung',
        pool: groups('luminaire.outdoor'),
        count: 'all',
      },
    ],
  },
  {
    label: 'Sicherheitsbeleuchtung',
    subtitles: perFloor(
      'Sicherheitsbeleuchtung',
      groups('emergency', 'cable.fire'),
      9,
    ),
  },
  {
    label: 'Erdung, Blitz- und Überspannungsschutz',
    subtitles: [
      {
        label: 'Erdung und Potentialausgleich',
        pool: groups('earthing', 'cable.single'),
        count: 9,
      },
      {
        label: 'Äußerer Blitzschutz',
        pool: groups('lightning'),
        count: 'all',
        scale: 2,
      },
      { label: 'Überspannungsschutz', pool: groups('surge'), count: 'all' },
    ],
  },
  {
    label: 'Datennetz',
    subtitles: [
      {
        label: 'Zentrale Komponenten',
        pool: any(groups('data.rack', 'data.patch'), fibre),
        count: 10,
      },
      ...perFloor(
        'Datennetz',
        any(
          cat7,
          groups('data.outlet', 'data.patch'),
          ids('data-patch-panel-24', 'data-cable-manager'),
        ),
        9,
      ),
    ],
  },
  {
    label: 'Stundenlohnarbeiten',
    subtitles: [
      {
        label: 'Stundenlohnarbeiten',
        pool: ids('own-hours-foreman', 'own-hours-fitter', 'own-hours-helper'),
        count: 'all',
        fixed: {
          'own-hours-foreman': 40,
          'own-hours-fitter': 80,
          'own-hours-helper': 40,
        },
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Quantities
// ---------------------------------------------------------------------------

/** A plausible quantity for one position: a count, or a rounded length. */
function quantity(product: Product, rng: Rng, scale: number): number {
  const step = (min: number, max: number, size: number) =>
    Math.max(size, Math.round((rng.int(min, max) * scale) / size) * size)
  const count = (min: number, max: number) =>
    Math.max(1, Math.round(rng.int(min, max) * scale))

  const section = Number(product.attrs.crossSectionMm2 ?? 0)
  switch (product.group) {
    case 'mcb':
      return count(2, 36)
    case 'rcd':
      return count(1, 8)
    case 'rcbo':
      return count(2, 24)
    case 'mccb':
    case 'isolator':
      return count(1, 3)
    case 'site_cabinet':
    case 'main_board':
      return 1
    case 'board':
      return count(1, 2)
    case 'cable.nym':
    case 'cable.halogenfree':
    case 'cable.nyy':
      if (section <= 2.5) return step(300, 1800, 10)
      if (section <= 6) return step(80, 600, 10)
      if (section <= 16) return step(40, 300, 5)
      if (section <= 50) return step(30, 180, 5)
      return step(20, 120, 5)
    case 'cable.fire':
      return step(100, 500, 10)
    case 'cable.single':
      return step(40, 260, 10)
    case 'routing.tray':
      return step(20, 160, 5)
    case 'routing.fitting':
      return count(2, 18)
    case 'routing.conduit':
      return step(60, 500, 10)
    case 'routing.trunking':
      return step(15, 120, 5)
    case 'device':
      if (product.id.includes('frame')) return count(20, 140)
      if (product.id.includes('wall-box')) return step(40, 260, 10)
      if (product.id.includes('junction')) return count(10, 80)
      if (product.id.includes('socket')) return count(12, 90)
      if (product.id.includes('detector')) return count(2, 18)
      if (product.id.includes('cee')) return count(1, 6)
      if (product.id.includes('floor-box')) return count(4, 24)
      return count(4, 40)
    case 'luminaire':
      if (product.id.includes('panel')) return count(8, 64)
      if (product.id.includes('downlight')) return count(6, 40)
      if (product.id.includes('rail')) return count(6, 30)
      return count(2, 24)
    case 'luminaire.outdoor':
      return count(2, 10)
    case 'emergency':
      return count(2, 14)
    case 'data.cable':
      return product.id.includes('fibre')
        ? step(60, 300, 10)
        : step(800, 3500, 50)
    case 'data.outlet':
      return count(10, 60)
    case 'data.rack':
      if (product.id.includes('rack-')) return count(1, 2)
      if (product.id.includes('panel') || product.id.includes('splice')) {
        return count(1, 4)
      }
      return count(2, 6)
    case 'data.patch':
      return step(20, 120, 10)
    case 'earthing':
      if (product.unit === 'm') return step(60, 280, 10)
      if (product.id.includes('bar')) return count(1, 3)
      if (product.id.includes('lug')) return count(4, 16)
      return count(6, 40)
    case 'lightning':
      if (product.unit === 'm') return step(80, 400, 10)
      if (product.id.includes('holder')) return step(60, 300, 10)
      if (product.id.includes('terminal')) return count(4, 16)
      return count(6, 40)
    case 'surge':
      return count(1, 4)
    case 'own_work':
      return 1
  }
}

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

/** Planners do not all write the same sentence. Each position picks its own. */
const SYNONYMS: ReadonlyArray<ReadonlyArray<string>> = [
  [
    'liefern, einbauen und anschließen.',
    'liefern, montieren und betriebsfertig anschließen.',
    'einschließlich Lieferung, Einbau und Anschluss.',
  ],
  [
    'liefern, montieren und anschließen.',
    'liefern, montieren und betriebsfertig anschließen.',
    'einschließlich Lieferung, Montage und Anschluss.',
  ],
  ['liefern und montieren.', 'liefern und fachgerecht montieren.'],
  ['liefern und verlegen.', 'liefern und fachgerecht verlegen.'],
  ['Bemessungsstrom', 'Nennstrom'],
  ['Schutzart IP ', 'Schutzart IP'],
]

function wording(
  product: Product,
  floor: string | undefined,
  rng: Rng,
): string {
  let text = product.long.join(' ')
  for (const options of SYNONYMS) {
    const [canonical] = options
    if (canonical !== undefined && text.includes(canonical)) {
      text = text.replaceAll(canonical, rng.pick(options))
    }
  }
  return floor !== undefined && rng.chance(0.35)
    ? `${text}\nEinbauort: ${floor}.`
    : text
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

const two = (value: number) => String(value).padStart(2, '0')

export function buildTender(
  catalog: Array<Product>,
  rng: Rng,
): { positions: Array<TenderPosition>; gaeb: GaebDocument } {
  const positions: Array<TenderPosition> = []
  const categories: Array<GaebCategory> = []

  TITLES.forEach((title, titleIndex) => {
    const titleNo = two(titleIndex + 1)
    const titleCategory: GaebCategory = {
      id: `T${titleNo}`,
      rno: titleNo,
      label: title.label,
      categories: [],
      items: [],
    }

    title.subtitles.forEach((subtitle, subtitleIndex) => {
      const subtitleNo = two(subtitleIndex + 1)
      const section = `${titleNo}.${subtitleNo}`
      const draw = rng.fork(`tender/${section}`)

      const pool = catalog.filter(subtitle.pool)
      const chosen =
        subtitle.count === 'all' ? pool : draw.sample(pool, subtitle.count)
      if (chosen.length === 0) {
        throw new Error(`Subtitle ${section} "${subtitle.label}" is empty.`)
      }

      const subtitleCategory: GaebCategory = {
        id: `T${titleNo}U${subtitleNo}`,
        rno: subtitleNo,
        label: subtitle.label,
        categories: [],
        items: [],
      }

      chosen.forEach((product, index) => {
        const itemNo = String((index + 1) * 10).padStart(4, '0')
        const seq = positions.length
        const position: TenderPosition = {
          oz: `${section}.${itemNo}`,
          seq,
          section,
          productId: product.id,
          qty:
            subtitle.fixed?.[product.id] ??
            quantity(product, draw, subtitle.scale ?? 1),
          unit: product.unit,
          shortText: product.short,
          longText: wording(product, subtitle.floor, draw),
        }
        positions.push(position)
        subtitleCategory.items.push({
          id: `P${String(seq + 1).padStart(4, '0')}`,
          rno: itemNo,
          qty: position.qty,
          unit: position.unit,
          shortText: position.shortText,
          longText: position.longText,
        })
      })

      titleCategory.categories.push(subtitleCategory)
    })

    categories.push(titleCategory)
  })

  if (positions.length !== POSITION_COUNT) {
    throw new Error(
      `The tender has ${positions.length} positions, expected ${POSITION_COUNT}.`,
    )
  }

  return {
    positions,
    gaeb: {
      phase: 83,
      date: TENDER.issued,
      time: '09:30:00',
      program: { system: 'Preisspiegel Demo', name: 'Tender generator 1.0' },
      project: {
        name: TENDER.projectNo,
        label: TENDER.project,
        currency: 'EUR',
      },
      boq: {
        id: 'LV1',
        name: TENDER.lot,
        label: `${TENDER.project}, ${TENDER.lot}`,
        date: TENDER.issued,
        levels: [
          { type: 'BoQLevel', label: 'Titel', length: 2 },
          { type: 'BoQLevel', label: 'Untertitel', length: 2 },
          { type: 'Item', length: 4 },
        ],
        categories,
        items: [],
      },
    },
  }
}
