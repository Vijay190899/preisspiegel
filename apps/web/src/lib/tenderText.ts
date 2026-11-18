/**
 * The tender's own words in English.
 *
 * A German tender is in German, and what a supplier wrote is evidence that
 * must stay as it was written. But the names of its sections, its storeys
 * and what an item is can be said in English for a reader who does not read
 * German, as long as the original is one click away. This is a glossary of
 * the trade's terms applied phrase by phrase, not a translation service: a
 * text it has no words for comes back unchanged.
 */
import { useLocale } from './i18n'
import type { Locale } from './locale'

/** Phrases, the longest first where one contains another. */
const PHRASES: ReadonlyArray<readonly [RegExp, string]> = (
  [
    // Whole short texts that are sentences rather than product names.
    [
      'Baustelleneinrichtung für das Gewerk Elektro',
      'Site setup for the electrical trade',
    ],
    [
      'Prüfung und Messung der Anlage mit Protokoll',
      'Testing and measurement of the installation, with report',
    ],
    ['Bestands- und Revisionsunterlagen', 'As-built and revision documents'],
    ['Einweisung des Betreibers', 'Instruction of the operator'],
    [
      'Unterflur-Geräteeinsatz für (\\d+) Steckdosen und (\\d+) Datendosen',
      'Underfloor device insert for $1 sockets and $2 data outlets',
    ],
    [
      'Erdungsbandschelle für Rohre bis (\\d+) Zoll',
      'Earthing band clamp for pipes up to $1 inch',
    ],
    [
      'Kreuzverbinder für Rund- und Flachleiter',
      'Cross connector for round and flat conductors',
    ],
    [
      'Dachleitungshalter für Flachdach',
      'Roof conductor holder for flat roofs',
    ],
    ['Stundenlohnarbeiten Obermonteur', 'Hourly work, senior fitter'],
    ['Stundenlohnarbeiten Monteur', 'Hourly work, fitter'],
    ['Stundenlohnarbeiten Helfer', 'Hourly work, helper'],
    // Distribution and protection.
    ['Anschlussverteilerschrank', 'Site distribution cabinet'],
    ['für Baustrom', 'for site power'],
    ['Niederspannungshauptverteilung', 'Main low-voltage distribution board'],
    ['Kompaktleistungsschalter', 'Moulded-case circuit breaker'],
    ['Fehlerstrom-Schutzschalter', 'Residual-current circuit breaker'],
    ['Leitungsschutzschalter', 'Miniature circuit breaker'],
    ['FI/LS-Schalter', 'RCBO'],
    ['Lasttrennschalter', 'Switch-disconnector'],
    ['Standverteiler', 'Floor-standing distribution board'],
    ['Wandverteiler', 'Wall-mounted distribution board'],
    ['Überspannungsableiter', 'Surge arrester'],
    ['Kombiableiter', 'Combined arrester'],
    ['für TN-S-Systeme', 'for TN-S systems'],
    ['Potentialausgleichsschiene', 'Equipotential bonding bar'],
    ['Haupterdungsschiene', 'Main earthing bar'],
    ['mit (\\d+) Anschlüssen', 'with $1 terminals'],
    ['Feld', 'panel'],
    // Cables and routing.
    ['Starkstromkabel', 'Power cable'],
    ['Aderleitung grün-gelb', 'Single-core cable, green-yellow,'],
    ['Halogenfreie Mantelleitung', 'Halogen-free sheathed cable'],
    ['Mantelleitung', 'Sheathed cable'],
    ['Sicherheitskabel', 'Fire-resistant cable'],
    ['Datenkabel', 'Data cable'],
    ['LWL-Kabel', 'Fibre-optic cable'],
    ['LWL-Spleißbox', 'Fibre splice box'],
    ['Patchkabel', 'Patch cable'],
    ['Kabelrangierpanel', 'Cable management panel'],
    ['Bogen 90° für Kabelrinne', '90° bend for cable tray'],
    ['T-Stück für Kabelrinne', 'Tee for cable tray'],
    ['Kabelrinne', 'Cable tray'],
    ['Gitterrinne', 'Wire mesh tray'],
    ['Installationsrohr starr', 'Rigid conduit'],
    ['Installationsrohr flexibel', 'Flexible conduit'],
    ['Leitungsführungskanal', 'Cable trunking'],
    ['Brüstungskanal', 'Dado trunking'],
    ['Fundamenterder Bandstahl', 'Foundation earth electrode, steel strip'],
    ['Runddraht', 'Round wire'],
    ['Fangstange Aluminium', 'Air-termination rod, aluminium'],
    ['mit Betonsockel', 'with concrete base'],
    // Wiring accessories.
    ['SCHUKO-Steckdose', 'SCHUKO socket'],
    ['CEE-Steckdose', 'CEE socket'],
    ['Steckdosenleiste', 'Power strip'],
    ['mit Überspannungsschutz', 'with surge protection'],
    ['mit Klappdeckel', 'with hinged lid'],
    ['Wechselschalter', 'Two-way switch'],
    ['Serienschalter', 'Double switch'],
    ['Kreuzschalter', 'Intermediate switch'],
    ['Jalousietaster', 'Blind push-button'],
    ['Taster', 'Push-button'],
    ['Schließer', 'normally open'],
    ['Bewegungsmelder', 'Motion detector'],
    ['Präsenzmelder', 'Presence detector'],
    ['Deckenmontage', 'ceiling-mounted'],
    ['schaltend', 'switching'],
    ['LED-Drehdimmer', 'LED rotary dimmer'],
    ['Herdanschlussdose', 'Cooker connection box'],
    ['Geräteanschlussdose', 'Appliance connection box'],
    ['Abdeckrahmen', 'Cover frame'],
    ['Abzweigdose', 'Junction box'],
    ['Abzweigkasten', 'Junction enclosure'],
    ['Gerätedose für Hohlwand', 'Device box for cavity walls'],
    ['Gerätedose für Mauerwerk', 'Device box for masonry'],
    ['Datendose', 'Data outlet'],
    ['Patchpanel', 'Patch panel'],
    ['Netzwerkschrank', 'Network cabinet'],
    // Lighting.
    ['LED-Einlegeleuchte', 'LED recessed panel'],
    ['LED-Downlight', 'LED downlight'],
    ['LED-Feuchtraumleuchte', 'LED moisture-proof luminaire'],
    ['LED-Anbauleuchte rund', 'LED surface-mounted luminaire, round'],
    [
      'LED-Geräteträger für Lichtband',
      'LED gear tray for continuous-row lighting',
    ],
    ['Tragschiene für Lichtband', 'Trunking rail for continuous-row lighting'],
    ['LED-Pendelleuchte', 'LED pendant luminaire'],
    ['direkt/indirekt strahlend', 'direct/indirect'],
    [
      'LED-Wandleuchte für den Außenbereich',
      'LED wall luminaire for outdoor use',
    ],
    ['LED-Pollerleuchte', 'LED bollard luminaire'],
    ['LED-Fluter mit Montagebügel', 'LED floodlight with mounting bracket'],
    ['Sicherheitsleuchte LED', 'Emergency luminaire, LED'],
    ['Rettungszeichenleuchte LED', 'Exit sign luminaire, LED'],
    ['Deckeneinbau', 'recessed in the ceiling'],
    ['Deckenanbau', 'surface-mounted on the ceiling'],
    ['Einzelbatterie', 'self-contained battery'],
    ['Erkennungsweite', 'viewing distance'],
    // Qualities.
    ['(\\d+)-polig \\+ N', '$1-pole + N'],
    ['(\\d+)-polig', '$1-pole'],
    ['(\\d+)-reihig', '$1-row'],
    ['(\\d+)-fach', '$1-gang'],
    ['(\\d+) TE', '$1 modules'],
    ['(\\d+) HE', '$1 U'],
    ['(\\d+) Zoll', '$1 inch'],
    ['(\\d+) Fasern', '$1 fibres'],
    ['Aufputz', 'surface-mounted'],
    ['Unterputz', 'flush-mounted'],
    ['gelocht', 'perforated'],
    ['bandverzinkt', 'strip-galvanised'],
    ['galvanisch verzinkt', 'electro-galvanised'],
    ['feuerverzinkt', 'hot-dip galvanised'],
    ['halogenfrei', 'halogen-free'],
    ['gewellt', 'corrugated'],
    ['reinweiß', 'pure white'],
    ['Stahlblech', 'sheet steel'],
    ['Edelstahl', 'stainless steel'],
    ['Stahl', 'steel'],
    ['Aluminium', 'aluminium'],
    ['Kupfer', 'copper'],
    ['Innen/Außen', 'indoor/outdoor'],
    ['grau', 'grey'],
    ['Höhe', 'height'],
    ['Länge', 'length'],
    ['Typ', 'type'],
    ['mit', 'with'],
    ['für', 'for'],
    ['und', 'and'],
  ] as const
).map(([german, english]) => [
  // A phrase counts only as whole words: `Typ` is not the start of `Type`.
  new RegExp(`(?<![\\p{L}\\d])${german}(?![\\p{L}\\d])`, 'gu'),
  english,
])

