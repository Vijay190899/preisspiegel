import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'preisspiegel:theme'

/**
 * Runs in <head> before first paint, so the page never flashes the wrong
 * theme. A stored choice wins; otherwise the operating system decides.
 */
export const themeBootScript = `(function(){try{var s=localStorage.getItem('${STORAGE_KEY}');var t=s==='light'||s==='dark'?s:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})()`

const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

function readTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
  listeners.forEach((notify) => notify())
}

/** The active theme. On the server it reports light; the boot script corrects it. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => 'light')
}
