import { X } from 'lucide-react'
import { useT } from '~/lib/i18n'
import { dismiss, useNotice } from '~/lib/notice'

/** The app's one line about an action that failed (`lib/notice.ts`). */
export function Notice() {
  const t = useT()
  const message = useNotice()
  return (
    // The region is always there, so a screen reader hears what lands in it.
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
    >
      {message !== null && (
        <p className="pointer-events-auto flex max-w-[60ch] items-center gap-3 rounded-control border border-line-strong bg-surface-raised py-2 pl-3.5 pr-1.5 text-[0.93rem] shadow-lifted">
          <span
            className="lamp shrink-0"
            style={{ '--lamp': 'var(--t-open)' } as React.CSSProperties}
          />
          <span>{t(message)}</span>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t('notice.dismiss')}
            className="flex size-8 shrink-0 items-center justify-center rounded-control text-ink-3 hover:bg-ink/[0.07] hover:text-ink"
          >
            <X size={15} aria-hidden />
          </button>
        </p>
      )}
    </div>
  )
}