/** German figures in a text, in English notation: `3x1,5` and `3.600`. */
function figures(text: string): string {
  return text.replace(/\d+(?:[.,]\d+)+/g, (number) =>
    number.replace(/[.,]/g, (mark) => (mark === ',' ? '.' : ',')),
  )
}

const said = new Map<string, string>()

/** What an item is, in English. */
export function itemInEnglish(shortText: string): string {
  const known = said.get(shortText)
  if (known !== undefined) return known
  let text = shortText
  for (const [pattern, english] of PHRASES) {
    text = text.replace(pattern, english)
  }
  text = figures(text).replace(/,,/g, ',')
  said.set(shortText, text)
  return text
}

const STOREYS: ReadonlyArray<
  readonly [RegExp, (n: string) => [string, string]]
> = [
  [/^(?:Untergeschoss|UG)$/, () => ['basement', 'Bsmt']],
  [/^(?:Erdgeschoss|EG)$/, () => ['ground floor', 'Ground']],
  [
    /^(\d+)\.\s*(?:Obergeschoss|OG)$/,
    (n) => [`${ordinal(n)} floor`, ordinal(n)],
  ],
  [/^(?:Dachgeschoss|DG)$/, () => ['top floor', 'Top']],
]

function ordinal(digits: string): string {
  const n = Number(digits)
  const tail = n % 100
  const suffix =
    tail >= 11 && tail <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${suffix}`
}

/** A storey in English: in full ("2nd floor") or short for a label ("2nd"). */
export function storeyInEnglish(label: string, short = false): string {
  for (const [pattern, name] of STOREYS) {
    const match = pattern.exec(label.trim())
    if (match === null) continue
    const [full, brief] = name(match[1] ?? '')
    return short ? brief : full
  }
  return label
}

const HEADINGS: Partial<Record<string, string>> = {
  // Titles.
  'Baustrom und allgemeine Leistungen': 'Site power and general services',
  Niederspannungshauptverteilung: 'Main low-voltage distribution',
  Unterverteilungen: 'Sub-distribution boards',
  'Kabel und Leitungen': 'Cables and wiring',
  Verlegesysteme: 'Cable routing systems',
  Installationsgeräte: 'Wiring accessories',
  Beleuchtung: 'Lighting',
  Sicherheitsbeleuchtung: 'Emergency lighting',
  'Erdung, Blitz- und Überspannungsschutz':
    'Earthing, lightning and surge protection',
  Datennetz: 'Data network',
  Stundenlohnarbeiten: 'Hourly work',
  // Sections that serve the whole building.
  Baustromversorgung: 'Site power supply',
  'Allgemeine Leistungen': 'General services',
  'Felder und Einspeisung': 'Panels and incoming supply',
  Abgänge: 'Outgoing feeders',
  'Schutz und Messung': 'Protection and metering',
  Hauptleitungen: 'Main cables',
  'Haupttrassen und Steigzonen': 'Main routes and risers',
  Außenbeleuchtung: 'Outdoor lighting',
  'Erdung und Potentialausgleich': 'Earthing and equipotential bonding',
  'Äußerer Blitzschutz': 'External lightning protection',
  Überspannungsschutz: 'Surge protection',
  'Zentrale Komponenten': 'Central components',
  // The first word of a section that is cut by storey.
  Unterverteilung: 'Sub-distribution board',
  Leitungen: 'Wiring',
}

/** A title or a section of the tender in English. */
export function headingInEnglish(label: string): string {
  const whole = HEADINGS[label]
  if (whole !== undefined) return whole
  // "Beleuchtung 2. Obergeschoss": a trade and the storey it is on.
  const match = /^(\S+)\s+(.+)$/.exec(label)
  if (match !== null) {
    const [, trade = '', rest = ''] = match
    const storey = storeyInEnglish(rest)
    const name = HEADINGS[trade]
    if (name !== undefined && storey !== rest) return `${name}, ${storey}`
  }
  return label
}

/** The project and the lot, where they follow the usual wording. */
export function projectInEnglish(name: string): string {
  return name
    .replace(/^Neubau Bürogebäude\b/, 'New office building')
    .replace(
      /^Los (\d+) Elektroinstallation$/,
      'Lot $1, electrical installation',
    )
}

const ATTRIBUTES: Partial<Record<string, string>> = {
  bemessungsstrom: 'Rated current',
  nennstrom: 'Rated current',
  schutzart: 'Degree of protection',
  polzahl: 'Number of poles',
  leistung: 'Power',
  systemleistung: 'System power',
  lichtstrom: 'Luminous flux',
  leuchtenlichtstrom: 'Luminous flux',
  farbtemperatur: 'Colour temperature',
  lichtfarbe: 'Colour temperature',
  querschnitt: 'Cross-section',
  aderzahl: 'Number of cores',
  auslösecharakteristik: 'Tripping characteristic',
  charakteristik: 'Tripping characteristic',
  bemessungsfehlerstrom: 'Rated residual current',
  fehlerstrom: 'Residual current',
  schaltvermögen: 'Breaking capacity',
  länge: 'Length',
  abmessungen: 'Dimensions',
  breite: 'Width',
  höhe: 'Height',
  typ: 'Type',
  montageart: 'Mounting',
  montage: 'Mounting',
  ansteuerung: 'Control',
  betriebsgerät: 'Control gear',
  material: 'Material',
  kategorie: 'Category',
  spannung: 'Voltage',
  bemessungsspannung: 'Rated voltage',
  nennbetriebsdauer: 'Rated duration',
  betriebsdauer: 'Duration',
  produkt: 'Product',
  product: 'Product',
}

/** The name of a compared attribute, where it is one of the usual ones. */
export function attributeInEnglish(name: string): string {
  return ATTRIBUTES[name.trim().toLowerCase()] ?? name
}

/** The tender's words in the language of the page. German is the original. */
export interface TenderText {
  locale: Locale
  item: (shortText: string) => string
  heading: (label: string) => string
  storey: (label: string, short?: boolean) => string
  project: (name: string) => string
  attribute: (name: string) => string
}

const ORIGINAL: TenderText = {
  locale: 'de',
  item: (text) => text,
  heading: (text) => text,
  storey: (text) => text,
  project: (text) => text,
  attribute: (text) => text,
}
const ENGLISH: TenderText = {
  locale: 'en',
  item: itemInEnglish,
  heading: headingInEnglish,
  storey: storeyInEnglish,
  project: projectInEnglish,
  attribute: attributeInEnglish,
}

export function useTenderText(): TenderText {
  return useLocale() === 'en' ? ENGLISH : ORIGINAL
}
