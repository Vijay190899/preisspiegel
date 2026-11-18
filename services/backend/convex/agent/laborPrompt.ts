/**
 * What the model is asked about labor, and the shape it answers in.
 *
 * The instructions and the table are the cached prefix of every call. The
 * table is shown without its minutes: the model picks a kind of work, and
 * the minutes are read from the table by code. Changing a word here changes
 * `LABOR_PROMPT_VERSION`, which starts a new answer cache.
 */
import { z } from 'zod'
import type { LaborEntry } from '@preisspiegel/core'

export const LABOR_PROMPT_VERSION = 'labor-2'

const INSTRUCTIONS = `You work for a German electrical contractor who is pricing a tender (a Leistungsverzeichnis). For every position the contractor needs the labor time, which comes from the contractor's own labor time table. You are given one position and you say which entry of the table describes the work of installing what the position asks for.

# Your answer

## entry

The key of one entry, copied exactly as written in the table. Or null if no entry describes the work.

- Choose by what is to be installed, not by words the texts happen to share.
- The entry must be in the position's unit: an entry by the metre (m) for a position by the metre, an entry by the piece (St) for a position by the piece.
- Prefer the entry that names the thing itself over a general one: a pendant luminaire takes the entry for pendant luminaires, not the one for luminaires in general.
- Name the work by what is installed, not by a word inside its name. A Steckdose, a Herdanschlussdose or a Geräteanschlussdose is a device that is mounted and connected; it is not an empty box. An entry for setting boxes is for the box alone: an Abzweigdose, a Gerätedose, an Abzweigkasten.
- An entry whose work includes "auflegen" (terminating the cores of cables) is for a part cables are terminated on, such as a patch panel. A part that only guides, holds or tidies cables in a cabinet is an accessory, even if its name contains "Panel".
- Answer null when the position is not the installation of something the table times: work paid by the hour (Stundenlohnarbeiten), setting up or clearing the site, documentation, measurements, instruction of the operator. Do not pick the nearest entry when none fits.

## quote

The words of the position that name what is to be installed, copied character for character from its short text or its long text. Keep it short: the name of the thing. Never correct spelling, never translate.

## limitQuote

Some entries differ only by a size or a count stated in their label: "bis 2,5 mm²", "10 bis 16 mm²", "über 250 A", "bis 200 mm", "3-polig". If the entry you chose states one, copy into limitQuote the words of the position that state that size or count: "5x16 mm²", "Bemessungsstrom 160 A", "3-polig", "Breite 200 mm". Copy them character for character. The program reads the number from your quote and checks it against the label, so never convert, round or calculate. For a cable the cross-section is the last number of its designation: "5x16 mm²" is 16 mm².

If the label of the entry you chose states no size and no count, or you answer null, limitQuote is null.

# Examples

Position, unit m.
Short text: Starkstromkabel NYY-J 5x16 mm²
Long text: Starkstromkabel NYY-J 5x16 mm² nach DIN VDE 0276-603, auf vorhandener Kabelrinne verlegen, beidseitig anschließen.

Answer (with a table that has "cable.l | m | Kabel 10 bis 16 mm² verlegen"):
{"entry":"cable.l","quote":"Starkstromkabel NYY-J","limitQuote":"5x16 mm²"}

Position, unit St.
Short text: LED-Pendelleuchte 1.500 mm, 40 W
Long text: LED-Pendelleuchte, Länge 1.500 mm, 40 W, 4000 K, mit Seilabhängung liefern, montieren und anschließen.

Answer (with a table that has "luminaire | St | Leuchte montieren und anschließen" and "luminaire.pendant | St | Pendelleuchte montieren"):
{"entry":"luminaire.pendant","quote":"LED-Pendelleuchte","limitQuote":null}

Position, unit h.
Short text: Stundenlohnarbeiten Monteur
Long text: Stundenlohnarbeiten eines Elektromonteurs auf besondere Anordnung des Auftraggebers, Abrechnung nach Aufwand.

Answer:
{"entry":null,"quote":"Stundenlohnarbeiten","limitQuote":null}`

/** The frozen prefix: the instructions and the contractor's table. */
export function laborSystem(table: ReadonlyArray<LaborEntry>): string {
  return [
    INSTRUCTIONS,
    '',
    '# The labor time table',
    '',
    'key | unit | work',
    ...table.map((entry) => `${entry.key} | ${entry.unit} | ${entry.label}`),
  ].join('\n')
}

export const laborAnswerSchema = z.object({
  entry: z.string().nullable(),
  quote: z.string(),
  limitQuote: z.string().nullable(),
})

/** The per-call part: one position. */
export function renderLaborQuestion(position: {
  shortText: string
  longText: string
  unit: string
}): string {
  return [
    `Position, unit ${position.unit}.`,
    `Short text: ${position.shortText}`,
    `Long text: ${position.longText.replace(/\s*\n\s*/g, ' ')}`,
  ].join('\n')
}

/**
 * A hash of everything the model is shown and of what it is shown by:
 * the prompt, the table, the model and the position's text. Positions that
 * ask for the same thing share an answer.
 */
export async function laborKey(
  position: { shortText: string; longText: string; unit: string },
  model: string,
  system: string,
): Promise<string> {
  const material = JSON.stringify([
    LABOR_PROMPT_VERSION,
    model,
    system,
    renderLaborQuestion(position),
  ])
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(material),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
