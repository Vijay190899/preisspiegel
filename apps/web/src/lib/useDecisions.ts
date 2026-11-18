import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '@preisspiegel/backend/api'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { byOz } from './decisions'
import { TENDER_SLUG } from './queries'
import { useSession } from './session'
import type { DecidedByOz } from './decisions'

const NONE: DecidedByOz = new Map()

/**
 * What this browser has decided, live, and the two things that can be done
 * about a position: decide it, or take the decision back.
 */
export function useDecisions(): {
  decided: DecidedByOz
  /** Takes an offer as it stands, or sets a price where `offerId` is `null`. */
  decide: (oz: string, offerId: string | null, unitPrice?: number) => void
  reopen: (oz: string) => void
} {
  const session = useSession()
  const { data } = useQuery(
    convexQuery(
      api.decisions.mine,
      session === null ? 'skip' : { slug: TENDER_SLUG, session },
    ),
  )
  const decided = useMemo(
    () => (data === undefined ? NONE : byOz(data)),
    [data],
  )
  const send = useConvexMutation(api.decisions.decide)
  const undo = useConvexMutation(api.decisions.reopen)

  const decide = useCallback(
    (oz: string, offerId: string | null, unitPrice?: number) => {
      if (session === null) return
      void send({ slug: TENDER_SLUG, session, oz, offerId, unitPrice })
    },
    [send, session],
  )
  const reopen = useCallback(
    (oz: string) => {
      if (session === null) return
      void undo({ slug: TENDER_SLUG, session, oz })
    },
    [undo, session],
  )
  return { decided, decide, reopen }
}
