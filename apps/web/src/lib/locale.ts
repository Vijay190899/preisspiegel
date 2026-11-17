/**
 * Which language the page is in.
 *
 * The choice is kept in a cookie, so the server can render the page in the
 * right language from the first byte and nothing flashes in the other one.
 * Formatting a number is not a hook, but it has to follow the language the
 * components around it are rendered in: on the server that is the request's
 * language; in the browser `useLocale` notes it every time it is asked.
 */
import { createIsomorphicFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

export type Locale = 'de' | 'en'

export const LOCALE_COOKIE = 'preisspiegel-locale'

/** The language the request asked for, or the one the browser's cookie names. */
export const requestedLocale = createIsomorphicFn()
  .server((): Locale => (getCookie(LOCALE_COOKIE) === 'en' ? 'en' : 'de'))
  .client((): Locale =>
    document.cookie.split('; ').some((entry) => entry === `${LOCALE_COOKIE}=en`)
      ? 'en'
      : 'de',
  )

let active: Locale = 'de'

export function noteLocale(locale: Locale): void {
  active = locale
}

/** The language of the render that is asking. */
export function activeLocale(): Locale {
  if (typeof document !== 'undefined') return active
  // A server renders many requests at once; each one's language comes from
  // its own request, never from a variable they would share.
  try {
    return requestedLocale()
  } catch {
    // No request is being answered: a test or a script. The noted language
    // stands, as it does in the browser.
    return active
  }
}
