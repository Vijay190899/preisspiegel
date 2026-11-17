/**
 * The tender's own words in English.
 *
 * A German tender is in German, and what a supplier wrote is evidence that
 * must stay as it was written. But the names of its sections, its storeys
 * and what an item is can be said in English for a reader who does not read
 * German, as long as the original is one click away. This is a glossary of
 * the trade's terms applied phrase by phrase, not a translation service. A
 * text is shown in English only if the glossary covers all of it; one with
 * a word it does not know is shown as the tender wrote it, never half in
 * one language and half in the other.
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
    ['Einweisung des Betreibers', 'Handover and instruction of the operator'],
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
    ['Stundenlohnarbeiten Obermonteur', 'Daywork, chargehand'],
    ['Stundenlohnarbeiten Monteur', 'Daywork, electrician'],
    ['Stundenlohnarbeiten Helfer', 'Daywork, labourer'],
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
    ['Wandverteiler Aufputz', 'Surface-mounted distribution board'],
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
    ['(\\d+) Port', '$1-port'],
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

/**
 * German figures in English notation, where they are measures: a decimal
 * comma (`3x1,5`, `0,5 m`) and a thousands point before a unit (`3.600 lm`).
 * A date or a version number is left alone.
 */
function figures(text: string): string {
  return text
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(
      /(?<![\d.,])(\d{1,3})\.(\d{3})(?=\s?(?:lm|mm|m|W|K|A|V|kg|h)(?![\p{L}]))/gu,
      '$1,$2',
    )
}

/** A phrase as it stands inside a sentence: without its capital. */
function lowerFirst(text: string): string {
  return /^[A-Z][a-z]/.test(text)
    ? text.charAt(0).toLowerCase() + text.slice(1)
    : text
}

/** Words that are the same in both languages, or are codes and names. */
const SAME = new Set([
  'cat',
  'simplex',
  'duplex',
  'port',
  'schuko',
  'led',
  'dali',
])

/** Whether what the phrases left over is free of words they did not know. */
function covered(rest: string): boolean {
  for (const [word] of rest.matchAll(/[\p{L}]+/gu)) {
    // Units, single letters and codes written in capitals stay as they are.
    if (word.length <= 2 || word === word.toUpperCase()) continue
    if (!SAME.has(word.toLowerCase())) return false
  }
  return true
}

const said = new Map<string, string>()

/**
 * What an item is, in English, or the tender's own words where the
 * glossary does not cover all of them.
 */
