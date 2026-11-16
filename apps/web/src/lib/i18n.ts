import { useSyncExternalStore } from 'react'

export type Locale = 'de' | 'en'

const STORAGE_KEY = 'preisspiegel:locale'
const DEFAULT_LOCALE: Locale = 'de'

/**
 * UI copy. German is the working language of the people this is for, so it is
 * the default and the source of truth; English mirrors it key for key.
 * Domain terms (Leistungsverzeichnis, Position, Preisspiegel, OZ) stay German
 * in both, because that is what an estimator calls them.
 */
const de = {
  'app.tagline': 'Angebotskalkulation mit Quellenangabe',
  'app.skipToContent': 'Zum Inhalt springen',
  'app.synthetic': 'Demo: Bauvorhaben, Firmen und Zahlen sind erfunden.',

  'nav.overview': 'Übersicht',
  'nav.positions': 'Positionen',
  'nav.jump': 'Position suchen',

  'theme.toLight': 'Zu Papier wechseln',
  'theme.toDark': 'Zur Blaupause wechseln',
  'locale.switch': 'Switch to English',

  'block.project': 'Bauvorhaben',
  'block.lot': 'Vergabeeinheit',
  'block.client': 'Auftraggeber',
  'block.bidder': 'Bieter',
  'block.projectNo': 'Projekt-Nr.',
  'block.status': 'Stand',
  'block.statusLoaded': 'Unterlagen eingelesen',
  'block.sheet': 'Blatt',

  'overview.positions': 'Positionen im Leistungsverzeichnis',
  'overview.referenced': 'mit Positionsbezug im Angebot',
  'overview.unreferenced': 'ohne Positionsbezug',
  'overview.referencedHint':
    'So viele Positionen nennt mindestens ein Lieferant mit ihrer Ordnungszahl. Für alle anderen muss das passende Angebot erst über den Text gefunden werden.',
  'overview.documents': 'Unterlagen',
  'overview.titles': 'Aufbau des Leistungsverzeichnisses',
  'overview.titlesHint': 'Positionen je Titel',
  'overview.open': 'Positionen öffnen',
  'overview.empty.title': 'Noch keine Ausschreibung geladen',
  'overview.empty.body':
    'Mit pnpm seed load wird die Demo-Ausschreibung eingelesen: Leistungsverzeichnis und drei Lieferantenangebote.',

  'doc.no': 'Nr.',
  'doc.file': 'Datei',
  'doc.kind': 'Art',
  'doc.from': 'Von',
  'doc.date': 'Datum',
  'doc.pages': 'Seiten',
  'doc.lines': 'Zeilen',
  'doc.kind.tender': 'Leistungsverzeichnis',
  'doc.kind.offer': 'Angebot',
  'doc.planner': 'Ausschreibende Stelle',

  'list.search': 'OZ oder Text',
  'list.count': '{n} Positionen',
  'list.none': 'Keine Position passt zur Suche.',
  'list.pick.title': 'Position wählen',
  'list.pick.body':
    'Links eine Position auswählen, oder mit ⌘K nach Ordnungszahl oder Text suchen.',

  'pos.quantity': 'Menge',
  'pos.description': 'Leistungsbeschreibung',
  'pos.comparison': 'Preisspiegel',
  'pos.comparisonHint':
    'Angebotszeilen, die diese Position mit ihrer Ordnungszahl nennen. Jede Zahl führt zu ihrer Quelle.',
  'pos.notFound': 'Diese Position gibt es im Leistungsverzeichnis nicht.',
  'pos.previous': 'Vorherige Position',
  'pos.next': 'Nächste Position',

  'offer.article': 'Artikel',
  'offer.articleNo': 'Art.-Nr.',
  'offer.qty': 'Menge',
  'offer.price': 'Preis',
  'offer.per': 'je',
  'offer.perUnit': 'je Einheit',
  'offer.total': 'Gesamt',
  'offer.list': 'Listenpreis',
  'offer.discount': 'Rabatt',
  'offer.alternative': 'Alternative',
  'offer.noLine': 'Keine Zeile mit Bezug auf diese Position.',
  'offer.noRefs':
    'Dieses Angebot nennt keine Ordnungszahlen. Die Zuordnung erfolgt über den Text.',
  'offer.second': 'Weitere Zeile zur selben Position',

  'source.title': 'Quelle',
  'source.none.title': 'Keine Quelle gewählt',
  'source.none.body':
    'Auf eine unterstrichene Zahl klicken: Die Stelle im Dokument, von der sie stammt, erscheint hier.',
  'source.page': 'Seite {page} von {pages}',
  'source.element': 'Element',
  'source.loading': 'Dokument wird geladen',
  'source.failed': 'Das Dokument konnte nicht geladen werden.',
  'source.readHere': 'Hier gelesen',
  'source.close': 'Quelle schließen',

  'field.posRef': 'Positionsbezug',
  'field.articleNo': 'Artikelnummer',
  'field.text': 'Bezeichnung',
  'field.qty': 'Menge',
  'field.unit': 'Einheit',
  'field.unitPrice': 'Preis',
  'field.priceBasis': 'Preiseinheit',
  'field.listPrice': 'Listenpreis',
  'field.discountPct': 'Rabatt',
  'field.total': 'Gesamtbetrag',

  'palette.placeholder': 'Ordnungszahl oder Text …',
  'palette.hint': 'Enter öffnet · Esc schließt',
  'palette.empty': 'Nichts gefunden.',

  'status.models': 'Modelle',
  'status.off': 'aus',
} as const

