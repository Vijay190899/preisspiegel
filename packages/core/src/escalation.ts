/**
 * Which questions a run gives to the larger model (the escalation role).
 *
 * The matcher reads every position. Where it left a line it was asked about
 * unconfirmed (it said it was unsure, its quotes did not hold up, or the call
 * failed), the position cannot be settled from its answer, and that question
 * is asked once more of a larger model. Code checks the second answer exactly
 * as it checked the first. A question several positions share is asked once.
 *
 * The share of a tender that may go to the larger model is capped, so a run
 * whose matcher fails wholesale cannot turn into a run of the larger model.
 */
import type { Judgement } from './pipeline'

/** At most this share of a tender's positions is read a second time. */
export const ESCALATION_SHARE = 0.2

export interface ReadOutcome {
  seq: number
  /** The question's key: positions that share it share one answer. */
  key: string
  source: 'model' | 'cache' | 'code' | 'failed' | 'escalated'
  judgements: ReadonlyArray<Pick<Judgement, 'verdict' | 'by'>>
}

export interface EscalationPlan {
  /** Questions to ask again, in document order, with the positions asking. */
  items: Array<{ key: string; seqs: Array<number> }>
  /** Positions the matcher could not settle. */
  unsettled: number
  /** Of those, how many were left out by the cap. */
  capped: number
}

/** Whether the matcher's reading leaves a position unsettled. */
export function unsettled(row: ReadOutcome): boolean {
  if (row.source === 'code' || row.source === 'escalated') return false
  if (row.source === 'failed') return true
  return row.judgements.some(
    (judgement) =>
      judgement.by === 'model' && judgement.verdict === 'unconfirmed',
  )
}

export function planEscalation(
  rows: ReadonlyArray<ReadOutcome>,
  share: number = ESCALATION_SHARE,
): EscalationPlan {
  const byKey = new Map<string, Array<number>>()
  let count = 0
  for (const row of [...rows].sort((a, b) => a.seq - b.seq)) {
    if (!unsettled(row)) continue
    count++
    const seqs = byKey.get(row.key)
    if (seqs === undefined) byKey.set(row.key, [row.seq])
    else seqs.push(row.seq)
  }

  const room = Math.floor(rows.length * share)
  const items: EscalationPlan['items'] = []
  let taken = 0
  for (const [key, seqs] of byKey) {
    if (taken + seqs.length > room) continue
    items.push({ key, seqs })
    taken += seqs.length
  }
  return { items, unsettled: count, capped: count - taken }
}

/**
 * One position's reading after the second one. The larger model's verdict is
 * taken only for the lines the matcher left unconfirmed; every line the
 * matcher settled keeps its verdict, so a worse second answer cannot undo a
 * line that was already settled. Both readings are verified against this
 * position's own lines before they meet here.
 */
export function mergeEscalated<
  T extends Pick<Judgement, 'id' | 'verdict' | 'by'>,
>(first: ReadonlyArray<T>, second: ReadonlyArray<T>): Array<T> {
  const again = new Map(second.map((judgement) => [judgement.id, judgement]))
  return first.map((judgement) => {
    if (judgement.by !== 'model' || judgement.verdict !== 'unconfirmed') {
      return judgement
    }
    return again.get(judgement.id) ?? judgement
  })
}
