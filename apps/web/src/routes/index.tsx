import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { Schematic } from '~/components/overview/Schematic'
import { useT } from '~/lib/i18n'
import { usePace } from '~/lib/pace'
import { offers, tenderQuery } from '~/lib/queries'

const EASE = [0.22, 1, 0.36, 1] as const

export const Route = createFileRoute('/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(tenderQuery),
  component: Overview,
})

function Overview() {
  const t = useT()
  const { pace } = usePace()
  const { data: tender } = useSuspenseQuery(tenderQuery)

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
        <p className="max-w-[46ch] text-[1.1rem] leading-relaxed text-ink-2">
          {t('overview.lead', {
            bidder: tender.contractor,
            client: tender.client,
            n: offers(tender).length,
          })}
        </p>
        <Link to="/positionen" className="action">
          {t('overview.open')}
        </Link>
      </motion.div>

      <div className="mt-12 sm:mt-20">
        <Schematic tender={tender} />
      </div>

      <p className="caption mt-14">{t('app.synthetic')}</p>
    </div>
  )
}