export type MessageKey = keyof typeof de

const en: Record<MessageKey, string> = {
  'app.tagline': 'Tender pricing with every number sourced',
  'app.skipToContent': 'Skip to content',
  'app.synthetic':
    'Demo: the project, the companies and the numbers are invented.',

  'nav.overview': 'Overview',
  'nav.positions': 'Positions',
  'nav.jump': 'Find a position',

  'theme.toLight': 'Switch to paper',
  'theme.toDark': 'Switch to blueprint',
  'locale.switch': 'Auf Deutsch umschalten',

  'block.project': 'Project',
  'block.lot': 'Lot',
  'block.client': 'Client',
  'block.bidder': 'Bidder',
  'block.projectNo': 'Project no.',
  'block.status': 'Status',
  'block.statusLoaded': 'Documents read',
  'block.sheet': 'Sheet',

  'overview.positions': 'Positions in the Leistungsverzeichnis',
  'overview.referenced': 'named by an offer',
  'overview.unreferenced': 'not named',
  'overview.referencedHint':
    'This many positions are named by at least one supplier with their ordinal number. For the rest, the matching offer line has to be found from the text.',
  'overview.documents': 'Documents',
  'overview.titles': 'Structure of the Leistungsverzeichnis',
  'overview.titlesHint': 'Positions per title',
  'overview.open': 'Open positions',
  'overview.empty.title': 'No tender loaded yet',
  'overview.empty.body':
    'pnpm seed load reads in the demo tender: the Leistungsverzeichnis and three supplier offers.',

  'doc.no': 'No.',
  'doc.file': 'File',
  'doc.kind': 'Kind',
  'doc.from': 'From',
  'doc.date': 'Date',
  'doc.pages': 'Pages',
  'doc.lines': 'Lines',
  'doc.kind.tender': 'Leistungsverzeichnis',
  'doc.kind.offer': 'Offer',
  'doc.planner': 'Issuing office',

  'list.search': 'OZ or text',
  'list.count': '{n} positions',
  'list.none': 'No position matches the search.',
  'list.pick.title': 'Pick a position',
  'list.pick.body':
    'Choose a position on the left, or press ⌘K to search by ordinal number or text.',

  'pos.quantity': 'Quantity',
  'pos.description': 'Description',
  'pos.comparison': 'Preisspiegel',
  'pos.comparisonHint':
    'Offer lines that name this position by its ordinal number. Every number leads to its source.',
  'pos.notFound': 'There is no such position in the Leistungsverzeichnis.',
  'pos.previous': 'Previous position',
  'pos.next': 'Next position',

  'offer.article': 'Article',
  'offer.articleNo': 'Art. no.',
  'offer.qty': 'Quantity',
  'offer.price': 'Price',
  'offer.per': 'per',
  'offer.perUnit': 'per unit',
  'offer.total': 'Total',
  'offer.list': 'List price',
  'offer.discount': 'Discount',
  'offer.alternative': 'Alternative',
  'offer.noLine': 'No line refers to this position.',
  'offer.noRefs':
    'This offer gives no ordinal numbers. Its lines are matched from the text.',
  'offer.second': 'Another line for the same position',

  'source.title': 'Source',
  'source.none.title': 'No source selected',
  'source.none.body':
    'Click an underlined number: the place in the document it came from appears here.',
  'source.page': 'Page {page} of {pages}',
  'source.element': 'Element',
  'source.loading': 'Loading document',
  'source.failed': 'The document could not be loaded.',
  'source.readHere': 'Read here',
  'source.close': 'Close source',

  'field.posRef': 'Position reference',
  'field.articleNo': 'Article number',
  'field.text': 'Description',
  'field.qty': 'Quantity',
  'field.unit': 'Unit',
  'field.unitPrice': 'Price',
  'field.priceBasis': 'Price unit',
  'field.listPrice': 'List price',
  'field.discountPct': 'Discount',
  'field.total': 'Total',

  'palette.placeholder': 'Ordinal number or text …',
  'palette.hint': 'Enter opens · Esc closes',
  'palette.empty': 'Nothing found.',

  'status.models': 'Models',
  'status.off': 'off',
}

const messages: Record<Locale, Record<MessageKey, string>> = { de, en }

const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

function readLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'en' || stored === 'de' ? stored : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

export function setLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
  document.documentElement.lang = locale
  listeners.forEach((notify) => notify())
}

/** The active locale. The server always renders German; the client corrects it. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, readLocale, () => DEFAULT_LOCALE)
}

export type Translate = (
  key: MessageKey,
  values?: Record<string, string | number>,
) => string

export function useT(): Translate {
  const locale = useLocale()
  return (key, values) => {
    let text = messages[locale][key]
    for (const [name, value] of Object.entries(values ?? {})) {
      text = text.replace(`{${name}}`, String(value))
    }
    return text
  }
}
