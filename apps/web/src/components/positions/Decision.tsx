import { useId, useState } from 'react'
import { reasonLabel } from '~/lib/findings'
import { formatMoney, formatUnitPrice } from '~/lib/format'
import { useT } from '~/lib/i18n'
import { lampStyle, strong } from './parts'
import type { Decided } from '~/lib/decisions'
import type { Match } from '~/lib/queries'

/** What a run decided about the position, and what the decision is worth. */
export function Decision({
  match,
  unit,
  supplier,
}: {
  match: Match
  unit: string
  supplier: string | undefined
}) {
  const t = useT()
  const review = match.status === 'review'
  const unpriced = match.offers.some(
    (offer) => offer.findings.length > 0 && offer.unitPrice === null,
  )

  const body =
    !review && match.best !== null
      ? t('decision.auto.body', {
          supplier: supplier ?? '',
          price: formatUnitPrice(match.best.unitPrice),
          unit,
          total: formatMoney(match.materialTotal ?? 0),
        })
      : match.offers.length === 0
        ? t('decision.review.none')
        : match.atRisk !== null && match.best !== null
          ? t('decision.review.cheaper', { atRisk: formatMoney(match.atRisk) })
          : match.atRisk !== null
            ? t('decision.review.only', { atRisk: formatMoney(match.atRisk) })
            : unpriced
              ? t('decision.review.unpriced', { unit })
              : ''

  // The figures in the sentence are what it is about.
  const figures = [
    match.atRisk === null ? null : `${formatMoney(match.atRisk)} €`,
    !review && match.materialTotal !== null
      ? `${formatMoney(match.materialTotal)} €`
      : null,
  ].filter((figure): figure is string => figure !== null)

  return (
    <div>
      <p className="statement verdict">
        <span
          className="lamp mr-3 translate-y-[-0.18em]"
          style={lampStyle(review ? 'open' : 'settled')}
        />
        <b>{t(review ? 'decision.review' : 'decision.auto')}</b>
        {review && match.reasons.length > 0 && (
          <>
            {': '}
            <span className="text-open-ink">
              {match.reasons.map((reason) => t(reasonLabel(reason))).join(', ')}
            </span>
          </>
        )}
        {'. '}
        {body !== '' && <span className="num">{strong(body, figures)}</span>}
      </p>
      {match.noted.length > 0 && (
        <p className="caption mt-3">
          {t('decision.noted', {
            reasons: match.noted
              .map((reason) => t(reasonLabel(reason)))
              .join(', '),
          })}
        </p>
      )}
    </div>
  )
}

/** What the estimator decided, and the way back. */
export function Settled({
  decision,
  qty,
  unit,
  supplier,
  onReopen,
}: {
  decision: Decided
  qty: number
  unit: string
  supplier: string | undefined
  onReopen: () => void
}) {
  const t = useT()
  const total = `${formatMoney(Math.round(qty * decision.unitPrice * 100) / 100)} €`
  const body = t(
    decision.offerId === null
      ? 'decision.decided.own'
      : 'decision.decided.offer',
    {
      supplier: supplier ?? '',
      price: formatUnitPrice(decision.unitPrice),
      unit,
      total,
    },
  )
  return (
    <div>
      <p className="statement verdict">
        <span
          className="lamp mr-3 translate-y-[-0.18em]"
          style={lampStyle('settled')}
        />
        <b>{t('decision.decided')}</b>
        {'. '}
        <span className="num">{strong(body, [total])}</span>
      </p>
      <button
        type="button"
        onClick={onReopen}
        className="quiet-action -ml-3.5 mt-2 !h-9 text-[0.92rem]"
      >
        {t('decision.undo')}
      </button>
    </div>
  )
}

/** A price of the estimator's own, for a position no offer settles. */
export function OwnPrice({
  unit,
  onDecide,
}: {
  unit: string
  onDecide: (offerId: null, unitPrice: number) => void
}) {
  const t = useT()
  const field = useId()
  const [text, setText] = useState('')
  // Both ways of writing a decimal are accepted: 12,50 and 12.50.
  const price = Number(text.trim().replace(',', '.'))
  const valid = text.trim() !== '' && Number.isFinite(price) && price > 0

  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) onDecide(null, price)
      }}
    >
      <div>
        <label htmlFor={field} className="caption block">
          {t('decision.own.label', { unit })}
        </label>
        <input
          id={field}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="num mt-1.5 h-10 w-36 rounded-control border border-line-strong bg-surface px-3 text-[1rem] text-ink outline-none transition-colors duration-150 focus:border-focus"
        />
      </div>
      <button
        type="submit"
        disabled={!valid}
        className="flex h-10 items-center rounded-control border border-line-strong px-3 text-[0.92rem] font-medium text-ink transition-colors duration-150 hover:bg-ink/[0.06] disabled:opacity-40"
      >
        {t('decision.own.submit')}
      </button>
    </form>
  )
}
