import { useSyncExternalStore } from 'react'
import { formatQty } from './format'

export type Locale = 'de' | 'en'

const STORAGE_KEY = 'preisspiegel:locale'
const DEFAULT_LOCALE: Locale = 'de'

/**
 * UI copy. German is the working language of the people this is for, so it is
 * the default and the source of truth; English mirrors it key for key.
 * Domain terms (Leistungsverzeichnis, Position, Ordnungszahl) stay German in
 * both, because that is what an estimator calls them.
 */
const de = {
  'app.skipToContent': 'Zum Inhalt springen',
  'app.synthetic': 'Demo. Bauvorhaben, Firmen und Zahlen sind erfunden.',

  'nav.overview': 'Übersicht',
  'nav.positions': 'Positionen',
  'nav.jump': 'Position suchen',
  'nav.main': 'Hauptnavigation',

  'theme.toLight': 'Helles Design einschalten',
  'theme.toDark': 'Dunkles Design einschalten',
  'locale.switch': 'Switch to English',

  'overview.project': '{lot}, Projekt {no}',
  'overview.lead':
    '{bidder} kalkuliert das Angebot für die {client}. {n} Lieferanten haben geantwortet.',
  'overview.open': 'Positionen öffnen',
  'overview.empty.title': 'Noch keine Ausschreibung geladen',
  'overview.empty.body':
    'Mit pnpm seed load wird die Demo-Ausschreibung eingelesen: das Leistungsverzeichnis und drei Lieferantenangebote.',

  'plan.label':
    'Übersichtsschaltplan der Ausschreibung: Die Angebote speisen das Leistungsverzeichnis, jeder Abgang ist ein Titel.',
  'plan.tender': 'Leistungsverzeichnis',
  'plan.lines': '{n} Zeilen',
  'plan.pages': '{n} Seiten',
  'plan.from': 'vom {date}',
  'plan.read':
    '{referenced} von {total} Positionen nennt mindestens ein Angebot mit ihrer Ordnungszahl. Die übrigen {rest} werden über den Text zugeordnet.',
  'plan.hint': 'Ein Abgang öffnet die Positionen dieses Titels.',
  'plan.openTitle': 'Titel {rno} {label} öffnen, {positions}',

  'positions.one': 'Position',
  'positions.many': 'Positionen',

  'list.search': 'Ordnungszahl oder Text',
  'list.none': 'Keine Position passt zur Suche.',
  'list.clearTitle': 'Filter aufheben',

  'pos.back': 'Alle Positionen',
  'pos.readMore': 'Ganz lesen',
  'pos.readLess': 'Weniger',
  'pos.offers': 'Angebote zu dieser Position',
  'pos.offersHint': 'Jede unterstrichene Zahl führt zu ihrer Quelle.',
  'pos.notFound': 'Diese Position gibt es im Leistungsverzeichnis nicht.',
  'pos.previous': 'Vorherige Position',
  'pos.next': 'Nächste Position',
  'pos.source': 'Im Leistungsverzeichnis zeigen',
  'pos.quantity': 'Menge laut Leistungsverzeichnis',

  'offer.articleNo': 'Artikelnummer',
  'offer.qty': 'Menge',
  'offer.per': 'je',
  'offer.converted': 'Das sind {price} € je {unit}.',
  'offer.total': 'Gesamt',
  'offer.list': 'Listenpreis',
  'offer.discount': 'Rabatt',
  'offer.alternative': 'Als Alternative angeboten',
  'offer.noLine': 'Keine Zeile nennt diese Position.',
  'offer.noRefs':
    'Dieses Angebot nennt keine Ordnungszahlen. Die Zuordnung erfolgt über den Text.',
  'offer.second': 'Zweite Zeile zur selben Position',
  'offer.show': 'Einzelheiten zeigen',
  'offer.hide': 'Einzelheiten verbergen',

  'source.title': 'Quelle',
  'source.page': 'Seite {page} von {pages}',
  'source.element': 'Element',
  'source.marked': 'Die Stelle ist im Dokument markiert: {field}',
  'source.loading': 'Dokument wird geladen',
  'source.failed': 'Das Dokument konnte nicht geladen werden.',
  'source.close': 'Quelle schließen',

  'field.posRef': 'Positionsbezug',
  'field.articleNo': 'Artikelnummer',
  'field.text': 'Bezeichnung',
  'field.description': 'Leistungsbeschreibung',
  'field.qty': 'Menge',
  'field.unit': 'Einheit',
  'field.unitPrice': 'Preis',
  'field.priceBasis': 'Preiseinheit',
  'field.listPrice': 'Listenpreis',
  'field.discountPct': 'Rabatt',
  'field.total': 'Gesamtbetrag',

  'palette.placeholder': 'Ordnungszahl oder Text',
  'palette.hint': 'Enter öffnet, Esc schließt',
  'palette.empty': 'Nichts gefunden.',

  'error.title': 'Etwas ist schiefgelaufen',
  'error.notFound': 'Seite nicht gefunden',
} as const

