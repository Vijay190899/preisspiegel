import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import {
  Outlet,
  createFileRoute,
  useNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router'
import { useCallback, useEffect, useRef } from 'react'
import { PositionList } from '~/components/positions/PositionList'
import { settleQueue, settleStatuses } from '~/lib/decisions'
import {
  positionsQuery,
  reviewQueueQuery,
  statusesQuery,
  tenderQuery,
} from '~/lib/queries'
import { searchFlag, searchText } from '~/lib/searchParams'
import { useDecisions } from '~/lib/useDecisions'

export const Route = createFileRoute('/positionen')({
  /**
   * `titel` shows one title of the Leistungsverzeichnis only. `offen` shows
   * only the positions that need a decision, the costliest first.
   */
  validateSearch: (
    search: Record<string, unknown>,
  ): { titel?: string; offen?: true } => ({
    titel: searchText(search.titel),
    offen: searchFlag(search.offen),
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(tenderQuery),
      context.queryClient.ensureQueryData(positionsQuery),
      context.queryClient.ensureQueryData(statusesQuery),
    ]),
  component: Positions,
})

/** The working surface: the list on the left, the open position beside it. */
function Positions() {
  const { titel, offen } = Route.useSearch()
  const { oz } = useParams({ strict: false })
  // Set by the position route while one of its numbers has its source open.
  const sourceOpen = useSearch({
    strict: false,
    select: (search) => search.quelle !== undefined,
  })
  const { data: rows } = useSuspenseQuery(positionsQuery)
  const { data: statuses } = useSuspenseQuery(statusesQuery)
  const { data: queue } = useQuery({
    ...reviewQueueQuery,
    enabled: offen === true,
  })
  const { decided } = useDecisions()
  const navigate = useNavigate()

  const visible = useRef<Array<string>>(rows.map((row) => row.oz))
  const onVisibleChange = useCallback((next: Array<string>) => {
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
      const index = oz === undefined ? -1 : list.indexOf(oz)
      const next = index === -1 ? list[0] : list[index + step]
      if (next === undefined) return
      event.preventDefault()
      void navigate({
        to: '/positionen/$oz',
        params: { oz: next },
        search: (previous) => ({
          titel: previous.titel,
          offen: previous.offen,
        }),
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [oz, navigate])

  return (
    <div className="workspace" data-focused={oz !== undefined && sourceOpen}>
      <aside
        data-position-list
        className={`workspace-list min-h-0 bg-surface max-lg:h-[calc(100dvh-var(--header-h))] ${
          oz === undefined ? '' : 'max-lg:hidden'
        }`}
      >
        <PositionList
          rows={rows}
          selected={oz}
          title={titel}
          statuses={settleStatuses(statuses, decided)}
          queue={
            offen === true
              ? queue === undefined
                ? null
                : settleQueue(queue, decided)
              : undefined
          }
          onVisibleChange={onVisibleChange}
        />
      </aside>
      <div className="min-h-0 min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
