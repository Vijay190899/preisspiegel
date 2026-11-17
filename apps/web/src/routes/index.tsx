import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Shares } from '~/components/overview/Breakdown'
import { Decisions, groupDecisions } from '~/components/overview/Decisions'
import { Facade } from '~/components/overview/Facade'
import { PictureKey } from '~/components/overview/PictureKey'
import { RunLine } from '~/components/overview/RunLine'
import { Scenery } from '~/components/overview/Scenery'
import { formatMoney, formatQty } from '~/lib/format'
import { settleCounts, settleQueue, settleStatuses } from '~/lib/decisions'
import { useT } from '~/lib/i18n'
import { usePace } from '~/lib/pace'
import { useTenderText } from '~/lib/tenderText'
import { useDecisions } from '~/lib/useDecisions'
import {
  offers,
  reviewQueueQuery,
  runQuery,
  statusesQuery,
  tenderQuery,
} from '~/lib/queries'
import type { Pointing } from '~/components/overview/PictureKey'

const EASE = [0.22, 1, 0.36, 1] as const
/** How many decisions the overview lists; the rest are one click away. */
const LISTED = 6

export const Route = createFileRoute('/')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(tenderQuery),
      context.queryClient.ensureQueryData(runQuery),
      context.queryClient.ensureQueryData(statusesQuery),
      context.queryClient.ensureQueryData(reviewQueueQuery),
    ]),
  component: Overview,
})

function Overview() {
  const t = useT()
  const said = useTenderText()
  const { pace } = usePace()
  const { data: tender } = useSuspenseQuery(tenderQuery)
  const { data: run } = useSuspenseQuery(runQuery)
  const { data: statuses } = useSuspenseQuery(statusesQuery)
  const { data: wholeQueue } = useSuspenseQuery(reviewQueueQuery)
  // What the estimator has decided is laid over what the run decided.
  const { decided: mine } = useDecisions()
  const queue = settleQueue(wholeQueue, mine)
  const [pointing, setPointing] = useState<Pointing>(null)

  if (tender === null) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-4 py-24 sm:px-8">
        <h1 className="display text-[clamp(2.4rem,5vw,4rem)]">
          {t('overview.empty.title')}
        </h1>
        <p className="mt-6 max-w-[60ch] text-[1.1rem] text-ink-2">
          {t('overview.empty.body')}
        </p>
      </div>
    )
  }

  // The words settle first; then the lights come on behind them.
  const arrive = (order: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: pace({ delay: order * 0.08, duration: 0.7, ease: EASE }),
  })

  const { current, done } = run
  const underWay =
    current !== null &&
    (current.status === 'preparing' ||
      current.status === 'reading' ||
      current.status === 'deciding')
  const decided =
    !underWay && done !== null && done.auto !== null && done.review !== null
  const suppliers = offers(tender)
  const storeyOf = (seq: number): string | null => {
    const letter = tender.storeyByPosition[seq]
    return letter === undefined || letter === '-'
      ? null
      : said.storey(tender.storeys[parseInt(letter, 36)] ?? '', true) || null
  }
  const counts = done === null ? null : settleCounts(done, wholeQueue, mine)
  const open = counts?.review ?? 0

  return (
    <div>
      <div>
        <section className="scene">
          <Scenery />
          <div className="mx-auto w-full max-w-[1320px] px-4 pt-12 sm:px-8 sm:pt-16 lg:pt-20">
            <div className="grid gap-x-16 gap-y-9 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-end">
              <div>
                <motion.h1
                  {...arrive(0)}
                  className="display text-[clamp(2.4rem,4.9vw,4.4rem)]"
                >
                  {said.project(tender.project)}
                </motion.h1>
                <motion.p {...arrive(1)} className="mt-5 text-ink-3">
                  {t('overview.project', {
                    lot: said.project(tender.lot),
                    no: tender.projectNo,
                  })}
                </motion.p>
              </div>

              <motion.div {...arrive(2)}>
                {decided ? (
                  <p className="statement">
                    <b>{formatQty(counts?.auto ?? 0)}</b>{' '}
                    {t('overview.priced', { total: formatQty(done.positions) })}{' '}
                    {open > 0 && (
                      <>
                        <b>{formatQty(open)}</b>{' '}
                        {t(
                          open === 1
                            ? 'overview.wait.one'
                            : 'overview.wait.many',
                        )}
                        {counts !== null &&
                          counts.atRisk !== null &&
                          counts.atRisk > 0 && (
                            <>
                              {' '}
                              {t('overview.stake.before')}{' '}
                              <b className="whitespace-nowrap">
                                {formatMoney(counts.atRisk)} €
                              </b>
                              {t('overview.stake.after')}
                            </>
                          )}
                      </>
                    )}
                  </p>
                ) : (
                  <p className="statement">
                    {t('overview.lead', {
                      bidder: tender.contractor,
                      client: tender.client,
                      n: suppliers.length,
                    })}
                  </p>
                )}
                <div className="mt-7 flex flex-wrap items-center gap-2">
                  {decided && open > 0 ? (
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
            </div>
          </div>

          <div className="mt-12 sm:mt-16 lg:mt-20">
            <Facade
              tender={tender}
              statuses={settleStatuses(statuses, mine)}
              reading={underWay ? current.read : null}
              pointing={pointing}
            />
          </div>
        </section>
        <div className="key-bar">
          <div className="mx-auto w-full max-w-[1320px] px-4 py-3 sm:px-8 xl:py-5">
            <PictureKey
              tender={tender}
              queue={decided ? queue : []}
              unread={statuses === null}
              onPoint={setPointing}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1320px] px-4 pb-20 sm:px-8">
        {decided && queue.length > 0 && (
          <div className="mt-20 grid gap-x-20 gap-y-16 lg:mt-28 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <section aria-labelledby="costly" className="min-w-0">
              <h2 id="costly" className="heading text-[1.75rem]">
                {t('ledger.title')}
              </h2>
              <p className="mt-2 max-w-[60ch] text-ink-2">{t('ledger.body')}</p>
              <p className="caption mt-2 max-w-[70ch]">
                {t('ledger.key', {
                  suppliers: suppliers
                    .map((supplier) => supplier.supplierName ?? supplier.key)
                    .join(', '),
                })}
              </p>
              <div className="mt-7">
                <Decisions
                  groups={groupDecisions(queue).slice(0, LISTED)}
                  suppliers={suppliers}
                  storeyOf={storeyOf}
                />
              </div>
              <Link
                to="/positionen"
                search={{ offen: true }}
                className="quiet-action -ml-3.5 mt-3"
              >
                {t('ledger.all', { n: formatQty(queue.length) })}
              </Link>
            </section>

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-14">
              <section aria-labelledby="who">
                <h2 id="who" className="heading text-[1.3rem]">
                  {t('shares.title')}
                </h2>
                <div className="mt-5">
                  <Shares wins={done.wins} suppliers={suppliers} />
                </div>
              </section>
            </div>
          </div>
        )}

        <div className="mt-20 grid gap-3 border-t border-line pt-6">
          <RunLine current={run.current} done={run.done} />
          <p className="caption">{t('app.synthetic')}</p>
        </div>
      </div>
    </div>
  )
}
