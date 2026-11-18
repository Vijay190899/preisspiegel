import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatQty, unitLabel } from '~/lib/format'
import { useT } from '~/lib/i18n'
import { useTenderText } from '~/lib/tenderText'
import { searchPositions } from '~/lib/positionSearch'
import { positionsQuery } from '~/lib/queries'
import type { PositionRow } from '~/lib/queries'

const MAX_RESULTS = 8

/** Jump to a position by ordinal number or text. Opens with ⌘K or Ctrl+K. */
export function CommandPalette() {
  const t = useT()
  const said = useTenderText()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const opener = useRef<Element | null>(null)

  const { data: rows = [] } = useQuery({ ...positionsQuery, enabled: open })
  const results = useMemo(
    () => searchPositions(rows, query, MAX_RESULTS),
    [rows, query],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('preisspiegel:palette', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('preisspiegel:palette', onOpen)
    }
  }, [])

  useEffect(() => {
    if (open) {
      opener.current = document.activeElement
      setQuery('')
      setActive(0)
      // The input mounts with the dialog; focus it once it is there.
      requestAnimationFrame(() => input.current?.focus())
    } else if (opener.current instanceof HTMLElement) {
      opener.current.focus()
    }
  }, [open])

  const go = (row: PositionRow | undefined) => {
    if (row === undefined) return
    setOpen(false)
    void navigate({ to: '/positionen/$oz', params: { oz: row.oz } })
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center bg-scrim px-4 pt-[13vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.jump')}
            className="w-full max-w-[580px] overflow-hidden rounded-module border border-line bg-surface-raised shadow-lifted"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 520, damping: 38 }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false)
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((index) => Math.min(index + 1, results.length - 1))
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((index) => Math.max(index - 1, 0))
              }
              if (event.key === 'Enter') {
                // Focus goes back to the button that opened the palette; the
                // same key press must not press it again.
                event.preventDefault()
                go(results[active])
              }
              // Keep focus inside: the input is the only stop.
              if (event.key === 'Tab') event.preventDefault()
            }}
          >
            <div className="flex items-center gap-3 px-4">
              <Search size={17} className="shrink-0 text-ink-3" aria-hidden />
              <input
                ref={input}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActive(0)
                }}
                placeholder={t('palette.placeholder')}
                aria-label={t('nav.jump')}
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-results"
                aria-activedescendant={
                  results[active] === undefined
                    ? undefined
                    : `palette-${results[active].oz}`
                }
                className="h-14 w-full bg-transparent text-[1.05rem] outline-none placeholder:text-ink-3"
              />
            </div>

            {results.length === 0 && (
              <p
                role="status"
                className="border-t border-line px-3 py-7 text-center text-ink-3"
              >
                {t('palette.empty')}
              </p>
            )}
            <ul
              id="palette-results"
              role="listbox"
              aria-label={t('nav.positions')}
              hidden={results.length === 0}
              className="max-h-[52vh] overflow-auto border-t border-line p-1.5"
            >
              {results.map((row, index) => (
                <li
                  key={row.oz}
                  id={`palette-${row.oz}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    go(row)
                  }}
                  className="relative flex cursor-pointer items-baseline gap-3 rounded-control px-3 py-2.5"
                >
                  {index === active && (
                    <motion.span
                      layoutId="palette-active"
                      className="absolute inset-0 rounded-control bg-lamp-soft"
                      transition={{
                        type: 'spring',
                        stiffness: 600,
                        damping: 42,
                      }}
                    />
                  )}
                  <span className="code relative w-[5.9rem] shrink-0 text-[0.84rem] text-ink-2">
                    {row.oz}
                  </span>
                  <span className="relative min-w-0 flex-1 truncate">
                    {said.item(row.shortText)}
                  </span>
                  <span className="num relative shrink-0 text-[0.84rem] text-ink-3">
                    {formatQty(row.qty)} {unitLabel(row.unit)}
                  </span>
                </li>
              ))}
            </ul>

            <p className="caption border-t border-line px-4 py-2.5">
              {t('palette.hint')}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Opens the palette from a button. */
export function openPalette(): void {
  window.dispatchEvent(new Event('preisspiegel:palette'))
}
