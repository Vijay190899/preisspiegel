/**
 * The product catalogue behind the synthetic tender.
 *
 * Each product carries three wordings of the same thing: how a planner writes
 * it in a Leistungsverzeichnis, how a wholesaler abbreviates it on an offer,
 * and how a manufacturer lists it. Matching across those wordings is the work
 * the pipeline has to do.
 *
 * Everything here is invented: brands, article numbers, prices and labor
 * minutes are plausible, not taken from any real catalogue or price list.
 */
import { formatGermanNumber } from '@preisspiegel/core'

export type Unit = 'St' | 'm' | 'h' | 'psch'

export type ProductGroup =
  | 'mcb'
  | 'rcd'
  | 'rcbo'
  | 'mccb'
  | 'isolator'
  | 'site_cabinet'
  | 'board'
  | 'main_board'
  | 'cable.nym'
  | 'cable.nyy'
  | 'cable.halogenfree'
  | 'cable.fire'
  | 'cable.single'
  | 'routing.tray'
  | 'routing.fitting'
  | 'routing.conduit'
  | 'routing.trunking'
  | 'device'
  | 'luminaire'
  | 'luminaire.outdoor'
  | 'emergency'
  | 'data.cable'
  | 'data.outlet'
  | 'data.rack'
  | 'data.patch'
  | 'earthing'
  | 'lightning'
  | 'surge'
  | 'own_work'

export type AttrValue = string | number | boolean

export interface Product {
  id: string
  group: ProductGroup
  attrs: Record<string, AttrValue>
  /** Attributes where a different value means a different product. */
  critical: Array<string>
  unit: Unit
  /** Reference net price per unit in EUR. */
  price: number
  /** Key into the labor time table. */
  zeitwert: string
  /** Tender wording. */
  short: string
  long: Array<string>
  /** Wholesaler shorthand. */
  a: string
  /** Manufacturer listing: a name line and a detail line. */
  b: { name: string; detail: string }
  articleA: string
  articleB: string
}

export interface Zeitwert {
  key: string
  label: string
  unit: Unit
  /** Minutes of labor per unit. */
  minutes: number
}

/** The contractor's own labor time table. Invented, like the prices. */
export const ZEITWERTE: ReadonlyArray<Zeitwert> = [
  z('mcb.1p', 'Leitungsschutzschalter 1-polig einbauen', 'St', 6),
  z('mcb.3p', 'Leitungsschutzschalter 3-polig einbauen', 'St', 12),
  z('rcd.2p', 'Fehlerstrom-Schutzschalter 2-polig einbauen', 'St', 15),
  z('rcd.4p', 'Fehlerstrom-Schutzschalter 4-polig einbauen', 'St', 20),
  z('rcbo', 'FI/LS-Schalter einbauen', 'St', 12),
  z('mccb.small', 'Leistungsschalter bis 250 A einbauen', 'St', 60),
  z('mccb.large', 'Leistungsschalter über 250 A einbauen', 'St', 120),
  z('isolator', 'Lasttrennschalter einbauen', 'St', 30),
  z('site_cabinet', 'Anschlussverteilerschrank aufstellen', 'St', 240),
  z('board.wall', 'Wandverteiler montieren', 'St', 75),
  z('board.floor', 'Standverteiler aufstellen', 'St', 240),
  z('main_board', 'NSHV-Feld aufstellen und verbinden', 'St', 480),
  z('cable.s', 'Leitung bis 2,5 mm² verlegen', 'm', 2.5),
  z('cable.m', 'Leitung 4 bis 6 mm² verlegen', 'm', 3.5),
  z('cable.l', 'Kabel 10 bis 16 mm² verlegen', 'm', 5),
  z('cable.xl', 'Kabel 25 bis 50 mm² verlegen', 'm', 8),
  z('cable.xxl', 'Kabel 70 bis 95 mm² verlegen', 'm', 12),
  z('cable.xxxl', 'Kabel ab 120 mm² verlegen', 'm', 16),
  z('tray.s', 'Kabelrinne bis 200 mm montieren', 'm', 12),
  z('tray.l', 'Kabelrinne über 200 mm montieren', 'm', 18),
  z('tray.fitting', 'Formteil Kabelrinne montieren', 'St', 15),
  z('conduit', 'Installationsrohr verlegen', 'm', 4.5),
  z('trunking', 'Installationskanal montieren', 'm', 10),
  z('device', 'Installationsgerät einbauen', 'St', 12),
  z('device.box', 'Dose setzen', 'St', 6),
  z('device.frame', 'Abdeckrahmen aufsetzen', 'St', 2),
  z('device.cee', 'CEE-Steckdose montieren', 'St', 25),
  z('device.sensor', 'Melder montieren und einstellen', 'St', 25),
  z('device.floorbox', 'Bodentank einbauen', 'St', 60),
  z('luminaire', 'Leuchte montieren und anschließen', 'St', 25),
  z('luminaire.pendant', 'Pendelleuchte montieren', 'St', 40),
  z('luminaire.rail', 'Lichtband-Tragschiene montieren', 'St', 20),
  z('emergency', 'Sicherheitsleuchte montieren', 'St', 25),
  z('data.cable', 'Datenkabel verlegen', 'm', 2.5),
  z('data.outlet', 'Datendose montieren und auflegen', 'St', 30),
  z('data.panel', 'Patchpanel montieren und auflegen', 'St', 120),
  z('data.rack', 'Netzwerkschrank aufstellen', 'St', 210),
  z('data.patch', 'Patchkabel stecken', 'St', 1),
  z('data.accessory', 'Schrankzubehör einbauen', 'St', 10),
  z('earth.bar', 'Potentialausgleichsschiene montieren', 'St', 45),
  z('earth.strip', 'Erder oder Ableitung verlegen', 'm', 7),
  z('earth.part', 'Verbinder oder Halter montieren', 'St', 6),
  z('earth.rod', 'Fangstange oder Anschlussfahne setzen', 'St', 25),
  z('surge', 'Überspannungsschutz einbauen', 'St', 30),
]

function z(key: string, label: string, unit: Unit, minutes: number): Zeitwert {
  return { key, label, unit, minutes }
}

/** Invented brands. Any resemblance to a real company is coincidental. */
const BRAND = {
  switchgear: 'Trennox',
  lighting: 'Lumfeld',
  device: 'Tastwerk',
  data: 'Quorix',
} as const

const de = (value: number, decimals: number = 0) =>
  formatGermanNumber(value, decimals)
/** Cross-sections read `1,5`, `2,5`, `16`. */
const mm2 = (value: number) => de(value, Number.isInteger(value) ? 0 : 1)
const cents = (value: number) => Math.round(value * 100) / 100

type Draft = Omit<Product, 'articleA' | 'articleB'> & { codeB: string }

export function buildCatalog(): Array<Product> {
  const drafts: Array<Draft> = [
    ...breakers(),
    ...cabinets(),
    ...cables(),
    ...routing(),
    ...devices(),
    ...luminaires(),
    ...emergency(),
    ...dataNetwork(),
    ...earthing(),
    ...ownWork(),
  ]

  const seen = new Set<string>()
  return drafts.map(({ codeB, ...draft }) => {
    if (seen.has(draft.id)) throw new Error(`duplicate product ${draft.id}`)
    seen.add(draft.id)
    return {
      ...draft,
      price: cents(draft.price),
      articleA: String(1_000_000 + (fnv(draft.id) % 8_999_999)),
      articleB: codeB,
    }
  })
}

