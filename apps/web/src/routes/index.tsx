import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { RunLine } from '~/components/overview/RunLine'
import { Schematic } from '~/components/overview/Schematic'
import { useT } from '~/lib/i18n'
import { usePace } from '~/lib/pace'
import { formatMoney, formatQty } from '~/lib/format'
import { offers, runQuery, statusesQuery, tenderQuery } from '~/lib/queries'

const EASE = [0.22, 1, 0.36, 1] as const

export const Route = createFileRoute('/')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(tenderQuery),
      context.queryClient.ensureQueryData(runQuery),
      context.queryClient.ensureQueryData(statusesQuery),
    ]),
  component: Overview,
})

function Overview() {
  const t = useT()
  const { pace } = usePace()
  const { data: tender } = useSuspenseQuery(tenderQuery)
  const { data: run } = useSuspenseQuery(runQuery)
  const { data: statuses } = useSuspenseQuery(statusesQuery)

  if (tender === null) {
    return (
      <div className="mx-auto w-full max-w-[1240px] px-4 py-20 sm:px-8">
        <h1 className="display text-[2.2rem]">{t('overview.empty.title')}</h1>
        <p className="mt-4 max-w-[60ch] text-[1.05rem] text-ink-2">
          {t('overview.empty.body')}
        </p>
      </div>
    )
  }

  // The words arrive first and settle; then the diagram switches on.
  const arrive = (order: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: pace({ delay: order * 0.07, duration: 0.6, ease: EASE }),
  })
  const done = run.done
  const decided = done !== null && done.auto !== null && done.review !== null

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-10 sm:px-8 sm:pt-16">
      <header className="max-w-[23ch] text-[clamp(2.3rem,5.6vw,4.4rem)]">
        <motion.p
          {...arrive(0)}
          className="mb-4 text-[1rem] font-medium text-ink-3"
        >
          {t('overview.project', { lot: tender.lot, no: tender.projectNo })}
        </motion.p>
        <motion.h1 {...arrive(1)} className="display text-[1em]">
          {tender.project}
        </motion.h1>
      </header>

      <motion.div
        {...arrive(2)}
        className="mt-7 flex flex-wrap items-center gap-x-10 gap-y-6"
      >
        {decided ? (
          // What the run came to, in two sentences and one figure in euros.
          <p className="max-w-[40ch] text-[1.25rem] leading-snug text-ink-2">
            <span className="text-ink">
              {t('overview.result', {
                auto: formatQty(done.auto ?? 0),
                total: formatQty(done.positions),
              })}
            </span>{' '}
            {done.review === 1
              ? t('overview.review.one')
              : t('overview.review.many', {
                  n: formatQty(done.review ?? 0),
                })}{' '}
            {done.atRisk !== null && done.atRisk > 0 && (
              <span className="num">
                {t('overview.atRisk', { amount: formatMoney(done.atRisk) })}
              </span>
            )}
          </p>
        ) : (
          <p className="max-w-[46ch] text-[1.1rem] leading-relaxed text-ink-2">
            {t('overview.lead', {
              bidder: tender.contractor,
              client: tender.client,
              n: offers(tender).length,
            })}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {decided && (done.review ?? 0) > 0 ? (
            <>
              <Link
                to="/positionen"
                search={{ offen: true }}
                className="action"
              >
                {t('overview.decide')}
              </Link>
              <Link to="/positionen" className="quiet-action">
                {t('overview.all')}
              </Link>
            </>
          ) : (
            <Link to="/positionen" className="action">
              {t('overview.open')}
            </Link>
          )}
        </div>
      </motion.div>

      <div className="mt-12 sm:mt-20">
        <Schematic tender={tender} statuses={statuses} />
      </div>

      <div className="mt-12 grid gap-4">
        <RunLine current={run.current} done={run.done} />
        <p className="caption">{t('app.synthetic')}</p>
      </div>
    </div>
  )
}
