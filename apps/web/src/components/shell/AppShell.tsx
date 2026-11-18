import { Link, useRouterState } from '@tanstack/react-router'
import { Moon, Search, Sun } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect } from 'react'
import { setLocale, useLocale, useT } from '~/lib/i18n'
import { LOCALE_COOKIE } from '~/lib/locale'
import { setTheme, useTheme } from '~/lib/theme'
import { CommandPalette, openPalette } from './CommandPalette'
import { Notice } from './Notice'
import type { ReactNode } from 'react'
import type { MessageKey } from '~/lib/i18n'

const TABS: Array<{
  to: '/' | '/positionen' | '/kalkulation' | '/messung'
  label: MessageKey
}> = [
  { to: '/', label: 'nav.overview' },
  { to: '/positionen', label: 'nav.positions' },
  { to: '/kalkulation', label: 'nav.costing' },
  { to: '/messung', label: 'nav.measured' },
]

const iconButton =
  'flex h-9 items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-ink/[0.07] hover:text-ink'

export function AppShell({ children }: { children: ReactNode }) {
  const t = useT()
  const locale = useLocale()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  useEffect(() => {
    document.documentElement.lang = locale
    // A choice from before the cookie existed is carried over, so the next
    // page comes from the server in this language.
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`
  }, [locale])
  // The tab whose address the page is under; the overview is what is left.
  const active =
    TABS.find((tab) => tab.to !== '/' && pathname.startsWith(tab.to))?.to ?? '/'

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-control focus:bg-surface-raised focus:px-3 focus:py-2 focus:shadow-lifted"
      >
        {t('app.skipToContent')}
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-bg/75 backdrop-blur-xl backdrop-saturate-150">
        {/* On a phone the tabs take a row of their own, four equal parts
            of it, so none is cut off; from 640 px they sit beside the mark. */}
        <div className="flex flex-wrap items-center gap-x-1 px-3 sm:h-14 sm:flex-nowrap sm:gap-2 sm:px-6">
          <Link
            to="/"
            aria-label="Preisspiegel"
            className="mr-1 flex h-14 items-center gap-2.5 sm:mr-4 sm:h-auto"
          >
            <Mark />
            <span className="hidden text-[1.02rem] font-semibold tracking-[-0.02em] sm:inline [font-stretch:108%]">
              Preisspiegel
            </span>
          </Link>

          <nav
            aria-label={t('nav.main')}
            className="order-last grid h-11 w-full grid-cols-4 items-center gap-0.5 sm:order-none sm:flex sm:h-auto sm:w-auto"
          >
            {TABS.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={active === tab.to ? 'page' : undefined}
                className={`relative shrink-0 rounded-control px-1 py-1.5 text-center text-[0.88rem] font-medium transition-colors duration-150 sm:px-3 sm:text-[0.94rem] ${
                  active === tab.to ? 'text-ink' : 'text-ink-3 hover:text-ink'
                }`}
              >
                {active === tab.to && (
                  // One pill that travels between the tabs.
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-control bg-surface-raised shadow-module"
                    transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                  />
                )}
                <span className="relative">{t(tab.label)}</span>
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={openPalette}
              className="hidden h-9 items-center gap-2 rounded-control border border-line bg-surface/70 px-2.5 text-[0.9rem] text-ink-3 transition-colors duration-150 hover:border-line-strong hover:text-ink sm:mr-1 sm:flex"
            >
              <Search size={15} aria-hidden />
              {/* The visible words are the name; under 768 px only a
                  screen reader has them. */}
              <span className="sr-only md:not-sr-only">{t('nav.jump')}</span>
              <kbd
                aria-hidden="true"
                className="ml-1 hidden rounded-[5px] border border-line bg-bg px-1.5 text-[0.75rem] font-medium text-ink-3 md:inline"
              >
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
      <Notice />
    </div>
  )
}

/**
 * Three bars of unequal height: three supplier prices side by side, the
 * chosen one in copper. That comparison is a Preisspiegel.
 */
function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="1" y="7" width="5" height="14" rx="1.5" className="fill-ink" />
      <rect
        x="8.5"
        y="11"
        width="5"
        height="10"
        rx="1.5"
        className="fill-lamp"
      />
      <rect x="16" y="1" width="5" height="20" rx="1.5" className="fill-ink" />
    </svg>
  )
}

function ThemeToggle() {
  const theme = useTheme()
  const t = useT()
  const next = theme === 'dark' ? 'light' : 'dark'
  const label = t(next === 'light' ? 'theme.toLight' : 'theme.toDark')

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className={`${iconButton} w-9`}
    >
      {/* Both icons render; CSS shows the one for the active theme, so the
          server-rendered markup is right before React hydrates. */}
      <Moon size={17} strokeWidth={1.75} className="dark:hidden" aria-hidden />
      <Sun
        size={17}
        strokeWidth={1.75}
        className="hidden dark:block"
        aria-hidden
      />
    </button>
  )
}

function LocaleToggle() {
  const locale = useLocale()
  const t = useT()
  const next = locale === 'de' ? 'en' : 'de'

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      title={t('locale.switch')}
      className={`${iconButton} gap-1 px-2 text-[0.82rem] font-medium`}
    >
      {/* The name says what the button does and holds what it shows. */}
      <span className="sr-only">{t('locale.switch')}:</span>
      <span className={locale === 'de' ? 'text-ink' : 'text-ink-3'}>DE</span>
      <span aria-hidden="true" className="text-line-strong">
        /
      </span>
      <span className={locale === 'en' ? 'text-ink' : 'text-ink-3'}>EN</span>
    </button>
  )
}
