import { useSyncExternalStore } from 'react'
import type { MessageKey } from './i18n'

/**
 * One short line the app says when something the visitor did could not be
 * done: a decision that did not get through, say. It stays for a few
 * seconds and is read out by screen readers. Pages keep their own messages
 * for what belongs to them; this is for actions that leave the page as it
 * was, where nothing else would show that they failed.
 */
export const NOTICE_MS = 6000

let current: MessageKey | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function say(message: MessageKey): void {
  current = message
  clearTimeout(timer)
  timer = setTimeout(dismiss, NOTICE_MS)
  emit()
}

/** What is being said now, if anything. */
export function peekNotice(): MessageKey | null {
  return current
}

export function dismiss(): void {
  current = null
  clearTimeout(timer)
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useNotice(): MessageKey | null {
  return useSyncExternalStore(subscribe, peekNotice, () => null)
}
