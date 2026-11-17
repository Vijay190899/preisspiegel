import { describe, expect, it } from 'vitest'
import { seedRow } from './seeds'

/**
 * The search was once set by measuring it on the demo tender alone, and on
 * other tenders it never showed some true offers to any reader. These
 * tenders are the ones that showed it. No model is called: the questions
 * are built and compared with what the generator planted.
 */
describe('the search on tenders it was not set on', () => {
  it.each([119, 120, 122])(
    'shows every true offer to a reader on seed %i',
    async (seed) => {
      const row = await seedRow(seed)
      expect(row.neverAsked).toBe(0)
      // With flawless reading, nothing is priced that needed a person.
      expect(row.perfectReader.wrongAuto).toBe(0)
    },
    30_000,
  )
})
