import NumberFlow from '@number-flow/react'
import { motion } from 'motion/react'
import { useId, useState } from 'react'
import { formatDate, formatMoney, formatQty } from '~/lib/format'
import { useLocale, useT } from '~/lib/i18n'
import { useStartRun } from '~/lib/useRun'
import type { MessageKey } from '~/lib/i18n'
import type { RunSummary } from '~/lib/queries'
import type { Refusal } from '~/lib/useRun'

export const isUnderWay = (run: RunSummary): boolean =>
  run.status === 'preparing' ||
  run.status === 'reading' ||
  run.status === 'deciding'

/**
 * What a run that is under way is doing right now, said where the tender's
 * state is otherwise said. The count comes straight from the run and moves
 * as its batches land.
 */
export function Reading({ run }: { run: RunSummary }) {
  const t = useT()
  const locale = useLocale()
  const share = run.positions === 0 ? 0 : run.read / run.positions
  return (
    <div role="status">
      <p className="statement">
        {run.status === 'deciding' ? (
          t('run.deciding')
        ) : (
          <>
            {t(
              run.mode === 'replay'
                ? 'run.replaying.before'
                : 'run.reading.before',
            )}{' '}
            <b>
              <NumberFlow
                value={run.read}
                locales={locale === 'en' ? 'en-GB' : 'de-DE'}
                className="num"
              />
            </b>{' '}
            {t('run.reading.after', { total: formatQty(run.positions) })}
          </>
        )}
      </p>
      <div className="mt-5 h-1 overflow-hidden rounded-full bg-ink/10">
        <motion.div
          className="h-full origin-left rounded-full bg-lamp"
          initial={false}
          animate={{ scaleX: run.status === 'deciding' ? 1 : share }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  )
}

/**
 * What the last run did, in one sentence, and the one costly thing the
 * interface can start: a run in which the model reads, behind the access
 * code.
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
  // A run under way is said beside the house, not down here.
  if (isUnderWay(current)) return null

  const ended = current.status === 'stopped' || current.status === 'failed'
  const shown = done ?? current
  return (
    <div className="grid gap-3">
      {ended && (
        <p className="caption flex items-center gap-2.5">
          <span
            className="lamp"
            style={{ '--lamp': 'var(--t-open)' } as React.CSSProperties}
          />
          {t(current.status === 'stopped' ? 'run.stopped' : 'run.failed', {
            note: current.note ?? '',
          })}
        </p>
      )}
      {shown.status === 'done' && (
        <p className="caption max-w-[78ch]">
          {t(shown.mode === 'replay' ? 'run.done.replay' : 'run.done', {
            date: formatDate(
              new Date(shown.startedAt).toISOString().slice(0, 10),
            ),
            model: shown.model ?? '',
            calls: formatQty(shown.calls),
            cached: formatQty(shown.cached),
            usd: formatMoney(shown.usd),
          })}
        </p>
      )}
      <LiveRun />
    </div>
  )
}

export const REFUSED: Record<Refusal, MessageKey> = {
  code: 'run.refused.code',
  locked: 'run.refused.locked',
  closed: 'run.refused.closed',
  running: 'run.refused.running',
  busy: 'run.refused.busy',
  failed: 'run.refused.failed',
}

/** The model reads afresh, for whoever has the access code. Closed until asked for. */
function LiveRun() {
  const t = useT()
  const field = useId()
  const [code, setCode] = useState('')
  const { start, refused, asking } = useStartRun()
  return (
    <details className="caption max-w-[78ch]">
      <summary className="w-fit cursor-pointer rounded-sm text-ink-2 hover:text-ink">
        {t('run.live.summary')}
      </summary>
      <p className="mt-2">{t('run.live.body')}</p>
      <form
        className="mt-3 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          void start(code).then((started) => {
            if (started) {
              setCode('')
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }
          })
        }}
      >
        <div>
          <label htmlFor={field} className="caption block">
            {t('run.live.code')}
          </label>
          <input
            id={field}
            type="password"
            autoComplete="off"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            aria-describedby={refused === null ? undefined : `${field}-why`}
            className="mt-1.5 h-10 w-52 rounded-control border border-line-strong bg-surface px-3 text-[1rem] text-ink outline-none transition-colors duration-150 focus:border-focus"
          />
        </div>
        <button
          type="submit"
          disabled={code === '' || asking}
          className="flex h-10 items-center rounded-control border border-line-strong px-3 text-[0.92rem] font-medium text-ink transition-colors duration-150 hover:bg-ink/[0.06] disabled:opacity-40"
        >
          {t('run.live.start')}
        </button>
      </form>
      {refused !== null && (
        <p id={`${field}-why`} role="alert" className="mt-2 text-open-ink">
          {t(REFUSED[refused])}
        </p>
      )}
    </details>
  )
}
