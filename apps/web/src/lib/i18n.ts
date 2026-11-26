import { useSyncExternalStore } from 'react'
import { formatQty } from './format'
import {
  LOCALE_COOKIE,
  activeLocale,
  noteLocale,
  requestedLocale,
} from './locale'
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
  'nav.measured': 'Messung',
  'pos.title': 'Position {oz}',
  'app.description':
    'Angebotskalkulation für Elektro-Ausschreibungen: jede Position zugeordnet und kalkuliert, jede Zahl bis zur Quelle nachvollziehbar.',
  'measured.title': 'Was gemessen ist',
  'measured.s1':
    'Auf einer Ausschreibung, die das System nie gesehen hatte, hat es',
  'measured.s2': 'von {total} Positionen ohne Person kalkuliert,',
  'measured.s3.all': 'alle zu Recht',
  'measured.s3.some': '{n} davon zu Recht',
  'measured.s4': '.',
  'measured.s5':
    'gelegten Fallen hat es gefunden. Der Preisfehler in dem, was es allein kalkuliert hat:',
  'measured.s6': 'von {sum} €.',
  'measured.of': '{part} von {whole}',
  'measured.lead.source':
    'Seed {seed}, ein Lauf am {date} mit {model}, gegen die Lösung des Generators gezählt. Die Dateien:',
  'measured.runs.title': 'Fünf Läufe nebeneinander',
  'measured.runs.body':
    'Die ungesehenen Ausschreibungen zuerst, die neueste vorn: jede wurde erzeugt, einmal gelesen und gezählt. Dann der erste Lauf, der Stand vor jeder Änderung, und zuletzt die Demo-Ausschreibung, wie sie jetzt ist.',
  'measured.run.first': 'Erster Lauf',
  'measured.run.unseen': 'Ungesehen',
  'measured.run.now': 'Demo, jetzt',
  'measured.seed': 'Seed {seed}',
  'measured.row.auto': 'Ohne Person kalkuliert',
  'measured.row.rightly': 'davon zu Recht ohne Person',
  'measured.row.price': 'davon zum richtigen Preis',
  'measured.row.euro': 'Preisfehler darin',
  'measured.row.traps': 'Fallen gefunden',
  'measured.row.found': 'Nötige Entscheidungen gefunden',
  'measured.row.belong': 'Gemeldete Entscheidungen, die nötig waren',
  'measured.row.numbers': 'Gezeigte Zahlen an ihrer Stelle',
  'measured.row.calls': 'Modell',
  'measured.row.file': 'Dateien',
  'measured.calls': '{calls} Aufrufe, {cached} aus dem Speicher, {usd} $',
  'measured.labor.title': 'Montagezeiten',
  'measured.b4.title': 'Ein größeres Modell',
  'measured.b4.body':
    'Was das erste Modell nicht klären konnte, liest ein größeres noch einmal, und der Code prüft dessen Antwort für jede Position an ihren eigenen Zeilen. Gemessen auf einer neuen Ausschreibung, einmal ohne und einmal mit dem größeren Modell: Es räumte jeden Fehler aus, den das erste übrig ließ, und zusammen kostet es fast das Fünffache. Eine Ausschreibung ist zu wenig, um es einzuschalten; es bleibt aus, bis es auf weiteren gemessen ist.',
  'measured.b4.alone': 'Erstes Modell allein',
  'measured.b4.with': 'Mit {model}',
  'measured.b4.row.queue': 'Positionen für eine Person (erwartet {expected})',
  'measured.b4.row.cost': 'Kosten',
  'measured.b4.more':
    '{usd} $ mehr, für {questions} Fragen zu {positions} Positionen',
  'measured.labor.body':
    'B5: Jede Position bekommt einen Eintrag aus der Zeitwerttabelle des Auftragnehmers. Das Modell schlägt ihn vor, der Code prüft Einheit und Größe und nimmt die Minuten aus der Tabelle. Die Anweisungen wurden einmal geändert, nach den ersten beiden Läufen; Seed 504 ist danach erzeugt und einmal gelesen.',
  'measured.labor.row.settled': 'Ohne Person zugeordnet',
  'measured.labor.row.hours': 'Stunden falsch, gemessen an allen',
  'measured.labor.row.prompt': 'Anweisungen',
  'measured.labor.before': 'erste Fassung',
  'measured.labor.after': 'nach der Änderung',
  'measured.traps.title': 'Die Fallen, Art für Art',
  'measured.traps.body':
    'In jede Ausschreibung legt der Generator 60 Fallen in die Angebote. So viele davon hat der Lauf auf Seed {seed} an ihrer Zeile gefunden.',
  'measured.limits.title': 'Was die Zahlen nicht zeigen',
  'measured.limit.tuned':
    'Die Demo-Ausschreibung stimmt in jeder Position. Das wurde erreicht, indem Prompt und Prüfungen an ihr geändert wurden; deshalb steht sie nicht vorn.',
  'measured.limit.generator':
    'Die ungesehenen Ausschreibungen kommen aus demselben Generator. Ungesehen sind ihre Zahlen, nicht ihre Sprache.',
  'measured.limit.once':
    'Jede Spalte ist ein Lauf. Wie stark das Ergebnis von Lauf zu Lauf schwankt, ist nicht gemessen.',
  'measured.limit.cache':
    'Jeder ungesehene Lauf hat einen Teil seiner Antworten aus früheren Ausschreibungen übernommen, wo dieselbe Frage schon gestellt war.',
  'measured.limit.numbers':
    'Eine Zahl an ihrer Stelle heißt: sie steht dort, wohin die Oberfläche zeigt. Nicht, dass sie richtig ist.',
  'labor.title': 'Montage',
  'labor.set.from': 'Nach der Zeitwerttabelle von {contractor}:',
  'labor.per': '{minutes} min je {unit}',
  'labor.sum': '{hours} Stunden für {qty}',
  'labor.cost.before': 'zu {rate} € die Stunde',
  'labor.read': 'Gewählt nach den Worten der Position',
  'labor.and': 'und',
  'labor.none':
    'Keine Montagezeit: Die Zeitwerttabelle von {contractor} hat für diese Arbeit keinen Eintrag, sie wird anders abgerechnet.',
  'labor.none.read': 'Gelesen an',
  'labor.review': 'Die Montagezeit entscheidet eine Person.',
  'labor.why.unread': 'Die Position wurde nicht gelesen.',
  'labor.why.unknown_entry':
    'Der vorgeschlagene Eintrag steht nicht in der Zeitwerttabelle.',
  'labor.why.quote':
    'Die Worte, auf die sich der Vorschlag stützt, stehen so nicht in der Position.',
  'labor.why.unit':
    'Der vorgeschlagene Eintrag rechnet in einer anderen Einheit als die Position.',
  'labor.why.limit_unstated':
    'Der vorgeschlagene Eintrag gilt nur für eine bestimmte Größe, und die Position nennt keine, die sich prüfen lässt.',
  'labor.why.limit_conflict':
    'Die zitierten Worte nennen eine andere Größe als die Position selbst.',
  'labor.why.limit':
    'Der vorgeschlagene Eintrag gilt für eine andere Größe, als die Position verlangt.',
  'labor.proposed': 'Vorgeschlagen war',
  'labor.position.says': 'die Position sagt',
  'costing.title': 'Was das Angebot kostet',
  'costing.labor.before': ', die Montage braucht',
  'costing.labor.hours': 'Stunden und kostet zu {rate} € die Stunde',
  'costing.labor': 'Montage',
  'costing.labor.where': 'Wo die Montage steckt',
  'costing.labor.reading':
    'Die Montagezeiten werden gerade gelesen: {read} von {total} Positionen.',
  'costing.labor.body':
    '{set} von {total} Positionen haben eine Montagezeit aus der Zeitwerttabelle von {contractor} mit {entries} Einträgen. {none} werden anders abgerechnet, und bei {review} entscheidet eine Person.',
  'costing.labor.open': 'Wo eine Person die Montagezeit entscheidet: {n}',
  'costing.labor.why.limit':
    'Der vorgeschlagene Eintrag gilt für eine andere Größe',
  'costing.labor.why.other': 'Der Vorschlag lässt sich nicht prüfen',
  'costing.col.quantity': 'Menge',
  'costing.col.hours': 'Stunden',
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
    'Angenommen ist, was Preislisten für Kabel üblicherweise enthalten: Kupfer zu 150 € je 100 kg steckt im Preis, auf die Notierung kommt 1 % Bezugskosten. Die Kupferzahl ist hier Aderzahl mal Querschnitt mal 9,6 kg je km. Die Angebote der Demo nennen keine Kupferbasis. Die Montage rechnet mit den Minuten der Zeitwerttabelle und einem Stundensatz, beide für die Demo erfunden; Zuschläge für Baustelle, Gemeinkosten und Gewinn sind nicht enthalten. Eine Position, die eine Person entscheidet, zählt zum günstigsten sauberen Angebot, bis sie entschieden ist, danach zum entschiedenen Preis.',
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
  'run.done.replay':
    'Lauf vom {date}: {cached} gespeicherte Antworten von {model} wiedergegeben und jede neu geprüft. Kein Modell wurde gerufen.',
  'run.done.escalated':
    '{questions} Fragen zu {positions} Positionen, die das erste Modell nicht klären konnte, las {model} noch einmal; {answered} davon beantwortete es.',
  'run.escalating.planning':
    'Alles gelesen. Gesucht wird, was das erste Modell nicht klären konnte.',
  'run.escalating':
    'Alles gelesen. {model} liest {questions} Fragen noch einmal, die das erste Modell nicht klären konnte.',
  'run.reading.before': 'Ein Lauf liest gerade die Angebote:',
  'run.replaying.before': 'Die gespeicherten Antworten werden geprüft:',
  'run.reading.after': 'von {total} Positionen.',
  'run.again': 'Noch einmal lesen',
  'run.again.hint':
    'Gibt die gespeicherten Antworten wieder und prüft und entscheidet jede Position neu. Ruft kein Modell.',
  'run.live.summary': 'Das Modell neu lesen lassen',
  'run.live.body':
    'Ein Lauf, in dem das Modell liest, braucht den Zugangscode dieser Demo. Er kostet höchstens etwa 40 Cent: gerufen wird das Modell nur für Fragen, die noch niemand gestellt hat.',
  'run.live.code': 'Zugangscode',
  'run.live.start': 'Lauf starten',
  'run.refused.code': 'Der Code stimmt nicht.',
  'run.refused.locked':
    'Zu viele falsche Codes. In zehn Minuten geht es wieder.',
  'run.refused.closed':
    'Hier ist kein Zugangscode gesetzt. Das Modell liest auf dieser Installation nur von der Kommandozeile.',
  'run.refused.running': 'Es ist gerade ein Lauf unterwegs.',
  'run.refused.busy':
    'Die Antworten wurden eben schon mehrmals neu gelesen. In ein paar Minuten geht es wieder.',
  'run.refused.failed':
    'Die Anfrage kam nicht durch. Bitte noch einmal versuchen.',
  'run.deciding':
    'Alles gelesen. Die Positionen werden geprüft und entschieden.',
  'run.stopped': 'Der letzte Lauf wurde angehalten: {note}',
  'run.failed': 'Der letzte Lauf ist abgebrochen: {note}',
  'run.none':
    'Noch kein Lauf. Ein Lauf liest die Angebote und entscheidet jede Position; er wird mit pnpm demo:reset gestartet.',

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
  'error.retry': 'Noch einmal versuchen',
  'error.body':
    'Die Seite konnte nicht geladen werden. Meist hilft es, es noch einmal zu versuchen.',
  'notice.dismiss': 'Schließen',
  'decision.failed':
    'Die Entscheidung kam nicht durch. Die Position ist unverändert; bitte noch einmal.',
} as const

