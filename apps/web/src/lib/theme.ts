import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'preisspiegel:theme'

/**
 * Runs in <head> before first paint, so the page never flashes the wrong
 * theme. A stored choice wins; otherwise it is night, which is how the
 * interface was drawn. Day is a choice.
 */
export const themeBootScript = `(function(){var t='dark';try{var s=localStorage.getItem('${STORAGE_KEY}');if(s==='light'||s==='dark')t=s}catch(e){}document.documentElement.dataset.theme=t})()`

const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

function readTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
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

/** The active theme. The server renders night; the boot script applies a stored choice. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => 'dark')
}
