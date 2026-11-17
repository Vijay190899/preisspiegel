import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { gaebPositions, parseGaeb } from '../../../../packages/core/src'
import {
  headingInEnglish,
  itemInEnglish,
  projectInEnglish,
  storeyInEnglish,
} from './tenderText'

const positions = gaebPositions(
  parseGaeb(
    readFileSync(
      fileURLToPath(
        new URL('../../../../data/seed/tender.x83', import.meta.url),
      ),
      'utf8',
    ),
  ),
)

/** Letters and words that only German has: what is left of an untranslated text. */
const GERMAN =
  /[äöüßÄÖÜ]|(?<![\p{L}])(?:mit|für|und|der|die|das|des|bis|polig|fach|reihig|Zoll|Typ)(?![\p{L}])/u

describe('the tender in English', () => {
  it('says what every item of the demo tender is, with no German left in it', () => {
    const texts = [...new Set(positions.map((position) => position.shortText))]
    expect(texts.length).toBeGreaterThan(200)
    const left = texts
      .map((text) => itemInEnglish(text))
      .filter((text) => GERMAN.test(text))
    expect(left).toEqual([])
  })

  it('names every title and section', () => {
    const labels = [
      ...new Set(
        positions.flatMap((position) =>
          position.path.map((step) => step.label),
        ),
      ),
    ]
    expect(labels.length).toBeGreaterThan(60)
    const left = labels
      .map((label) => headingInEnglish(label))
      .filter((label) => GERMAN.test(label) || /geschoss/i.test(label))
    expect(left).toEqual([])
  })

  it('translates the trade terms and turns figures into English notation', () => {
    expect(itemInEnglish('Leitungsschutzschalter B16, 1-polig')).toBe(
      'Miniature circuit breaker B16, 1-pole',
    )
    expect(itemInEnglish('Mantelleitung NYM-J 3x1,5 mm²')).toBe(
      'Sheathed cable NYM-J 3x1.5 mm²',
    )
    expect(
      itemInEnglish(
        'LED-Einlegeleuchte 625 x 625 mm, 28 W, 3.600 lm, 3000 K, DALI',
      ),
    ).toBe('LED recessed panel 625 x 625 mm, 28 W, 3,600 lm, 3000 K, DALI')
    expect(itemInEnglish('SCHUKO-Steckdose 16 A, Unterputz, 2-fach')).toBe(
      'SCHUKO socket 16 A, flush-mounted, 2-gang',
    )
  })

  it('names storeys in full and in short', () => {
    expect(storeyInEnglish('UG')).toBe('basement')
    expect(storeyInEnglish('EG', true)).toBe('Ground')
    expect(storeyInEnglish('2. OG')).toBe('2nd floor')
    expect(storeyInEnglish('3. Obergeschoss', true)).toBe('3rd')
    expect(headingInEnglish('Beleuchtung 1. Obergeschoss')).toBe(
      'Lighting, 1st floor',
    )
  })

  it('leaves what it has no words for as it is', () => {
    expect(itemInEnglish('Sonderanfertigung Typenschild')).toContain(
      'Sonderanfertigung',
    )
    expect(headingInEnglish('Aufzugsanlage')).toBe('Aufzugsanlage')
    expect(projectInEnglish('Neubau Bürogebäude Kontorhaus Weidenufer')).toBe(
      'New office building Kontorhaus Weidenufer',
    )
    expect(projectInEnglish('Los 12 Elektroinstallation')).toBe(
      'Lot 12, electrical installation',
    )
  })
})
