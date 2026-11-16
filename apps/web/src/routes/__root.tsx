import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { AppShell } from '~/components/AppShell'
import { themeBootScript } from '~/lib/theme'
import appCss from '~/styles/app.css?url'
import type { ReactNode } from 'react'
import type { QueryClient } from '@tanstack/react-query'

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
  return (
    <div className="py-16 text-center">
      <p className="num text-sm text-ink-3">404</p>
      <h1 className="mt-2 text-xl font-semibold">Seite nicht gefunden</h1>
    </div>
  )
}

function RouteError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div
      role="alert"
      className="rounded-lg border border-risk/40 bg-risk-soft p-4 text-sm"
    >
      <h1 className="font-semibold text-risk">Etwas ist schiefgelaufen</h1>
      <p className="mt-1 break-words text-ink-2">{message}</p>
    </div>
  )
}
