import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { filterPositions } from '~/lib/positionSearch'
import {
  matchQuery,
  positionLaborQuery,
  positionQuery,
  positionsQuery,
  reviewQueueQuery,
} from '~/lib/queries'

/**
 * How long the first position's data is kept unwatched: long enough for the
 * browser to hydrate and open it, which on a slow connection takes seconds.
 */
const KEPT_FOR_OPENING_MS = 60_000

export const Route = createFileRoute('/positionen/')({
  loaderDeps: ({ search }) => ({ titel: search.titel, offen: search.offen }),
  /**
   * The server cannot know how wide the screen is, so the browser decides
   * whether to open the first position. The server fetches that position
   * while it renders the list and sends it with the page; when the browser
   * opens it, it is there, and nothing waits for the live connection.
   */
  loader: async ({ context, deps }) => {
    const { queryClient } = context
    const rows = await queryClient.ensureQueryData(positionsQuery)
    const queue =
      deps.offen === true
        ? await queryClient.ensureQueryData(reviewQueueQuery)
        : []
    const first = firstOz(rows, queue, deps.titel, deps.offen)
    if (first === undefined) return
    const keep = { gcTime: KEPT_FOR_OPENING_MS }
    await Promise.all([
      queryClient.ensureQueryData({ ...positionQuery(first), ...keep }),
      queryClient.ensureQueryData({ ...matchQuery(first), ...keep }),
      queryClient.ensureQueryData({ ...positionLaborQuery(first), ...keep }),
    ])
  },
  component: FirstPosition,
})

/** The position a wide screen opens: the first listed, or the first open one. */
function firstOz(
  rows: Parameters<typeof filterPositions>[0],
  queue: ReadonlyArray<{ oz: string }> | undefined,
  titel: string | undefined,
  offen: true | undefined,
): string | undefined {
  return offen === true
    ? queue?.find((item) => titel === undefined || item.oz.startsWith(titel))
        ?.oz
    : filterPositions(rows, '', titel)[0]?.oz
}

/** Where there is room for the list and a position side by side. */
const WIDE = '(min-width: 1024px)'

/**
 * No position is named. A wide screen opens the first one of the list, so the
 * place beside the list is never empty; a narrow screen shows the list alone.
 */
function FirstPosition() {
  const { titel, offen } = Route.useSearch()
  const navigate = useNavigate()
  const { data: rows } = useSuspenseQuery(positionsQuery)
  const { data: queue } = useQuery({
    ...reviewQueueQuery,
    enabled: offen === true,
  })
  const first = firstOz(rows, queue, titel, offen)

  useEffect(() => {
    if (first === undefined || !window.matchMedia(WIDE).matches) return
    void navigate({
      to: '/positionen/$oz',
      params: { oz: first },
      search: (previous) => ({ titel: previous.titel, offen: previous.offen }),
      replace: true,
    })
  }, [first, navigate])

  return null
}
