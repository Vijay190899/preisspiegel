import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { DocumentRegister } from '~/components/overview/DocumentRegister'
import { PositionsFigure, TitleMeters } from '~/components/overview/Figures'
import { TitleBlock } from '~/components/overview/TitleBlock'
import { useT } from '~/lib/i18n'
import { tenderQuery } from '~/lib/queries'

export const Route = createFileRoute('/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(tenderQuery),
  component: Overview,
})

function Overview() {
  const t = useT()
  const { data: tender } = useSuspenseQuery(tenderQuery)

  if (tender === null) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-6">
        <section className="sheet sheet-marked px-5 py-8 sm:px-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('overview.empty.title')}
          </h1>
          <p className="mt-3 max-w-[60ch] text-ink-2">
            {t('overview.empty.body')}
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-[1280px] gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <TitleBlock tender={tender} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]">
        <PositionsFigure tender={tender} />
        <DocumentRegister tender={tender} />
      </div>

      <TitleMeters tender={tender} />

      <p className="label !normal-case !tracking-normal">
        {t('app.synthetic')}
      </p>
    </div>
  )
}
