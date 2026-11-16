import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { PositionSheet } from '~/components/positions/PositionSheet'
import { SourceViewer } from '~/components/source/SourceViewer'
import { useT } from '~/lib/i18n'
import { positionQuery, positionsQuery, tenderQuery } from '~/lib/queries'
import { resolveSource } from '~/lib/sources'

export const Route = createFileRoute('/positionen/$oz')({
  /** `quelle` names the value whose source is open, e.g. `a.0.unitPrice`. */
  validateSearch: (search: Record<string, unknown>): { quelle?: string } =>
    typeof search.quelle === 'string' ? { quelle: search.quelle } : {},
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(positionQuery(params.oz)),
  component: PositionPage,
})

function PositionPage() {
  const t = useT()
  const { oz } = Route.useParams()
  const { quelle } = Route.useSearch()
  const { data: tender } = useSuspenseQuery(tenderQuery)
  const { data: rows } = useSuspenseQuery(positionsQuery)
  const { data: detail } = useSuspenseQuery(positionQuery(oz))

  if (tender === null || detail === null) {
    return (
      <div className="p-8">
        <p className="num text-ink-3">{oz}</p>
        <h1 className="mt-2 text-[1.2rem] font-semibold">
          {t('pos.notFound')}
        </h1>
      </div>
    )
  }

  const index = rows.findIndex((row) => row.oz === oz)
  const source = resolveSource(quelle, tender, detail)

  return (
    <div className="grid h-full min-h-0 lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(400px,45%)]">
      <div className="min-h-0 overflow-auto">
        <Link
          to="/positionen"
          search={(previous) => ({ titel: previous.titel })}
          className="label flex items-center gap-1 px-4 pt-4 !text-[0.8rem] text-ink-2 sm:px-6 lg:hidden"
        >
          <ChevronLeft size={14} aria-hidden />
          {t('nav.positions')}
        </Link>
        <PositionSheet
          // A new position starts its entrance again.
          key={oz}
          tender={tender}
          detail={detail}
          source={quelle}
          previous={rows[index - 1]?.oz}
          next={rows[index + 1]?.oz}
        />
      </div>

      {/* Beside the sheet on a wide screen; a panel from below on a narrow one. */}
      <aside
        aria-label={t('source.title')}
        className={`min-h-0 border-line-strong bg-surface xl:block xl:border-l ${
          source === null
            ? 'hidden'
            : 'fixed inset-x-0 bottom-0 z-30 h-[72dvh] border-t shadow-lifted xl:static xl:h-auto xl:border-t-0 xl:shadow-none'
        }`}
      >
        <SourceViewer source={source} />
      </aside>
    </div>
  )
}
