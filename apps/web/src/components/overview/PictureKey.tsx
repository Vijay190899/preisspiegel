import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { reasonLabel } from '~/lib/findings'
import { formatQty } from '~/lib/format'
import { useT } from '~/lib/i18n'
import { useTenderText } from '~/lib/tenderText'
import type { ReasonCode, ReviewItem, Tender } from '~/lib/queries'

/** Windows to pick out on the building, by their place in the document. */
export type Pointing = ReadonlySet<number> | null

/**
 * The key to the picture, and a way to ask it questions: what the two kinds
 * of window mean, why the red ones are red, and which bay is which title.
 * Pointing at a reason or a title picks its windows out on the building;
 * a reason can also be held with a click.
 */
export function PictureKey({
  tender,
  queue,
  unread,
  onPoint,
}: {
  tender: Tender
  queue: ReadonlyArray<ReviewItem>
  /** Whether some windows are still dark. */
  unread: boolean
  onPoint: (windows: Pointing) => void
}) {
  const t = useT()
  const said = useTenderText()
  const [held, setHeld] = useState<ReasonCode | null>(null)

  const byReason = useMemo(() => {
    const found = new Map<ReasonCode, Set<number>>()
    for (const item of queue) {
      for (const code of item.reasons) {
        const windows = found.get(code) ?? new Set<number>()
        windows.add(item.seq)
        found.set(code, windows)
      }
    }
    return [...found.entries()].sort(([, a], [, b]) => b.size - a.size)
  }, [queue])

  const byTitle = useMemo(() => {
    let from = 0
    return tender.titles.map((title) => {
      const windows = new Set<number>()
      for (let n = 0; n < title.positionCount; n++) windows.add(from + n)
      from += title.positionCount
      return { ...title, windows }
    })
  }, [tender.titles])

  const heldWindows =
    held === null
      ? null
      : (byReason.find(([code]) => code === held)?.[1] ?? null)
  const point = (windows: Pointing) => onPoint(windows)
  const release = () => onPoint(heldWindows)

  return (
    <div className="grid gap-4 text-[0.9rem]">
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-ink-2">
        <li className="text-ink-3">{t('facade.caption')}</li>
        <li className="flex items-center gap-2">
          <Swatch glass="var(--t-glass)" />
          {t('facade.state.priced')}
        </li>
        <li className="flex items-center gap-2">
          <Swatch glass="var(--t-glass-open)" />
          {t('facade.state.open')}
          {byReason.length > 0 && ':'}
        </li>
        {byReason.map(([code, windows]) => {
          const on = held === code
          return (
            <li key={code}>
              <button
                type="button"
                aria-pressed={on}
                title={t('key.hold')}
                onPointerEnter={() => point(windows)}
                onPointerLeave={release}
                onFocus={() => point(windows)}
                onBlur={release}
                onClick={() => {
                  setHeld(on ? null : code)
                  onPoint(on ? null : windows)
                }}
                className={`flex h-8 items-center gap-2 rounded-full border px-3 transition-colors duration-150 ${
                  on
                    ? 'border-open bg-open-soft text-ink'
                    : 'border-line text-ink-2 hover:border-line-strong hover:text-ink'
                }`}
              >
                {t(reasonLabel(code))}
                <span className="num text-ink-3">
                  {formatQty(windows.size)}
                </span>
              </button>
            </li>
          )
        })}
        {unread && (
          <li className="flex items-center gap-2">
            <Swatch glass="var(--t-glass-off)" />
            {t('facade.state.off')}
          </li>
        )}
      </ul>

      {/* What the numbers under the roof stand for: the tender's titles. */}
      <nav aria-label={t('facade.titles')}>
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
          {byTitle.map((title) => (
            <li key={title.rno}>
              <Link
                to="/positionen"
                search={{ titel: title.rno }}
                onPointerEnter={() => point(title.windows)}
                onPointerLeave={release}
                onFocus={() => point(title.windows)}
                onBlur={release}
                className="group inline-flex items-baseline gap-2 rounded-[4px] text-ink-2 transition-colors duration-150 hover:text-ink"
              >
                <span className="code text-[0.8rem] text-ink-3 group-hover:text-ink-2">
                  {title.rno}
                </span>
                {said.heading(title.label)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

/** A window in a piece of wall, small, for the key under the picture. */
function Swatch({ glass }: { glass: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-grid h-5 w-3.5 place-items-center rounded-[2px] bg-wall"
    >
      <span
        className="block h-3.5 w-[5px] rounded-[1px]"
        style={{ background: glass }}
      />
    </span>
  )
}
