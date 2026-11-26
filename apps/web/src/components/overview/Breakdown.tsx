import { formatQty } from '~/lib/format'
import type { TenderDocument } from '~/lib/queries'

/**
 * A count per name, each with a bar on one scale and its figure beside it.
 * The figure is the label; the bar only shows the proportion.
 */
function Tally({
  rows,
}: {
  rows: ReadonlyArray<{ key: string; name: string; count: number }>
}) {
  const largest = Math.max(1, ...rows.map((row) => row.count))
  return (
    <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-5 gap-y-3.5">
      {rows.map((row) => (
        <div key={row.key} className="contents">
          <dt className="min-w-0">
            <span className="block text-[0.95rem] leading-snug text-ink-2">
              {row.name}
            </span>
            <span
              className="grow mt-2 block h-[3px] min-w-[3px] rounded-full bg-pane"
              style={{ width: `${(row.count / largest) * 100}%` }}
            />
          </dt>
          <dd className="num text-right text-[0.95rem] text-ink">
            {formatQty(row.count)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Whose offer each priced position is priced with. */
export function Shares({
  wins,
  suppliers,
}: {
  wins: Record<string, number>
  suppliers: ReadonlyArray<TenderDocument>
}) {
  const rows = suppliers
    .map((supplier) => ({
      key: supplier.key,
      name: supplier.supplierName ?? supplier.key,
      count: wins[supplier.key] ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
  return <Tally rows={rows} />
}