export type MessageKey = keyof typeof de

const APP_NAME = 'Preisspiegel'

const en: Record<MessageKey, string> = {
  'app.skipToContent': 'Skip to content',
  'app.synthetic':
    'Demo. The project, the companies and the numbers are invented.',

  'nav.overview': 'Overview',
  'nav.positions': 'Items',
  'nav.jump': 'Find an item',
  'nav.costing': 'Costing',
  'nav.measured': 'Measured',
  'pos.title': 'Item {oz}',
  'app.description':
    'Bid pricing for electrical tenders: every item matched and priced, every number traceable to its source.',
  'measured.title': 'What was measured',
  'measured.s1': 'On a tender the system had never seen, it priced',
  'measured.s2': 'of {total} items without a person,',
  'measured.s3.all': 'all of them rightly',
  'measured.s3.some': '{n} of them rightly',
  'measured.s4': '.',
  'measured.s5':
    'planted traps were found. The price error in what it priced by itself:',
  'measured.s6': 'of {sum} €.',
  'measured.of': '{part} of {whole}',
  'measured.lead.source':
    'Seed {seed}, one run on {date} with {model}, counted against the generator\u2019s answer key. The files:',
  'measured.runs.title': 'Five runs side by side',
  'measured.runs.body':
    'The unseen tenders first, the newest in front: each was generated, read once and counted. Then the first run, the state before any change, and last the demo tender as it is now.',
  'measured.run.first': 'First run',
  'measured.run.unseen': 'Unseen',
  'measured.run.now': 'Demo, now',
  'measured.seed': 'Seed {seed}',
  'measured.row.auto': 'Priced without a person',
  'measured.row.rightly': 'of those, rightly without a person',
  'measured.row.price': 'of those, at the right price',
  'measured.row.euro': 'Price error in them',
  'measured.row.traps': 'Traps found',
  'measured.row.found': 'Needed decisions found',
  'measured.row.belong': 'Raised decisions that were needed',
  'measured.row.numbers': 'Numbers shown at their place',
  'measured.row.calls': 'Model',
  'measured.row.file': 'Files',
  'measured.calls': '{calls} calls, {cached} from the store, {usd} $',
  'measured.labor.title': 'Labor times',
  'measured.b4.title': 'A larger model',
  'measured.b4.body':
    'What the first model could not settle, a larger one reads again, and code checks its answer for each item against that item\u2019s own lines. Measured on a new tender, once without and once with the larger model: it cleared every error the first one left, and together it costs nearly five times as much. One tender is too little to switch it on; it stays off until it is measured on more.',
  'measured.b4.alone': 'First model alone',
  'measured.b4.with': 'With {model}',
  'measured.b4.row.queue': 'Items for a person ({expected} expected)',
  'measured.b4.row.cost': 'Cost',
  'measured.b4.more':
    '{usd} $ more, for {questions} questions on {positions} items',
  'measured.labor.body':
    'B5: every item is given an entry of the contractor\u2019s labor time table. The model proposes it, code checks the unit and the size and takes the minutes from the table. The instructions were changed once, after the first two runs; seed 504 was generated after that and read once.',
  'measured.labor.row.settled': 'Tied to an entry without a person',
  'measured.labor.row.hours': 'Hours wrong, against all hours',
  'measured.labor.row.prompt': 'Instructions',
  'measured.labor.before': 'first version',
  'measured.labor.after': 'after the change',
  'measured.traps.title': 'The traps, kind by kind',
  'measured.traps.body':
    'The generator plants 60 traps in the offers of every tender. This is how many of them the run on seed {seed} found on their line.',
  'measured.limits.title': 'What the figures do not show',
  'measured.limit.tuned':
    'The demo tender agrees on every item. That was reached by changing the prompt and the checks against it, which is why it does not lead.',
  'measured.limit.generator':
    'The unseen tenders come from the same generator. Their numbers are unseen, not their language.',
  'measured.limit.once':
    'Each column is one run. How much the result varies from run to run has not been measured.',
  'measured.limit.cache':
    'Each unseen run took part of its answers from earlier tenders, where the same question had been asked before.',
  'measured.limit.numbers':
    'A number at its place means it stands where the interface points. Not that it is right.',
  'labor.title': 'Labor',
  'labor.set.from': 'From the labor time table of {contractor}:',
  'labor.per': '{minutes} min per {unit}',
  'labor.sum': '{hours} hours for {qty}',
  'labor.cost.before': 'at {rate} € an hour',
  'labor.read': 'Chosen on the words of the item',
  'labor.and': 'and',
  'labor.none':
    'No labor time: the labor time table of {contractor} has no entry for this work, which is charged another way.',
  'labor.none.read': 'Read from',
  'labor.review': 'A person decides the labor time.',
  'labor.why.unread': 'The item was not read.',
  'labor.why.unknown_entry':
    'The proposed entry is not in the labor time table.',
  'labor.why.quote':
    'The words the proposal rests on are not in the item as written.',
  'labor.why.unit': 'The proposed entry counts in another unit than the item.',
  'labor.why.limit_unstated':
    'The proposed entry covers only a certain size, and the item states none that can be checked.',
  'labor.why.limit_conflict':
    'The words quoted state another size than the item itself.',
  'labor.why.limit':
    'The proposed entry covers another size than the item asks for.',
  'labor.proposed': 'The proposal was',
  'labor.position.says': 'the item says',
  'costing.title': 'What the bid comes to',
  'costing.labor.before': ', the labor takes',
  'costing.labor.hours': 'hours and at {rate} € an hour costs',
  'costing.labor': 'Labor',
  'costing.labor.where': 'Where the labor is',
  'costing.labor.reading':
    'The labor times are being read: {read} of {total} items.',
  'costing.labor.body':
    '{set} of {total} items have a labor time from the labor time table of {contractor}, which has {entries} entries. {none} are charged another way, and for {review} a person decides.',
  'costing.labor.open': 'Where a person decides the labor time: {n}',
  'costing.labor.why.limit': 'The proposed entry covers another size',
  'costing.labor.why.other': 'The proposal cannot be checked',
  'costing.col.quantity': 'Quantity',
  'costing.col.hours': 'Hours',
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
    'Assumed is what price lists for cable usually hold: copper at 150 € per 100 kg is in the price, and 1% procurement costs are added to the notation. The copper number here is cores times cross-section times 9.6 kg per km. The offers in the demo state no copper base. Labor uses the minutes of the labor time table and an hourly rate, both invented for the demo; site, overhead and profit mark-ups are not included. An item a person decides counts at its cheapest clean offer until it is decided, and at the decided price after that.',
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
  'run.done.replay':
    'Run of {date}: {cached} stored answers by {model} read back and each checked again. No model was called.',
  'run.done.escalated':
    '{model} read {questions} questions again, for {positions} items the first model could not settle, and answered {answered} of them.',
  'run.escalating.planning':
    'Everything is read. Looking for what the first model could not settle.',
  'run.escalating':
    'Everything is read. {model} is reading {questions} questions again that the first model could not settle.',
  'run.reading.before': 'A run is reading the offers:',
  'run.replaying.before': 'The stored answers are being checked:',
  'run.reading.after': 'of {total} items.',
  'run.again': 'Read it again',
  'run.again.hint':
    'Reads the stored answers back and checks and decides every item again. Calls no model.',
  'run.live.summary': 'Have the model read afresh',
  'run.live.body':
    'A run in which the model reads needs this demo\u2019s access code. It costs about 40 cents at most: the model is called only for questions nobody has asked yet.',
  'run.live.code': 'Access code',
  'run.live.start': 'Start the run',
  'run.refused.code': 'That is not the code.',
  'run.refused.locked': 'Too many wrong codes. Try again in ten minutes.',
  'run.refused.closed':
    'No access code is set here. On this deployment the model reads only from the command line.',
  'run.refused.running': 'A run is under way.',
  'run.refused.busy':
    'The answers have just been read back several times. Try again in a few minutes.',
  'run.refused.failed': 'The request did not get through. Please try again.',
  'run.deciding':
    'Everything is read. The items are being checked and decided.',
  'run.stopped': 'The last run was stopped: {note}',
  'run.failed': 'The last run failed: {note}',
  'run.none':
    'No run yet. A run reads the offers and decides every item; it is started with pnpm demo:reset.',

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
  'error.retry': 'Try again',
  'error.body': 'The page could not be loaded. Trying again usually helps.',
  'notice.dismiss': 'Close',
  'decision.failed':
    'The decision did not get through. The item is unchanged; please try again.',
}

