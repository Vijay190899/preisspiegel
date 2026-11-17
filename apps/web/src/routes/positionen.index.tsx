import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { filterPositions } from '~/lib/positionSearch'
import { positionsQuery } from '~/lib/queries'

export const Route = createFileRoute('/positionen/')({
  component: FirstPosition,
})

/** Where there is room for the list and a position side by side. */
const WIDE = '(min-width: 1024px)'

/**
 * No position is named. A wide screen opens the first one of the list, so the
 * place beside the list is never empty; a narrow screen shows the list alone.
 */
function FirstPosition() {
  const { titel } = Route.useSearch()
  const navigate = useNavigate()
  const { data: rows } = useSuspenseQuery(positionsQuery)
  const first = filterPositions(rows, '', titel)[0]?.oz

  useEffect(() => {
    if (first === undefined || !window.matchMedia(WIDE).matches) return
    void navigate({
      to: '/positionen/$oz',
      params: { oz: first },
      search: (previous) => ({ titel: previous.titel }),
      replace: true,
    })
  }, [first, navigate])

  return null
}
