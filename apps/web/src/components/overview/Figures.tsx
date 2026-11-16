import NumberFlow from '@number-flow/react'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { formatQty } from '~/lib/format'
import { useT } from '~/lib/i18n'
import type { Tender } from '~/lib/queries'

/**
 * The tender's one headline number and how it splits. Before a run, the split
 * that is known is whether a supplier names a position by its ordinal number.
 */
export function PositionsFigure({ tender }: { tender: Tender }) {
  const t = useT()
  const total = tender.positionCount
  const referenced = tender.referencedPositionCount
  const parts = [
    {
      key: 'referenced',
      label: t('overview.referenced'),
      value: referenced,
      fill: 'bg-settled',
      ink: 'text-white',
    },
    {
      key: 'unreferenced',
      label: t('overview.unreferenced'),
      value: total - referenced,
      fill: 'bg-idle',
      ink: 'text-ink',
    },
  ].filter((part) => part.value > 0)

  return (
    <section
      className="sheet enter flex flex-col px-4 pb-5 pt-3 sm:px-5"
      style={{ '--enter-delay': '120ms' } as React.CSSProperties}
    >
      <h2 className="label mb-3">{t('overview.positions')}</h2>

      <p className="text-[3.6rem] font-semibold leading-none tracking-[-0.03em]">
        <NumberFlow value={total} locales="de-DE" />
      </p>

      {/* One whole split into parts: a tall segmented bar, each share printed on its block. */}
      <div
        role="img"
        aria-label={parts
          .map(
            (part) =>
              `${part.label}: ${formatQty(part.value)} (${share(part.value, total)})`,
          )
          .join(', ')}
        className="mt-6 flex h-7 gap-[2px]"
      >
        {parts.map((part) => (
          <div
            key={part.key}
            title={`${part.label}: ${formatQty(part.value)}`}
            style={{ flexGrow: part.value }}
            className={`flex min-w-0 basis-0 items-center overflow-hidden rounded-[4px] px-2 ${part.fill}`}
          >
            {part.value / total > 0.12 && (
              <span className={`num text-[0.8rem] font-medium ${part.ink}`}>
                {share(part.value, total)}
              </span>
            )}
          </div>
        ))}
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.87rem]">
        {parts.map((part) => (
          <div key={part.key} className="flex items-center gap-2">
            <span
              className={`size-2.5 rounded-[2px] ${part.fill}`}
              aria-hidden
            />
            <dt className="text-ink-2">{part.label}</dt>
            <dd className="num text-ink">{formatQty(part.value)}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 max-w-[46ch] text-[0.87rem] leading-relaxed text-ink-3">
        {t('overview.referencedHint')}
      </p>

      <Link
        to="/positionen"
        className="group mt-auto flex items-center justify-between border-t border-line pt-4 text-[0.93rem] font-medium text-accent-ink"
      >
        {t('overview.open')}
        <ArrowRight
          size={16}
          aria-hidden
          className="transition-transform duration-150 group-hover:translate-x-0.5"
        />
      </Link>
    </section>
  )
}

function share(value: number, total: number): string {
  return `${Math.round((value / total) * 100)} %`
}

/**
 * How the Leistungsverzeichnis is built: one row per title, a bar and a count
 * each, bars on one baseline. One hue, because the rows differ only in size.
 */
export function TitleMeters({ tender }: { tender: Tender }) {
  const t = useT()
  const largest = Math.max(...tender.titles.map((title) => title.positionCount))

  return (
    <section
      className="sheet enter px-4 pb-4 pt-3 sm:px-5"
      style={{ '--enter-delay': '180ms' } as React.CSSProperties}
    >
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="label">{t('overview.titles')}</h2>
        <p className="label !normal-case !tracking-normal">
          {t('overview.titlesHint')}
        </p>
      </div>

      <ol className="grid gap-x-10 md:grid-cols-2">
        {tender.titles.map((title) => (
          <li key={title.rno}>
            <Link
              to="/positionen"
              search={{ titel: title.rno }}
              className="group grid grid-cols-[2rem_minmax(0,1fr)_3.2rem] items-center gap-x-3 border-b border-line py-2.5 text-[0.93rem]"
            >
              <span className="num text-[0.8rem] text-ink-3">{title.rno}</span>
              <span className="min-w-0">
                <span className="block truncate group-hover:text-accent-ink">
                  {title.label}
                </span>
                <span className="mt-1.5 block h-1 rounded-full bg-surface-sunken">
                  <span
                    className="block h-1 rounded-full bg-ink-3 transition-colors duration-150 group-hover:bg-accent"
                    style={{
                      width: `${Math.max(2, (title.positionCount / largest) * 100)}%`,
                    }}
                  />
                </span>
              </span>
              <span className="num text-right text-ink-2">
                {formatQty(title.positionCount)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
