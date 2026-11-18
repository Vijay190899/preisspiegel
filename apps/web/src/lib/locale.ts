/**
 * Which language the current render is in.
 *
 * Formatting a number is not a hook, but it has to follow the language the
 * components around it are rendered in: German on the server and while the
 * page hydrates, then the reader's choice. `useLocale` notes the language
 * every time it is asked, and the formatters read it here.
 */
export type Locale = 'de' | 'en'

let active: Locale = 'de'

export function noteLocale(locale: Locale): void {
  active = locale
}

export function activeLocale(): Locale {
  return active
}
