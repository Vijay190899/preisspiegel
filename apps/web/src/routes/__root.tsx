import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { AppShell } from '~/components/shell/AppShell'
import { pageDescription, pageTitle, useLocale, useT } from '~/lib/i18n'
import { themeBootScript } from '~/lib/theme'
import appCss from '~/styles/app.css?url'
import type { QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/** The deployed address, for the share image, which has to be absolute. */
const SITE_URL = import.meta.env.VITE_SITE_URL?.replace(/\/$/, '') || undefined

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: pageTitle() },
      { name: 'description', content: pageDescription() },
      // The address bar takes the colour of the night the page opens in.
      { name: 'theme-color', content: '#070b12' },
      // What a link to the demo shows where it is shared.
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Preisspiegel' },
      { property: 'og:title', content: 'Preisspiegel' },
      { property: 'og:description', content: pageDescription() },
      { name: 'twitter:card', content: 'summary_large_image' },
      ...(SITE_URL === undefined
        ? []
        : [
            { property: 'og:image', content: `${SITE_URL}/og.png` },
            { property: 'og:image:width', content: '1200' },
            { property: 'og:image:height', content: '630' },
            { name: 'twitter:image', content: `${SITE_URL}/og.png` },
          ]),
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
  const locale = useLocale()
  return (
    // The boot script applies a stored theme before React hydrates, so the
    // attribute on <html> can legitimately differ from what the server rendered.
    <html lang={locale} data-theme="dark" suppressHydrationWarning>
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

/**
 * What a page that failed to load says. A visitor is told what to do, not
 * what went wrong inside; the error itself is shown only in development and
 * goes to the console, where the server's log has its own copy.
 */
function RouteError({ error, reset }: { error: unknown; reset: () => void }) {
  const t = useT()
  const router = useRouter()
  const detail = error instanceof Error ? error.message : String(error)
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-20 sm:px-8">
      <div role="alert">
        <h1 className="display flex items-center gap-3 text-[2.2rem]">
          <span
            className="lamp"
            style={{ '--lamp': 'var(--t-open)' } as React.CSSProperties}
          />
          {t('error.title')}
        </h1>
        <p className="mt-4 max-w-[60ch] text-[1.05rem] text-ink-2">
          {t('error.body')}
        </p>
        {import.meta.env.DEV && (
          <p className="code mt-4 max-w-[80ch] break-words text-ink-3">
            {detail}
          </p>
        )}
      </div>
      <button
        type="button"
        className="action mt-8"
        onClick={() => {
          reset()
          void router.invalidate()
        }}
      >
        {t('error.retry')}
      </button>
    </div>
  )
}
