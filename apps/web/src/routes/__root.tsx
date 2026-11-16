import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { AppShell } from '~/components/shell/AppShell'
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
    <div className="mx-auto w-full max-w-[1280px] px-4 py-16 sm:px-6">
      <p className="num text-ink-3">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Seite nicht gefunden</h1>
    </div>
  )
}

function RouteError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-6">
      <div role="alert" className="sheet border-open px-5 py-4">
        <h1 className="font-semibold text-open-ink">
          Etwas ist schiefgelaufen
        </h1>
        <p className="mt-1 break-words text-[0.93rem] text-ink-2">{message}</p>
      </div>
    </div>
  )
}