export type MessageKey = keyof typeof de

const en: Record<MessageKey, string> = {
  'app.skipToContent': 'Skip to content',
  'app.synthetic':
    'Demo. The project, the companies and the numbers are invented.',

  'nav.overview': 'Overview',
  'nav.positions': 'Positions',
  'nav.jump': 'Find a position',
  'nav.main': 'Main navigation',

  'theme.toLight': 'Switch to the light theme',
  'theme.toDark': 'Switch to the dark theme',
  'locale.switch': 'Auf Deutsch umschalten',

  'overview.project': '{lot}, project {no}',
  'overview.lead':
    '{bidder} is pricing the bid for {client}. {n} suppliers have answered.',
  'overview.open': 'Open positions',
  'overview.empty.title': 'No tender loaded yet',
  'overview.empty.body':
    'pnpm seed load reads in the demo tender: the Leistungsverzeichnis and three supplier offers.',

  'plan.label':
    'Single-line diagram of the tender: the offers feed the Leistungsverzeichnis, and every outgoing feeder is one of its titles.',
  'plan.tender': 'Leistungsverzeichnis',
  'plan.lines': '{n} lines',
  'plan.pages': '{n} pages',
  'plan.from': 'dated {date}',
  'plan.read':
    '{referenced} of {total} positions are named by at least one offer with their Ordnungszahl. The other {rest} are matched from the text.',
  'plan.hint': 'A feeder opens the positions of that title.',
  'plan.openTitle': 'Open title {rno} {label}, {positions}',

  'positions.one': 'position',
  'positions.many': 'positions',

  'list.search': 'Ordnungszahl or text',
  'list.none': 'No position matches the search.',
  'list.clearTitle': 'Clear filter',

  'pos.back': 'All positions',
  'pos.readMore': 'Read all',
  'pos.readLess': 'Less',
  'pos.offers': 'Offers for this position',
  'pos.offersHint': 'Every underlined number leads to its source.',
  'pos.notFound': 'There is no such position in the Leistungsverzeichnis.',
  'pos.previous': 'Previous position',
  'pos.next': 'Next position',
  'pos.source': 'Show in the Leistungsverzeichnis',
  'pos.quantity': 'Quantity in the Leistungsverzeichnis',

  'offer.articleNo': 'Article number',
  'offer.qty': 'Quantity',
  'offer.per': 'per',
  'offer.converted': 'That is {price} € per {unit}.',
  'offer.total': 'Total',
  'offer.list': 'List price',
  'offer.discount': 'Discount',
  'offer.alternative': 'Offered as an alternative',
  'offer.noLine': 'No line names this position.',
  'offer.noRefs':
    'This offer gives no Ordnungszahl. Its lines are matched from the text.',
  'offer.second': 'A second line for the same position',
  'offer.show': 'Show details',
  'offer.hide': 'Hide details',

  'source.title': 'Source',
  'source.page': 'Page {page} of {pages}',
  'source.element': 'Element',
  'source.marked': 'The place is marked in the document: {field}',
  'source.loading': 'Loading document',
  'source.failed': 'The document could not be loaded.',
  'source.close': 'Close source',

  'field.posRef': 'Position reference',
  'field.articleNo': 'Article number',
  'field.text': 'Wording',
  'field.description': 'Description',
  'field.qty': 'Quantity',
  'field.unit': 'Unit',
  'field.unitPrice': 'Price',
  'field.priceBasis': 'Price unit',
  'field.listPrice': 'List price',
  'field.discountPct': 'Discount',
  'field.total': 'Total',

  'palette.placeholder': 'Ordnungszahl or text',
  'palette.hint': 'Enter opens, Esc closes',
  'palette.empty': 'Nothing found.',

  'error.title': 'Something went wrong',
  'error.notFound': 'Page not found',
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
      text = text.replaceAll(`{${name}}`, String(value))
    }
    return text
  }
}

/** "1 Position", "1.170 Positionen": the count with its noun in the right number. */
export function positionsText(t: Translate, count: number): string {
  return `${formatQty(count)} ${positionsNoun(t, count)}`
}

export function positionsNoun(t: Translate, count: number): string {
  return t(count === 1 ? 'positions.one' : 'positions.many')
}
