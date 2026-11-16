import { Link } from '@tanstack/react-router'
import { MousePointerClick, X } from 'lucide-react'
import { useT } from '~/lib/i18n'
import { documentUrl } from '~/lib/sources'
import { FormatChip } from '../overview/DocumentRegister'
import { GaebSource } from './GaebSource'
import { PdfSource } from './PdfSource'
import type { ResolvedSource } from '~/lib/sources'

/**
 * The document a number came from, open at the place it was read. A PDF shows
 * its page with the value marked; a GAEB file shows the item's own lines.
 */
export function SourceViewer({ source }: { source: ResolvedSource | null }) {
  const t = useT()

  if (source === null) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div className="max-w-[30ch]">
          <MousePointerClick
            size={22}
            strokeWidth={1.5}
            className="mx-auto text-ink-3"
            aria-hidden
          />
          <h2 className="mt-3 font-medium">{t('source.none.title')}</h2>
          <p className="mt-1.5 text-[0.87rem] leading-relaxed text-ink-3">
            {t('source.none.body')}
          </p>
        </div>
      </div>
    )
  }

  const { document, ref, label } = source
  const where =
    ref.kind === 'pdf'
      ? t('source.page', { page: ref.page, pages: document.pageCount ?? '?' })
      : `${t('source.element')} <${ref.element}>`

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-line-strong bg-surface px-4 py-2.5">
        <FormatChip format={document.format} />
        <div className="min-w-0 flex-1">
          <p className="num truncate text-[0.87rem]">{document.fileName}</p>
          <p className="label mt-1 !normal-case !tracking-normal">
            {t(label)} · {where}
          </p>
        </div>
        <Link
          to="."
          search={(previous) => ({ ...previous, quelle: undefined })}
          replace
          resetScroll={false}
          aria-label={t('source.close')}
          title={t('source.close')}
          className="grid size-8 shrink-0 place-items-center rounded-sm text-ink-3 transition-colors duration-150 hover:bg-surface-sunken hover:text-ink"
        >
          <X size={16} aria-hidden />
        </Link>
      </header>

      <div className="min-h-0 flex-1 bg-surface-sunken p-3 sm:p-4">
        {ref.kind === 'pdf' ? (
          <PdfSource
            url={documentUrl(document)}
            box={ref}
            caption={`${t('source.readHere')}: ${t(label)}`}
          />
        ) : (
          <GaebSource
            url={documentUrl(document)}
            itemId={ref.itemId}
            element={ref.element}
          />
        )}
      </div>
    </div>
  )
}
