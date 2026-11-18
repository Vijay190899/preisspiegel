/**
 * What the estimator has decided, laid over what the run decided.
 *
 * A run leaves positions open; a decision closes one. The run's results
 * stay as they are, shared by everyone who looks at the tender. What a
 * person decided is their own, and is put on top here: the window goes from
 * red to lit, the position leaves the queue, and the sums follow.
 */
export interface Decided {
  oz: string
  seq: number
  /** The offer taken, or `null` where a price was set. */
  offerId: string | null
  supplierKey: string | null
  unitPrice: number
  at: number
}

export type DecidedByOz = ReadonlyMap<string, Decided>

export function byOz(decided: ReadonlyArray<Decided>): Map<string, Decided> {
  return new Map(decided.map((entry) => [entry.oz, entry]))
}

/** The status letters with every decided position priced. */
export function settleStatuses(
  statuses: string | null,
  decided: DecidedByOz,
): string | null {
  if (statuses === null || decided.size === 0) return statuses
  const letters = [...statuses]
  for (const { seq } of decided.values()) {
    if (letters[seq] === 'r') letters[seq] = 'a'
  }
  return letters.join('')
}

/** The queue without what has been decided. */
export function settleQueue<T extends { oz: string }>(
  queue: ReadonlyArray<T>,
  decided: DecidedByOz,
): Array<T> {
  return decided.size === 0
    ? [...queue]
    : queue.filter((item) => !decided.has(item.oz))
}

/**
 * How many positions are priced and how many wait, and what the waiting
 * ones are worth, once the decisions are counted in.
 */
export function settleCounts(
  run: { auto: number | null; review: number | null; atRisk: number | null },
  queue: ReadonlyArray<{ oz: string; atRisk: number | null }>,
  decided: DecidedByOz,
): { auto: number; review: number; atRisk: number | null; decided: number } {
  const closed = queue.filter((item) => decided.has(item.oz))
  const worth = closed.reduce((sum, item) => sum + (item.atRisk ?? 0), 0)
  return {
    auto: (run.auto ?? 0) + closed.length,
    review: (run.review ?? 0) - closed.length,
    atRisk:
      run.atRisk === null
        ? null
        : Math.max(0, Math.round((run.atRisk - worth) * 100) / 100),
    decided: closed.length,
  }
}
