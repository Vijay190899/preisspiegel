import { Link } from '@tanstack/react-router'
import { reasonLabel } from '~/lib/findings'
import { formatMoney, formatQty } from '~/lib/format'
import { useT } from '~/lib/i18n'
import { useTenderText } from '~/lib/tenderText'
import type { CSSProperties } from 'react'
import type { ReviewItem, TenderDocument } from '~/lib/queries'

/** Decisions about one article for one reason, on however many storeys. */
export interface DecisionGroup {
  /** The costliest of them, which is the one the line opens. */
  lead: ReviewItem
  items: Array<ReviewItem>
  /** What all of them together are worth. `null` where none has a figure. */
  atRisk: number | null
}

/**
 * The same article is tendered on every storey, and what is wrong with a
 * supplier's line for it is wrong on all of them. Listing each storey
 * would fill the ledger with one decision said seven times, so decisions
 * about the same thing for the same reason are one line.
 */
export function groupDecisions(
  items: ReadonlyArray<ReviewItem>,
): Array<DecisionGroup> {
  const groups = new Map<string, DecisionGroup>()
  for (const item of items) {
    const key = `${item.shortText}|${item.unit}|${item.reasons.join('+')}`
    const group = groups.get(key)
    if (group === undefined) {
      groups.set(key, { lead: item, items: [item], atRisk: item.atRisk })
      continue
    }
    group.items.push(item)
    if (item.atRisk !== null) {
      group.atRisk = Math.round(((group.atRisk ?? 0) + item.atRisk) * 100) / 100
    }
    if ((item.atRisk ?? 0) > (group.lead.atRisk ?? 0)) group.lead = item
  }
  return [...groups.values()].sort((a, b) => (b.atRisk ?? 0) - (a.atRisk ?? 0))
}

/**
 * The decisions that carry the most money, as a ledger: what it is about,
 * why it needs a person, what each supplier asks, and what it is worth.
 */
export function Decisions({
  groups,
  suppliers,
  storeyOf,
}: {
  groups: ReadonlyArray<DecisionGroup>
  suppliers: ReadonlyArray<TenderDocument>
  /** The storey a position is on, by its place in the document. */
  storeyOf: (seq: number) => string | null
}) {
  const t = useT()
  const said = useTenderText()
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
        {groups.map(({ lead, items, atRisk }) => {
          const storeys = [
            ...new Set(
              items
                .map((item) => ({ seq: item.seq, name: storeyOf(item.seq) }))
                .sort((a, b) => a.seq - b.seq)
                .map((entry) => entry.name)
                .filter((name): name is string => name !== null),
            ),
          ]
          return (
            <li key={lead.oz} className="border-b border-line">
              <Link
                to="/positionen/$oz"
                params={{ oz: lead.oz }}
                search={{ offen: true }}
                className="ledger-row"
              >
                <span className="code text-[0.82rem] text-ink-3 [grid-area:oz]">
                  {lead.oz}
                </span>
                <span className="min-w-0 [grid-area:text]">
                  <span className="line-clamp-2 text-[1.02rem] font-medium leading-snug text-ink">
                    {said.item(lead.shortText)}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[0.88rem] text-ink-2">
                    <span
                      className="lamp"
                      style={{ '--lamp': 'var(--t-open)' } as CSSProperties}
                    />
                    {lead.reasons
                      .map((code) => t(reasonLabel(code)))
                      .join(', ')}
                    <span className="text-ink-3">
                      {items.length > 1
                        ? t('ledger.several', {
                            n: formatQty(items.length),
                            where: storeys.join(', '),
                          })
                        : storeys.join(', ')}
                    </span>
                  </span>
                </span>
                <Quotes item={lead} suppliers={suppliers} />
                <span className="num text-right text-[1.08rem] font-medium text-ink [grid-area:sum]">
                  {atRisk === null ? '' : `${formatMoney(atRisk)} €`}
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
