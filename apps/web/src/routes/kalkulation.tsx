import {
  cableLines,
  copperSurcharge,
  surchargePerKm,
} from '@preisspiegel/core/copper'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useId, useMemo, useState } from 'react'
import { settleMaterial } from '~/lib/decisions'
import { formatMoney, formatQty, unitLabel } from '~/lib/format'
import { useT } from '~/lib/i18n'
import {
  laborQuery,
  positionsQuery,
  reviewQueueQuery,
  runQuery,
  tenderQuery,
} from '~/lib/queries'
import { useTenderText } from '~/lib/tenderText'
import { useDecisions } from '~/lib/useDecisions'
import type { LaborSummary } from '~/lib/queries'

/** The range the control covers, in EUR per 100 kg of copper. */
const LOWEST = 500
const HIGHEST = 1400
/** Where it stands at first: about what copper cost when this was built. */
const AT_FIRST = 950
/** How many cable positions the page lists. */
const LISTED = 8

export const Route = createFileRoute('/kalkulation')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(tenderQuery),
      context.queryClient.ensureQueryData(runQuery),
      context.queryClient.ensureQueryData(positionsQuery),
      context.queryClient.ensureQueryData(laborQuery),
      context.queryClient.ensureQueryData(reviewQueueQuery),
    ]),
  component: Costing,
})

/**
 * What the bid comes to: the material the run priced, the labor the
 * contractor's time table gives, and the copper surcharge. Cable is quoted
 * with copper at a fixed base, and what copper costs on the day comes on
 * top; the control moves the day's figure and the sum follows.
 */
