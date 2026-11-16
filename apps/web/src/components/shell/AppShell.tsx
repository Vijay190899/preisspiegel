import { Link } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useT } from '~/lib/i18n'
import { CommandPalette, openPalette } from './CommandPalette'
import { LocaleToggle, ThemeToggle } from './Toggles'
import { Wordmark } from './Wordmark'
import type { ReactNode } from 'react'

const tab =
  'label relative grid h-full place-items-center px-2 !text-[0.8rem] !tracking-[0.06em] sm:px-3 sm:!text-[0.87rem] text-ink-3 transition-colors duration-150 hover:text-ink data-[status=active]:text-ink data-[status=active]:after:absolute data-[status=active]:after:inset-x-2 sm:data-[status=active]:after:inset-x-3 data-[status=active]:after:bottom-0 data-[status=active]:after:h-[2px] data-[status=active]:after:bg-accent'

export function AppShell({ children }: { children: ReactNode }) {
  const t = useT()

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:bg-surface-raised focus:px-3 focus:py-2 focus:text-sm focus:shadow-lifted"
      >
        {t('app.skipToContent')}
      </a>

      <header className="sticky top-0 z-40 border-b border-line-strong bg-surface/92 backdrop-blur-md">
        <div className="flex h-[52px] items-stretch gap-1 px-3 sm:gap-2 sm:px-6">
          <Link
            to="/"
            aria-label="Preisspiegel"
            className="flex items-center pr-2 sm:pr-4"
          >
            <Wordmark />
          </Link>

          <nav className="flex items-stretch" aria-label="Hauptnavigation">
            <Link to="/" activeOptions={{ exact: true }} className={tab}>
              {t('nav.overview')}
            </Link>
            <Link to="/positionen" className={tab}>
              {t('nav.positions')}
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={openPalette}
              aria-label={t('nav.jump')}
              className="flex h-8 items-center gap-2 rounded-sm border border-line bg-surface-raised px-2 text-[0.87rem] text-ink-3 transition-colors duration-150 hover:border-line-strong hover:text-ink sm:mr-1 sm:pl-2.5 sm:pr-1.5"
            >
              <Search size={14} aria-hidden />
              <span className="hidden sm:inline">{t('nav.jump')}</span>
              <kbd className="num ml-2 hidden rounded-[2px] border border-line px-1 py-px text-[0.73rem] text-ink-3 sm:inline">
                ⌘K
              </kbd>
            </button>
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="content" className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>

      <CommandPalette />
    </div>
  )
}