export function itemInEnglish(shortText: string): string {
  const known = said.get(shortText)
  if (known !== undefined) return known

  // Each phrase found is set aside, so what is left over can be looked at.
  const found: Array<string> = []
  let rest = shortText
  for (const [pattern, english] of PHRASES) {
    rest = rest.replace(pattern, (...match) => {
      const groups = match.slice(1, -2) as Array<string | undefined>
      found.push(
        english.replace(/\$(\d)/g, (_, digit: string) =>
          String(groups[Number(digit) - 1] ?? ''),
        ),
      )
      return `\u27e6${found.length - 1}\u27e7`
    })
  }
  const text = covered(rest.replace(/\u27e6\d+\u27e7/g, ' '))
    ? figures(
        rest.replace(/\u27e6(\d+)\u27e7/g, (_, at: string, offset: number) => {
          const phrase = String(found[Number(at)] ?? '')
          // Only the start of a name has a capital.
          return offset === 0 ? phrase : lowerFirst(phrase)
        }),
      ).replace(/,,/g, ',')
    : shortText
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
  Stundenlohnarbeiten: 'Daywork',
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

/** What is compared about a product, by its German name in lower case. */
const ATTRIBUTES: Partial<Record<string, string>> = {
  abdeckung: 'Cover',
  abmessung: 'Dimensions',
  abmessungen: 'Dimensions',
  'abmessungen h x b x t': 'Dimensions H x W x D',
  aderquerschnitt: 'Core cross-section',
  aderzahl: 'Number of cores',
  anschlussart: 'Connection type',
  ansteuerung: 'Control',
  anzahl: 'Number',
  'anzahl anschlüsse': 'Number of terminals',
  'anzahl datendosen': 'Number of data outlets',
  'anzahl der anschlüsse': 'Number of terminals',
  'anzahl der felder': 'Number of panels',
  'anzahl der fächer': 'Number of compartments',
  'anzahl der plätze': 'Number of spaces',
  'anzahl der steckdosen': 'Number of sockets',
  'anzahl fächer': 'Number of compartments',
  'anzahl plätze': 'Number of spaces',
  'anzahl pole': 'Number of poles',
  'anzahl ports': 'Number of ports',
  'anzahl rangierbügel': 'Number of cable brackets',
  'anzahl steckdosen': 'Number of sockets',
  aufbau: 'Construction',
  ausführung: 'Version',
  'ausführung sockel': 'Base version',
  ausgang: 'Output',
  auslösecharakteristik: 'Tripping characteristic',
  ausschaltvermögen: 'Breaking capacity',
  batterie: 'Battery',
  batteriebetrieb: 'Battery operation',
  batterieversorgung: 'Battery supply',
  bauart: 'Design',
  bauform: 'Design',
  bauhöhe: 'Height',
  bemessungsfehlerstrom: 'Rated residual current',
  bemessungsgrenzkurzschlussausschaltvermögen:
    'Rated ultimate short-circuit breaking capacity',
  bemessungsschaltvermögen: 'Rated breaking capacity',
  bemessungsspannung: 'Rated voltage',
  bemessungsstrom: 'Rated current',
  betriebsart: 'Operating mode',
  betriebsdauer: 'Duration',
  'betriebsdauer einzelbatterie': 'Battery duration',
  betriebsgerät: 'Control gear',
  'betriebsgerät dali': 'DALI control gear',
  brandklasse: 'Fire class',
  brandschutzklasse: 'Fire protection class',
  brandverhalten: 'Reaction to fire',
  breite: 'Width',
  charakteristik: 'Characteristic',
  datendosen: 'Data outlets',
  deckel: 'Lid',
  dimmbarkeit: 'Dimmability',
  durchmesser: 'Diameter',
  einbau: 'Installation',
  einbauart: 'Installation type',
  einbaubreite: 'Installation width',
  einbauhöhe: 'Installation height',
  einsatz: 'Insert',
  einzelbatterie: 'Self-contained battery',
  'einzelbatterie betriebsdauer': 'Battery duration',
  'einzelbatterie-betriebsdauer': 'Battery duration',
  erfassungswinkel: 'Detection angle',
  erkennungsweite: 'Viewing distance',
  farbe: 'Colour',
  farbtemperatur: 'Colour temperature',
  'faserart om4': 'Fibre type OM4',
  faserklasse: 'Fibre class',
  faserzahl: 'Number of fibres',
  fehlerstrom: 'Residual current',
  fernmeldekontakt: 'Signalling contact',
  flachleiter: 'Flat conductor',
  flachleiteranschluss: 'Flat conductor connection',
  formteil: 'Fitting',
  'formteil bogen 90°': '90° bend fitting',
  'formteil winkel': 'Fitting angle',
  funktion: 'Function',
  funktionserhalt: 'Circuit integrity',
  halogenfrei: 'Halogen-free',
  halogenfreiheit: 'Halogen-free',
  holmhöhe: 'Side height',
  höhe: 'Height',
  höheneinheiten: 'Rack units',
  'innere unterteilung': 'Internal separation',
  kabeltyp: 'Cable type',
  kategorie: 'Category',
  klappdeckel: 'Hinged lid',
  klemmleiste: 'Terminal strip',
  leistung: 'Power',
  leistungsbereich: 'Power range',
  leiterquerschnitt: 'Conductor cross-section',
  leitertyp: 'Conductor type',
  leitungsquerschnitt: 'Conductor cross-section',
  leitungstyp: 'Cable type',
  leuchtenlichtstrom: 'Luminous flux',
  lichtfarbe: 'Colour temperature',
  lichtregelung: 'Light control',
  lichtstrom: 'Luminous flux',
  lochung: 'Perforation',
  länge: 'Length',
  material: 'Material',
  maße: 'Dimensions',
  montage: 'Mounting',
  montageart: 'Mounting',
  nennbetriebsdauer: 'Rated duration',
  'nennbetriebsdauer einzelbatterie': 'Rated battery duration',
  nenngröße: 'Nominal size',
  nennstrom: 'Rated current',
  netzsystem: 'System earthing',
  oberfläche: 'Finish',
  polzahl: 'Number of poles',
  ports: 'Ports',
  product: 'Product',
  produkt: 'Product',
  querschnitt: 'Cross-section',
  reichweite: 'Range',
  reihen: 'Rows',
  reihenzahl: 'Number of rows',
  relaisausgang: 'Relay output',
  runddraht: 'Round wire',
  'rundleiter-bereich': 'Round conductor range',
  schaltart: 'Switching type',
  schalterart: 'Switch type',
  schaltertyp: 'Switch type',
  schaltglied: 'Contact element',
  schaltstrom: 'Switching current',
  schaltung: 'Circuit',
  schaltungsart: 'Circuit type',
  schaltvermögen: 'Breaking capacity',
  schirmung: 'Shielding',
  schließer: 'Normally open contact',
  schnittstelle: 'Interface',
  schutzart: 'Degree of protection',
  spannung: 'Voltage',
  steckdosentyp: 'Socket type',
  steckertyp: 'Connector type',
  steuerung: 'Control',
  strom: 'Current',
  stromstärke: 'Current',
  systemart: 'System type',
  systemleistung: 'System power',
  teilungseinheiten: 'Modules',
  tiefe: 'Depth',
  typ: 'Type',
  verlegeart: 'Installation method',
  verriegelung: 'Interlock',
  verzinkung: 'Galvanising',
  werkstoff: 'Material',
  winkel: 'Angle',
  wippe: 'Rocker',
  zuleitung: 'Supply cable',
  'überspannungsableiter-typ': 'Surge arrester type',
  überspannungsschutz: 'Surge protection',
}

/**
 * The name of a compared attribute. A model writes these, often joining two
 * ("Aderzahl und Querschnitt", "Höhe x Breite"); each part is looked up and
 * the name is given in English only if every part is known.
 */
export function attributeInEnglish(name: string): string {
  const whole = ATTRIBUTES[name.trim().toLowerCase()]
  if (whole !== undefined) return whole
  // Where two things are joined: by a word, by `x`, or by a slash.
  const joints = [...name.matchAll(/\s+(und|mit|x)\s+|\//g)]
  if (joints.length === 0) return name
  const parts = name.split(/\s+(?:und|mit|x)\s+|\//)
  let english = ''
  for (const [at, part] of parts.entries()) {
    const word = ATTRIBUTES[part.trim().toLowerCase()]
    if (word === undefined) return name
    english += at === 0 ? word : lowerFirst(word)
    const joint = joints[at]
    if (joint === undefined) continue
    const by = joint[1]
    english +=
      by === undefined
        ? '/'
        : ` ${by === 'und' ? 'and' : by === 'mit' ? 'with' : 'x'} `
  }
  return english
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
