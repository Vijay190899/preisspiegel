import { useSyncExternalStore } from 'react'

export type Locale = 'de' | 'en'

const STORAGE_KEY = 'preisspiegel:locale'
const DEFAULT_LOCALE: Locale = 'de'

/**
 * UI copy. German is the working language of the people this is for, so it is
 * the default and the source of truth; English mirrors it key for key.
 * Domain terms (Leistungsverzeichnis, Position, Preisspiegel) stay German in
 * both, because that is what an estimator calls them.
 */
const de = {
  'app.tagline': 'Angebotskalkulation mit Quellenangabe',
  'app.skipToContent': 'Zum Inhalt springen',

  'theme.toLight': 'Helles Design aktivieren',
  'theme.toDark': 'Dunkles Design aktivieren',
  'locale.switch': 'Switch to English',

  'home.eyebrow': 'Ausschreibung',
  'home.empty.title': 'Noch keine Ausschreibung geladen',
  'home.empty.body':
    'Sobald ein Leistungsverzeichnis und die Lieferantenangebote eingelesen sind, erscheint hier die Übersicht: wie viele Positionen automatisch kalkuliert wurden und welche eine Entscheidung brauchen.',

  'status.title': 'Systemstatus',
  'status.backend': 'Backend',
  'status.connected': 'Verbunden',
  'status.provider': 'Anbieter',
  'status.models': 'Modelle',
  'status.modelsHint':
    'Jede Rolle ist eine Umgebungsvariable. Größere Modelle laufen nur, wenn eine Rolle ausdrücklich darauf zeigt.',
  'status.role.match': 'Zuordnung',
  'status.role.escalation': 'Eskalation',
  'status.role.investigator': 'Klärung',
  'status.off': 'aus',
} as const

type MessageKey = keyof typeof de

const en: Record<MessageKey, string> = {
  'app.tagline': 'Tender pricing with every number sourced',
  'app.skipToContent': 'Skip to content',

  'theme.toLight': 'Switch to light theme',
  'theme.toDark': 'Switch to dark theme',
  'locale.switch': 'Auf Deutsch umschalten',

  'home.eyebrow': 'Tender',
  'home.empty.title': 'No tender loaded yet',
  'home.empty.body':
    'Once a Leistungsverzeichnis and the supplier offers are read in, the overview appears here: how many positions were priced automatically and which ones need a decision.',

  'status.title': 'System status',
  'status.backend': 'Backend',
  'status.connected': 'Connected',
  'status.provider': 'Provider',
  'status.models': 'Models',
  'status.modelsHint':
    'Every role is an environment variable. Larger models run only when a role is explicitly pointed at one.',
  'status.role.match': 'Matching',
  'status.role.escalation': 'Escalation',
  'status.role.investigator': 'Investigation',
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

export type Translate = (key: MessageKey) => string

export function useT(): Translate {
  const locale = useLocale()
  return (key) => messages[locale][key]
}
