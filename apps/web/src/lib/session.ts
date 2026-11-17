import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'preisspiegel:session'

/**
 * The demo has no accounts. A browser gets a random id the first time it
 * decides something, keeps it, and its decisions are stored under it. It
 * says nothing about the person and is sent nowhere but to this app.
 */
let made: string | null = null

function read(): string | null {
  if (made !== null) return made
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null && /^[A-Za-z0-9_-]{16,64}$/.test(stored)) {
      made = stored
      return made
    }
    const fresh = crypto.randomUUID().replaceAll('-', '')
    localStorage.setItem(STORAGE_KEY, fresh)
    made = fresh
  } catch {
    // Storage is blocked: the id lasts for this page only.
    made = crypto.randomUUID().replaceAll('-', '')
  }
  return made
}

const subscribe = () => () => {}

/** This browser's id, or `null` on the server and while the page hydrates. */
export function useSession(): string | null {
  return useSyncExternalStore(subscribe, read, () => null)
}
