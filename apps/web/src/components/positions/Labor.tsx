import { formatMoney, formatQty, quoted, unitLabel } from '~/lib/format'
import { useT } from '~/lib/i18n'
import type { MessageKey } from '~/lib/i18n'
import type { PositionLabor } from '~/lib/queries'

const REASON: Record<string, MessageKey> = {
  unread: 'labor.why.unread',
  unknown_entry: 'labor.why.unknown_entry',
  quote: 'labor.why.quote',
  unit: 'labor.why.unit',
  limit_unstated: 'labor.why.limit_unstated',
  limit: 'labor.why.limit',
}

/** German words from a document, kept as written and marked as German. */
function Said({ children }: { children: string }) {
  return (
    <span lang="de" className="text-ink">
      {quoted(children)}
    </span>
  )
}

/**
 * The labor of a position: which entry of the contractor's labor time table
 * the work takes, what that comes to, and the words of the position it rests
 * on. The minutes are the table's, the hours and the money are worked out
 * from them; nothing here is a number the model said.
 */
export function Labor({
  labor,
  unit,
}: {
  labor: PositionLabor
  /** The position's unit, as the tender writes it. */
  unit: string
}) {
  const t = useT()
  const contractor = labor.contractor ?? ''

  if (
    labor.status === 'set' &&
    labor.entry !== null &&
    labor.minutes !== null
  ) {
    const cost = labor.rate === null ? null : labor.hours * labor.rate
    return (
      <div className="grid max-w-[62ch] gap-3">
        <p className="text-[1.05rem] leading-relaxed text-ink-2">
          {t('labor.set.from', { contractor })} <Said>{labor.entry.label}</Said>
          {', '}
          <span className="num whitespace-nowrap text-ink">
            {t('labor.per', {
              minutes: formatQty(labor.minutes),
              unit: unitLabel(unit, 1),
            })}
          </span>
          {'. '}
          <span className="num">
            {t('labor.sum', {
              qty: `${formatQty(labor.qty)} ${unitLabel(unit, labor.qty)}`,
              hours: formatQty(Math.round(labor.hours * 10) / 10),
            })}
            {cost !== null && labor.rate !== null && (
              <>
                {' '}
                {t('labor.cost.before', { rate: formatQty(labor.rate) })}{' '}
                <b className="whitespace-nowrap font-semibold text-ink">
                  {formatMoney(cost)} €
                </b>
              </>
            )}
            .
          </span>
        </p>
        {labor.quote !== null && (
          <p className="caption">
            {t('labor.read')} <Said>{labor.quote}</Said>
            {labor.limitQuote !== null && (
              <>
                {' '}
                {t('labor.and')} <Said>{labor.limitQuote}</Said>
              </>
            )}
            .
          </p>
        )}
      </div>
    )
  }

  if (labor.status === 'none') {
    return (
      <p className="max-w-[62ch] text-[1.05rem] leading-relaxed text-ink-2">
        {t('labor.none', { contractor })}
        {labor.quote !== null && (
          <>
            {' '}
            {t('labor.none.read')} <Said>{labor.quote}</Said>.
          </>
        )}
      </p>
    )
  }

  return (
    <div className="grid max-w-[62ch] gap-3">
      <p className="flex items-baseline gap-3 text-[1.05rem] leading-relaxed text-ink-2">
        <span
          className="lamp shrink-0 translate-y-[-0.1em]"
          style={{ '--lamp': 'var(--t-open)' } as React.CSSProperties}
        />
        <span>
          <b className="font-semibold text-ink">{t('labor.review')}</b>{' '}
          {t(REASON[labor.reason ?? 'unread'] ?? 'labor.why.unread')}
        </span>
      </p>
      {labor.entry !== null && (
        <p className="caption">
          {t('labor.proposed')} <Said>{labor.entry.label}</Said>
          {labor.limitQuote !== null && (
            <>
              {'; '}
              {t('labor.position.says')} <Said>{labor.limitQuote}</Said>
            </>
          )}
          .
        </p>
      )}
    </div>
  )
}
