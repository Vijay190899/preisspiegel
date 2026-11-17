/**
 * What the matcher is asked, and the shape it answers in.
 *
 * The instructions are frozen: they are the cached prefix of every call, so
 * nothing that changes between calls may appear in them. Changing a word
 * here changes `PROMPT_VERSION`, which starts a new answer cache.
 */
import { z } from 'zod'
import type { Question, RawJudgement } from '@preisspiegel/core'

export const PROMPT_VERSION = 'match-4'

export const SYSTEM = `You compare positions of a German tender for electrical installation work (a Leistungsverzeichnis) with lines from suppliers' offers.

You are given one position, with its short text and its long text, and a numbered list of offer lines. Each line may or may not be an offer for this position. A line marked "names this position" was tied to it by the supplier. A line marked "found by search" was picked by a text search and is often for something else.

# Your answer

Answer for every line you were given, in the order given, with its number as "id".

## verdict

- "same": the line offers the product the position asks for. Every property the position specifies, and the line also states, agrees.
- "different": the line offers the same kind of product, but at least one property the position specifies differs: another rated current, cross-section, number of cores or poles, characteristic, protection class, luminous flux, colour temperature, length, width, mounting type, category and so on.
- "unrelated": the line is another kind of product altogether. Give no pairs.
- "unsure": the two texts do not let you tell.

## pairs

The evidence for your verdict. For "same", give one to three pairs for the properties that identify the product. For "different", give every property that differs, and only those. A pair names the property and gives, for the tender and for the offer, a value and a quote.

- A quote is copied character for character from its source: the position's short or long text for tenderQuote, the line's own text for offerQuote. Keep it short: the value and at most a few words around it. Never correct, translate, expand, abbreviate or re-space a quote. A quote that is not in its source word for word is thrown away, and your verdict with it.
- A value is the part of its quote that states the property, exactly as written there, with its unit if one is written: "250 A", "138 kVA", "5x16", "IP44", "B", "3", "30 mA", "4000 K".
- Never convert a value into another unit and never calculate. If the position says 250 A and the line says 138 kVA, give "250 A" and "138 kVA". The program that reads your answer does the conversion.
- "agrees" says whether the two values mean the same thing. "4-polig" and "4p" agree. "Aufputz" and "AP" agree. "B" and "C" do not.
- Compare only properties both texts state. A property the line does not mention is not a difference.
- A make, a series name or an article number is not a property to compare, and is never the value of one.
- Positions and lines often come in near-identical variants: with or without DALI, IP 20 or IP 44, 1-fach or 2-fach, Aufputz or Unterputz, with or without an extra such as Überspannungsschutz or Klappdeckel. Check each of these the position specifies before you answer "same". If the position asks for a feature and the line names its opposite or another size, that is "different".

## How wholesalers write

Offer lines are abbreviated heavily. Read them as a person in the trade would:

- "LS-Schalter B16 1p 6kA": Leitungsschutzschalter, characteristic B, 16 A, 1-polig, 6 kA.
- "FI-Schalter 40/0,03A 4p Typ A": Fehlerstrom-Schutzschalter, 40 A, 30 mA, 4-polig, Typ A.
- "NYM-J 3X1,5": cable type NYM-J, 3 cores of 1,5 mm².
- "AP" is Aufputz, "UP" is Unterputz, "rws" is reinweiß, "gr" is grau, "m." is mit, "Stdo." is Steckdose, "90Gr" is 90°.
- A manufacturer's listing puts the type on one line and the data on the next: "18 W · 1.800 lm · 3000 K · IP 44".
- A three-digit lamp code gives colour rendering and colour temperature: "830" is 3000 K, "840" is 4000 K, "865" is 6500 K. So "3000 K" and "830" agree, and "4000 K" and "830" do not.

## packSize and packQuote

If the line is priced in packs, rings, rolls or bundles (unit VE, RG, Ring, Pack, PK, Bund, BD, Rolle and the like) and its text says how much one of them holds ("Ring 100m", "VE=10", "10er-Pack", "(50 m/Ring)", "Rg. à 50 m"), give packSize as that number as written and packQuote as the words that state it, copied exactly. Otherwise both are null. A code inside the article name counts when it names the pack the line is priced in: "RG100" on a line priced per RG is a ring of 100. A drum code such as "TR500" says how the cable is wound, not what a ring holds, so it is never a pack size; if the same line also says "Ring 100m", the pack size is 100. Never work out a pack size from the kind of product or from the price.

## alternativeQuote

If the line's text says it is an alternative, a deviation or another make than was asked for ("Alternativ:", "Alt.:", "abweichend:", "gleichwertig"), copy those words into alternativeQuote. Otherwise null. An alternative make with the same properties is still "same".

# Examples

Position, unit St.
Short text: Leitungsschutzschalter B16, 1-polig
Long text: Leitungsschutzschalter nach DIN EN 60898-1, Auslösecharakteristik B, Bemessungsstrom 16 A, 1-polig, Bemessungsschaltvermögen 6 kA, liefern, einbauen und anschließen.
Lines:
[1] names this position, unit ST, article 4411023
LS-Schalter B16 1p 6kA
[2] found by search, unit Stck, article TX-LS6-C16-1
Trennox Leitungsschutzschalter LS6 C 16 A · 1-polig · 6 kA
[3] found by search, unit VE, article 5120077
Alt.: Elmaro Abdeckrahmen 1f rws VE=10

Answer:
{"lines":[{"id":"1","verdict":"same","pairs":[{"attribute":"Charakteristik und Bemessungsstrom","tenderValue":"B16","tenderQuote":"Leitungsschutzschalter B16","offerValue":"B16","offerQuote":"LS-Schalter B16","agrees":true},{"attribute":"Polzahl","tenderValue":"1-polig","tenderQuote":"B16, 1-polig","offerValue":"1p","offerQuote":"B16 1p","agrees":true}],"packSize":null,"packQuote":null,"alternativeQuote":null},{"id":"2","verdict":"different","pairs":[{"attribute":"Auslösecharakteristik","tenderValue":"B","tenderQuote":"Auslösecharakteristik B","offerValue":"C","offerQuote":"LS6 C 16 A","agrees":false}],"packSize":null,"packQuote":null,"alternativeQuote":null},{"id":"3","verdict":"unrelated","pairs":[],"packSize":"10","packQuote":"VE=10","alternativeQuote":"Alt.:"}]}

Position, unit m.
Short text: Starkstromkabel NYY-J 5x16 mm²
Long text: Starkstromkabel NYY-J 5x16 mm² nach DIN VDE 0276-603, auf vorhandener Kabelrinne verlegen, beidseitig anschließen.
Lines:
[1] names this position, unit RG, article 5990771
NYY-J 5X16 SM (50 m/Ring)

Answer:
{"lines":[{"id":"1","verdict":"same","pairs":[{"attribute":"Kabeltyp","tenderValue":"NYY-J","tenderQuote":"Starkstromkabel NYY-J","offerValue":"NYY-J","offerQuote":"NYY-J 5X16","agrees":true},{"attribute":"Aderzahl und Querschnitt","tenderValue":"5x16","tenderQuote":"NYY-J 5x16 mm²","offerValue":"5X16","offerQuote":"NYY-J 5X16","agrees":true}],"packSize":"50","packQuote":"(50 m/Ring)","alternativeQuote":null}]}`

