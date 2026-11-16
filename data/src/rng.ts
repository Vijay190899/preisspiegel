/**
 * Seeded randomness. Everything the generator decides comes from here, so the
 * same seed always produces the same tender, byte for byte.
 */

export interface Rng {
  /** A float in [0, 1). */
  next: () => number
  /** An integer in [min, max], both included. */
  int: (min: number, max: number) => number
  /** True with the given probability. */
  chance: (probability: number) => boolean
  pick: <T>(items: ReadonlyArray<T>) => T
  /** `count` distinct items, in the order they appear in `items`. */
  sample: <T>(items: ReadonlyArray<T>, count: number) => Array<T>
  shuffle: <T>(items: ReadonlyArray<T>) => Array<T>
  /**
   * An independent stream named by `label`. Adding draws to one part of the
   * generator then leaves every other part's output unchanged.
   */
  fork: (label: string) => Rng
}

export function createRng(seed: number | string): Rng {
  let state = typeof seed === 'number' ? seed >>> 0 : hash(seed)

  // mulberry32
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const int = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1))

  const shuffle = <T>(items: ReadonlyArray<T>): Array<T> => {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i)
      const a = out[i] as T
      out[i] = out[j] as T
      out[j] = a
    }
    return out
  }

  const origin = typeof seed === 'number' ? String(seed) : seed

  return {
    next,
    int,
    chance: (probability) => next() < probability,
    pick: <T>(items: ReadonlyArray<T>): T => {
      if (items.length === 0) throw new Error('pick from an empty list')
      return items[int(0, items.length - 1)] as T
    },
    sample: <T>(items: ReadonlyArray<T>, count: number): Array<T> => {
      if (count > items.length) {
        throw new Error(`sample of ${count} from ${items.length} items`)
      }
      const chosen = new Set(
        shuffle(items.map((_, index) => index)).slice(0, count),
      )
      return items.filter((_, index) => chosen.has(index))
    },
    shuffle,
    fork: (label) => createRng(`${origin}/${label}`),
  }
}

/** FNV-1a, 32 bit. */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
