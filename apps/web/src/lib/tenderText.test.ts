import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { gaebPositions, parseGaeb } from '../../../../packages/core/src'
import {
  attributeInEnglish,
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
    // A phrase inside a name has no capital of its own.
    expect(
      itemInEnglish('Dachleitungshalter für Flachdach, Runddraht Ø 8 mm'),
    ).toBe('Roof conductor holder for flat roofs, round wire Ø 8 mm')
    expect(itemInEnglish('Wandverteiler Aufputz, 3-reihig, 36 TE, IP 30')).toBe(
      'Surface-mounted distribution board, 3-row, 36 modules, IP 30',
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

  it('covers every item of the demo tender: none is left in German', () => {
    const texts = [...new Set(positions.map((position) => position.shortText))]
    const untouched = texts.filter((text) => itemInEnglish(text) === text)
    expect(untouched).toEqual([])
  })

  it('shows a text it does not fully cover as the tender wrote it', () => {
    // Never half in one language and half in the other.
    for (const text of [
      'Brandmeldezentrale mit 4 Ringen',
      'Leuchte Typ A1 für Flur und Treppenhaus',
      'Sonderanfertigung Typenschild',
    ]) {
      expect(itemInEnglish(text)).toBe(text)
    }
    expect(headingInEnglish('Aufzugsanlage')).toBe('Aufzugsanlage')
  })

  it('turns only measures into English notation', () => {
    expect(itemInEnglish('Patchkabel Cat.6A S/FTP, 0,5 m, grau')).toBe(
      'Patch cable Cat.6A S/FTP, 0.5 m, grey',
    )
    // A date and a version are not measures.
    expect(itemInEnglish('Kabelrinne 60 x 100 mm, Stand 12.03.2027')).toBe(
      'Kabelrinne 60 x 100 mm, Stand 12.03.2027',
    )
  })

  it('says the project and the lot', () => {
    expect(projectInEnglish('Neubau Bürogebäude Kontorhaus Weidenufer')).toBe(
      'New office building Kontorhaus Weidenufer',
    )
    expect(projectInEnglish('Los 12 Elektroinstallation')).toBe(
      'Lot 12, electrical installation',
    )
  })

  it('names what was compared, part by part, or leaves the name alone', () => {
    expect(attributeInEnglish('Bemessungsstrom')).toBe('Rated current')
    expect(attributeInEnglish('Aderzahl und Querschnitt')).toBe(
      'Number of cores and cross-section',
    )
    expect(attributeInEnglish('Höhe x Breite')).toBe('Height x width')
    expect(attributeInEnglish('Reihen/Teilungseinheiten')).toBe('Rows/modules')
    // One part unknown: the whole name stays as the model wrote it.
    expect(attributeInEnglish('Polzahl und Sonderfarbe')).toBe(
      'Polzahl und Sonderfarbe',
    )
  })

  it('covers the names the demo run compared by', () => {
    // The commonest names in the demo run, with how often each was used.
    const used: Array<[string, number]> = [
      ['Polzahl', 350],
      ['Schutzart', 308],
      ['Systemleistung', 266],
      ['Farbtemperatur', 247],
      ['Leuchtenlichtstrom', 188],
      ['Montageart', 148],
      ['Bemessungsstrom', 103],
      ['Aderzahl und Querschnitt', 100],
      ['Charakteristik und Bemessungsstrom', 99],
      ['Länge', 92],
      ['Kategorie', 91],
      ['Kabeltyp', 83],
      ['Farbe', 78],
      ['Typ', 73],
      ['Bemessungsfehlerstrom', 59],
      ['Charakteristik und Nennstrom', 50],
      ['Einbauart', 41],
      ['Halogenfreiheit', 37],
      ['Nennstrom und Bemessungsfehlerstrom', 22],
      ['Reihen und Teilungseinheiten', 19],
      ['Kabeltyp und Funktionserhalt', 17],
      ['Überspannungsschutz', 14],
    ]
    const left = used.filter(([name]) => attributeInEnglish(name) === name)
    expect(left).toEqual([])
  })
})
