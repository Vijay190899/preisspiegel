import NumberFlow from '@number-flow/react'
import { motion } from 'motion/react'
import { formatDate, formatMoney, formatQty } from '~/lib/format'
import { useT } from '~/lib/i18n'
import type { RunSummary } from '~/lib/queries'

/**
 * What the last run did, in one sentence, or what a running one is doing
 * right now. The figures come straight from the run; a running one counts
 * up as its batches land.
 */
export function RunLine({
  current,
  done,
}: {
  current: RunSummary | null
  done: RunSummary | null
}) {
  const t = useT()
  if (current === null) return <p className="caption">{t('run.none')}</p>

  const running = current.status === 'preparing' || current.status === 'reading'
  if (running || current.status === 'deciding') {
    const share = current.positions === 0 ? 0 : current.read / current.positions
    return (
      <div role="status" className="max-w-[46rem]">
        <p className="flex items-center gap-2.5 text-ink-2">
          <span
            className="lamp animate-pulse"
            style={{ '--lamp': 'var(--t-lamp)' } as React.CSSProperties}
          />
          {current.status === 'deciding' ? (
            t('run.deciding')
          ) : (
            <span>
              {t('run.reading.before')}{' '}
              <NumberFlow
                value={current.read}
                locales="de-DE"
                className="num font-medium text-ink"
              />{' '}
              {t('run.reading.after', { total: formatQty(current.positions) })}
            </span>
          )}
        </p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-sunken">
          <motion.div
            className="h-full origin-left rounded-full bg-lamp"
            animate={{ scaleX: current.status === 'deciding' ? 1 : share }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
    )
  }

  if (current.status === 'stopped' || current.status === 'failed') {
    return (
      <p className="caption flex items-center gap-2.5">
        <span
          className="lamp"
          style={{ '--lamp': 'var(--t-open)' } as React.CSSProperties}
        />
        {t(current.status === 'stopped' ? 'run.stopped' : 'run.failed', {
          note: current.note ?? '',
        })}
      </p>
    )
  }

  const shown = done ?? current
  return (
    <p className="caption max-w-[78ch]">
      {t('run.done', {
        date: formatDate(new Date(shown.startedAt).toISOString().slice(0, 10)),
        model: shown.model ?? '',
        calls: formatQty(shown.calls),
        cached: formatQty(shown.cached),
        usd: formatMoney(shown.usd),
      })}
    </p>
  )
}
