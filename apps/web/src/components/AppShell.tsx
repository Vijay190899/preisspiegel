import { Link } from '@tanstack/react-router'
import { useT } from '~/lib/i18n'
import { LocaleToggle } from './LocaleToggle'
import { ThemeToggle } from './ThemeToggle'
import { Wordmark } from './Wordmark'
import type { ReactNode } from 'react'

export function AppShell({ children }: { children: ReactNode }) {
  const t = useT()

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-card"
      >
        {t('app.skipToContent')}
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="rounded-md">
            <Wordmark />
          </Link>
          <span className="hidden text-[13px] text-ink-3 md:inline">
            {t('app.tagline')}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        id="content"
        className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 sm:py-8"
      >
        {children}
      </main>
    </div>
  )
}