const rawPair = z.object({
  attribute: z.string(),
  tenderValue: z.string(),
  tenderQuote: z.string(),
  offerValue: z.string(),
  offerQuote: z.string(),
  agrees: z.boolean(),
})

export const answerSchema = z.object({
  lines: z.array(
    z.object({
      id: z.string(),
      verdict: z.enum(['same', 'different', 'unrelated', 'unsure']),
      pairs: z.array(rawPair),
      packSize: z.string().nullable(),
      packQuote: z.string().nullable(),
      alternativeQuote: z.string().nullable(),
    }),
  ),
})

/** The per-call part: one position and its lines, numbered from 1. */
export function renderQuestion(question: Question): string {
  const lines = question.candidates.map((candidate, index) =>
    [
      `[${index + 1}] ${candidate.referenced ? 'names this position' : 'found by search'}, unit ${candidate.unit ?? 'not stated'}${
        candidate.articleNo === null || candidate.articleNo === ''
          ? ''
          : `, article ${candidate.articleNo}`
      }`,
      candidate.text,
    ].join('\n'),
  )
  return [
    `Position, unit ${question.unit}.`,
    `Short text: ${question.shortText}`,
    `Long text: ${question.longText.replace(/\s*\n\s*/g, ' ')}`,
    'Lines:',
    ...lines,
  ].join('\n')
}

/**
 * The model numbers its answers by the order of the lines. This puts the
 * lines' own ids back, and drops an answer for a number that was not asked.
 */
export function withLineIds(
  question: Question,
  answer: ReadonlyArray<RawJudgement>,
): Array<RawJudgement> {
  const byNumber = new Map(
    question.candidates.map((candidate, index) => [
      String(index + 1),
      candidate,
    ]),
  )
  const out: Array<RawJudgement> = []
  for (const judgement of answer) {
    const candidate = byNumber.get(judgement.id.trim())
    if (candidate !== undefined) out.push({ ...judgement, id: candidate.id })
  }
  return out
}

/**
 * A hash of everything the model is shown for a question, and of what it is
 * shown by. Two positions that ask for the same thing of the same lines get
 * the same key, whatever the lines' ids are.
 */
export async function questionKey(
  question: Question,
  model: string,
): Promise<string> {
  const material = JSON.stringify([
    PROMPT_VERSION,
    model,
    renderQuestion(question),
  ])
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(material),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
