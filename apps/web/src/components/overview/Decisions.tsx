import { Link } from '@tanstack/react-router'
import { reasonLabel } from '~/lib/findings'
import { formatMoney } from '~/lib/format'
import { useT } from '~/lib/i18n'
import type { CSSProperties } from 'react'
import type { ReviewItem, TenderDocument } from '~/lib/queries'

/**
 * The decisions that carry the most money, as a ledger: what the position
 * is, why it needs a person, what each supplier asks for it, and what the
 * decision is worth.
 */
export function Decisions({
  items,
  suppliers,
  storeyOf,
}: {
  items: ReadonlyArray<ReviewItem>
  suppliers: ReadonlyArray<TenderDocument>
  /** The storey a position is on, by its place in the document. */
  storeyOf: (seq: number) => string | null
}) {
  const t = useT()
  return (
    <div>
      <div className="ledger-head" aria-hidden="true">
        <span className="[grid-area:oz]">{t('ledger.col.position')}</span>
        <span className="hidden [grid-area:quotes] sm:block">
          {t('ledger.col.quotes')}
        </span>
        <span className="text-right [grid-area:sum]">
          {t('ledger.col.worth')}
        </span>
      </div>
      <ol className="border-t border-line-strong">
        {items.map((item) => {
          const storey = storeyOf(item.seq)
          return (
            <li key={item.oz} className="border-b border-line">
              <Link
                to="/positionen/$oz"
                params={{ oz: item.oz }}
                className="ledger-row"
              >
                <span className="code text-[0.82rem] text-ink-3 [grid-area:oz]">
                  {item.oz}
                </span>
                <span className="min-w-0 [grid-area:text]">
                  <span className="line-clamp-2 text-[1.02rem] font-medium leading-snug text-ink">
                    {item.shortText}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[0.88rem] text-ink-2">
                    <span
                      className="lamp"
                      style={{ '--lamp': 'var(--t-open)' } as CSSProperties}
                    />
                    {item.reasons
                      .map((code) => t(reasonLabel(code)))
                      .join(', ')}
                    {storey !== null && (
                      <span className="text-ink-3">· {storey}</span>
                    )}
                  </span>
                </span>
                <Quotes item={item} suppliers={suppliers} />
                <span className="num text-right text-[1.08rem] font-medium text-ink [grid-area:sum]">
                  {item.atRisk === null ? '' : `${formatMoney(item.atRisk)} €`}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/**
 * What each supplier asks for the whole quantity, as three bars on one
 * scale, in the suppliers' fixed order. A bar is red where something was
 * found on that offer; a supplier who did not offer leaves a gap.
 */
function Quotes({
  item,
  suppliers,
}: {
  item: ReviewItem
  suppliers: ReadonlyArray<TenderDocument>
}) {
  const t = useT()
  const largest = Math.max(0, ...item.quotes.map((quote) => quote.total ?? 0))
  const rows = suppliers.map((supplier) => {
    // A supplier can offer a position twice; the cheaper line is the one
    // that matters here.
    const own = item.quotes
      .filter((quote) => quote.supplierKey === supplier.key)
      .sort((a, b) => (a.total ?? Infinity) - (b.total ?? Infinity))[0]
    return { supplier, quote: own }
  })
  const words = rows
    .map(({ supplier, quote }) =>
      quote === undefined || quote.total === null
        ? t('ledger.quote.none', { supplier: supplier.supplierName ?? '' })
        : t(quote.clean ? 'ledger.quote.clean' : 'ledger.quote.flagged', {
            supplier: supplier.supplierName ?? '',
            total: formatMoney(quote.total),
          }),
    )
    .join(' ')

  return (
    <span
      role="img"
      aria-label={words}
      title={words}
      className="hidden w-full flex-col gap-[3px] [grid-area:quotes] sm:flex"
    >
      {rows.map(({ supplier, quote }) => (
        <span key={supplier.key} className="block h-[5px]">
          {quote !== undefined && quote.total !== null && largest > 0 && (
            <span
              className={`block h-full min-w-[3px] rounded-[2px] ${
                quote.clean ? 'bg-ink-3' : 'bg-open'
              }`}
              style={{ width: `${(quote.total / largest) * 100}%` }}
            />
          )}
        </span>
      ))}
    </span>
  )
}