const messages: Record<Locale, Record<MessageKey, string>> = { de, en }

const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

function readLocale(): Locale {
  if (requestedLocale() === 'en') return 'en'
  try {
    // A choice made before the cookie existed.
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

export function setLocale(locale: Locale): void {
  // A year; the server reads it to render the page in this language.
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Private mode or blocked storage: the cookie carries the choice.
  }
  document.documentElement.lang = locale
  listeners.forEach((notify) => notify())
}

/**
 * The active locale. The server renders the language the request's cookie
 * names, and the browser starts from the same, so the two agree.
 */
export function useLocale(): Locale {
  const locale = useSyncExternalStore(subscribe, readLocale, requestedLocale)
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

/**
 * The document title of a page: what the page is, then the app. Route heads
 * are not components, so this reads the language of the request (on the
 * server) or of the cookie (in the browser) instead of a hook.
 */
export function pageTitle(
  page?: MessageKey,
  values?: Record<string, string | number>,
): string {
  if (page === undefined) return APP_NAME
  let name: string = messages[activeLocale()][page]
  for (const [key, value] of Object.entries(values ?? {})) {
    name = name.replaceAll(`{${key}}`, String(value))
  }
  return `${name} · ${APP_NAME}`
}

/** What the app is, in the language of the request, for the page's head. */
export function pageDescription(): string {
  return messages[activeLocale()]['app.description']
}

/** "1 Position", "1.170 Positionen": the count with its noun in the right number. */
export function positionsText(t: Translate, count: number): string {
  return `${formatQty(count)} ${positionsNoun(t, count)}`
}

export function positionsNoun(t: Translate, count: number): string {
  return t(count === 1 ? 'positions.one' : 'positions.many')
}
