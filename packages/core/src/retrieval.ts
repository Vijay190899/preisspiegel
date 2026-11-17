/**
 * Finds the offer lines that could answer a position when the line does not
 * say so itself. Okapi BM25 over the search terms of the line texts: no
 * model, no embedding, the same result every time.
 */
import { PIECE_WEIGHT, searchTerms } from './text'

export interface SearchIndex<T> {
  search: (query: string, limit: number) => Array<{ item: T; score: number }>
}

const K1 = 1.4
const B = 0.6

export function buildIndex<T>(
  items: ReadonlyArray<T>,
  textOf: (item: T) => string,
): SearchIndex<T> {
  const documents = items.map((item) => {
    const counts = new Map<string, number>()
    const terms = searchTerms(textOf(item))
    for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1)
    return { item, counts, length: terms.length }
  })
  const average =
    documents.reduce((sum, document) => sum + document.length, 0) /
    Math.max(1, documents.length)

  const frequency = new Map<string, number>()
  for (const document of documents) {
    for (const term of document.counts.keys()) {
      frequency.set(term, (frequency.get(term) ?? 0) + 1)
    }
  }
  const weight = (term: string): number => {
    const n = frequency.get(term) ?? 0
    return Math.log(1 + (documents.length - n + 0.5) / (n + 0.5))
  }

  return {
    search(query, limit) {
      const wanted = new Set(searchTerms(query))
      const scored: Array<{ item: T; score: number }> = []
      for (const document of documents) {
        let score = 0
        for (const term of wanted) {
          const count = document.counts.get(term)
          if (count === undefined) continue
          score +=
            ((term.startsWith('#') ? PIECE_WEIGHT : 1) *
              (weight(term) * count * (K1 + 1))) /
            (count + K1 * (1 - B + (B * document.length) / average))
        }
        if (score > 0) scored.push({ item: document.item, score })
      }
      // The order of equal scores follows the order of the items, so the
      // result does not depend on how a sort happens to break ties.
      return scored
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => b.entry.score - a.entry.score || a.index - b.index)
        .slice(0, limit)
        .map(({ entry }) => entry)
    },
  }
}
