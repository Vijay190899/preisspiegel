import { createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexProvider } from 'convex/react'
import { routeTree } from './routeTree.gen'

/**
 * The Convex deployment URL. Local development reads CONVEX_URL from the
 * backend package's `.env.local`; a deployed build sets VITE_CONVEX_URL.
 */
function convexUrl(): string {
  const url = import.meta.env.VITE_CONVEX_URL ?? import.meta.env.CONVEX_URL
  if (typeof url !== 'string' || url === '') {
    throw new Error(
      'No Convex URL. Run `pnpm dev` (it starts Convex), or set VITE_CONVEX_URL.',
    )
  }
  return url
}

export function getRouter() {
  const convexQueryClient = new ConvexQueryClient(convexUrl())

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        gcTime: 5000,
      },
    },
  })
  convexQueryClient.connect(queryClient)

  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0, // TanStack Query owns caching.
    Wrap: ({ children }) => (
      <ConvexProvider client={convexQueryClient.convexClient}>
        {children}
      </ConvexProvider>
    ),
  })

  // Server-rendered query results are streamed to the client and reused there.
  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}
