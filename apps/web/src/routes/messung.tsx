import { createFileRoute } from '@tanstack/react-router'
import { formatDate, formatMoney, formatQty, formatShare } from '~/lib/format'
import { useT } from '~/lib/i18n'
import { RUNS, TRAP_KINDS, filesOf, headline } from '~/lib/measured'
import type { MessageKey } from '~/lib/i18n'
import type { MeasuredRun } from '~/lib/measured'

export const Route = createFileRoute('/messung')({ component: Measured })

const COLUMN: Record<MeasuredRun['key'], MessageKey> = {
  first: 'measured.run.first',
  unseen119: 'measured.run.unseen',
  unseen501: 'measured.run.unseen',
  unseen502: 'measured.run.unseen',
  now: 'measured.run.now',
}

/**
 * What the benchmarks found, read from the files they wrote. It leads with
 * the newest tender the pipeline had not seen, sets the five runs side by
 * side, and says what the figures do not show.
 */
function Measured() {
  const t = useT()
  const lead = headline()
  const of = (part: number, whole: number) =>
    t('measured.of', { part: formatQty(part), whole: formatQty(whole) })

  const rows: Array<{
    label: MessageKey
    cell: (run: MeasuredRun) => string
  }> = [
    {
      label: 'measured.row.auto',
      cell: (run) => `${formatQty(run.auto)} (${formatShare(run.autoShare)})`,
    },
    {
      label: 'measured.row.rightly',
      cell: (run) => of(run.autoCorrect, run.auto),
    },
    {
      label: 'measured.row.price',
      cell: (run) => of(run.autoAtRightPrice, run.auto),
    },
    {
      label: 'measured.row.euro',
      cell: (run) => `${formatMoney(run.euroError)} €`,
    },
    {
      label: 'measured.row.traps',
      cell: (run) => of(run.trapsCaught, run.trapsPlanted),
    },
    {
      label: 'measured.row.found',
      cell: (run) => of(run.reviewFound, run.reviewExpected),
    },
    {
      label: 'measured.row.belong',
      cell: (run) =>
        `${of(run.reviewFound, run.reviewRaised)} (${formatShare(run.queuePrecision)})`,
    },
    {
      label: 'measured.row.numbers',
      cell: (run) => of(run.numbersFound, run.numbersChecked),
    },
    {
      label: 'measured.row.calls',
      cell: (run) =>
        t('measured.calls', {
          calls: formatQty(run.calls),
          cached: formatQty(run.fromCache),
          usd: formatMoney(run.usd),
        }),
    },
  ]

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 pb-24 pt-12 sm:px-8 sm:pt-16">
      <h1 className="display text-[clamp(2.2rem,4.6vw,3.6rem)]">
        {t('measured.title')}
      </h1>

      <p className="statement mt-8 !max-w-[46ch]">
        {t('measured.s1')} <b>{formatQty(lead.auto)}</b>{' '}
        {t('measured.s2', { total: formatQty(lead.positions) })}{' '}
        <b>
          {lead.autoCorrect === lead.auto
            ? t('measured.s3.all')
            : t('measured.s3.some', { n: formatQty(lead.autoCorrect) })}
        </b>
        {t('measured.s4')} <b>{of(lead.trapsCaught, lead.trapsPlanted)}</b>{' '}
        {t('measured.s5')}{' '}
        <b className="whitespace-nowrap">{formatMoney(lead.euroError)} €</b>{' '}
        {t('measured.s6', { sum: formatMoney(lead.euroAuto) })}
      </p>
      <p className="caption mt-4 max-w-[70ch]">
        {t('measured.lead.source', {
          seed: lead.seed,
          date: formatDate(lead.date),
          model: lead.model,
        })}{' '}
        <span className="code">{filesOf(lead)}</span>
      </p>

      <section className="mt-20" aria-labelledby="runs">
        <h2 id="runs" className="heading text-[1.75rem]">
          {t('measured.runs.title')}
        </h2>
        <p className="mt-2 max-w-[64ch] text-ink-2">
          {t('measured.runs.body')}
        </p>
        <div className="measure-scroll mt-7">
          <table className="measure">
            <thead>
              <tr>
                <td />
                {RUNS.map((run) => (
                  <th
                    key={run.key}
                    scope="col"
                    data-lead={run.key === lead.key ? '' : undefined}
                  >
                    {t(COLUMN[run.key])}
                    <span className="caption block font-normal">
                      {t('measured.seed', { seed: run.seed })}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{t(row.label)}</th>
                  {RUNS.map((run) => (
                    <td
                      key={run.key}
                      className="num"
                      data-lead={run.key === lead.key ? '' : undefined}
                    >
                      {row.cell(run)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{t('measured.row.file')}</th>
                {RUNS.map((run) => (
                  <td key={run.key}>
                    <span className="code">{filesOf(run)}</span>
                    <span className="caption block">
                      {run.gitSha}, {formatDate(run.date)}
                    </span>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div className="mt-20 grid gap-x-20 gap-y-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-labelledby="traps" className="min-w-0">
          <h2 id="traps" className="heading text-[1.75rem]">
            {t('measured.traps.title')}
          </h2>
          <p className="mt-2 max-w-[60ch] text-ink-2">
            {t('measured.traps.body', { seed: lead.seed })}
          </p>
          <ul className="mt-7 grid max-w-[40rem] gap-0">
            {TRAP_KINDS.map((kind) => {
              const { planted, caught } = lead.traps[kind]
              return (
                <li
                  key={kind}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1.5 border-b border-line py-3 sm:grid-cols-[minmax(0,1fr)_9rem_6rem]"
                >
                  <span>{t(`reason.${kind}`)}</span>
                  <span
                    className="flex gap-[3px] max-sm:col-span-2 max-sm:row-start-2"
                    aria-hidden="true"
                  >
                    {Array.from({ length: planted }, (_, index) => (
                      <span
                        key={index}
                        className={`h-4 w-1.5 rounded-[1.5px] ${index < caught ? 'bg-pane' : 'bg-open'}`}
                      />
                    ))}
                  </span>
                  <span className="num text-right text-ink-2">
                    {of(caught, planted)}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <section aria-labelledby="limits" className="min-w-0">
          <h2 id="limits" className="heading text-[1.3rem]">
            {t('measured.limits.title')}
          </h2>
          <ul className="mt-5 grid max-w-[52ch] gap-4 text-ink-2">
            {(
              [
                'measured.limit.tuned',
                'measured.limit.generator',
                'measured.limit.once',
                'measured.limit.cache',
                'measured.limit.numbers',
              ] as const
            ).map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-20 border-t border-line pt-6">
        <p className="caption">{t('app.synthetic')}</p>
      </div>
    </div>
  )
}
