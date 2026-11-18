import { Link } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { reasonLabel } from '~/lib/findings'
import { formatMoney, formatQty, unitLabel } from '~/lib/format'
import { positionsText, useT } from '~/lib/i18n'
import { filterPositions } from '~/lib/positionSearch'
import { itemInEnglish, useTenderText } from '~/lib/tenderText'
import type { PositionRow, ReviewItem } from '~/lib/queries'

type Item =
  | { kind: 'title'; key: string; rno: string; label: string }
  | { kind: 'subtitle'; key: string; rno: string; label: string }
  | { kind: 'position'; key: string; row: PositionRow }
  | { kind: 'decision'; key: string; item: ReviewItem }

const HEIGHT = { title: 50, subtitle: 32, position: 54, decision: 72 } as const

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
 * The Leistungsverzeichnis as a list to scroll and search, or, once a run
 * has decided the positions, only those that need a person, with the
 * costliest decision first. Only the rows on screen are rendered, so a
 * tender of a few thousand positions stays quick.
 */
export function PositionList({
  rows,
  selected,
  title,
  statuses,
  queue,
  onVisibleChange,
}: {
  rows: Array<PositionRow>
  selected: string | undefined
  title: string | undefined
  /** One letter per position in document order, once a run has decided them. */
  statuses: string | null
  /**
   * The positions that need a decision, when only those are to be shown;
   * `null` while they load, `undefined` when the whole list is shown.
   */
  queue: Array<ReviewItem> | null | undefined
  /** Reports what is listed, in order, so the keyboard can step through it. */
  onVisibleChange: (visible: Array<string>) => void
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const onlyOpen = queue !== undefined

  const items = useMemo((): Array<Item> => {
    if (queue === undefined) {
      return buildItems(filterPositions(rows, query, title))
    }
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return (queue ?? [])
      .filter((item) => title === undefined || item.oz.startsWith(title))
      .filter((item) => {
        const haystack =
          `${item.oz} ${item.shortText} ${itemInEnglish(item.shortText)}`.toLowerCase()
        return words.every((word) => haystack.includes(word))
      })
      .map((item) => ({ kind: 'decision', key: item.oz, item }))
  }, [queue, rows, query, title])

  const listed = useMemo(
    () =>
      items.flatMap((item) =>
        item.kind === 'position'
          ? [item.row.oz]
          : item.kind === 'decision'
            ? [item.item.oz]
            : [],
      ),
    [items],
  )
  const titleLabel = rows.find((row) => row.path[0]?.rno === title)?.path[0]
    ?.label
  const openCount =
    statuses === null
      ? null
      : [...statuses].filter((letter) => letter === 'r').length

  useEffect(() => onVisibleChange(listed), [listed, onVisibleChange])

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
    const index = items.findIndex((item) => item.key === selected)
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
    selected !== undefined && listed.includes(selected) ? selected : listed[0]

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

        {openCount !== null && (
          // All positions, or only the ones a person has to decide.
          <div
            role="group"
            aria-label={t('list.show')}
            className="mt-2.5 grid grid-cols-2 rounded-control bg-surface-sunken p-0.5 text-[0.9rem] font-medium"
          >
            <Scope active={!onlyOpen} offen={undefined}>
              {t('list.all')}
              <span className="num font-normal text-ink-3">
                {formatQty(rows.length)}
              </span>
            </Scope>
            <Scope active={onlyOpen} offen={true}>
              <span
                className="size-2 rounded-full bg-open"
                aria-hidden="true"
              />
              {t('list.open')}
              <span className="num font-normal text-ink-3">
                {formatQty(openCount)}
              </span>
            </Scope>
          </div>
        )}

        <div className="mt-2.5 flex min-h-7 items-center justify-between gap-2 px-1">
          <p className="caption num" aria-live="polite">
            {positionsText(t, listed.length)}
          </p>
          {title !== undefined && (
            <Link
              to="."
              search={(previous) => ({ ...previous, titel: undefined })}
              replace
              title={t('list.clearTitle')}
              aria-label={`${t('list.clearTitle')}: ${title} ${titleLabel ?? ''}`}
              className="flex h-7 items-center gap-1.5 rounded-full bg-lamp-soft pl-2.5 pr-1.5 text-[0.82rem] font-medium text-lamp-ink transition-colors duration-150 hover:bg-lamp-ink hover:text-bg"
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
          <p className="p-5 text-ink-3">
            {queue === null
              ? ''
              : onlyOpen && query === ''
                ? t('list.noneOpen')
                : t('list.none')}
          </p>
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
                  <ListItem
                    item={item}
                    selected={selected}
                    tabStop={tabStop}
                    statuses={statuses}
                  />
                </div>
              )
            })}
          </div>
        )}
      </motion.div>
    </div>
  )
}

