import { Link } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatQty, unitLabel } from '~/lib/format'
import { positionsText, useT } from '~/lib/i18n'
import { filterPositions } from '~/lib/positionSearch'
import type { PositionRow } from '~/lib/queries'

type Item =
  | { kind: 'title'; key: string; rno: string; label: string }
  | { kind: 'subtitle'; key: string; rno: string; label: string }
  | { kind: 'position'; key: string; row: PositionRow }

const HEIGHT = { title: 50, subtitle: 32, position: 54 } as const

/** Positions under their titles, in document order. */
function buildItems(rows: Array<PositionRow>): Array<Item> {
  const items: Array<Item> = []
  let title = ''
  let subtitle = ''
  for (const row of rows) {
    const [first, second] = row.path
    if (first !== undefined && first.rno !== title) {
      title = first.rno
      subtitle = ''
      items.push({ kind: 'title', key: `t${title}`, ...first })
    }
    const section = `${title}.${second?.rno ?? ''}`
    if (second !== undefined && section !== subtitle) {
      subtitle = section
      items.push({
        kind: 'subtitle',
        key: `s${section}`,
        rno: section,
        label: second.label,
      })
    }
    items.push({ kind: 'position', key: row.oz, row })
  }
  return items
}

/**
 * The Leistungsverzeichnis as a list to scroll and search. Only the rows on
 * screen are rendered, so a tender of a few thousand positions stays quick.
 */
export function PositionList({
  rows,
  selected,
  title,
  onVisibleChange,
}: {
  rows: Array<PositionRow>
  selected: string | undefined
  title: string | undefined
  /** Reports the filtered positions, so the keyboard can step through them. */
  onVisibleChange: (visible: Array<PositionRow>) => void
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const scroller = useRef<HTMLDivElement>(null)

  const visible = useMemo(
    () => filterPositions(rows, query, title),
    [rows, query, title],
  )
  const items = useMemo(() => buildItems(visible), [visible])
  const titleLabel = rows.find((row) => row.path[0]?.rno === title)?.path[0]
    ?.label

  useEffect(() => onVisibleChange(visible), [visible, onVisibleChange])

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scroller.current,
    estimateSize: (index) => HEIGHT[items[index]?.kind ?? 'position'],
    getItemKey: (index) => items[index]?.key ?? index,
    overscan: 14,
  })

  // Keep the open position in view, also when it was reached by keyboard.
  useEffect(() => {
    if (selected === undefined) return
    const index = items.findIndex(
      (item) => item.kind === 'position' && item.row.oz === selected,
    )
    if (index === -1) return
    virtualizer.scrollToIndex(index, { align: 'auto' })

    // Stepping with the arrow keys takes the focus along with the selection.
    const list = scroller.current
    if (list === null || !list.contains(document.activeElement)) return
    const frame = requestAnimationFrame(() => {
      list.querySelector<HTMLElement>('[data-selected]')?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [selected, items, virtualizer])

  // The list is one stop for the Tab key: the open position, or else the first.
  const tabStop =
    selected !== undefined && visible.some((row) => row.oz === selected)
      ? selected
      : visible[0]?.oz

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-3 pb-2.5 pt-3">
        <label className="flex h-10 items-center gap-2.5 rounded-control border border-line bg-surface-raised px-3 transition-colors duration-150 focus-within:border-focus">
          <Search size={15} className="shrink-0 text-ink-3" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('list.search')}
            aria-label={t('list.search')}
            className="w-full bg-transparent outline-none placeholder:text-ink-3"
          />
        </label>
        <div className="mt-2.5 flex min-h-7 items-center justify-between gap-2 px-1">
          <p className="caption num" aria-live="polite">
            {positionsText(t, visible.length)}
          </p>
          {title !== undefined && (
            <Link
              to="."
              search={(previous) => ({ ...previous, titel: undefined })}
              replace
              title={t('list.clearTitle')}
              aria-label={`${t('list.clearTitle')}: ${title} ${titleLabel ?? ''}`}
              className="flex h-7 items-center gap-1.5 rounded-full bg-copper-soft pl-2.5 pr-1.5 text-[0.82rem] font-medium text-copper-ink transition-colors duration-150 hover:bg-copper-ink hover:text-on-copper"
            >
              <span className="code text-[0.76rem]">{title}</span>
              <span className="max-w-[13ch] truncate">{titleLabel}</span>
              <X size={13} aria-hidden />
            </Link>
          )}
        </div>
      </div>

      <motion.div
        ref={scroller}
        layoutScroll
        className="min-h-0 flex-1 overflow-auto border-t border-line"
      >
        {items.length === 0 ? (
          <p className="p-5 text-ink-3">{t('list.none')}</p>
        ) : (
          <div
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((virtual) => {
              const item = items[virtual.index]
              if (item === undefined) return null
              return (
                <div
                  key={virtual.key}
                  className="absolute inset-x-0 top-0"
                  style={{
                    height: virtual.size,
                    transform: `translateY(${virtual.start}px)`,
                  }}
                >
                  <ListItem item={item} selected={selected} tabStop={tabStop} />
                </div>
              )
            })}
          </div>
        )}
      </motion.div>
    </div>
  )
}

function ListItem({
  item,
  selected,
  tabStop,
}: {
  item: Item
  selected: string | undefined
  tabStop: string | undefined
}) {
  if (item.kind === 'title') {
    return (
      <div className="flex h-full items-end gap-2.5 px-4 pb-2">
        <span className="code text-[0.8rem] text-copper-ink">{item.rno}</span>
        <span className="heading truncate text-[1rem]">{item.label}</span>
      </div>
    )
  }
  if (item.kind === 'subtitle') {
    return (
      <div className="caption flex h-full items-center gap-2 px-4">
        <span className="truncate">{item.label}</span>
      </div>
    )
  }

  const { row } = item
  const active = row.oz === selected
  return (
    <Link
      to="/positionen/$oz"
      params={{ oz: row.oz }}
      search={(previous) => ({ titel: previous.titel })}
      // The router marks the link of the open position with aria-current.
      data-selected={active ? '' : undefined}
      tabIndex={row.oz === tabStop ? 0 : -1}
      className={`group relative mx-1.5 grid h-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-control px-2.5 transition-colors duration-150 ${
        active ? '' : 'hover:bg-ink/[0.045]'
      }`}
    >
      {active && (
        // One marker that glides from the last open position to this one.
        <motion.span
          layoutId="position-active"
          className="absolute inset-0 rounded-control bg-surface-raised shadow-module"
          transition={{ type: 'spring', stiffness: 520, damping: 40 }}
        >
          <span className="absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-copper" />
        </motion.span>
      )}
      <span className="relative min-w-0">
        <span className="code block text-[0.72rem] leading-none text-ink-3">
          {row.oz}
        </span>
        <span
          className={`mt-1.5 block truncate text-[0.93rem] leading-tight ${
            active ? 'font-medium' : ''
          }`}
        >
          {row.shortText}
        </span>
      </span>
      <span className="num relative whitespace-nowrap text-right text-[0.84rem] text-ink-2">
        {formatQty(row.qty)}{' '}
        <span className="text-ink-3">{unitLabel(row.unit)}</span>
      </span>
    </Link>
  )
}
