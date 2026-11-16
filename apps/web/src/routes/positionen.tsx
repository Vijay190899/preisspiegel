import { useSuspenseQuery } from '@tanstack/react-query'
import {
  Outlet,
  createFileRoute,
  useNavigate,
  useParams,
} from '@tanstack/react-router'
import { useCallback, useEffect, useRef } from 'react'
import { PositionList } from '~/components/positions/PositionList'
import { positionsQuery, tenderQuery } from '~/lib/queries'
import type { PositionRow } from '~/lib/queries'

export const Route = createFileRoute('/positionen')({
  /** `titel` shows one title of the Leistungsverzeichnis only. */
  validateSearch: (search: Record<string, unknown>): { titel?: string } =>
    typeof search.titel === 'string' ? { titel: search.titel } : {},
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(tenderQuery),
      context.queryClient.ensureQueryData(positionsQuery),
    ]),
  component: Positions,
})

/** The working surface: the list on the left, the open position beside it. */
function Positions() {
  const { titel } = Route.useSearch()
  const { oz } = useParams({ strict: false })
  const { data: rows } = useSuspenseQuery(positionsQuery)
  const navigate = useNavigate()

  const visible = useRef<Array<PositionRow>>(rows)
  const onVisibleChange = useCallback((next: Array<PositionRow>) => {
    visible.current = next
  }, [])

  // J and K step through the list from anywhere; arrows do when the list has focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('input, textarea, [role="dialog"]')) return

      const inList = target?.closest('[data-position-list]') != null
      const step =
        event.key === 'j' || (inList && event.key === 'ArrowDown')
          ? 1
          : event.key === 'k' || (inList && event.key === 'ArrowUp')
            ? -1
            : 0
      if (step === 0) return

      const list = visible.current
      const index = list.findIndex((row) => row.oz === oz)
      const next = index === -1 ? list[0] : list[index + step]
      if (next === undefined) return
      event.preventDefault()
      void navigate({
        to: '/positionen/$oz',
        params: { oz: next.oz },
        search: (previous) => ({ titel: previous.titel }),
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [oz, navigate])

  return (
    <div className="grid min-h-0 flex-1 lg:h-[calc(100dvh-53px)] lg:flex-none lg:grid-cols-[minmax(300px,348px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
      <aside
        data-position-list
        className={`min-h-0 flex-col border-r border-line-strong bg-surface max-lg:h-[calc(100dvh-53px)] ${
          oz === undefined ? 'flex' : 'hidden lg:flex'
        }`}
      >
        <PositionList
          rows={rows}
          selected={oz}
          title={titel}
          onVisibleChange={onVisibleChange}
        />
      </aside>
      <div className="min-h-0 min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
