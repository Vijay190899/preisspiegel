import { useSuspenseQuery } from '@tanstack/react-query'
import {
  Link,
  createFileRoute,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo } from 'react'
import { PositionView } from '~/components/positions/PositionView'
import { SourcePanel } from '~/components/source/SourcePanel'
import { useT } from '~/lib/i18n'
import { filterPositions } from '~/lib/positionSearch'
import { positionQuery, positionsQuery, tenderQuery } from '~/lib/queries'
import { searchText } from '~/lib/searchParams'
import { resolveSource } from '~/lib/sources'

export const Route = createFileRoute('/positionen/$oz')({
  /** `quelle` names the value whose source is open, e.g. `a.0.unitPrice`. */
  validateSearch: (search: Record<string, unknown>): { quelle?: string } => ({
    quelle: searchText(search.quelle),
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(positionQuery(params.oz)),
  component: PositionPage,
})

function PositionPage() {
  const t = useT()
  const { oz } = Route.useParams()
  const { quelle } = Route.useSearch()
  const titel = useSearch({
    strict: false,
    select: (search) => search.titel,
  })
  const navigate = useNavigate()
  const { data: tender } = useSuspenseQuery(tenderQuery)
  const { data: rows } = useSuspenseQuery(positionsQuery)
  const { data: detail } = useSuspenseQuery(positionQuery(oz))

  const closeSource = useCallback(() => {
    void navigate({
      to: '.',
      search: (previous) => ({ ...previous, quelle: undefined }),
      replace: true,
      resetScroll: false,
    })
  }, [navigate])

  const source =
    tender === null || detail === null
      ? null
      : resolveSource(quelle, tender, detail)

  // A source name that points at nothing is taken out of the address.
  const dangling = quelle !== undefined && source === null
  useEffect(() => {
    if (dangling) closeSource()
  }, [dangling, closeSource])

  // The arrows step through what the list shows: one title, or all of them.
  const siblings = useMemo(
    () => filterPositions(rows, '', titel),
    [rows, titel],
  )

  if (tender === null || detail === null) {
    return (
      <div className="mx-auto w-full max-w-[680px] px-5 py-12 sm:px-8">
        <p className="code text-ink-3">{oz}</p>
        <h1 className="heading mt-3 text-[1.5rem]">{t('pos.notFound')}</h1>
        <Link
          to="/positionen"
          search={(previous) => ({ titel: previous.titel })}
          className="action mt-8"
        >
          {t('pos.back')}
        </Link>
      </div>
    )
  }

  const index = siblings.findIndex((row) => row.oz === oz)

  return (
    <div className="reader" data-open={source !== null}>
      <div className="h-full min-h-0 overflow-auto">
        <Link
          to="/positionen"
          search={(previous) => ({ titel: previous.titel })}
          className="quiet-action -mb-2 ml-2 mt-3 !h-9 !px-2 text-[0.92rem] sm:ml-5 lg:hidden"
        >
          <ChevronLeft size={16} aria-hidden />
          {t('pos.back')}
        </Link>
        <PositionView
          // A new position arrives afresh.
          key={oz}
          tender={tender}
          detail={detail}
          source={source === null ? undefined : quelle}
          previous={index === -1 ? undefined : siblings[index - 1]?.oz}
          next={index === -1 ? undefined : siblings[index + 1]?.oz}
        />
      </div>

      <div className="reader-scrim" onClick={closeSource} aria-hidden="true" />
      <SourcePanel name={quelle} source={source} onClose={closeSource} />
    </div>
  )
}
