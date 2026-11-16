import { Link } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatQty, unitLabel } from '~/lib/format'
import { useT } from '~/lib/i18n'
import { filterPositions } from '~/lib/positionSearch'
import type { PositionRow } from '~/lib/queries'

type Item =
  | { kind: 'title'; key: string; rno: string; label: string }
  | { kind: 'subtitle'; key: string; rno: string; label: string }
  | { kind: 'position'; key: string; row: PositionRow }

const HEIGHT = { title: 38, subtitle: 30, position: 46 } as const

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
    if (index !== -1) virtualizer.scrollToIndex(index, { align: 'auto' })
  }, [selected, items, virtualizer])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line p-3">
        <label className="flex h-9 items-center gap-2 rounded-sm border border-line bg-surface-raised px-2.5 focus-within:border-focus">
          <Search size={14} className="shrink-0 text-ink-3" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('list.search')}
            aria-label={t('list.search')}
            className="w-full bg-transparent text-[0.93rem] outline-none placeholder:text-ink-3"
          />
        </label>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <p className="label !normal-case !tracking-normal" aria-live="polite">
            {t('list.count', { n: formatQty(visible.length) })}
          </p>
          {title !== undefined && (
            <Link
              to="."
              search={(previous) => ({ ...previous, titel: undefined })}
              replace
              className="label flex items-center gap-1 border border-line-strong py-1 pl-2 pr-1 !normal-case !tracking-normal text-ink hover:border-accent"
            >
              <span className="num">{title}</span>
              <span className="max-w-[14ch] truncate">{titleLabel}</span>
              <X size={12} aria-hidden />
            </Link>
          )}
        </div>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-auto">
        {items.length === 0 ? (
          <p className="p-5 text-[0.93rem] text-ink-3">{t('list.none')}</p>
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
                  <ListItem item={item} selected={selected} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function ListItem({
  item,
  selected,
}: {
  item: Item
  selected: string | undefined
}) {
  if (item.kind === 'title') {
    return (
      <div className="flex h-full items-end gap-2.5 border-b border-line-strong bg-surface px-3 pb-2">
        <span className="num text-[0.8rem] text-accent-ink">{item.rno}</span>
        <span className="truncate text-[0.93rem] font-semibold">
          {item.label}
        </span>
      </div>
    )
  }
  if (item.kind === 'subtitle') {
    return (
      <div className="label flex h-full items-center gap-2.5 border-b border-line bg-surface-sunken px-3 !tracking-[0.05em]">
        <span className="num !tracking-normal">{item.rno}</span>
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
      aria-current={active ? 'true' : undefined}
      className={`grid h-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b border-l-2 border-b-line px-3 transition-colors duration-100 ${
        active
          ? 'border-l-accent bg-accent-soft'
          : 'border-l-transparent hover:bg-surface-sunken'
      }`}
    >
      <span className="min-w-0">
        <span className="num block text-[0.73rem] leading-none text-ink-3">
          {row.oz}
        </span>
        <span className="mt-1 block truncate text-[0.9rem] leading-tight">
          {row.shortText}
        </span>
      </span>
      <span className="num whitespace-nowrap text-right text-[0.8rem] text-ink-2">
        {formatQty(row.qty)}{' '}
        <span className="text-ink-3">{unitLabel(row.unit)}</span>
      </span>
    </Link>
  )
}