function Costing() {
  const t = useT()
  const said = useTenderText()
  const control = useId()
  const { data: run } = useSuspenseQuery(runQuery)
  const { data: rows } = useSuspenseQuery(positionsQuery)
  const { data: labor } = useSuspenseQuery(laborQuery)
  const { data: queue } = useSuspenseQuery(reviewQueueQuery)
  // What the estimator decided replaces what the run assumed for it.
  const { decided } = useDecisions()
  const [notation, setNotation] = useState(AT_FIRST)

  const cables = useMemo(() => cableLines(rows), [rows])
  const surcharge = copperSurcharge(cables, notation)
  const runMaterial = run.done?.materialTotal ?? null
  const material =
    runMaterial === null ? null : settleMaterial(runMaterial, queue, decided)
  const kilometres = cables.reduce((sum, line) => sum + line.metres, 0) / 1000
  const tonnes = cables.reduce((sum, line) => sum + line.copperKg, 0) / 1000
  const heaviest = useMemo(
    () => [...cables].sort((a, b) => b.copperKg - a.copperKg).slice(0, LISTED),
    [cables],
  )

  if (material === null) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-4 py-24 sm:px-8">
        <h1 className="display text-[clamp(2.2rem,4.6vw,3.6rem)]">
          {t('costing.title')}
        </h1>
        <p className="mt-6 max-w-[60ch] text-[1.1rem] text-ink-2">
          {t('run.none')}
        </p>
      </div>
    )
  }

  // Labor counts once a labor pass has read the whole tender.
  const laborDone =
    labor !== null && labor.status === 'done' && labor.rate !== null
  const laborCost = laborDone
    ? Math.round(labor.hours * (labor.rate ?? 0) * 100) / 100
    : 0
  const total = Math.round((material + laborCost + surcharge) * 100) / 100
  // The same scale for every position of the control, so the bar grows.
  const full = material + laborCost + copperSurcharge(cables, HIGHEST)

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 pb-24 pt-12 sm:px-8 sm:pt-16">
      <h1 className="display text-[clamp(2.2rem,4.6vw,3.6rem)]">
        {t('costing.title')}
      </h1>

      <p className="statement mt-8 !max-w-[46ch]" aria-live="polite">
        {t('costing.s1')} <b>{formatMoney(material)} €</b>
        {laborDone && (
          <>
            {t('costing.labor.before')}{' '}
            <b>{formatQty(Math.round(labor.hours))}</b>{' '}
            {t('costing.labor.hours', { rate: formatQty(labor.rate ?? 0) })}{' '}
            <b>{formatMoney(laborCost)} €</b>
          </>
        )}
        {t('costing.s2')} <b>{formatQty(notation)} €</b> {t('costing.s3')}{' '}
        <b className="whitespace-nowrap">{formatMoney(surcharge)} €</b>{' '}
        {t('costing.s4')}{' '}
        <b className="whitespace-nowrap">{formatMoney(total)} €</b>
        {t('costing.s5')}
      </p>

      <div className="mt-10 max-w-[46rem]">
        <label htmlFor={control} className="caption block">
          {t('costing.control')}
        </label>
        <input
          id={control}
          type="range"
          min={LOWEST}
          max={HIGHEST}
          step={10}
          value={notation}
          onChange={(event) => setNotation(Number(event.target.value))}
          className="copper-control mt-3 w-full"
        />
        <div className="num mt-1 flex justify-between text-[0.85rem] text-ink-3">
          <span>{formatQty(LOWEST)}</span>
          <span>{formatQty((LOWEST + HIGHEST) / 2)}</span>
          <span>{formatQty(HIGHEST)}</span>
        </div>
      </div>

      {/* The bid as one length: the material, and the copper on top of it. */}
      <div className="mt-12" aria-hidden="true">
        <div className="flex h-3 gap-[3px]">
          <span
            className="block rounded-[3px] bg-pane"
            style={{ width: `${(material / full) * 100}%` }}
          />
          {laborDone && (
            <span
              className="block rounded-[3px] bg-ink-3"
              style={{ width: `${(laborCost / full) * 100}%` }}
            />
          )}
          <span
            className="block rounded-[3px] bg-copper transition-[width] duration-200 ease-arrive"
            style={{ width: `${(surcharge / full) * 100}%` }}
          />
        </div>
        <div className="mt-2.5 flex gap-6 text-[0.9rem] text-ink-2">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-pane" />
            {t('costing.material')}
          </span>
          {laborDone && (
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-ink-3" />
              {t('costing.labor')}
            </span>
          )}
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-copper" />
            {t('costing.surcharge')}
          </span>
        </div>
      </div>

      <section className="mt-20" aria-labelledby="where">
        <h2 id="where" className="heading text-[1.75rem]">
          {t('costing.where')}
        </h2>
        <p className="mt-2 max-w-[62ch] text-ink-2">
          {t('costing.cables', {
            n: formatQty(cables.length),
            km: formatQty(Math.round(kilometres * 10) / 10),
            t: formatQty(Math.round(tonnes * 10) / 10),
          })}
        </p>

        <div className="mt-7 max-w-[60rem]">
          <div className="cable-row !py-0 pb-2.5 text-[0.8125rem] text-ink-3">
            <span className="[grid-area:oz]">{t('ledger.col.position')}</span>
            <span className="text-right [grid-area:length]">
              {t('costing.col.length')}
            </span>
            <span className="hidden text-right [grid-area:copper] sm:block">
              {t('costing.col.copper')}
            </span>
            <span className="text-right [grid-area:sum]">
              {t('costing.col.surcharge')}
            </span>
          </div>
          <ol className="border-t border-line-strong">
            {heaviest.map((line) => (
              <li key={line.oz} className="border-b border-line">
                <Link
                  to="/positionen/$oz"
                  params={{ oz: line.oz }}
                  className="cable-row ledger-hover"
                >
                  <span className="code text-[0.82rem] text-ink-3 [grid-area:oz]">
                    {line.oz}
                  </span>
                  <span className="min-w-0 truncate font-medium text-ink [grid-area:text]">
                    {said.item(line.shortText)}
                  </span>
                  <span className="num text-right text-ink-2 [grid-area:length]">
                    {formatQty(line.metres)} m
                  </span>
                  <span className="num hidden text-right text-ink-2 [grid-area:copper] sm:block">
                    {formatQty(line.copper)} kg/km
                  </span>
                  <span className="num text-right font-medium text-ink [grid-area:sum]">
                    {formatMoney(
                      (line.metres / 1000) *
                        surchargePerKm(line.copper, notation),
                    )}{' '}
                    €
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {labor !== null && <LaborSection labor={labor} />}

      <p className="caption mt-12 max-w-[78ch]">{t('costing.note')}</p>
    </div>
  )
}

/**
 * Where the labor is: the positions that take the most hours, and the ones
 * whose labor time a person decides, with why.
 */
function LaborSection({ labor }: { labor: LaborSummary }) {
  const t = useT()
  const said = useTenderText()
  const rate = labor.rate ?? 0
  if (labor.status !== 'done') {
    return (
      <section className="mt-20" aria-labelledby="labor">
        <h2 id="labor" className="heading text-[1.75rem]">
          {t('costing.labor.where')}
        </h2>
        <p className="mt-2 max-w-[62ch] text-ink-2">
          {t('costing.labor.reading', {
            read: formatQty(labor.read),
            total: formatQty(labor.positions),
          })}
        </p>
      </section>
    )
  }
  return (
    <section className="mt-20" aria-labelledby="labor">
      <h2 id="labor" className="heading text-[1.75rem]">
        {t('costing.labor.where')}
      </h2>
      <p className="mt-2 max-w-[62ch] text-ink-2">
        {t('costing.labor.body', {
          set: formatQty(labor.set),
          total: formatQty(labor.positions),
          contractor: labor.contractor ?? '',
          entries: formatQty(labor.entries),
          none: formatQty(labor.none),
          review: formatQty(labor.reviewCount),
        })}
      </p>

      <div className="mt-7 max-w-[60rem]">
        <div className="cable-row !py-0 pb-2.5 text-[0.8125rem] text-ink-3">
          <span className="[grid-area:oz]">{t('ledger.col.position')}</span>
          <span className="text-right [grid-area:length]">
            {t('costing.col.quantity')}
          </span>
          <span className="hidden text-right [grid-area:copper] sm:block">
            {t('costing.col.hours')}
          </span>
          <span className="text-right [grid-area:sum]">
            {t('costing.labor')}
          </span>
        </div>
        <ol className="border-t border-line-strong">
          {labor.heaviest.map((line) => (
            <li key={line.oz} className="border-b border-line">
              <Link
                to="/positionen/$oz"
                params={{ oz: line.oz }}
                className="cable-row ledger-hover"
              >
                <span className="code text-[0.82rem] text-ink-3 [grid-area:oz]">
                  {line.oz}
                </span>
                <span className="min-w-0 truncate font-medium text-ink [grid-area:text]">
                  {said.item(line.shortText)}
                </span>
                <span className="num text-right text-ink-2 [grid-area:length]">
                  {formatQty(line.qty)} {unitLabel(line.unit, line.qty)}
                </span>
                <span className="num hidden text-right text-ink-2 [grid-area:copper] sm:block">
                  {formatQty(Math.round(line.hours * 10) / 10)} h
                </span>
                <span className="num text-right font-medium text-ink [grid-area:sum]">
                  {formatMoney(line.hours * rate)} €
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>

      {labor.review.length > 0 && (
        <div className="mt-12 max-w-[60rem]">
          <h3 className="heading text-[1.2rem]">
            {t('costing.labor.open', { n: formatQty(labor.reviewCount) })}
          </h3>
          <ol className="mt-4 border-t border-line-strong">
            {labor.review.map((line) => (
              <li key={line.oz} className="border-b border-line">
                <Link
                  to="/positionen/$oz"
                  params={{ oz: line.oz }}
                  className="ledger-row"
                >
                  <span className="code text-[0.82rem] text-ink-3 [grid-area:oz]">
                    {line.oz}
                  </span>
                  <span className="min-w-0 [grid-area:text]">
                    <span className="block font-medium text-ink">
                      {said.item(line.shortText)}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-[0.9rem] text-ink-2">
                      <span
                        className="lamp"
                        style={
                          { '--lamp': 'var(--t-open)' } as React.CSSProperties
                        }
                      />
                      {t(
                        line.reason === 'limit'
                          ? 'costing.labor.why.limit'
                          : 'costing.labor.why.other',
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
