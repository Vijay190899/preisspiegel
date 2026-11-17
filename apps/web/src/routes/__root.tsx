import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { AppShell } from '~/components/shell/AppShell'
import { useT } from '~/lib/i18n'
import { themeBootScript } from '~/lib/theme'
import appCss from '~/styles/app.css?url'
import type { QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Preisspiegel' },
      {
        name: 'description',
        content:
          'Angebotskalkulation für Elektro-Ausschreibungen: jede Position zugeordnet und kalkuliert, jede Zahl bis zur Quelle nachvollziehbar.',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ],
    scripts: [{ children: themeBootScript }],
  }),
  notFoundComponent: NotFound,
  errorComponent: RouteError,
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <AppShell>
        <Outlet />
      </AppShell>
    </RootDocument>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    // The boot script sets data-theme before React hydrates, so the attribute
    // on <html> legitimately differs from what the server rendered.
    <html lang="de" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function NotFound() {
  const t = useT()
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-20 sm:px-8">
      <p className="code text-ink-3">404</p>
      <h1 className="display mt-3 text-[2.2rem]">{t('error.notFound')}</h1>
      <Link to="/" className="action mt-8">
        {t('nav.overview')}
      </Link>
    </div>
  )
}

function RouteError({ error }: { error: unknown }) {
  const t = useT()
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-12 sm:px-8">
      <div role="alert" className="module max-w-[70ch] px-5 py-4">
        <h1 className="flex items-center gap-2.5 font-semibold">
          <span
            className="lamp"
            style={{ '--lamp': 'var(--t-open)' } as React.CSSProperties}
          />
          {t('error.title')}
        </h1>
        <p className="mt-2 break-words text-[0.93rem] text-ink-2">{message}</p>
      </div>
    </div>
  )
}