/** One side of the switch between all positions and the open ones. */
function Scope({
  active,
  offen,
  children,
}: {
  active: boolean
  offen: true | undefined
  children: React.ReactNode
}) {
  return (
    <Link
      to="/positionen"
      search={(previous) => ({ titel: previous.titel, offen })}
      aria-current={active ? 'true' : undefined}
      activeProps={{}}
      className={`relative flex h-8 items-center justify-center gap-2 rounded-[6px] transition-colors duration-150 ${
        active ? 'text-ink' : 'text-ink-3 hover:text-ink'
      }`}
    >
      {active && (
        <motion.span
          layoutId="list-scope"
          className="absolute inset-0 rounded-[6px] bg-surface-raised shadow-module"
          transition={{ type: 'spring', stiffness: 520, damping: 40 }}
        />
      )}
      <span className="relative flex items-center gap-2">{children}</span>
    </Link>
  )
}

const rowLink =
  'group relative mx-1.5 grid h-full items-center gap-x-3 rounded-control px-2.5 transition-colors duration-150'

/** One marker that glides from the last open position to this one. */
function ActiveMarker() {
  return (
    <motion.span
      layoutId="position-active"
      className="absolute inset-0 rounded-control bg-surface-raised shadow-module"
      transition={{ type: 'spring', stiffness: 520, damping: 40 }}
    />
  )
}

function ListItem({
  item,
  selected,
  tabStop,
  statuses,
}: {
  item: Item
  selected: string | undefined
  tabStop: string | undefined
  statuses: string | null
}) {
  const t = useT()
  const said = useTenderText()
  if (item.kind === 'title') {
    return (
      <div className="flex h-full items-end gap-2.5 px-4 pb-2">
        <span className="code text-[0.8rem] text-lamp-ink">{item.rno}</span>
        <span className="heading truncate text-[1rem]">
          {said.heading(item.label)}
        </span>
      </div>
    )
  }
  if (item.kind === 'subtitle') {
    return (
      <div className="caption flex h-full items-center gap-2 px-4">
        <span className="truncate">{said.heading(item.label)}</span>
      </div>
    )
  }

  if (item.kind === 'decision') {
    const { item: decision } = item
    const active = decision.oz === selected
    const [first, ...more] = decision.reasons
    return (
      <Link
        to="/positionen/$oz"
        params={{ oz: decision.oz }}
        search={(previous) => ({
          titel: previous.titel,
          offen: previous.offen,
        })}
        // The router marks the link of the open position with aria-current.
        data-selected={active ? '' : undefined}
        tabIndex={decision.oz === tabStop ? 0 : -1}
        className={`${rowLink} grid-cols-[minmax(0,1fr)_auto] ${
          active ? '' : 'hover:bg-ink/[0.045]'
        }`}
      >
        {active && <ActiveMarker />}
        <span className="relative min-w-0">
          <span className="code block text-[0.72rem] leading-none text-ink-3">
            {decision.oz}
          </span>
          <span
            className={`mt-1.5 block truncate text-[0.93rem] leading-tight ${
              active ? 'font-medium' : ''
            }`}
          >
            {said.item(decision.shortText)}
          </span>
          <span className="mt-1.5 flex items-center gap-1.5 text-[0.8rem] leading-none text-open-ink">
            <span
              className="size-1.5 rounded-full bg-open"
              aria-hidden="true"
            />
            <span className="truncate">
              {first === undefined ? '' : t(reasonLabel(first))}
              {more.length > 0 && ` +${more.length}`}
            </span>
          </span>
        </span>
        <span className="num relative whitespace-nowrap text-right text-[0.84rem] text-ink-2">
          {decision.atRisk === null ? '' : `${formatMoney(decision.atRisk)} €`}
        </span>
      </Link>
    )
  }

  const { row } = item
  const active = row.oz === selected
  const open = statuses?.[row.seq] === 'r'
  return (
    <Link
      to="/positionen/$oz"
      params={{ oz: row.oz }}
      search={(previous) => ({ titel: previous.titel, offen: previous.offen })}
      // The router marks the link of the open position with aria-current.
      data-selected={active ? '' : undefined}
      tabIndex={row.oz === tabStop ? 0 : -1}
      className={`${rowLink} grid-cols-[minmax(0,1fr)_auto] ${
        active ? '' : 'hover:bg-ink/[0.045]'
      }`}
    >
      {active && <ActiveMarker />}
      <span className="relative min-w-0">
        <span className="code flex items-center gap-1.5 text-[0.72rem] leading-none text-ink-3">
          {row.oz}
          {open && (
            // Only what needs a person is marked; the rest stays quiet.
            <span
              className="size-1.5 rounded-full bg-open"
              role="img"
              aria-label={t('list.status.r')}
            />
          )}
        </span>
        <span
          className={`mt-1.5 block truncate text-[0.93rem] leading-tight ${
            active ? 'font-medium' : ''
          }`}
        >
          {said.item(row.shortText)}
        </span>
      </span>
      <span className="num relative whitespace-nowrap text-right text-[0.84rem] text-ink-2">
        {formatQty(row.qty)}{' '}
        <span className="text-ink-3">{unitLabel(row.unit, row.qty)}</span>
      </span>
    </Link>
  )
}
