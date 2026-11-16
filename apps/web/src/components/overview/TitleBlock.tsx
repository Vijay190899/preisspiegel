import { formatDate } from '~/lib/format'
import { useT } from '~/lib/i18n'
import { tenderDocument } from '~/lib/queries'
import type { Tender } from '~/lib/queries'
import type { ReactNode } from 'react'

/**
 * The title block of a drawing sheet (Schriftfeld): a ruled grid of labelled
 * fields that says what the sheet is, for whom, and where it stands. Here it
 * introduces the tender.
 */
export function TitleBlock({ tender }: { tender: Tender }) {
  const t = useT()
  const issued = tenderDocument(tender)?.date

  return (
    <section
      aria-label={tender.project}
      className="sheet sheet-marked enter grid grid-cols-2 gap-px border-frame bg-frame md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1fr)]"
    >
      <Field
        label={t('block.project')}
        className="col-span-2 md:col-span-1 md:row-span-2"
      >
        <h1 className="text-[1.75rem] font-semibold leading-[1.12] tracking-[-0.015em] sm:text-[2.15rem]">
          {tender.project}
        </h1>
        <p className="mt-2 text-[1.07rem] text-ink-2">{tender.lot}</p>
      </Field>

      <Field label={t('block.client')}>
        <p className="text-[1rem]">{tender.client}</p>
      </Field>
      <Field label={t('block.projectNo')}>
        <p className="num text-[1.2rem]">{tender.projectNo}</p>
      </Field>

      <Field label={t('block.bidder')}>
        <p className="text-[1rem]">{tender.contractor}</p>
      </Field>
      <Field label={t('block.status')}>
        <p className="flex items-center gap-2 text-[1rem]">
          <span className="size-2 bg-settled" aria-hidden="true" />
          {t('block.statusLoaded')}
        </p>
        {issued !== undefined && (
          <p className="num mt-1 text-[0.8rem] text-ink-3">
            {formatDate(issued)}
          </p>
        )}
      </Field>
    </section>
  )
}

function Field({
  label,
  className = '',
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`min-w-0 bg-surface px-4 pb-4 pt-3 sm:px-5 ${className}`}>
      <p className="label mb-2.5">{label}</p>
      {children}
    </div>
  )
}
