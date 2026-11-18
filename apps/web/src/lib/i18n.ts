import { useSyncExternalStore } from 'react'
import { formatQty } from './format'
import { noteLocale } from './locale'
import type { Locale } from './locale'

export type { Locale } from './locale'

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
  'nav.costing': 'Kalkulation',
  'costing.title': 'Was das Kupfer ausmacht',
  'costing.s1': 'Das kalkulierte Material kostet',
  'costing.s2': '. Bei',
  'costing.s3': 'je 100 kg Kupfer kommen',
  'costing.s4': 'Kupferzuschlag dazu, zusammen',
  'costing.s5': '.',
  'costing.control': 'Kupfernotierung des Tages, in € je 100 kg',
  'costing.material': 'Material',
  'costing.surcharge': 'Kupferzuschlag',
  'costing.where': 'Wo das Kupfer steckt',
  'costing.cables':
    '{n} Positionen sind Kabel und Leitungen nach Metern: {km} km, in denen {t} t Kupfer gerechnet werden.',
  'costing.col.length': 'Länge',
  'costing.col.copper': 'Kupferzahl',
  'costing.col.surcharge': 'Zuschlag',
  'costing.note':
    'Angenommen ist, was Preislisten für Kabel üblicherweise enthalten: Kupfer zu 150 € je 100 kg steckt im Preis, auf die Notierung kommt 1 % Bezugskosten. Die Kupferzahl ist hier Aderzahl mal Querschnitt mal 9,6 kg je km. Die Angebote der Demo nennen keine Kupferbasis; Lohn ist noch nicht kalkuliert.',
  'nav.main': 'Hauptnavigation',

  'theme.toLight': 'Helles Design einschalten',
  'theme.toDark': 'Dunkles Design einschalten',
  'locale.switch': 'Switch to English',

  'overview.project': '{lot}, Projekt {no}',
  'overview.lead':
    '{bidder} kalkuliert das Angebot für die {client}. {n} Lieferanten haben geantwortet.',
  'overview.open': 'Positionen öffnen',
  'overview.decide': 'Entscheidungen öffnen',
  'overview.all': 'Alle Positionen',
  'overview.priced': 'von {total} Positionen sind kalkuliert.',
  'overview.wait.one': 'wartet auf eine Entscheidung',
  'overview.wait.many': 'warten auf eine Entscheidung',
  'overview.stake.before': 'und daran hängen',
  'overview.stake.after': '.',

  'ledger.title': 'Die teuersten Entscheidungen',
  'ledger.body':
    'Was eine Entscheidung wert ist: der Abstand zwischen dem günstigsten Angebot, an dem etwas auffällt, und dem günstigsten ohne Befund. Wo kein Angebot ohne Befund ist, der ganze Betrag.',
  'ledger.several': '{n} Positionen: {where}',
  'ledger.all': 'Alle {n} Entscheidungen',
  'ledger.col.position': 'Position',
  'ledger.col.quotes': 'Die Angebote',
  'ledger.col.worth': 'Im Spiel',
  'ledger.key':
    'Die Balken zeigen, was jeder Lieferant für die ganze Menge verlangt, von oben nach unten: {suppliers}. Rot ist ein Angebot mit Befund.',
  'ledger.quote.clean': '{supplier}: {total} €, ohne Befund.',
  'ledger.quote.flagged': '{supplier}: {total} €, mit Befund.',
  'ledger.quote.none': '{supplier}: kein Preis.',
  'shares.title': 'Mit wem kalkuliert ist',

  'overview.empty.title': 'Noch keine Ausschreibung geladen',
  'overview.empty.body':
    'Mit pnpm seed load wird die Demo-Ausschreibung eingelesen: das Leistungsverzeichnis und drei Lieferantenangebote.',

  'facade.label':
    'Ansicht des Gebäudes mit einem Fenster je Position: {total} Fenster, {priced} kalkuliert, {open} brauchen eine Entscheidung.',
  'facade.hint':
    'Die Pfeiltasten wählen ein Fenster, die Eingabetaste öffnet die Position.',
  'facade.house': 'Haus',
  'facade.state.priced': 'kalkuliert',
  'facade.state.open': 'braucht eine Entscheidung',
  'facade.state.read': 'gelesen, noch nicht entschieden',
  'facade.state.off': 'noch nicht gelesen',
  'facade.open': 'Position öffnen',
  'facade.caption': 'Jedes Fenster ist eine Position.',
  'facade.openHead': 'offen',
  'key.hold': 'Auf dem Gebäude zeigen; ein Klick hält es fest',
  'facade.titles': 'Die Titel des Leistungsverzeichnisses',

  'run.done':
    'Lauf vom {date} mit {model}: {calls} Fragen gelesen, {cached} Antworten lagen schon vor, {usd}\u00a0$.',
  'run.reading.before': 'Ein Lauf liest gerade die Angebote:',
  'run.reading.after': 'von {total} Positionen.',
  'run.deciding':
    'Alles gelesen. Die Positionen werden geprüft und entschieden.',
  'run.stopped': 'Der letzte Lauf wurde angehalten: {note}',
  'run.failed': 'Der letzte Lauf ist abgebrochen: {note}',
  'run.none':
    'Noch kein Lauf. Ein Lauf liest die Angebote und entscheidet jede Position; er wird mit pnpm bench --start gestartet.',

  'positions.one': 'Position',
  'positions.many': 'Positionen',

  'list.search': 'Ordnungszahl oder Text',
  'list.none': 'Keine Position passt zur Suche.',
  'list.clearTitle': 'Filter aufheben',
  'list.all': 'Alle',
  'list.open': 'Offen',
  'list.show': 'Welche Positionen anzeigen',
  'list.noneOpen': 'Keine Position braucht eine Entscheidung.',
  'list.status.a': 'kalkuliert',
  'list.status.r': 'braucht eine Entscheidung',

  'pos.back': 'Alle Positionen',
  'pos.readMore': 'Ganz lesen',
  'pos.readLess': 'Weniger',
  'pos.offers': 'Die Angebote',
  'pos.offersHint': 'Jede unterstrichene Zahl führt zu ihrer Quelle.',
  'pos.notFound': 'Diese Position gibt es im Leistungsverzeichnis nicht.',
  'pos.previous': 'Vorherige Position',
  'pos.next': 'Nächste Position',
  'pos.source': 'Im Leistungsverzeichnis zeigen',
  'pos.quantity': 'Menge laut Leistungsverzeichnis',
  'pos.asked': 'Was verlangt ist',
  'pos.wording': 'Im Wortlaut des Leistungsverzeichnisses.',
  'pos.where': 'Wo die Position im Gebäude liegt: {where}. Zur Übersicht.',

  'decision.decided': 'Entschieden',
  'decision.decided.offer':
    'Kalkuliert mit {supplier}: {price} € je {unit}, zusammen {total}.',
  'decision.decided.own':
    'Kalkuliert mit einem eigenen Preis: {price} € je {unit}, zusammen {total}.',
  'decision.undo': 'Entscheidung zurücknehmen',
  'decision.take': 'Damit kalkulieren',
  'decision.taken': 'Damit kalkuliert',
  'decision.own.label': 'Eigener Preis je {unit}, in €',
  'decision.own.submit': 'Mit diesem Preis kalkulieren',
  'decision.keys':
    'Die Tasten 1 bis {n} nehmen das Angebot der Spalte, U nimmt eine Entscheidung zurück.',
  'decision.auto': 'Ohne Rückfrage kalkuliert',
  'decision.auto.body':
    '{supplier} bietet am günstigsten an: {price} € je {unit}, zusammen {total} €.',
  'decision.review': 'Braucht eine Entscheidung',
  'decision.review.cheaper':
    'Das günstigste Angebot ist nicht ohne Befund. Mit dem günstigsten gültigen kostet die Position {atRisk} € mehr.',
  'decision.review.only':
    'Kein Angebot ist ohne Befund. Es geht um {atRisk} €.',
  'decision.review.unpriced':
    'Ein Angebot lässt sich nicht auf {unit} umrechnen und deshalb nicht vergleichen.',
  'decision.review.none': 'Kein Lieferant hat diese Position angeboten.',
  'decision.noted': 'Gesehen, ohne Folgen für den Preis: {reasons}.',

  'reason.SPEC_MISMATCH': 'Leistung weicht ab',
  'reason.UNIT_BASIS': 'Einheit unklar',
  'reason.PRICE_OUTLIER': 'Preis fällt heraus',
  'reason.QTY_MISMATCH': 'Menge weicht ab',
  'reason.ALTERNATIVE_PRODUCT': 'Anderes Fabrikat',
  'reason.NO_OFFER': 'Kein Angebot',
  'reason.AMBIGUOUS': 'Nicht eindeutig',
  'reason.ARITHMETIC': 'Rechnet sich nicht',

  'finding.SPEC_MISMATCH': '{attribute}: verlangt {tender}, angeboten {offer}.',
  'finding.SPEC_MISMATCH.unconfirmed':
    'Dem Text nach ein anderes Produkt. Ein Beleg dafür ließ sich nicht prüfen.',
  'finding.UNIT_BASIS':
    'Preis je {lineUnit}, ausgeschrieben in {tenderUnit}. Wie viel eine Einheit enthält, steht nicht im Angebot.',
  'finding.ARITHMETIC':
    'Menge mal Preis ergibt {expected} €, im Angebot steht {printed} €.',
  'finding.QTY_MISMATCH': 'Ausgeschrieben sind {asked}, angeboten {offered}.',
  'finding.ALTERNATIVE_PRODUCT': 'Als abweichendes Fabrikat gekennzeichnet.',
  'finding.AMBIGUOUS':
    'Der Lieferant beantwortet die Position auf {lines} Zeilen zu verschiedenen Preisen.',
  'finding.AMBIGUOUS.unconfirmed':
    'Ob diese Zeile zur Position gehört, ließ sich aus den beiden Texten nicht klären.',
  'finding.PRICE_OUTLIER':
    '{price} € je Einheit. Das nächste Angebot liegt bei {others} €.',
  'finding.NO_OFFER': 'Kein Lieferant hat diese Position angeboten.',

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
  'offer.chosen': 'Günstigstes gültiges Angebot',
  'offer.compared': 'Verglichen',
  'offer.tenderWording': 'Im Wortlaut des Leistungsverzeichnisses',
  'offer.agrees': 'entspricht',
  'offer.differs': 'entspricht nicht',
  'offer.details': 'Einzelheiten',
  'offer.forAll': '{qty} {unit} kosten {total} €',
  'gauge.asked': 'verlangt',
  'gauge.offered': 'angeboten',
  'gauge.less': '{gap} {unit} weniger als verlangt',
  'gauge.more': '{gap} {unit} mehr als verlangt',
  'offer.byQuantity': 'Über die Menge zugeordnet',
  'offer.sameText': 'Wiederholt den Text der Position',

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
  'nav.positions': 'Items',
  'nav.jump': 'Find an item',
  'nav.costing': 'Costing',
  'costing.title': 'What copper does to the bid',
  'costing.s1': 'The priced material comes to',
  'costing.s2': '. With copper at',
  'costing.s3': 'per 100 kg, a surcharge of',
  'costing.s4': 'comes on top:',
  'costing.s5': ' in all.',
  'costing.control': "The day's copper notation, in € per 100 kg",
  'costing.material': 'Material',
  'costing.surcharge': 'Copper surcharge',
  'costing.where': 'Where the copper is',
  'costing.cables':
    '{n} items are cable by the metre: {km} km, counted to hold {t} t of copper.',
  'costing.col.length': 'Length',
  'costing.col.copper': 'Copper number',
  'costing.col.surcharge': 'Surcharge',
  'costing.note':
    'Assumed is what price lists for cable usually hold: copper at 150 € per 100 kg is in the price, and 1% procurement costs are added to the notation. The copper number here is cores times cross-section times 9.6 kg per km. The offers in the demo state no copper base; labor is not priced yet.',
  'nav.main': 'Main navigation',

  'theme.toLight': 'Switch to the light theme',
  'theme.toDark': 'Switch to the dark theme',
  'locale.switch': 'Auf Deutsch umschalten',

  'overview.project': '{lot}, project {no}',
  'overview.lead':
    '{bidder} is pricing the bid for {client}. {n} suppliers have answered.',
  'overview.open': 'Open items',
  'overview.decide': 'Open the decisions',
  'overview.all': 'All items',
  'overview.priced': 'of {total} items are priced.',
  'overview.wait.one': 'is waiting for a decision',
  'overview.wait.many': 'are waiting for a decision',
  'overview.stake.before': 'with',
  'overview.stake.after': ' resting on them.',

  'ledger.title': 'The costliest decisions',
  'ledger.body':
    'What a decision is worth: the gap between the cheapest offer with something found on it and the cheapest one without. Where no offer is without a finding, the whole amount.',
  'ledger.several': '{n} items: {where}',
  'ledger.all': 'All {n} decisions',
  'ledger.col.position': 'Item',
  'ledger.col.quotes': 'The offers',
  'ledger.col.worth': 'At stake',
  'ledger.key':
    'The bars show what each supplier asks for the whole quantity, from top to bottom: {suppliers}. Red is an offer with a finding.',
  'ledger.quote.clean': '{supplier}: {total} €, nothing found.',
  'ledger.quote.flagged': '{supplier}: {total} €, with a finding.',
  'ledger.quote.none': '{supplier}: no price.',
  'shares.title': 'Who it is priced with',

  'overview.empty.title': 'No tender loaded yet',
  'overview.empty.body':
    'pnpm seed load reads in the demo tender: the bill of quantities and three supplier offers.',

  'facade.label':
    'Front of the building with one window per item: {total} windows, {priced} priced, {open} need a decision.',
  'facade.hint': 'The arrow keys choose a window, Enter opens the item.',
  'facade.house': 'House',
  'facade.state.priced': 'priced',
  'facade.state.open': 'needs a decision',
  'facade.state.read': 'read, not decided yet',
  'facade.state.off': 'not read yet',
  'facade.open': 'Open item',
  'facade.caption': 'Every window is an item.',
  'facade.openHead': 'open',
  'key.hold': 'Show on the building; a click holds it',
  'facade.titles': 'The sections of the bill of quantities',

  'run.done':
    'Run of {date} with {model}: {calls} questions read, {cached} answers were already there, {usd}\u00a0$.',
  'run.reading.before': 'A run is reading the offers:',
  'run.reading.after': 'of {total} items.',
  'run.deciding':
    'Everything is read. The items are being checked and decided.',
  'run.stopped': 'The last run was stopped: {note}',
  'run.failed': 'The last run failed: {note}',
  'run.none':
    'No run yet. A run reads the offers and decides every item; it is started with pnpm bench --start.',

  'positions.one': 'item',
  'positions.many': 'items',

  'list.search': 'Item number or text',
  'list.none': 'No item matches the search.',
  'list.clearTitle': 'Clear filter',
  'list.all': 'All',
  'list.open': 'Open',
  'list.show': 'Which items to show',
  'list.noneOpen': 'No item needs a decision.',
  'list.status.a': 'priced',
  'list.status.r': 'needs a decision',

  'pos.back': 'All items',
  'pos.readMore': 'Read all',
  'pos.readLess': 'Less',
  'pos.offers': 'The offers',
  'pos.offersHint': 'Every underlined number leads to its source.',
  'pos.notFound': 'There is no such item in the bill of quantities.',
  'pos.previous': 'Previous item',
  'pos.next': 'Next item',
  'pos.source': 'Show in the bill of quantities',
  'pos.quantity': 'Quantity in the bill of quantities',
  'pos.asked': 'What is asked for',
  'pos.wording': "In the tender's own words, which are German.",
  'pos.where': 'Where the item is in the building: {where}. To the overview.',

  'decision.decided': 'Decided',
  'decision.decided.offer':
    'Priced with {supplier}: {price} € per {unit}, {total} in all.',
  'decision.decided.own':
    'Priced with a price of your own: {price} € per {unit}, {total} in all.',
  'decision.undo': 'Take the decision back',
  'decision.take': 'Price with this offer',
  'decision.taken': 'Priced with this offer',
  'decision.own.label': 'Your own price per {unit}, in €',
  'decision.own.submit': 'Price with this',
  'decision.keys':
    'Keys 1 to {n} take the offer in that column, U takes a decision back.',
  'decision.auto': 'Priced without asking',
  'decision.auto.body':
    '{supplier} offers the lowest price: {price} € per {unit}, {total} € in all.',
  'decision.review': 'Needs a decision',
  'decision.review.cheaper':
    'The cheapest offer has a finding. With the cheapest valid one the item costs {atRisk} € more.',
  'decision.review.only':
    'No offer is without a finding. {atRisk} € are at stake.',
  'decision.review.unpriced':
    'One offer cannot be converted to {unit} and so cannot be compared.',
  'decision.review.none': 'No supplier offered this item.',
  'decision.noted': 'Seen, without consequence for the price: {reasons}.',

  'reason.SPEC_MISMATCH': 'Not what was specified',
  'reason.UNIT_BASIS': 'Unit unclear',
  'reason.PRICE_OUTLIER': 'Price stands out',
  'reason.QTY_MISMATCH': 'Quantity differs',
  'reason.ALTERNATIVE_PRODUCT': 'Another make',
  'reason.NO_OFFER': 'No offer',
  'reason.AMBIGUOUS': 'Not clear-cut',
  'reason.ARITHMETIC': 'Does not add up',

  'finding.SPEC_MISMATCH': '{attribute}: {tender} specified, {offer} offered.',
  'finding.SPEC_MISMATCH.unconfirmed':
    'Another product, going by the text. The evidence for it could not be checked.',
  'finding.UNIT_BASIS':
    'Priced per {lineUnit}, tendered in {tenderUnit}. The offer does not say how much one unit holds.',
  'finding.ARITHMETIC':
    'Quantity times price is {expected} €; the offer prints {printed} €.',
  'finding.QTY_MISMATCH': '{asked} tendered, {offered} offered.',
  'finding.ALTERNATIVE_PRODUCT': 'Marked as another make.',
  'finding.AMBIGUOUS':
    'The supplier answers the item on {lines} lines at different prices.',
  'finding.AMBIGUOUS.unconfirmed':
    'Whether this line is for the item could not be settled from the two texts.',
  'finding.PRICE_OUTLIER':
    '{price} € per unit. The nearest offer is {others} €.',
  'finding.NO_OFFER': 'No supplier offered this item.',

  'offer.articleNo': 'Article number',
  'offer.qty': 'Quantity',
  'offer.per': 'per',
  'offer.converted': 'That is {price} € per {unit}.',
  'offer.total': 'Total',
  'offer.list': 'List price',
  'offer.discount': 'Discount',
  'offer.alternative': 'Offered as an alternative',
  'offer.noLine': 'No line names this item.',
  'offer.noRefs':
    'This offer gives no item numbers. Its lines are matched from the text.',
  'offer.second': 'A second line for the same item',
  'offer.show': 'Show details',
  'offer.hide': 'Hide details',
  'offer.chosen': 'Cheapest valid offer',
  'offer.compared': 'Compared',
  'offer.tenderWording': 'In the wording of the bill of quantities',
  'offer.agrees': 'equals',
  'offer.differs': 'does not equal',
  'offer.details': 'Details',
  'offer.forAll': '{qty} {unit} cost {total} €',
  'gauge.asked': 'asked',
  'gauge.offered': 'offered',
  'gauge.less': '{gap} {unit} less than asked for',
  'gauge.more': '{gap} {unit} more than asked for',
  'offer.byQuantity': 'Assigned by its quantity',
  'offer.sameText': "Repeats the item's own text",

  'source.title': 'Source',
  'source.page': 'Page {page} of {pages}',
  'source.element': 'Element',
  'source.marked': 'The place is marked in the document: {field}',
  'source.loading': 'Loading document',
  'source.failed': 'The document could not be loaded.',
  'source.close': 'Close source',

  'field.posRef': 'Item reference',
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

  'palette.placeholder': 'Item number or text',
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
  const locale = useSyncExternalStore(
    subscribe,
    readLocale,
    () => DEFAULT_LOCALE,
  )
  // The formatters follow the language of the render they are called in.
  noteLocale(locale)
  return locale
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