function fnv(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// ---------------------------------------------------------------------------
// Switchgear
// ---------------------------------------------------------------------------

function breakers(): Array<Draft> {
  const out: Array<Draft> = []

  for (const char of ['B', 'C'] as const) {
    for (const amps of [6, 10, 13, 16, 20, 25, 32, 40, 50, 63]) {
      for (const poles of [1, 3] as const) {
        const ka = poles === 1 ? 6 : 10
        out.push({
          id: `mcb-${char.toLowerCase()}${amps}-${poles}p`,
          group: 'mcb',
          attrs: {
            characteristic: char,
            ratedCurrentA: amps,
            poles,
            breakingCapacityKa: ka,
          },
          critical: ['characteristic', 'ratedCurrentA', 'poles'],
          unit: 'St',
          price:
            (poles === 1 ? 3.2 + 0.04 * amps : 14 + 0.25 * amps) *
            (char === 'C' ? 1.05 : 1),
          zeitwert: `mcb.${poles}p`,
          short: `Leitungsschutzschalter ${char}${amps}, ${poles}-polig`,
          long: [
            'Leitungsschutzschalter nach DIN EN 60898-1,',
            `Auslösecharakteristik ${char}, Bemessungsstrom ${amps} A, ${poles}-polig,`,
            `Bemessungsschaltvermögen ${ka} kA,`,
            'für Montage auf Tragschiene TH 35,',
            'liefern, einbauen und anschließen.',
          ],
          a: `LS-Schalter ${char}${amps} ${poles}p ${ka}kA`,
          b: {
            name: `${BRAND.switchgear} Leitungsschutzschalter LS${ka}`,
            detail: `${char} ${amps} A · ${poles}-polig · ${ka} kA`,
          },
          codeB: `TX-LS${ka}-${char}${amps}-${poles}`,
        })
      }
    }
  }

  const rcd = (amps: number, ma: number, poles: 2 | 4, type: 'A' | 'B') => {
    const fault = de(ma / 1000, 2)
    out.push({
      id: `rcd-${amps}-${ma}-${poles}p-${type.toLowerCase()}`,
      group: 'rcd',
      attrs: {
        ratedCurrentA: amps,
        residualCurrentMa: ma,
        poles,
        rcdType: type,
      },
      critical: ['ratedCurrentA', 'residualCurrentMa', 'poles', 'rcdType'],
      unit: 'St',
      price:
        (poles === 2 ? 28 + 0.3 * amps : 38 + 0.45 * amps) *
        (ma === 300 ? 1.1 : 1) *
        (type === 'B' ? 4.5 : 1),
      zeitwert: `rcd.${poles}p`,
      short: `Fehlerstrom-Schutzschalter ${amps} A / ${ma} mA, ${poles}-polig, Typ ${type}`,
      long: [
        'Fehlerstrom-Schutzschalter (RCCB) nach DIN EN 61008-1,',
        `Bemessungsstrom ${amps} A, Bemessungsfehlerstrom ${ma} mA, ${poles}-polig,`,
        type === 'B' ? 'Typ B, allstromsensitiv,' : 'Typ A, pulsstromsensitiv,',
        'für Montage auf Tragschiene TH 35,',
        'liefern, einbauen und anschließen.',
      ],
      a: `FI-Schalter ${amps}/${fault}A ${poles}p Typ ${type}`,
      b: {
        name: `${BRAND.switchgear} FI-Schutzschalter FI`,
        detail: `${amps} A · ${ma} mA · ${poles}-polig · Typ ${type}`,
      },
      codeB: `TX-FI-${amps}-${ma}-${poles}${type}`,
    })
  }
  for (const amps of [25, 40, 63]) {
    for (const ma of [30, 300]) {
      for (const poles of [2, 4] as const) rcd(amps, ma, poles, 'A')
    }
  }
  rcd(40, 30, 4, 'B')
  rcd(63, 30, 4, 'B')

  for (const char of ['B', 'C'] as const) {
    for (const amps of [10, 16, 20]) {
      out.push({
        id: `rcbo-${char.toLowerCase()}${amps}`,
        group: 'rcbo',
        attrs: {
          characteristic: char,
          ratedCurrentA: amps,
          residualCurrentMa: 30,
        },
        critical: ['characteristic', 'ratedCurrentA'],
        unit: 'St',
        price: 32 + 0.3 * amps,
        zeitwert: 'rcbo',
        short: `FI/LS-Schalter ${char}${amps} / 30 mA, 1-polig + N`,
        long: [
          'Kombinierter Fehlerstrom-/Leitungsschutzschalter (RCBO) nach DIN EN 61009-1,',
          `Auslösecharakteristik ${char}, Bemessungsstrom ${amps} A,`,
          'Bemessungsfehlerstrom 30 mA, Typ A, 1-polig + N, Schaltvermögen 6 kA,',
          'liefern, einbauen und anschließen.',
        ],
        a: `FI/LS ${char}${amps}/0,03A 1+N Typ A 6kA`,
        b: {
          name: `${BRAND.switchgear} FI/LS-Kombination FL6`,
          detail: `${char} ${amps} A · 30 mA · 1+N · Typ A`,
        },
        codeB: `TX-FL6-${char}${amps}-30`,
      })
    }
  }

  for (const amps of [100, 160, 250, 400, 630]) {
    for (const poles of [3, 4] as const) {
      const ka = amps <= 250 ? 36 : 50
      out.push({
        id: `mccb-${amps}-${poles}p`,
        group: 'mccb',
        attrs: { ratedCurrentA: amps, poles, breakingCapacityKa: ka },
        critical: ['ratedCurrentA', 'poles'],
        unit: 'St',
        price: (180 + 1.6 * amps) * (poles === 4 ? 1.25 : 1),
        zeitwert: amps <= 250 ? 'mccb.small' : 'mccb.large',
        short: `Kompaktleistungsschalter ${amps} A, ${poles}-polig, ${ka} kA`,
        long: [
          'Kompaktleistungsschalter (MCCB) nach DIN EN 60947-2,',
          `Bemessungsstrom ${amps} A, ${poles}-polig, Bemessungsgrenzkurzschlussausschaltvermögen ${ka} kA,`,
          'mit thermisch-magnetischem Auslöser, einstellbar,',
          'einschließlich Anschlussklemmen, liefern, einbauen und anschließen.',
        ],
        a: `Leistungsschalter MCCB ${amps}A ${poles}p ${ka}kA TM`,
        b: {
          name: `${BRAND.switchgear} Kompaktleistungsschalter KL`,
          detail: `${amps} A · ${poles}-polig · ${ka} kA · TM-Auslöser`,
        },
        codeB: `TX-KL-${amps}-${poles}`,
      })
    }
  }

  for (const amps of [63, 100, 160]) {
    out.push({
      id: `isolator-${amps}`,
      group: 'isolator',
      attrs: { ratedCurrentA: amps, poles: 3 },
      critical: ['ratedCurrentA'],
      unit: 'St',
      price: 45 + 0.8 * amps,
      zeitwert: 'isolator',
      short: `Lasttrennschalter ${amps} A, 3-polig`,
      long: [
        'Lasttrennschalter nach DIN EN 60947-3,',
        `Bemessungsstrom ${amps} A, 3-polig, als Hauptschalter,`,
        'für Montage auf Tragschiene, liefern, einbauen und anschließen.',
      ],
      a: `Lasttrennschalter ${amps}A 3p Hutschiene`,
      b: {
        name: `${BRAND.switchgear} Lasttrennschalter LT`,
        detail: `${amps} A · 3-polig`,
      },
      codeB: `TX-LT-${amps}-3`,
    })
  }

  return out
}

// ---------------------------------------------------------------------------
// Cabinets and boards
// ---------------------------------------------------------------------------

/**
 * Site distribution cabinets are sold by apparent power. A tender asks for a
 * current. S = √3 · 400 V · I, so 250 A is the 173 kVA size and 200 A the
 * 138 kVA size.
 */
export const SITE_CABINET_KVA: Readonly<Record<number, number>> = {
  63: 44,
  100: 69,
  160: 110,
  200: 138,
  250: 173,
  400: 277,
}

function cabinets(): Array<Draft> {
  const out: Array<Draft> = []

  for (const [ampsText, kva] of Object.entries(SITE_CABINET_KVA)) {
    const amps = Number(ampsText)
    out.push({
      id: `site-cabinet-${amps}`,
      group: 'site_cabinet',
      attrs: { ratedCurrentA: amps, ratedPowerKva: kva, ipRating: 'IP44' },
      critical: ['ratedCurrentA'],
      unit: 'St',
      price: 1800 + 14 * amps,
      zeitwert: 'site_cabinet',
      short: `Anschlussverteilerschrank ${amps} A für Baustrom`,
      long: [
        'Anschlussverteilerschrank für die Baustromversorgung nach DIN EN 61439-4,',
        `Bemessungsstrom ${amps} A, Anschluss 400 V / 50 Hz,`,
        'mit Zählerplatz, NH-Sicherungslasttrennschalter und abschließbarer Tür,',
        'Schutzart IP 44,',
        'liefern, aufstellen und anschließen, Vorhaltung für die Dauer der Bauzeit.',
      ],
      a: `Anschlussschrank AVS ${kva} kVA m. Zählerplatz IP44`,
      b: {
        name: `${BRAND.switchgear} Baustrom-Anschlussverteiler AV ${kva}`,
        detail: `${kva} kVA · 400 V · IP 44 · Zählerplatz`,
      },
      codeB: `TX-AV-${kva}`,
    })
  }

  for (const rows of [3, 4, 5]) {
    for (const ip of ['IP30', 'IP54'] as const) {
      const te = rows * 12
      const ipText = `IP ${ip.slice(2)}`
      out.push({
        id: `board-wall-${rows}r-${ip.toLowerCase()}`,
        group: 'board',
        attrs: { rows, moduleWidths: te, ipRating: ip },
        critical: ['rows', 'ipRating'],
        unit: 'St',
        price: (60 + 45 * rows) * (ip === 'IP54' ? 1.5 : 1),
        zeitwert: 'board.wall',
        short: `Wandverteiler Aufputz, ${rows}-reihig, ${te} TE, ${ipText}`,
        long: [
          'Installationskleinverteiler für Aufputzmontage nach DIN EN 61439-3,',
          `${rows}-reihig, ${te} Teilungseinheiten, Schutzart ${ipText}, Schutzklasse II,`,
          'mit Tür, N- und PE-Klemmen sowie Tragschienen,',
          'liefern, montieren und beschriften.',
        ],
        a: `Kleinverteiler AP ${rows}-reihig ${te}TE ${ip} m. Tür`,
        b: {
          name: `${BRAND.switchgear} Wandverteiler WV`,
          detail: `${rows}-reihig · ${te} TE · ${ipText} · SK II`,
        },
        codeB: `TX-WV-${rows}-${ip.slice(2)}`,
      })
    }
  }

  for (const [width, price] of [
    [600, 920],
    [800, 1180],
    [1050, 1490],
  ] as const) {
    out.push({
      id: `board-floor-${width}`,
      group: 'board',
      attrs: { widthMm: width, heightMm: 2000, ipRating: 'IP54' },
      critical: ['widthMm'],
      unit: 'St',
      price,
      zeitwert: 'board.floor',
      short: `Standverteiler 2000 x ${width} x 400 mm, IP 54`,
      long: [
        'Standverteiler als Stahlblechgehäuse nach DIN EN 61439-2,',
        `Abmessungen H x B x T 2000 x ${width} x 400 mm, Schutzart IP 54,`,
        'mit Montageplatte, Sockel 100 mm und Schwenkhebelverschluss,',
        'liefern, aufstellen und ausrichten.',
      ],
      a: `Standverteiler 2000x${width}x400 IP54 Stahlbl.`,
      b: {
        name: `${BRAND.switchgear} Standverteiler SV`,
        detail: `2000 x ${width} x 400 mm · IP 54 · Sockel 100`,
      },
      codeB: `TX-SV-20${width}`,
    })
  }

  for (const [amps, price] of [
    [400, 3600],
    [630, 4900],
    [1000, 7400],
  ] as const) {
    out.push({
      id: `main-board-${amps}`,
      group: 'main_board',
      attrs: { ratedCurrentA: amps },
      critical: ['ratedCurrentA'],
      unit: 'St',
      price,
      zeitwert: 'main_board',
      short: `Niederspannungshauptverteilung, Feld ${amps} A`,
      long: [
        'Feld für Niederspannungshauptverteilung nach DIN EN 61439-2,',
        `Sammelschienensystem Bemessungsstrom ${de(amps)} A, 4-polig, Kupfer,`,
        'Innere Unterteilung Form 2b, Schutzart IP 31, Stahlblech pulverbeschichtet,',
        'liefern, aufstellen, mit den Nachbarfeldern verbinden und beschriften.',
      ],
      a: `NSHV-Feld ${amps}A 4p Cu Form 2b IP31`,
      b: {
        name: `${BRAND.switchgear} Hauptverteilerfeld HV`,
        detail: `${de(amps)} A · 4-polig · Form 2b · IP 31`,
      },
      codeB: `TX-HV-${amps}`,
    })
  }

  return out
}

// ---------------------------------------------------------------------------
// Cables
// ---------------------------------------------------------------------------

function cables(): Array<Draft> {
  const out: Array<Draft> = []

  const cable = (spec: {
    type: string
    group: ProductGroup
    cores: number
    section: number
    title: string
    norm: string
    reel: string
    extra?: string
  }) => {
    const { type, cores, section } = spec
    const size = `${cores}x${mm2(section)}`
    const copper = Math.round(cores * section * 9.6)
    const zeitwert =
      section <= 2.5
        ? 'cable.s'
        : section <= 6
          ? 'cable.m'
          : section <= 16
            ? 'cable.l'
            : section <= 50
              ? 'cable.xl'
              : section <= 95
                ? 'cable.xxl'
                : 'cable.xxxl'
    out.push({
      id: `cable-${type.toLowerCase().replace(/[^a-z0-9]/g, '')}-${cores}x${String(section).replace('.', '_')}`,
      group: spec.group,
      attrs: {
        cableType: type,
        cores,
        crossSectionMm2: section,
        copperKgPerKm: copper,
      },
      critical: ['cableType', 'cores', 'crossSectionMm2'],
      unit: 'm',
      price:
        (copper / 1000) * 9.5 +
        0.2 +
        0.07 * cores +
        (spec.extra === undefined ? 0 : 0.9),
      zeitwert,
      short: `${spec.title} ${type} ${size} mm²`,
      long: [
        `${spec.title} ${type} ${size} mm² nach ${spec.norm},`,
        ...(spec.extra === undefined ? [] : [`${spec.extra},`]),
        'auf vorhandener Kabelrinne oder in Rohr verlegen,',
        'einschließlich Befestigungsmaterial, beidseitig anschließen.',
      ],
      a: `${type} ${size.toUpperCase()} ${spec.reel}`,
      b: {
        name: `${spec.title} ${type}`,
        detail: `${size} mm² · ${spec.reel}`,
      },
      codeB: `KB-${type.replace(/[^A-Z0-9]/g, '')}-${cores}X${String(section).replace('.', '')}`,
    })
  }

  for (const [cores, section] of [
    [3, 1.5],
    [3, 2.5],
    [5, 1.5],
    [5, 2.5],
    [5, 4],
    [5, 6],
    [5, 10],
    [5, 16],
  ] as const) {
    cable({
      type: 'NYM-J',
      group: 'cable.nym',
      cores,
      section,
      title: 'Mantelleitung',
      norm: 'DIN VDE 0250-204',
      reel: section <= 2.5 ? 'RG100' : 'TR500',
    })
  }

  for (const [cores, section] of [
    [5, 16],
    [5, 25],
    [5, 35],
    [5, 50],
    [4, 70],
    [4, 95],
    [4, 120],
    [4, 150],
    [4, 185],
  ] as const) {
    cable({
      type: 'NYY-J',
      group: 'cable.nyy',
      cores,
      section,
      title: 'Starkstromkabel',
      norm: 'DIN VDE 0276-603',
      reel: 'SM TR500',
    })
  }

  for (const [cores, section] of [
    [3, 1.5],
    [3, 2.5],
    [5, 2.5],
    [5, 6],
  ] as const) {
    cable({
      type: 'NHXMH-J',
      group: 'cable.halogenfree',
      cores,
      section,
      title: 'Halogenfreie Mantelleitung',
      norm: 'DIN VDE 0250-214',
      reel: 'TR500',
    })
  }

  for (const [cores, section] of [
    [3, 1.5],
    [5, 2.5],
  ] as const) {
    cable({
      type: 'NHXH-J FE180/E30',
      group: 'cable.fire',
      cores,
      section,
      title: 'Sicherheitskabel',
      norm: 'DIN VDE 0266',
      reel: 'TR500',
      extra: 'mit Funktionserhalt E30 nach DIN 4102-12',
    })
  }

  for (const section of [6, 10, 16, 25]) {
    cable({
      type: 'H07V-K',
      group: 'cable.single',
      cores: 1,
      section,
      title: 'Aderleitung grün-gelb',
      norm: 'DIN EN 50525-2-31',
      reel: 'RG100',
    })
  }

  return out
}

// ---------------------------------------------------------------------------
// Trays, conduits, trunking
// ---------------------------------------------------------------------------

function routing(): Array<Draft> {
  const out: Array<Draft> = []

  for (const [height, widths] of [
    [60, [100, 200, 300, 400, 500]],
    [85, [200, 300, 400]],
  ] as const) {
    for (const width of widths) {
      out.push({
        id: `tray-${height}x${width}`,
        group: 'routing.tray',
        attrs: { heightMm: height, widthMm: width, finish: 'bandverzinkt' },
        critical: ['heightMm', 'widthMm'],
        unit: 'm',
        price: (4 + 0.03 * width) * (height === 85 ? 1.25 : 1),
        zeitwert: width <= 200 ? 'tray.s' : 'tray.l',
        short: `Kabelrinne ${height} x ${width} mm, gelocht, bandverzinkt`,
        long: [
          `Kabelrinne aus Stahlblech, gelocht, bandverzinkt nach DIN EN 10346,`,
          `Holmhöhe ${height} mm, Breite ${width} mm,`,
          'einschließlich Verbinder, Ausleger und Befestigung an der Rohdecke,',
          'liefern und montieren.',
        ],
        a: `Kabelrinne ${height}x${width} gel. bandverz. 3m`,
        b: {
          name: 'Kabelrinne RK gelocht',
          detail: `${height} x ${width} mm · bandverzinkt · Länge 3 m`,
        },
        codeB: `RX-RK-${height}-${width}`,
      })
    }
  }

  for (const width of [100, 200, 300]) {
    out.push({
      id: `mesh-tray-${width}`,
      group: 'routing.tray',
      attrs: { heightMm: 55, widthMm: width, finish: 'galvanisch verzinkt' },
      critical: ['widthMm'],
      unit: 'm',
      price: 5.5 + 0.035 * width,
      zeitwert: width <= 200 ? 'tray.s' : 'tray.l',
      short: `Gitterrinne 55 x ${width} mm, galvanisch verzinkt`,
      long: [
        'Gitterrinne aus Stahldraht, galvanisch verzinkt,',
        `Höhe 55 mm, Breite ${width} mm,`,
        'einschließlich Verbinder und Deckenabhängung,',
        'liefern und montieren.',
      ],
      a: `Gitterrinne 55x${width} galv. verz. 3m`,
      b: {
        name: 'Gitterrinne GR',
        detail: `55 x ${width} mm · galvanisch verzinkt · Länge 3 m`,
      },
      codeB: `RX-GR-55-${width}`,
    })
  }

  for (const width of [100, 200, 300]) {
    out.push({
      id: `tray-bend-${width}`,
      group: 'routing.fitting',
      attrs: { heightMm: 60, widthMm: width, fitting: 'Bogen 90°' },
      critical: ['widthMm', 'fitting'],
      unit: 'St',
      price: 9 + 0.05 * width,
      zeitwert: 'tray.fitting',
      short: `Bogen 90° für Kabelrinne 60 x ${width} mm`,
      long: [
        `Bogen 90° als Formteil für Kabelrinne 60 x ${width} mm,`,
        'bandverzinkt, einschließlich Verbindungsmaterial,',
        'liefern und montieren.',
      ],
      a: `Rinnenbogen 90Gr 60x${width} bandverz.`,
      b: {
        name: 'Bogen 90° RKB',
        detail: `für Kabelrinne 60 x ${width} mm · bandverzinkt`,
      },
      codeB: `RX-RKB-60-${width}`,
    })
  }

  for (const width of [200, 300]) {
    out.push({
      id: `tray-tee-${width}`,
      group: 'routing.fitting',
      attrs: { heightMm: 60, widthMm: width, fitting: 'T-Stück' },
      critical: ['widthMm', 'fitting'],
      unit: 'St',
      price: 14 + 0.06 * width,
      zeitwert: 'tray.fitting',
      short: `T-Stück für Kabelrinne 60 x ${width} mm`,
      long: [
        `T-Stück als Formteil für Kabelrinne 60 x ${width} mm,`,
        'bandverzinkt, einschließlich Verbindungsmaterial,',
        'liefern und montieren.',
      ],
      a: `Rinnen-T-Stück 60x${width} bandverz.`,
      b: {
        name: 'T-Stück RKT',
        detail: `für Kabelrinne 60 x ${width} mm · bandverzinkt`,
      },
      codeB: `RX-RKT-60-${width}`,
    })
  }

  for (const size of [20, 25, 32, 40]) {
    out.push({
      id: `conduit-rigid-m${size}`,
      group: 'routing.conduit',
      attrs: { diameterMm: size, conduitType: 'starr' },
      critical: ['diameterMm', 'conduitType'],
      unit: 'm',
      price: 0.5 + 0.045 * size,
      zeitwert: 'conduit',
      short: `Installationsrohr starr M${size}, halogenfrei`,
      long: [
        `Elektroinstallationsrohr starr, Nenngröße M${size}, nach DIN EN 61386-21,`,
        'halogenfrei, mittlere Druckfestigkeit,',
        'einschließlich Muffen, Bögen und Schellen, liefern und verlegen.',
      ],
      a: `Stangenrohr starr M${size} hfr. grau 3m`,
      b: {
        name: 'Installationsrohr starr IRS',
        detail: `M${size} · halogenfrei · Stange 3 m`,
      },
      codeB: `RX-IRS-M${size}`,
    })
  }

  for (const size of [20, 25, 32]) {
    out.push({
      id: `conduit-flex-m${size}`,
      group: 'routing.conduit',
      attrs: { diameterMm: size, conduitType: 'flexibel' },
      critical: ['diameterMm', 'conduitType'],
      unit: 'm',
      price: 0.35 + 0.03 * size,
      zeitwert: 'conduit',
      short: `Installationsrohr flexibel M${size}, gewellt`,
      long: [
        `Elektroinstallationsrohr flexibel, gewellt, Nenngröße M${size}, nach DIN EN 61386-22,`,
        'für Verlegung unter Putz und in Hohlwänden,',
        'liefern und verlegen.',
      ],
      a: `Wellrohr flex. M${size} grau RG50`,
      b: {
        name: 'Wellrohr flexibel IRF',
        detail: `M${size} · Ring 50 m`,
      },
      codeB: `RX-IRF-M${size}`,
    })
  }

  for (const [height, width, price] of [
    [30, 45, 2.9],
    [40, 60, 3.8],
    [60, 110, 7.2],
  ] as const) {
    out.push({
      id: `trunking-${height}x${width}`,
      group: 'routing.trunking',
      attrs: { heightMm: height, widthMm: width },
      critical: ['heightMm', 'widthMm'],
      unit: 'm',
      price,
      zeitwert: 'trunking',
      short: `Leitungsführungskanal ${height} x ${width} mm, reinweiß`,
      long: [
        `Leitungsführungskanal aus Kunststoff, ${height} x ${width} mm, reinweiß,`,
        'halogenfrei, mit Oberteil,',
        'einschließlich Formteilen und Befestigung, liefern und montieren.',
      ],
      a: `LF-Kanal ${height}x${width} rws hfr. 2m`,
      b: {
        name: 'Leitungsführungskanal LFK',
        detail: `${height} x ${width} mm · reinweiß · Länge 2 m`,
      },
      codeB: `RX-LFK-${height}${width}`,
    })
  }

  for (const [material, price] of [
    ['Stahlblech', 24.5],
    ['Aluminium', 31.8],
  ] as const) {
    out.push({
      id: `sill-trunking-${material.toLowerCase()}`,
      group: 'routing.trunking',
      attrs: { heightMm: 70, widthMm: 130, material },
      critical: ['material'],
      unit: 'm',
      price,
      zeitwert: 'trunking',
      short: `Brüstungskanal 70 x 130 mm, ${material}`,
      long: [
        `Brüstungskanal aus ${material}, 70 x 130 mm, reinweiß beschichtet,`,
        'für den Einbau von Installationsgeräten, mit Oberteil 80 mm,',
        'einschließlich Endstücken, Innen- und Außenecken, liefern und montieren.',
      ],
      a: `Brüstungskanal 70x130 ${material === 'Aluminium' ? 'Alu' : 'Stahlbl.'} rws 2m`,
      b: {
        name: `Brüstungskanal BRK ${material}`,
        detail: '70 x 130 mm · Oberteil 80 mm · Länge 2 m',
      },
      codeB: `RX-BRK-${material === 'Aluminium' ? 'AL' : 'ST'}`,
    })
  }

  return out
}

// ---------------------------------------------------------------------------
// Switches, sockets, boxes
// ---------------------------------------------------------------------------

function devices(): Array<Draft> {
  type Spec = {
    id: string
    short: string
    detail: string
    a: string
    b: string
    bDetail: string
    price: number
    zeitwert: string
    attrs: Record<string, AttrValue>
    critical?: Array<string>
  }
  const specs: Array<Spec> = [
    {
      id: 'socket-1',
      short: 'SCHUKO-Steckdose 16 A, Unterputz, 1-fach',
      detail:
        'Schutzkontakt-Steckdose 16 A / 250 V, 1-fach, Unterputz, mit erhöhtem Berührungsschutz, reinweiß glänzend',
      a: 'Steckdose SCHUKO 16A UP 1f rws',
      b: 'SCHUKO-Steckdose S1',
      bDetail: '16 A · 250 V · 1-fach · reinweiß',
      price: 6.2,
      zeitwert: 'device',
      attrs: { ratedCurrentA: 16, gangs: 1, mounting: 'UP', ipRating: 'IP20' },
    },
    {
      id: 'socket-2',
      short: 'SCHUKO-Steckdose 16 A, Unterputz, 2-fach',
      detail:
        'Schutzkontakt-Steckdose 16 A / 250 V, 2-fach, Unterputz, mit erhöhtem Berührungsschutz, reinweiß glänzend',
      a: 'Steckdose SCHUKO 16A UP 2f rws',
      b: 'SCHUKO-Doppelsteckdose S2',
      bDetail: '16 A · 250 V · 2-fach · reinweiß',
      price: 11.4,
      zeitwert: 'device',
      attrs: { ratedCurrentA: 16, gangs: 2, mounting: 'UP', ipRating: 'IP20' },
    },
    {
      id: 'socket-ip44',
      short: 'SCHUKO-Steckdose 16 A, Aufputz, IP 44, mit Klappdeckel',
      detail:
        'Schutzkontakt-Steckdose 16 A / 250 V, Aufputz, Schutzart IP 44, mit Klappdeckel, grau',
      a: 'Steckdose SCHUKO 16A AP IP44 Klappd. gr',
      b: 'SCHUKO-Steckdose AP S44',
      bDetail: '16 A · 250 V · Aufputz · IP 44 · Klappdeckel',
      price: 9.8,
      zeitwert: 'device',
      attrs: { ratedCurrentA: 16, gangs: 1, mounting: 'AP', ipRating: 'IP44' },
    },
    {
      id: 'socket-surge',
      short: 'SCHUKO-Steckdose 16 A mit Überspannungsschutz, Unterputz',
      detail:
        'Schutzkontakt-Steckdose 16 A / 250 V, Unterputz, mit integriertem Überspannungsschutz Typ 3 und Kontrollleuchte, reinweiß',
      a: 'Steckdose SCHUKO 16A UP m. ÜSS Typ3 rws',
      b: 'SCHUKO-Steckdose S1 Protect',
      bDetail: '16 A · Überspannungsschutz Typ 3 · reinweiß',
      price: 38,
      zeitwert: 'device',
      attrs: { ratedCurrentA: 16, gangs: 1, mounting: 'UP', surge: true },
    },
    {
      id: 'switch-two-way',
      short: 'Wechselschalter 10 AX, Unterputz',
      detail:
        'Wippschalter als Aus-/Wechselschalter 10 AX / 250 V, Unterputz, mit Wippe, reinweiß glänzend',
      a: 'Wechselsch. 10AX UP m. Wippe rws',
      b: 'Wippschalter W-Aus/Wechsel',
      bDetail: '10 AX · 250 V · reinweiß',
      price: 5.9,
      zeitwert: 'device',
      attrs: { switchType: 'Wechsel', ratedCurrentA: 10, mounting: 'UP' },
      critical: ['switchType', 'mounting'],
    },
    {
      id: 'switch-series',
      short: 'Serienschalter 10 AX, Unterputz',
      detail:
        'Wippschalter als Serienschalter 10 AX / 250 V, Unterputz, mit Doppelwippe, reinweiß glänzend',
      a: 'Seriensch. 10AX UP m. Doppelwippe rws',
      b: 'Wippschalter W-Serie',
      bDetail: '10 AX · 250 V · Doppelwippe · reinweiß',
      price: 7.4,
      zeitwert: 'device',
      attrs: { switchType: 'Serie', ratedCurrentA: 10, mounting: 'UP' },
      critical: ['switchType', 'mounting'],
    },
    {
      id: 'switch-intermediate',
      short: 'Kreuzschalter 10 AX, Unterputz',
      detail:
        'Wippschalter als Kreuzschalter 10 AX / 250 V, Unterputz, mit Wippe, reinweiß glänzend',
      a: 'Kreuzsch. 10AX UP m. Wippe rws',
      b: 'Wippschalter W-Kreuz',
      bDetail: '10 AX · 250 V · reinweiß',
      price: 9.6,
      zeitwert: 'device',
      attrs: { switchType: 'Kreuz', ratedCurrentA: 10, mounting: 'UP' },
      critical: ['switchType', 'mounting'],
    },
    {
      id: 'push-button',
      short: 'Taster 10 A, Schließer, Unterputz',
      detail:
        'Wipptaster 10 A / 250 V, 1 Schließer, Unterputz, mit Wippe, reinweiß glänzend',
      a: 'Taster 10A 1S UP m. Wippe rws',
      b: 'Wipptaster T-Schließer',
      bDetail: '10 A · 1 Schließer · reinweiß',
      price: 6.4,
      zeitwert: 'device',
      attrs: { switchType: 'Taster', ratedCurrentA: 10, mounting: 'UP' },
      critical: ['switchType', 'mounting'],
    },
    {
      id: 'blind-button',
      short: 'Jalousietaster, Unterputz',
      detail:
        'Jalousie-Wipptaster 10 A / 250 V, 1-polig, mechanisch verriegelt, Unterputz, reinweiß glänzend',
      a: 'Jalousietaster 10A UP verriegelt rws',
      b: 'Jalousie-Wipptaster TJ',
      bDetail: '10 A · verriegelt · reinweiß',
      price: 11.5,
      zeitwert: 'device',
      attrs: { switchType: 'Jalousie', ratedCurrentA: 10, mounting: 'UP' },
      critical: ['switchType', 'mounting'],
    },
    {
      id: 'switch-two-way-ip44',
      short: 'Wechselschalter 10 AX, Aufputz, IP 44',
      detail:
        'Wippschalter als Aus-/Wechselschalter 10 AX / 250 V, Aufputz, Schutzart IP 44, grau',
      a: 'Wechselsch. 10AX AP IP44 gr',
      b: 'Wippschalter AP W44',
      bDetail: '10 AX · Aufputz · IP 44',
      price: 8.9,
      zeitwert: 'device',
      attrs: {
        switchType: 'Wechsel',
        ratedCurrentA: 10,
        mounting: 'AP',
        ipRating: 'IP44',
      },
      critical: ['switchType', 'mounting', 'ipRating'],
    },
    {
      id: 'motion-detector',
      short: 'Bewegungsmelder 180°, Unterputz',
      detail:
        'Bewegungsmelder mit Erfassungswinkel 180°, Reichweite 10 m, Unterputz, Relaisausgang 10 A, reinweiß',
      a: 'Bew.melder 180Gr UP Relais 10A rws',
      b: 'Bewegungsmelder BM 180',
      bDetail: '180° · 10 m · Relais 10 A · Unterputz',
      price: 46,
      zeitwert: 'device.sensor',
      attrs: { detectionAngleDeg: 180, mounting: 'UP', dali: false },
      critical: ['detectionAngleDeg', 'mounting'],
    },
    {
      id: 'presence-detector-dali',
      short: 'Präsenzmelder 360°, Deckenmontage, DALI',
      detail:
        'Präsenzmelder mit Erfassungswinkel 360°, Erfassungsbereich Ø 8 m, Deckeneinbau, mit Lichtregelung über DALI-Schnittstelle',
      a: 'Präs.melder 360Gr DE DALI Konstantlicht',
      b: 'Präsenzmelder PM 360 DALI',
      bDetail: '360° · Ø 8 m · DALI · Deckeneinbau',
      price: 118,
      zeitwert: 'device.sensor',
      attrs: { detectionAngleDeg: 360, mounting: 'Decke', dali: true },
      critical: ['detectionAngleDeg', 'dali'],
    },
    {
      id: 'presence-detector',
      short: 'Präsenzmelder 360°, Deckenmontage, schaltend',
      detail:
        'Präsenzmelder mit Erfassungswinkel 360°, Erfassungsbereich Ø 8 m, Deckeneinbau, Relaisausgang 10 A',
      a: 'Präs.melder 360Gr DE Relais 10A',
      b: 'Präsenzmelder PM 360 R',
      bDetail: '360° · Ø 8 m · Relais 10 A · Deckeneinbau',
      price: 74,
      zeitwert: 'device.sensor',
      attrs: { detectionAngleDeg: 360, mounting: 'Decke', dali: false },
      critical: ['detectionAngleDeg', 'dali'],
    },
    {
      id: 'dimmer-led',
      short: 'LED-Drehdimmer, Unterputz',
      detail:
        'Drehdimmer für LED-Leuchtmittel 3 bis 100 W, Phasenabschnitt, mit Druck-Wechselschalter, Unterputz, reinweiß',
      a: 'LED-Drehdimmer 3-100W UP rws',
      b: 'LED-Drehdimmer DD 100',
      bDetail: '3–100 W · Phasenabschnitt · reinweiß',
      price: 42,
      zeitwert: 'device',
      attrs: { switchType: 'Dimmer', mounting: 'UP', maxLoadW: 100 },
      critical: ['switchType'],
    },
    {
      id: 'cee-16',
      short: 'CEE-Steckdose 16 A, 5-polig, 400 V, IP 44, Aufputz',
      detail:
        'CEE-Wandsteckdose nach DIN EN 60309-2, 16 A, 5-polig, 400 V, 6h, Schutzart IP 44, Aufputz',
      a: 'CEE-Stdo. 16A 5p 400V IP44 AP',
      b: 'CEE-Wandsteckdose CW 16',
      bDetail: '16 A · 5-polig · 400 V · IP 44',
      price: 9.5,
      zeitwert: 'device.cee',
      attrs: { ratedCurrentA: 16, poles: 5, ipRating: 'IP44' },
      critical: ['ratedCurrentA', 'poles', 'ipRating'],
    },
    {
      id: 'cee-32',
      short: 'CEE-Steckdose 32 A, 5-polig, 400 V, IP 44, Aufputz',
      detail:
        'CEE-Wandsteckdose nach DIN EN 60309-2, 32 A, 5-polig, 400 V, 6h, Schutzart IP 44, Aufputz',
      a: 'CEE-Stdo. 32A 5p 400V IP44 AP',
      b: 'CEE-Wandsteckdose CW 32',
      bDetail: '32 A · 5-polig · 400 V · IP 44',
      price: 14.8,
      zeitwert: 'device.cee',
      attrs: { ratedCurrentA: 32, poles: 5, ipRating: 'IP44' },
      critical: ['ratedCurrentA', 'poles', 'ipRating'],
    },
    {
      id: 'cee-32-ip67',
      short: 'CEE-Steckdose 32 A, 5-polig, 400 V, IP 67, Aufputz',
      detail:
        'CEE-Wandsteckdose nach DIN EN 60309-2, 32 A, 5-polig, 400 V, 6h, Schutzart IP 67, Aufputz, mit Bajonettverschluss',
      a: 'CEE-Stdo. 32A 5p 400V IP67 AP',
      b: 'CEE-Wandsteckdose CW 32 W',
      bDetail: '32 A · 5-polig · 400 V · IP 67',
      price: 24.5,
      zeitwert: 'device.cee',
      attrs: { ratedCurrentA: 32, poles: 5, ipRating: 'IP67' },
      critical: ['ratedCurrentA', 'poles', 'ipRating'],
    },
    {
      id: 'cee-63-ip67',
      short: 'CEE-Steckdose 63 A, 5-polig, 400 V, IP 67, Aufputz',
      detail:
        'CEE-Wandsteckdose nach DIN EN 60309-2, 63 A, 5-polig, 400 V, 6h, Schutzart IP 67, Aufputz, mit Pilotkontakt',
      a: 'CEE-Stdo. 63A 5p 400V IP67 AP',
      b: 'CEE-Wandsteckdose CW 63 W',
      bDetail: '63 A · 5-polig · 400 V · IP 67',
      price: 68,
      zeitwert: 'device.cee',
      attrs: { ratedCurrentA: 63, poles: 5, ipRating: 'IP67' },
      critical: ['ratedCurrentA', 'poles', 'ipRating'],
    },
    {
      id: 'cooker-outlet',
      short: 'Herdanschlussdose, Unterputz',
      detail:
        'Herdanschlussdose 5-polig, bis 5 x 2,5 mm², Unterputz, mit Zugentlastung, reinweiß',
      a: 'Herdanschlussdose UP 5x2,5 rws',
      b: 'Herdanschlussdose HA 5',
      bDetail: '5-polig · bis 2,5 mm² · Unterputz',
      price: 4.8,
      zeitwert: 'device',
      attrs: { poles: 5, mounting: 'UP' },
      critical: ['poles'],
    },
    {
      id: 'appliance-outlet',
      short: 'Geräteanschlussdose, Unterputz',
      detail:
        'Geräteanschlussdose 3-polig, bis 3 x 2,5 mm², Unterputz, mit Zugentlastung, reinweiß',
      a: 'Geräteanschlussdose UP 3x2,5 rws',
      b: 'Geräteanschlussdose GA 3',
      bDetail: '3-polig · bis 2,5 mm² · Unterputz',
      price: 3.9,
      zeitwert: 'device',
      attrs: { poles: 3, mounting: 'UP' },
      critical: ['poles'],
    },
    ...[1, 2, 3].map((gangs): Spec => ({
      id: `frame-${gangs}`,
      short: `Abdeckrahmen ${gangs}-fach, reinweiß`,
      detail: `Abdeckrahmen ${gangs}-fach für waagerechte und senkrechte Montage, reinweiß glänzend, passend zum Schalterprogramm`,
      a: `Rahmen ${gangs}f rws glänzend`,
      b: `Abdeckrahmen R${gangs}`,
      bDetail: `${gangs}-fach · reinweiß glänzend`,
      price: 0.4 + 1.5 * gangs,
      zeitwert: 'device.frame',
      attrs: { gangs },
      critical: ['gangs'],
    })),
    {
      id: 'junction-box-85',
      short: 'Abzweigdose Aufputz 85 x 85 mm, IP 54',
      detail:
        'Abzweigdose für Aufputzmontage, 85 x 85 x 40 mm, Schutzart IP 54, mit Würgenippeln, grau',
      a: 'Abzw.dose AP 85x85 IP54 gr',
      b: 'Abzweigdose AD 85',
      bDetail: '85 x 85 x 40 mm · IP 54',
      price: 1.6,
      zeitwert: 'device.box',
      attrs: { widthMm: 85, ipRating: 'IP54' },
      critical: ['widthMm', 'ipRating'],
    },
    {
      id: 'junction-box-100',
      short: 'Abzweigdose Aufputz 100 x 100 mm, IP 54',
      detail:
        'Abzweigdose für Aufputzmontage, 100 x 100 x 45 mm, Schutzart IP 54, mit Würgenippeln, grau',
      a: 'Abzw.dose AP 100x100 IP54 gr',
      b: 'Abzweigdose AD 100',
      bDetail: '100 x 100 x 45 mm · IP 54',
      price: 2.3,
      zeitwert: 'device.box',
      attrs: { widthMm: 100, ipRating: 'IP54' },
      critical: ['widthMm', 'ipRating'],
    },
    {
      id: 'junction-box-150',
      short: 'Abzweigkasten 150 x 116 mm, IP 65',
      detail:
        'Abzweigkasten für Aufputzmontage, 150 x 116 x 67 mm, Schutzart IP 65, mit Klemmleiste 5-polig, grau',
      a: 'Abzw.kasten AP 150x116 IP65 m. Klemme gr',
      b: 'Abzweigkasten AK 150',
      bDetail: '150 x 116 x 67 mm · IP 65 · Klemme 5-polig',
      price: 6.9,
      zeitwert: 'device.box',
      attrs: { widthMm: 150, ipRating: 'IP65' },
      critical: ['widthMm', 'ipRating'],
    },
    {
      id: 'wall-box-hollow',
      short: 'Gerätedose für Hohlwand, Ø 68 mm',
      detail:
        'Hohlwand-Gerätedose Ø 68 mm, Tiefe 47 mm, halogenfrei, mit Geräteschrauben, winddicht',
      a: 'HW-Gerätedose D68 T47 hfr. winddicht',
      b: 'Hohlwanddose HD 68',
      bDetail: 'Ø 68 mm · Tiefe 47 mm · halogenfrei',
      price: 0.6,
      zeitwert: 'device.box',
      attrs: { diameterMm: 68, wallType: 'Hohlwand' },
      critical: ['wallType'],
    },
    {
      id: 'wall-box-masonry',
      short: 'Gerätedose für Mauerwerk, Ø 60 mm',
      detail:
        'Unterputz-Gerätedose Ø 60 mm, Tiefe 41 mm, mit Geräteschrauben und Tunnelstutzen',
      a: 'UP-Gerätedose D60 T41 m. Schrauben',
      b: 'Unterputzdose UD 60',
      bDetail: 'Ø 60 mm · Tiefe 41 mm',
      price: 0.35,
      zeitwert: 'device.box',
      attrs: { diameterMm: 60, wallType: 'Mauerwerk' },
      critical: ['wallType'],
    },
    {
      id: 'floor-box',
      short: 'Unterflur-Geräteeinsatz für 4 Steckdosen und 2 Datendosen',
      detail:
        'Unterflur-Geräteeinsatz mit Klappdeckel, für Hohlraumboden, bestückt mit 4 SCHUKO-Steckdosen und Geräteträger für 2 Datendosen, Bodenbelagsaussparung 5 mm',
      a: 'UF-Geräteeinsatz 4xSCHUKO + 2xDaten Klappd.',
      b: 'Unterflur-Geräteeinsatz UF 6',
      bDetail: '4 x SCHUKO · 2 x Daten · Klappdeckel',
      price: 185,
      zeitwert: 'device.floorbox',
      attrs: { sockets: 4, dataPorts: 2 },
      critical: ['sockets', 'dataPorts'],
    },
  ]

  return specs.map((spec) => ({
    id: `device-${spec.id}`,
    group: 'device',
    attrs: spec.attrs,
    critical: spec.critical ?? ['ratedCurrentA', 'gangs', 'ipRating'],
    unit: 'St',
    price: spec.price,
    zeitwert: spec.zeitwert,
    short: spec.short,
    long: [`${spec.detail},`, 'liefern, einbauen und anschließen.'],
    a: spec.a,
    b: { name: `${BRAND.device} ${spec.b}`, detail: spec.bDetail },
    codeB: `TW-${spec.id.toUpperCase()}`,
  }))
}

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------

/** The trade's colour code: first digit colour rendering, then the colour temperature. */
const colourCode = (kelvin: number) => `8${kelvin / 100}`

function luminaires(): Array<Draft> {
  const out: Array<Draft> = []

  const add = (spec: {
    id: string
    group?: ProductGroup
    title: string
    form: string
    watts: number
    lumens: number
    kelvin: number
    ip: string
    dali: boolean
    price: number
    a: string
    bName: string
    zeitwert?: string
    extra?: string
  }) => {
    const control = spec.dali ? 'DALI-dimmbar' : 'schaltbar'
    const ipText = `IP ${spec.ip.slice(2)}`
    out.push({
      id: `lum-${spec.id}`,
      group: spec.group ?? 'luminaire',
      attrs: {
        powerW: spec.watts,
        luminousFluxLm: spec.lumens,
        colourTempK: spec.kelvin,
        ipRating: spec.ip,
        dali: spec.dali,
      },
      critical: ['luminousFluxLm', 'colourTempK', 'ipRating', 'dali'],
      unit: 'St',
      price: spec.price,
      zeitwert: spec.zeitwert ?? 'luminaire',
      short: `${spec.title}, ${spec.watts} W, ${de(spec.lumens)} lm, ${spec.kelvin} K${spec.dali ? ', DALI' : ''}`,
      long: [
        `${spec.title} ${spec.form},`,
        `Systemleistung ${spec.watts} W, Leuchtenlichtstrom ${de(spec.lumens)} lm,`,
        `Farbtemperatur ${spec.kelvin} K, Farbwiedergabe Ra > 80,`,
        `Schutzart ${ipText}, Betriebsgerät ${control},`,
        ...(spec.extra === undefined ? [] : [`${spec.extra},`]),
        'liefern, montieren und anschließen.',
      ],
      a: `${spec.a} ${spec.watts}W ${spec.lumens}lm ${colourCode(spec.kelvin)} ${spec.ip}${spec.dali ? ' DALI' : ''}`,
      b: {
        name: `${BRAND.lighting} ${spec.bName}${spec.dali ? ' DALI' : ''}`,
        detail: `${spec.watts} W · ${de(spec.lumens)} lm · ${spec.kelvin} K · ${ipText}`,
      },
      codeB: `LF-${spec.id.toUpperCase()}`,
    })
  }

  for (const [watts, lumens] of [
    [28, 3600],
    [34, 4300],
  ] as const) {
    for (const kelvin of [3000, 4000]) {
      for (const dali of [false, true]) {
        add({
          id: `panel-${watts}-${kelvin}${dali ? '-dali' : ''}`,
          title: 'LED-Einlegeleuchte 625 x 625 mm',
          form: 'für Rasterdecken, Modul 625 x 625 mm, Blendungsbegrenzung UGR < 19',
          watts,
          lumens,
          kelvin,
          ip: 'IP20',
          dali,
          price: 62 + (watts === 34 ? 9 : 0) + (dali ? 18 : 0),
          a: 'LED-Panel 625',
          bName: 'PLANO 625',
        })
      }
    }
  }

  for (const [watts, lumens] of [
    [10, 900],
    [18, 1800],
    [26, 2600],
  ] as const) {
    for (const ip of ['IP20', 'IP44']) {
      add({
        id: `downlight-${watts}-${ip.toLowerCase()}`,
        title: 'LED-Downlight',
        form: `als Deckeneinbauleuchte, Deckenausschnitt Ø ${watts <= 10 ? 150 : 200} mm`,
        watts,
        lumens,
        kelvin: 3000,
        ip,
        dali: false,
        price: 28 + 1.4 * watts + (ip === 'IP44' ? 6 : 0),
        a: `LED-Downlight DE D${watts <= 10 ? 150 : 200}`,
        bName: `ROTO ${watts}`,
      })
    }
  }
  add({
    id: 'downlight-18-ip20-dali',
    title: 'LED-Downlight',
    form: 'als Deckeneinbauleuchte, Deckenausschnitt Ø 200 mm',
    watts: 18,
    lumens: 1800,
    kelvin: 3000,
    ip: 'IP20',
    dali: true,
    price: 28 + 1.4 * 18 + 15,
    a: 'LED-Downlight DE D200',
    bName: 'ROTO 18',
  })

  for (const [length, watts, lumens, dali, price] of [
    [1200, 30, 4000, false, 39],
    [1500, 45, 6200, false, 52],
    [1500, 45, 6200, true, 71],
  ] as const) {
    add({
      id: `damp-proof-${length}${dali ? '-dali' : ''}`,
      title: `LED-Feuchtraumleuchte ${length} mm`,
      form: `als Wannenleuchte, Länge ${length} mm, Gehäuse und Abdeckung aus Polycarbonat`,
      watts,
      lumens,
      kelvin: 4000,
      ip: 'IP65',
      dali,
      price,
      a: `LED-FR-Leuchte ${length}`,
      bName: `AQUA ${length}`,
    })
  }

  for (const [watts, lumens] of [
    [15, 1500],
    [22, 2300],
  ] as const) {
    for (const ip of ['IP40', 'IP54']) {
      add({
        id: `surface-round-${watts}-${ip.toLowerCase()}`,
        title: 'LED-Anbauleuchte rund',
        form: `für Wand- und Deckenmontage, Durchmesser ${watts === 15 ? 300 : 380} mm, opale Abdeckung`,
        watts,
        lumens,
        kelvin: 4000,
        ip,
        dali: false,
        price: 31 + 0.9 * watts + (ip === 'IP54' ? 8 : 0),
        a: `LED-Anbauleuchte rd D${watts === 15 ? 300 : 380}`,
        bName: `DISCO ${watts === 15 ? 300 : 380}`,
      })
    }
  }

  for (const dali of [false, true]) {
    add({
      id: `trunking-insert${dali ? '-dali' : ''}`,
      title: 'LED-Geräteträger für Lichtband 1500 mm',
      form: 'zum Einrasten in die Tragschiene, Länge 1500 mm, breit strahlend',
      watts: 50,
      lumens: 7500,
      kelvin: 4000,
      ip: 'IP20',
      dali,
      price: dali ? 118 : 96,
      a: 'LED-Geräteträger LB 1500 breit',
      bName: 'LINEA Insert 1500',
    })
  }
  out.push({
    id: 'lum-trunking-rail',
    group: 'luminaire',
    attrs: { lengthMm: 1500, poles: 7 },
    critical: ['lengthMm', 'poles'],
    unit: 'St',
    price: 38,
    zeitwert: 'luminaire.rail',
    short: 'Tragschiene für Lichtband 1500 mm, 7-polig',
    long: [
      'Tragschiene für Lichtbandsystem, Länge 1500 mm, Stahlblech weiß,',
      'mit 7-poliger Durchgangsverdrahtung 2,5 mm²,',
      'einschließlich Verbinder und Abhängung, liefern und montieren.',
    ],
    a: 'Tragschiene LB 1500 7p 2,5qmm ws',
    b: {
      name: `${BRAND.lighting} LINEA Tragschiene 1500`,
      detail: '1500 mm · 7-polig · 2,5 mm² · weiß',
    },
    codeB: 'LF-RAIL-1500',
  })

  for (const [length, watts, lumens, price] of [
    [1200, 38, 4600, 210],
    [1500, 48, 5800, 245],
  ] as const) {
    add({
      id: `pendant-${length}`,
      title: `LED-Pendelleuchte ${length} mm, direkt/indirekt strahlend`,
      form: `mit Seilabhängung, Länge ${length} mm, Aluminiumprofil, Blendungsbegrenzung UGR < 19`,
      watts,
      lumens,
      kelvin: 4000,
      ip: 'IP20',
      dali: true,
      price,
      a: `LED-Pendelleuchte ${length} dir/ind`,
      bName: `ARCO ${length}`,
      zeitwert: 'luminaire.pendant',
    })
  }

  for (const [id, title, form, watts, lumens, price, a, bName] of [
    [
      'wall-outdoor',
      'LED-Wandleuchte für den Außenbereich',
      'für Wandmontage, Aluminiumdruckguss anthrazit, Lichtaustritt nach unten',
      20,
      2000,
      88,
      'LED-Wandleuchte außen anthr.',
      'MURO 20',
    ],
    [
      'bollard',
      'LED-Pollerleuchte, Höhe 900 mm',
      'mit Erdstück, Höhe 900 mm, Aluminium anthrazit, rundstrahlend',
      15,
      1200,
      236,
      'LED-Pollerleuchte H900 anthr.',
      'PALO 900',
    ],
    [
      'floodlight',
      'LED-Fluter mit Montagebügel',
      'für Fassadenmontage, mit Montagebügel, Aluminiumdruckguss',
      50,
      6000,
      94,
      'LED-Fluter m. Bügel',
      'FARO 50',
    ],
  ] as const) {
    add({
      id,
      group: 'luminaire.outdoor',
      title,
      form,
      watts,
      lumens,
      kelvin: 4000,
      ip: 'IP65',
      dali: false,
      price,
      a,
      bName,
    })
  }

  return out
}

function emergency(): Array<Draft> {
  const out: Array<Draft> = []

  for (const [mount, mountA, ip, base] of [
    ['Deckeneinbau', 'DE', 'IP20', 68],
    ['Deckenanbau', 'AP', 'IP40', 74],
    ['Deckenanbau', 'AP', 'IP65', 96],
  ] as const) {
    for (const hours of [1, 3]) {
      const ipText = `IP ${ip.slice(2)}`
      out.push({
        id: `emergency-${mountA.toLowerCase()}-${ip.toLowerCase()}-${hours}h`,
        group: 'emergency',
        attrs: { autonomyH: hours, ipRating: ip, mounting: mount },
        critical: ['autonomyH', 'ipRating', 'mounting'],
        unit: 'St',
        price: base + (hours === 3 ? 12 : 0),
        zeitwert: 'emergency',
        short: `Sicherheitsleuchte LED, ${mount}, Einzelbatterie ${hours} h, ${ipText}`,
        long: [
          `Sicherheitsleuchte LED nach DIN EN 60598-2-22, für ${mount},`,
          `Einzelbatterieversorgung, Nennbetriebsdauer ${hours} h, Bereitschaftsschaltung,`,
          `mit automatischem Selbsttest, Schutzart ${ipText},`,
          'liefern, montieren und anschließen.',
        ],
        a: `Sich.-Leuchte LED ${mountA} EB ${hours}h ${ip} Selbsttest`,
        b: {
          name: `${BRAND.lighting} SAFE ${mountA} ${hours}H`,
          detail: `Einzelbatterie ${hours} h · ${ipText} · Selbsttest`,
        },
        codeB: `LF-SAFE-${mountA}-${ip.slice(2)}-${hours}H`,
      })
    }
  }

  for (const distance of [15, 30]) {
    for (const hours of [1, 3]) {
      out.push({
        id: `exit-sign-${distance}m-${hours}h`,
        group: 'emergency',
        attrs: { viewingDistanceM: distance, autonomyH: hours },
        critical: ['viewingDistanceM', 'autonomyH'],
        unit: 'St',
        price: 74 + (distance === 30 ? 34 : 0) + (hours === 3 ? 12 : 0),
        zeitwert: 'emergency',
        short: `Rettungszeichenleuchte LED, Erkennungsweite ${distance} m, Einzelbatterie ${hours} h`,
        long: [
          'Rettungszeichenleuchte LED nach DIN EN 1838 und DIN EN 60598-2-22,',
          `Erkennungsweite ${distance} m, Einzelbatterieversorgung, Nennbetriebsdauer ${hours} h,`,
          'Dauerschaltung, mit automatischem Selbsttest und Piktogrammscheibe nach DIN ISO 7010,',
          'für Wand- und Deckenmontage, liefern, montieren und anschließen.',
        ],
        a: `RZ-Leuchte LED EW${distance}m EB ${hours}h Dauer`,
        b: {
          name: `${BRAND.lighting} EXIT ${distance} ${hours}H`,
          detail: `Erkennungsweite ${distance} m · Einzelbatterie ${hours} h · Selbsttest`,
        },
        codeB: `LF-EXIT-${distance}-${hours}H`,
      })
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// Data network
// ---------------------------------------------------------------------------

function dataNetwork(): Array<Draft> {
  type Spec = {
    id: string
    group: ProductGroup
    unit: Unit
    price: number
    zeitwert: string
    short: string
    long: Array<string>
    a: string
    b: string
    bDetail: string
    attrs: Record<string, AttrValue>
    critical: Array<string>
  }
  const specs: Array<Spec> = [
    ...(
      [
        ['simplex', 'Simplex', 4, 0.62],
        ['duplex', 'Duplex', 8, 1.18],
      ] as const
    ).map(([id, label, pairs, price]): Spec => ({
      id: `cable-cat7-${id}`,
      group: 'data.cable',
      unit: 'm',
      price,
      zeitwert: 'data.cable',
      short: `Datenkabel Cat.7 S/FTP ${label}, halogenfrei`,
      long: [
        `Datenkabel Kategorie 7, S/FTP, ${label}, ${pairs / 4} x 4 x 2 x AWG 23/1,`,
        'bis 1000 MHz, halogenfrei, Brandklasse Dca,',
        'auf Kabelrinne oder in Rohr verlegen, beidseitig beschriften.',
      ],
      a: `Datenkabel Cat.7 S/FTP ${label} AWG23 hfr. Dca TR500`,
      b: `Datenkabel DK7 ${label}`,
      bDetail: 'Cat.7 · S/FTP · AWG 23 · 1000 MHz · Dca',
      attrs: { category: 'Cat.7', construction: label },
      critical: ['category', 'construction'],
    })),
    ...(
      [
        ['1-up', '1-fach', 'Unterputz', 1, 9.8],
        ['2-up', '2-fach', 'Unterputz', 2, 14.5],
        ['2-sill', '2-fach', 'Brüstungskanal', 2, 15.2],
      ] as const
    ).map(([id, gangs, mount, ports, price]): Spec => ({
      id: `outlet-${id}`,
      group: 'data.outlet',
      unit: 'St',
      price,
      zeitwert: 'data.outlet',
      short: `Datendose RJ45 Cat.6A, ${gangs}, ${mount}`,
      long: [
        `Datenanschlussdose RJ45, Kategorie 6A, ${gangs}, geschirmt, für ${mount},`,
        'mit Schrägauslass und Staubschutzklappe, reinweiß,',
        'liefern, montieren, Datenkabel auflegen und beschriften.',
      ],
      a: `Datendose RJ45 Cat.6A ${gangs.replace('-fach', 'f')} ${mount === 'Unterputz' ? 'UP' : 'BRK'} gesch. rws`,
      b: `Datendose DD6A-${ports}`,
      bDetail: `Cat.6A · ${ports} x RJ45 · geschirmt · ${mount}`,
      attrs: { category: 'Cat.6A', ports, mounting: mount },
      critical: ['category', 'ports', 'mounting'],
    })),
    {
      id: 'patch-panel-24',
      group: 'data.rack',
      unit: 'St',
      price: 86,
      zeitwert: 'data.panel',
      short: 'Patchpanel 19 Zoll, 24 Port, Cat.6A',
      long: [
        'Patchpanel 19 Zoll, 1 HE, 24 x RJ45, Kategorie 6A, geschirmt,',
        'mit Kabelabfangung und Erdungsanschluss,',
        'liefern, einbauen, Datenkabel auflegen und beschriften.',
      ],
      a: 'Patchpanel 19Z 1HE 24xRJ45 Cat.6A gesch.',
      b: 'Patchpanel PP24-6A',
      bDetail: '19 Zoll · 1 HE · 24 Port · Cat.6A',
      attrs: { category: 'Cat.6A', ports: 24 },
      critical: ['category', 'ports'],
    },
    ...(
      [
        [0.5, 2.4],
        [1, 2.7],
        [2, 3.3],
        [3, 4.1],
      ] as const
    ).map(([length, price]): Spec => ({
      id: `patch-cord-${String(length).replace('.', '_')}`,
      group: 'data.patch',
      unit: 'St',
      price,
      zeitwert: 'data.patch',
      short: `Patchkabel Cat.6A S/FTP, ${de(length, length < 1 ? 1 : 0)} m, grau`,
      long: [
        `Patchkabel RJ45, Kategorie 6A, S/FTP, Länge ${de(length, length < 1 ? 1 : 0)} m,`,
        'halogenfrei, grau, liefern und stecken.',
      ],
      a: `Patchkabel Cat.6A S/FTP ${de(length, length < 1 ? 1 : 0)}m gr hfr.`,
      b: `Patchkabel PK6A ${de(length, length < 1 ? 1 : 0)} m`,
      bDetail: 'Cat.6A · S/FTP · halogenfrei · grau',
      attrs: { category: 'Cat.6A', lengthM: length },
      critical: ['category', 'lengthM'],
    })),
    ...(
      [
        [24, 800, 520],
        [42, 1000, 890],
      ] as const
    ).map(([units, depth, price]): Spec => ({
      id: `rack-${units}he`,
      group: 'data.rack',
      unit: 'St',
      price,
      zeitwert: 'data.rack',
      short: `Netzwerkschrank 19 Zoll, ${units} HE, 800 x ${depth} mm`,
      long: [
        `Netzwerkschrank 19 Zoll, ${units} HE, Breite 800 mm, Tiefe ${depth} mm,`,
        'mit Glastür, abnehmbaren Seitenwänden, Dachlüfter und Sockel,',
        'liefern, aufstellen und erden.',
      ],
      a: `Netzwerkschrank 19Z ${units}HE 800x${depth} Glastür`,
      b: `Netzwerkschrank NS ${units}`,
      bDetail: `19 Zoll · ${units} HE · 800 x ${depth} mm · Glastür`,
      attrs: { rackUnits: units, depthMm: depth },
      critical: ['rackUnits'],
    })),
    ...(
      [
        [12, 2.3],
        [24, 3.4],
      ] as const
    ).map(([fibres, price]): Spec => ({
      id: `fibre-om4-${fibres}`,
      group: 'data.cable',
      unit: 'm',
      price,
      zeitwert: 'data.cable',
      short: `LWL-Kabel OM4, ${fibres} Fasern, Innen/Außen`,
      long: [
        `Lichtwellenleiterkabel Multimode OM4, ${fibres} Fasern 50/125 µm,`,
        'als Universalkabel für Innen- und Außenverlegung, halogenfrei, nagetiergeschützt,',
        'liefern und verlegen.',
      ],
      a: `LWL-Kabel U-DQ(ZN)BH ${fibres}G50/125 OM4`,
      b: `LWL-Universalkabel LU ${fibres} OM4`,
      bDetail: `${fibres} Fasern · 50/125 µm · OM4 · halogenfrei`,
      attrs: { fibreClass: 'OM4', fibres },
      critical: ['fibreClass', 'fibres'],
    })),
    {
      id: 'splice-box',
      group: 'data.rack',
      unit: 'St',
      price: 240,
      zeitwert: 'data.panel',
      short: 'LWL-Spleißbox 19 Zoll, 24 x LC-Duplex, OM4',
      long: [
        'LWL-Spleißbox 19 Zoll, 1 HE, ausziehbar, bestückt mit 24 LC-Duplex-Kupplungen OM4,',
        'einschließlich Pigtails und Spleißkassetten,',
        'liefern, einbauen, Fasern spleißen und einmessen.',
      ],
      a: 'LWL-Spleißbox 19Z 1HE 24xLC-D OM4 m. Pigtails',
      b: 'Spleißbox SB 24 LC',
      bDetail: '19 Zoll · 1 HE · 24 x LC-Duplex · OM4',
      attrs: { fibreClass: 'OM4', ports: 24 },
      critical: ['fibreClass', 'ports'],
    },
    {
      id: 'cable-manager',
      group: 'data.rack',
      unit: 'St',
      price: 19,
      zeitwert: 'data.accessory',
      short: 'Kabelrangierpanel 19 Zoll, 1 HE',
      long: [
        'Kabelrangierpanel 19 Zoll, 1 HE, mit 5 Rangierbügeln aus Kunststoff,',
        'liefern und einbauen.',
      ],
      a: 'Rangierpanel 19Z 1HE 5 Bügel',
      b: 'Rangierpanel RP 1',
      bDetail: '19 Zoll · 1 HE · 5 Bügel',
      attrs: { rackUnits: 1 },
      critical: [],
    },
    {
      id: 'power-strip',
      group: 'data.rack',
      unit: 'St',
      price: 48,
      zeitwert: 'data.accessory',
      short: 'Steckdosenleiste 19 Zoll, 8-fach, mit Überspannungsschutz',
      long: [
        'Steckdosenleiste 19 Zoll, 1 HE, 8 x SCHUKO, mit Überspannungsschutz,',
        'Zuleitung 2 m mit Schutzkontaktstecker, liefern und einbauen.',
      ],
      a: 'Steckdosenleiste 19Z 8xSCHUKO m. ÜSS 2m',
      b: 'Steckdosenleiste SL 8',
      bDetail: '19 Zoll · 8 x SCHUKO · Überspannungsschutz',
      attrs: { sockets: 8, surge: true },
      critical: ['sockets'],
    },
  ]

  return specs.map((spec) => ({
    id: `data-${spec.id}`,
    group: spec.group,
    attrs: spec.attrs,
    critical: spec.critical,
    unit: spec.unit,
    price: spec.price,
    zeitwert: spec.zeitwert,
    short: spec.short,
    long: spec.long,
    a: spec.a,
    b: { name: `${BRAND.data} ${spec.b}`, detail: spec.bDetail },
    codeB: `QX-${spec.id.toUpperCase()}`,
  }))
}

// ---------------------------------------------------------------------------
// Earthing, lightning and surge protection
// ---------------------------------------------------------------------------

function earthing(): Array<Draft> {
  type Spec = {
    id: string
    group: ProductGroup
    unit: Unit
    price: number
    zeitwert: string
    short: string
    long: Array<string>
    a: string
    b: string
    bDetail: string
    attrs: Record<string, AttrValue>
    critical: Array<string>
  }
  const specs: Array<Spec> = [
    {
      id: 'bonding-bar-small',
      group: 'earthing',
      unit: 'St',
      price: 14,
      zeitwert: 'earth.bar',
      short: 'Potentialausgleichsschiene mit 7 Anschlüssen',
      long: [
        'Potentialausgleichsschiene nach DIN VDE 0618-1, mit Abdeckung,',
        'für 7 Leiter 2,5 bis 25 mm² und 1 Flachleiter bis 30 x 4 mm,',
        'liefern, montieren und anschließen.',
      ],
      a: 'PA-Schiene 7x25qmm + 1xFl30 m. Abd.',
      b: 'Potentialausgleichsschiene PAS 7',
      bDetail: '7 x 2,5–25 mm² · 1 x Flachleiter 30 x 4',
      attrs: { terminals: 7 },
      critical: ['terminals'],
    },
    {
      id: 'bonding-bar-main',
      group: 'earthing',
      unit: 'St',
      price: 58,
      zeitwert: 'earth.bar',
      short: 'Haupterdungsschiene mit 12 Anschlüssen, Kupfer',
      long: [
        'Haupterdungsschiene aus Kupfer, vernickelt, auf Isolatoren,',
        'für 12 Leiter bis 95 mm² und 2 Flachleiter bis 40 x 5 mm,',
        'liefern, montieren und anschließen.',
      ],
      a: 'Haupterdungsschiene Cu 12x95qmm + 2xFl40',
      b: 'Haupterdungsschiene HES 12',
      bDetail: 'Kupfer vernickelt · 12 x bis 95 mm² · 2 x Flachleiter',
      attrs: { terminals: 12 },
      critical: ['terminals'],
    },
    ...(
      [
        ['zinc', 'feuerverzinkt', 'St/tZn', 3.9],
        ['v4a', 'Edelstahl V4A', 'V4A', 14.5],
      ] as const
    ).map(([id, material, code, price]): Spec => ({
      id: `strip-${id}`,
      group: 'earthing',
      unit: 'm',
      price,
      zeitwert: 'earth.strip',
      short: `Fundamenterder Bandstahl 30 x 3,5 mm, ${material}`,
      long: [
        `Fundamenterder als Bandstahl 30 x 3,5 mm, ${material}, nach DIN 18014,`,
        'hochkant verlegen, mit Abstandhaltern und Verbindern,',
        'liefern, verlegen und mit der Bewehrung verbinden.',
      ],
      a: `Bandstahl 30x3,5 ${code} RG50`,
      b: `Erdungsband EB 30 ${code}`,
      bDetail: `30 x 3,5 mm · ${material} · Ring 50 m`,
      attrs: { material: code, widthMm: 30 },
      critical: ['material'],
    })),
    ...(
      [
        ['alu-8', 'Aluminium', 'Al', 8, 1.9],
        ['zinc-10', 'Stahl feuerverzinkt', 'St/tZn', 10, 2.6],
        ['v4a-10', 'Edelstahl V4A', 'V4A', 10, 9.8],
      ] as const
    ).map(([id, material, code, diameter, price]): Spec => ({
      id: `round-${id}`,
      group: 'lightning',
      unit: 'm',
      price,
      zeitwert: 'earth.strip',
      short: `Runddraht Ø ${diameter} mm, ${material}`,
      long: [
        `Runddraht Ø ${diameter} mm, ${material}, nach DIN EN 62561-2,`,
        'als Fang- und Ableitung, einschließlich Leitungshaltern,',
        'liefern und verlegen.',
      ],
      a: `Runddraht D${diameter} ${code} RG`,
      b: `Runddraht RD ${diameter} ${code}`,
      bDetail: `Ø ${diameter} mm · ${material}`,
      attrs: { material: code, diameterMm: diameter },
      critical: ['material', 'diameterMm'],
    })),
    {
      id: 'terminal-lug',
      group: 'earthing',
      unit: 'St',
      price: 18,
      zeitwert: 'earth.rod',
      short: 'Anschlussfahne Edelstahl V4A, Länge 1,5 m',
      long: [
        'Anschlussfahne aus Edelstahl V4A, Rundstahl Ø 10 mm, Länge 1,5 m,',
        'zum Anschluss an den Fundamenterder, mit Verbinder,',
        'liefern und einbauen.',
      ],
      a: 'Anschlussfahne V4A D10 L1500 m. Verb.',
      b: 'Anschlussfahne AF 1500 V4A',
      bDetail: 'Ø 10 mm · Länge 1,5 m · V4A',
      attrs: { material: 'V4A', lengthM: 1.5 },
      critical: ['material'],
    },
    {
      id: 'cross-connector',
      group: 'lightning',
      unit: 'St',
      price: 3.2,
      zeitwert: 'earth.part',
      short: 'Kreuzverbinder für Rund- und Flachleiter',
      long: [
        'Kreuzverbinder aus Stahl feuerverzinkt, für Rundleiter Ø 8 bis 10 mm und Flachleiter bis 30 mm,',
        'liefern und montieren.',
      ],
      a: 'Kreuzverbinder Rd8-10/Fl30 St/tZn',
      b: 'Kreuzverbinder KV 30',
      bDetail: 'Rund 8–10 mm · Flach 30 mm · feuerverzinkt',
      attrs: { material: 'St/tZn' },
      critical: [],
    },
    {
      id: 'pipe-clamp',
      group: 'earthing',
      unit: 'St',
      price: 4.5,
      zeitwert: 'earth.part',
      short: 'Erdungsbandschelle für Rohre bis 2 Zoll',
      long: [
        'Erdungsbandschelle aus Messing vernickelt, für Rohre 3/8 bis 2 Zoll,',
        'Anschluss bis 16 mm², liefern und montieren.',
      ],
      a: 'Erdungsbandschelle 3/8-2Z Ms vern. 16qmm',
      b: 'Erdungsbandschelle ES 2',
      bDetail: '3/8 bis 2 Zoll · Anschluss 16 mm²',
      attrs: {},
      critical: [],
    },
    {
      id: 'roof-holder',
      group: 'lightning',
      unit: 'St',
      price: 2.1,
      zeitwert: 'earth.part',
      short: 'Dachleitungshalter für Flachdach, Runddraht Ø 8 mm',
      long: [
        'Dachleitungshalter für Flachdächer, mit Betonstein, für Runddraht Ø 8 mm,',
        'liefern und setzen.',
      ],
      a: 'Dachleitungshalter Flachd. Betonstein Rd8',
      b: 'Dachleitungshalter DH 8 F',
      bDetail: 'Flachdach · Betonstein · Ø 8 mm',
      attrs: { diameterMm: 8 },
      critical: [],
    },
    {
      id: 'air-terminal',
      group: 'lightning',
      unit: 'St',
      price: 38,
      zeitwert: 'earth.rod',
      short: 'Fangstange Aluminium, Länge 1,5 m, mit Betonsockel',
      long: [
        'Fangstange aus Aluminium, Ø 16 mm, verjüngt auf 10 mm, Länge 1,5 m,',
        'mit Betonsockel 17 kg und Keil, liefern und aufstellen.',
      ],
      a: 'Fangstange Al D16/10 L1500 m. Betonsockel',
      b: 'Fangstange FS 1500 Al',
      bDetail: 'Ø 16/10 mm · Länge 1,5 m · Betonsockel 17 kg',
      attrs: { lengthM: 1.5, material: 'Al' },
      critical: ['lengthM'],
    },
    ...(
      [
        [
          't1t2',
          'Kombiableiter Typ 1+2, 4-polig',
          'Typ 1+2',
          'Blitzstrom 25 kA (10/350) je Pol',
          420,
        ],
        [
          't2',
          'Überspannungsableiter Typ 2, 4-polig',
          'Typ 2',
          'Nennableitstoßstrom 20 kA (8/20) je Pol',
          160,
        ],
        [
          't3',
          'Überspannungsableiter Typ 3, 2-polig',
          'Typ 3',
          'für den Endgeräteschutz, Nennstrom 16 A',
          48,
        ],
      ] as const
    ).map(([id, title, spdType, rating, price]): Spec => ({
      id: `surge-${id}`,
      group: 'surge',
      unit: 'St',
      price,
      zeitwert: 'surge',
      short: `${title}, für TN-S-Systeme`,
      long: [
        `${title} nach DIN EN 61643-11, für TN-S-Systeme 230/400 V,`,
        `${rating}, mit Funktionsanzeige und Fernmeldekontakt,`,
        'für Montage auf Tragschiene, liefern, einbauen und anschließen.',
      ],
      a: `ÜSS ${spdType} ${id === 't3' ? '2p' : '4p'} TN-S m. FM-Kontakt`,
      b: `Überspannungsschutz SP ${spdType}`,
      bDetail: `${rating} · TN-S · Fernmeldekontakt`,
      attrs: { spdType, poles: id === 't3' ? 2 : 4 },
      critical: ['spdType'],
    })),
  ]

  return specs.map((spec) => ({
    id: `earth-${spec.id}`,
    group: spec.group,
    attrs: spec.attrs,
    critical: spec.critical,
    unit: spec.unit,
    price: spec.price,
    zeitwert: spec.zeitwert,
    short: spec.short,
    long: spec.long,
    a: spec.a,
    b: { name: spec.b, detail: spec.bDetail },
    codeB: `EF-${spec.id.toUpperCase()}`,
  }))
}

// ---------------------------------------------------------------------------
// The contractor's own work: no supplier quotes these
// ---------------------------------------------------------------------------

function ownWork(): Array<Draft> {
  const specs: Array<[string, Unit, string, Array<string>]> = [
    [
      'site-setup',
      'psch',
      'Baustelleneinrichtung für das Gewerk Elektro',
      [
        'Einrichten, Vorhalten und Räumen der Baustelleneinrichtung für das Gewerk Elektroinstallation,',
        'einschließlich Material- und Werkzeugcontainer, für die Dauer der Ausführung.',
      ],
    ],
    [
      'testing',
      'psch',
      'Prüfung und Messung der Anlage mit Protokoll',
      [
        'Erstprüfung der elektrischen Anlage nach DIN VDE 0100-600,',
        'einschließlich Besichtigen, Erproben und Messen sowie Erstellen der Prüfprotokolle.',
      ],
    ],
    [
      'documentation',
      'psch',
      'Bestands- und Revisionsunterlagen',
      [
        'Erstellen der Bestands- und Revisionsunterlagen in dreifacher Ausfertigung und digital,',
        'einschließlich Stromlaufplänen, Verteilerplänen und Bedienungsanleitungen.',
      ],
    ],
    [
      'handover',
      'psch',
      'Einweisung des Betreibers',
      [
        'Einweisung des Betreiberpersonals in die elektrischen Anlagen,',
        'einschließlich Übergabeprotokoll.',
      ],
    ],
    [
      'hours-foreman',
      'h',
      'Stundenlohnarbeiten Obermonteur',
      [
        'Stundenlohnarbeiten eines Obermonteurs auf besondere Anordnung des Auftraggebers,',
        'einschließlich aller Zuschläge und Nebenkosten.',
      ],
    ],
    [
      'hours-fitter',
      'h',
      'Stundenlohnarbeiten Monteur',
      [
        'Stundenlohnarbeiten eines Elektromonteurs auf besondere Anordnung des Auftraggebers,',
        'einschließlich aller Zuschläge und Nebenkosten.',
      ],
    ],
    [
      'hours-helper',
      'h',
      'Stundenlohnarbeiten Helfer',
      [
        'Stundenlohnarbeiten eines Helfers auf besondere Anordnung des Auftraggebers,',
        'einschließlich aller Zuschläge und Nebenkosten.',
      ],
    ],
  ]

  return specs.map(([id, unit, short, long]) => ({
    id: `own-${id}`,
    group: 'own_work',
    attrs: {},
    critical: [],
    unit,
    price: 0,
    zeitwert: '',
    short,
    long,
    a: '',
    b: { name: '', detail: '' },
    codeB: '',
  }))
}
