import { useConvexMutation } from '@convex-dev/react-query'
import { api } from '@preisspiegel/backend/api'
import { useCallback, useState } from 'react'
import { TENDER_SLUG } from './queries'
import type { FunctionReturnType } from 'convex/server'

export type Admission = FunctionReturnType<typeof api.runs.start>
export type Refusal = Extract<Admission, { ok: false }>['reason']

/**
 * Starts a run of the tender. Without a code the stored answers are read
 * back, which calls no model; with the deployment's access code the model
 * reads. The run itself arrives through the live queries, so all this keeps
 * is why the last request was refused.
 */
export function useStartRun(): {
  start: (code?: string) => Promise<boolean>
  refused: Refusal | null
  asking: boolean
} {
  const send = useConvexMutation(api.runs.start)
  const [refused, setRefused] = useState<Refusal | null>(null)
  const [asking, setAsking] = useState(false)

  const start = useCallback(
    async (code?: string) => {
      setAsking(true)
      try {
        const admission = await send({ slug: TENDER_SLUG, code })
        setRefused(admission.ok ? null : admission.reason)
        return admission.ok
      } finally {
        setAsking(false)
      }
    },
    [send],
  )
  return { start, refused, asking }
}
