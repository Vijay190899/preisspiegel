import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { CornerDownLeft, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatQty, unitLabel } from '~/lib/format'
import { useT } from '~/lib/i18n'
import { searchPositions } from '~/lib/positionSearch'
import { positionsQuery } from '~/lib/queries'
import type { PositionRow } from '~/lib/queries'

const MAX_RESULTS = 8

/** Jump to a position by ordinal number or text. Opens with ⌘K or Ctrl+K. */
export function CommandPalette() {
  const t = useT()
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
      input.current?.focus()
    } else if (opener.current instanceof HTMLElement) {
      opener.current.focus()
    }
  }, [open])

  if (!open) return null

  const go = (row: PositionRow | undefined) => {
    if (row === undefined) return
    setOpen(false)
    void navigate({ to: '/positionen/$oz', params: { oz: row.oz } })
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start justify-center bg-ink/25 px-4 pt-[14vh] backdrop-blur-[2px] dark:bg-black/50"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false)
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.jump')}
        className="sheet enter w-full max-w-[560px] shadow-lifted"
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
          if (event.key === 'Enter') go(results[active])
        }}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={16} className="shrink-0 text-ink-3" aria-hidden />
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
            className="h-12 w-full bg-transparent text-[1rem] text-ink outline-none placeholder:text-ink-3"
          />
        </div>

        <ul
          id="palette-results"
          role="listbox"
          className="max-h-[52vh] overflow-auto py-1"
        >
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-[0.93rem] text-ink-3">
              {t('palette.empty')}
            </li>
          ) : (
            results.map((row, index) => (
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
                className={`flex cursor-pointer items-baseline gap-3 px-4 py-2 ${
                  index === active ? 'bg-accent-soft' : ''
                }`}
              >
                <span className="num w-[5.6rem] shrink-0 text-[0.87rem] text-ink-2">
                  {row.oz}
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.93rem] text-ink">
                  {row.shortText}
                </span>
                <span className="num shrink-0 text-[0.8rem] text-ink-3">
                  {formatQty(row.qty)} {unitLabel(row.unit)}
                </span>
              </li>
            ))
          )}
        </ul>

        <div className="label flex items-center gap-2 border-t border-line px-4 py-2.5">
          <CornerDownLeft size={12} aria-hidden />
          {t('palette.hint')}
        </div>
      </div>
    </div>
  )
}

/** Opens the palette from a button. */
export function openPalette(): void {
  window.dispatchEvent(new Event('preisspiegel:palette'))
}
