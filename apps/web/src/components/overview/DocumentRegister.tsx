import { formatDate, formatQty } from '~/lib/format'
import { useT } from '~/lib/i18n'
import type { Tender, TenderDocument } from '~/lib/queries'

/** The documents a tender came with, listed the way a drawing register lists sheets. */
export function DocumentRegister({ tender }: { tender: Tender }) {
  const t = useT()
  const documents = [...tender.documents].sort(
    (a, b) =>
      Number(b.kind === 'tender') - Number(a.kind === 'tender') ||
      a.key.localeCompare(b.key),
  )

  return (
    <section
      className="sheet enter"
      style={{ '--enter-delay': '60ms' } as React.CSSProperties}
    >
      <h2 className="label border-b border-line px-4 py-3 sm:px-5">
        {t('overview.documents')}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-[0.93rem]">
          <thead>
            <tr className="label border-b border-line [&>th]:px-4 [&>th]:py-2.5 [&>th]:font-medium sm:[&>th]:px-5">
              <th scope="col" className="w-10">
                {t('doc.no')}
              </th>
              <th scope="col">{t('doc.file')}</th>
              <th scope="col">{t('doc.from')}</th>
              <th scope="col">{t('doc.date')}</th>
              <th scope="col" className="text-right">
                {t('doc.pages')}
              </th>
              <th scope="col" className="text-right">
                {t('doc.lines')}
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document, index) => (
              <Row
                key={document.key}
                no={index + 1}
                document={document}
                fallback={tender.client}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Row({
  no,
  document,
  fallback,
}: {
  no: number
  document: TenderDocument
  fallback: string
}) {
  const t = useT()
  return (
    <tr className="border-b border-line last:border-b-0 [&>td]:px-4 [&>td]:py-3 sm:[&>td]:px-5">
      <td className="num text-ink-3">{String(no).padStart(2, '0')}</td>
      <td>
        <div className="flex items-center gap-2.5">
          <FormatChip format={document.format} />
          <span className="num whitespace-nowrap text-[0.87rem]">
            {document.fileName}
          </span>
        </div>
        <p className="mt-1 text-[0.8rem] text-ink-3">
          {t(document.kind === 'tender' ? 'doc.kind.tender' : 'doc.kind.offer')}
        </p>
      </td>
      <td>{document.supplierName ?? fallback}</td>
      <td className="num whitespace-nowrap text-[0.87rem] text-ink-2">
        {formatDate(document.date)}
      </td>
      <td className="num text-right text-ink-2">{document.pageCount ?? '–'}</td>
      <td className="num text-right">{formatQty(document.lineCount)}</td>
    </tr>
  )
}

/** The file format as a lettered tag: X83, X84 or PDF. */
export function FormatChip({ format }: { format: TenderDocument['format'] }) {
  return (
    <span className="label inline-block border border-line-strong px-1.5 py-[3px] !text-[0.67rem] !tracking-[0.06em] text-ink-2">
      {format}
    </span>
  )
}
