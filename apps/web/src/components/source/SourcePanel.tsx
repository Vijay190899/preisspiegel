import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useT } from '~/lib/i18n'
import { documentUrl } from '~/lib/sources'
import { GaebSource } from './GaebSource'
import { PdfSource } from './PdfSource'
import type { ResolvedSource } from '~/lib/sources'

/**
 * The document a number came from, open at the place it was read. A PDF shows
 * its page with the value marked; a GAEB file shows the item's own lines.
 *
 * The panel takes its room when a source is named and gives it back when the
 * source closes. What it last showed stays in place while it slides away.
 */
export function SourcePanel({
  name,
  source,
  onClose,
}: {
  /** The source's name in the URL; `source` is what it resolved to. */
  name: string | undefined
  source: ResolvedSource | null
  onClose: () => void
}) {
  const t = useT()
  const open = source !== null

  const [kept, setKept] = useState({ name, source })
  if (source !== null && name !== kept.name) setKept({ name, source })
  const shown = source ?? kept.source

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      // The command palette is a dialog of its own and closes itself.
      const inDialog =
        event.target instanceof HTMLElement &&
        event.target.closest('[role="dialog"]') !== null
      if (event.key === 'Escape' && !inDialog) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <aside
      aria-label={t('source.title')}
      aria-hidden={!open}
      className="reader-source"
    >
      {shown !== null && (
        <div className="flex h-full min-h-0 flex-col max-lg:w-full">
          <header className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="flex items-center truncate font-medium">
                {/* The same box that marks the value in the document. */}
                <span
                  aria-hidden="true"
                  className="mr-2.5 inline-block h-3 w-[1.1rem] shrink-0 rounded-[3px] border-2 border-marker bg-marker-wash"
                />
                {t(shown.label)}
                <span className="ml-2 font-normal text-ink-3">
                  {shown.ref.kind === 'pdf'
                    ? t('source.page', {
                        page: shown.ref.page,
                        pages: shown.document.pageCount ?? '?',
                      })
                    : `${t('source.element')} ${shown.ref.element}`}
                </span>
              </p>
              <p className="code mt-0.5 truncate text-[0.8rem] text-ink-3">
                {shown.document.fileName}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('source.close')}
              title={`${t('source.close')} (Esc)`}
              className="grid size-9 shrink-0 place-items-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-ink/[0.07] hover:text-ink"
            >
              <X size={18} aria-hidden />
            </button>
          </header>

          <div className="min-h-0 flex-1 bg-surface-sunken">
            {shown.ref.kind === 'pdf' ? (
              <PdfSource
                url={documentUrl(shown.document)}
                box={shown.ref}
                caption={t('source.marked', { field: t(shown.label) })}
              />
            ) : (
              <GaebSource
                url={documentUrl(shown.document)}
                itemId={shown.ref.itemId}
                element={shown.ref.element}
              />
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
