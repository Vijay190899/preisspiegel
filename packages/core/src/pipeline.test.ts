import { describe, expect, it } from 'vitest'
import {
  assess,
  attribute,
  buildQuestions,
  decide,
  lineId,
  markOutliers,
  quantityCovers,
  triage,
  unitPriceOf,
  verifyAnswer,
} from './pipeline'
import type { OfferLine, Position } from './model'
import type { Judgement, Offer, Question, RawJudgement } from './pipeline'

const position = (over: Partial<Position> = {}): Position => ({
  oz: '01.01.0020',
  seq: 1,
  path: [],
  shortText: 'Anschlussverteilerschrank 250 A für Baustrom',
  longText:
    'Anschlussverteilerschrank für die Baustromversorgung, Bemessungsstrom 250 A, Schutzart IP 44, liefern und aufstellen.',
  qty: 1,
  unit: 'St',
  gaebId: 'P0002',
  ...over,
})

const line = (over: Partial<OfferLine> = {}): OfferLine => ({
  supplierKey: 'a',
  seq: 0,
  posRef: '01.01.0020',
  articleNo: '7799724',
  text: 'Anschlussschrank AVS 138 kVA m. Zählerplatz IP44',
  qty: 1,
  unit: 'ST',
  unitPrice: 4502.13,
  priceBasis: 1,
  listPrice: null,
  discountPct: null,
  total: 4502.13,
  alternative: false,
  sources: {},
  ...over,
})

const confirmed = (id: string, over: Partial<Judgement> = {}): Judgement => ({
  id,
  verdict: 'confirmed',
  by: 'model',
  said: 'same',
  pairs: [],
  rejected: 0,
  pack: null,
  alternative: null,
  ...over,
})

const question = (candidates: Array<OfferLine>, at = position()): Question =>
  buildQuestions([at], candidates)[0]!

describe('buildQuestions', () => {
  it('puts the line that names the position first, then what a search finds', () => {
    const named = line()
    const other = line({
      supplierKey: 'b',
      seq: 4,
      posRef: null,
      text: 'Anschlussverteilerschrank Baustrom 250 A',
    })
    const far = line({
      supplierKey: 'b',
      seq: 5,
      posRef: null,
      text: 'Patchkabel Cat.6A 2 m',
    })
    // The patch cable is what another position asks for. It fits that one
    // far better than the cabinet, so it is not put forward for the cabinet.
    const patch = position({
      oz: '10.01.0010',
      shortText: 'Patchkabel Cat.6A, 2 m',
      longText: 'Patchkabel Cat.6A, Länge 2 m, liefern.',
    })
    const asked = buildQuestions([position(), patch], [named, other, far])[0]!
    expect(asked.candidates.map((candidate) => candidate.id)).toEqual([
      'a.0',
      'b.4',
    ])
    expect(asked.candidates[0]!.referenced).toBe(true)
    expect(asked.candidates[1]!.referenced).toBe(false)
  })

  it('does not ask about a line that repeats the position word for word', () => {
    const echo = line({
      supplierKey: 'c',
      seq: 1,
      text: position().shortText,
      articleNo: null,
    })
    const asked = question([echo])
    expect(asked.candidates).toEqual([])
    expect(asked.echoes).toEqual(['c.1'])
    expect(verifyAnswer(asked, [])).toMatchObject([
      { id: 'c.1', verdict: 'confirmed', by: 'code' },
    ])
  })
})

describe('buildQuestions, by quantity', () => {
  // Blind buttons on three floors, 6 + 9 + 12 = 27 of them.
  const buttons = [6, 9, 12].map((qty, floor) =>
    position({
      oz: `06.0${floor + 1}.0090`,
      shortText: 'Jalousietaster, Unterputz',
      longText: 'Jalousietaster für Rohrmotor, Unterputz, liefern.',
      qty,
      unit: 'St',
    }),
  )
  const sockets = position({
    oz: '06.01.0010',
    shortText: 'SCHUKO-Steckdose 16 A, Unterputz',
    longText: 'SCHUKO-Steckdose 16 A, 250 V, Unterputz, liefern.',
    qty: 40,
    unit: 'St',
  })
  // The supplier quotes a two-way switch where blind buttons were asked
  // for. Nothing in its text leads to them; its quantity does.
  const inPlace = (over: Partial<OfferLine> = {}) =>
    line({
      supplierKey: 'b',
      seq: 5,
      posRef: null,
      text: 'Wippschalter Aus/Wechsel 10 AX reinweiß',
      articleNo: null,
      qty: 27,
      unit: 'St',
      ...over,
    })
  const idsFor = (
    all: Array<Position>,
    lines: Array<OfferLine>,
    oz: string,
  ): Array<string> =>
    buildQuestions(all, lines)
      .find((asked) => asked.oz === oz)!
      .candidates.map((candidate) => candidate.id)

  it('asks about a line for the positions whose quantities add up to its own', () => {
    const all = [sockets, ...buttons]
    for (const button of buttons) {
      expect(idsFor(all, [inPlace()], button.oz)).toEqual(['b.5'])
    }
    expect(idsFor(all, [inPlace()], sockets.oz)).toEqual([])
  })

  it('does not when the quantity is not the total of a kind', () => {
    const all = [sockets, ...buttons]
    expect(idsFor(all, [inPlace({ qty: 26 })], buttons[0]!.oz)).toEqual([])
  })

  it('does not when the unit is another', () => {
    const all = [sockets, ...buttons]
    expect(idsFor(all, [inPlace({ unit: 'm' })], buttons[0]!.oz)).toEqual([])
  })

  it('does not when the quantity fits too many kinds to say anything', () => {
    // Three more kinds that also come to 27.
    const others = ['Taster', 'Dimmer', 'Abdeckrahmen'].map((name, at) =>
      position({
        oz: `06.09.00${at + 1}0`,
        shortText: `${name}, Unterputz`,
        longText: `${name}, Unterputz, liefern.`,
        qty: 27,
        unit: 'St',
      }),
    )
    const all = [sockets, ...buttons, ...others]
    expect(idsFor(all, [inPlace()], buttons[0]!.oz)).toEqual([])
  })

  it('keeps the kinds a line reads most like when its quantity fits many', () => {
    // Four kinds come to 27. The line reads like none of the buttons'
    // rivals, a little like the buttons: both are operated by a rocker.
    const others = ['Bewegungsmelder', 'Dimmer', 'Abdeckrahmen'].map(
      (name, at) =>
        position({
          oz: `06.09.00${at + 1}0`,
          shortText: `${name}, Unterputz`,
          longText: `${name}, Unterputz, liefern.`,
          qty: 27,
          unit: 'St',
        }),
    )
    const rocker = buttons.map((button) => ({
      ...button,
      longText: 'Jalousietaster mit Wippe für Rohrmotor, Unterputz, liefern.',
    }))
    const all = [sockets, ...rocker, ...others]
    const line27 = inPlace({ text: 'Schalter mit Wippe 10 AX reinweiß' })
    expect(idsFor(all, [line27], rocker[0]!.oz)).toEqual(['b.5'])
    expect(idsFor(all, [line27], others[0]!.oz)).toEqual([])
  })

  it('leaves a line alone that the text search already led to its kind', () => {
    const right = inPlace({ text: 'Jalousietaster Unterputz reinweiß' })
    const all = [sockets, ...buttons]
    // Found by its text for every button, and once only.
    for (const button of buttons) {
      expect(idsFor(all, [right], button.oz)).toEqual(['b.5'])
    }
  })
})

describe('verifyAnswer', () => {
  const asked = question([line()])
  const raw = (over: Partial<RawJudgement> = {}): RawJudgement => ({
    id: 'a.0',
    verdict: 'same',
    pairs: [
      {
        attribute: 'Schutzart',
        tenderValue: 'IP 44',
        tenderQuote: 'Schutzart IP 44',
        offerValue: 'IP44',
        offerQuote: 'Zählerplatz IP44',
        agrees: true,
      },
    ],
    packSize: null,
    packQuote: null,
    alternativeQuote: null,
    ...over,
  })

  it('confirms a line called the same when its quotes stand in the sources', () => {
    const [judgement] = verifyAnswer(asked, [raw()])
    expect(judgement).toMatchObject({ verdict: 'confirmed', rejected: 0 })
    expect(judgement!.pairs[0]).toMatchObject({
      agrees: true,
      decidedBy: 'code',
    })
  })

  it('throws out a claim whose quote is not in the source', () => {
    const [judgement] = verifyAnswer(asked, [
      raw({
        pairs: [
          {
            attribute: 'Bemessungsstrom',
            tenderValue: '250 A',
            tenderQuote: 'Bemessungsstrom 250 A',
            offerValue: '250 A',
            // The line says nothing of the kind.
            offerQuote: 'Nennstrom 250 A',
            agrees: true,
          },
        ],
      }),
    ])
    expect(judgement).toMatchObject({
      verdict: 'unconfirmed',
      rejected: 1,
      pairs: [],
    })
  })

  it('throws out a value that is not in its own quote', () => {
    const [judgement] = verifyAnswer(asked, [
      raw({
        pairs: [
          {
            attribute: 'Bemessungsstrom',
            tenderValue: '250 A',
            tenderQuote: 'Bemessungsstrom 250 A',
            offerValue: '250 A',
            offerQuote: 'AVS 138 kVA',
            agrees: true,
          },
        ],
      }),
    ])
    expect(judgement).toMatchObject({ verdict: 'unconfirmed', rejected: 1 })
  })

  it('overrules a model that calls 138 kVA the same as 250 A', () => {
    const [judgement] = verifyAnswer(asked, [
      raw({
        pairs: [
          {
            attribute: 'Bemessungsstrom',
            tenderValue: '250 A',
            tenderQuote: 'Bemessungsstrom 250 A',
            offerValue: '138 kVA',
            offerQuote: 'AVS 138 kVA',
            agrees: true,
          },
        ],
      }),
    ])
    expect(judgement).toMatchObject({ verdict: 'mismatch', by: 'code' })
    expect(judgement!.pairs[0]).toMatchObject({
      agrees: false,
      decidedBy: 'code',
      arithmetic: '138 kVA / (√3 × 400 V) = 199 A',
    })
  })

  it('takes the pack size only when the line states it', () => {
    const ring = line({
      text: 'NYM-J 3X1,5 GR Ring 100m',
      unit: 'RG',
      posRef: '01.01.0020',
    })
    const about = question([ring])
    const stated = verifyAnswer(about, [
      raw({
        pairs: [],
        verdict: 'unsure',
        packSize: '100',
        packQuote: 'Ring 100m',
      }),
    ])[0]!
    expect(stated.pack).toEqual({ size: 100, quote: 'Ring 100m' })
    const invented = verifyAnswer(about, [
      raw({
        pairs: [],
        verdict: 'unsure',
        packSize: '50',
        packQuote: 'Ring 100m',
      }),
    ])[0]!
    expect(invented.pack).toBeNull()
    expect(invented.rejected).toBe(1)
  })

  it('treats a line the model did not answer for as not established', () => {
    expect(verifyAnswer(asked, [])[0]).toMatchObject({ verdict: 'unconfirmed' })
  })
})

describe('unitPriceOf', () => {
  it('divides by the price unit', () => {
    expect(
      unitPriceOf(
        line({ unit: 'M', unitPrice: 779.7, priceBasis: 100 }),
        'm',
        null,
      ),
    ).toBeCloseTo(7.797, 6)
    expect(
      unitPriceOf(
        line({ unit: 'ST', unitPrice: 380, priceBasis: 1000 }),
        'St',
        null,
      ),
    ).toBeCloseTo(0.38, 6)
  })

  it('divides a pack price by the pack size, and gives up without one', () => {
    const ring = line({ unit: 'RG', unitPrice: 61.9, priceBasis: 1 })
    expect(
      unitPriceOf(ring, 'm', { size: 100, quote: 'Ring 100m' }),
    ).toBeCloseTo(0.619, 6)
    expect(unitPriceOf(ring, 'm', null)).toBeNull()
  })

  it('does not convert between pieces and metres', () => {
    expect(
      unitPriceOf(line({ unit: 'M', unitPrice: 2 }), 'St', null),
    ).toBeNull()
  })
})

describe('quantityCovers', () => {
  it('accepts the quantity asked for, and rounding up within the allowance', () => {
    expect(quantityCovers(37, 37, null)).toBe(true)
    expect(quantityCovers(37, 40, null)).toBe(true)
    expect(quantityCovers(100, 131, null)).toBe(false)
    expect(quantityCovers(37, 30, null)).toBe(false)
  })

  it('accepts up to one pack more', () => {
    expect(quantityCovers(145, 200, 100)).toBe(true)
    expect(quantityCovers(145, 300, 100)).toBe(false)
  })
})

describe('assess', () => {
  const byId = (lines: Array<OfferLine>) =>
    new Map(lines.map((entry) => [lineId(entry), entry]))

  it('finds a total that does not multiply out, and forgives a cent', () => {
    const wrong = line({ qty: 10, unitPrice: 5, total: 55 })
    const cent = line({ seq: 1, qty: 3, unitPrice: 1.115, total: 3.36 })
    const codes = (entry: OfferLine) =>
      assess(position({ qty: entry.qty! }), byId([entry]), [
        confirmed(lineId(entry)),
      ])[0]!.findings.map((finding) => finding.code)
    expect(codes(wrong)).toEqual(['ARITHMETIC'])
    expect(codes(cent)).toEqual([])
  })

  it('adds up a quantity split over two lines of the same article and price', () => {
    const first = line({ qty: 6, total: 27012.78 })
    const second = line({ seq: 1, qty: 4, total: 18008.52 })
    const offers = assess(position({ qty: 10 }), byId([first, second]), [
      confirmed('a.0'),
      confirmed('a.1'),
    ])
    expect(offers.flatMap((offer) => offer.findings)).toEqual([])
  })

  it('calls two lines at different prices for one position ambiguous', () => {
    const first = line()
    const second = line({
      seq: 1,
      articleNo: '7799731',
      unitPrice: 5042.39,
      total: 5042.39,
    })
    const offers = assess(position(), byId([first, second]), [
      confirmed('a.0'),
      confirmed('a.1'),
    ])
    expect(
      offers.map((offer) => offer.findings.map((finding) => finding.code)),
    ).toEqual([['AMBIGUOUS'], ['AMBIGUOUS']])
  })

  it('flags a quantity far from the one asked for', () => {
    const tenth = line({ qty: 12, total: 54025.56 })
    const [offer] = assess(position({ qty: 120 }), byId([tenth]), [
      confirmed('a.0'),
    ])
    expect(offer!.findings).toEqual([
      { code: 'QTY_MISMATCH', detail: { asked: 120, offered: 12 } },
    ])
  })

  it('flags a pack without a size, and prices one with a size', () => {
    const ring = line({
      unit: 'RG',
      qty: 2,
      unitPrice: 61.9,
      total: 123.8,
      text: 'NYM-J 3X1,5 GR',
    })
    const at = position({ qty: 145, unit: 'm' })
    const [unclear] = assess(at, byId([ring]), [confirmed('a.0')])
    expect(unclear).toMatchObject({ unitPrice: null })
    expect(unclear!.findings.map((finding) => finding.code)).toEqual([
      'UNIT_BASIS',
    ])
    const [clear] = assess(at, byId([ring]), [
      confirmed('a.0', { pack: { size: 100, quote: 'Ring 100m' } }),
    ])
    expect(clear!.unitPrice).toBeCloseTo(0.619, 6)
    expect(clear!.quantity).toBe(200)
    expect(clear!.findings).toEqual([])
  })

  it('keeps a line the supplier ties to the position even if nothing confirms it', () => {
    const [offer] = assess(position(), byId([line()]), [
      confirmed('a.0', { verdict: 'unconfirmed' }),
    ])
    expect(offer!.findings.map((finding) => finding.code)).toEqual([
      'AMBIGUOUS',
    ])
  })

  it('keeps a line without a reference that could not be told, with no finding yet', () => {
    const stray = line({ posRef: null })
    const [kept] = assess(position(), byId([stray]), [
      confirmed('a.0', { verdict: 'unconfirmed' }),
    ])
    expect(kept).toMatchObject({ verdict: 'unconfirmed', findings: [] })
    // And it goes if its quantity does not bring it back.
    expect(
      attribute([{ position: position(), offers: [kept!] }])[0]!.offers,
    ).toEqual([])
  })
})

describe('attribute', () => {
  const lamp28 = (oz: string, qty: number) =>
    position({
      oz,
      qty,
      shortText: 'LED-Einlegeleuchte 28 W',
      longText: 'LED-Einlegeleuchte 28 W',
    })
  const lamp34 = (oz: string, qty: number) =>
    position({
      oz,
      qty,
      shortText: 'LED-Einlegeleuchte 34 W',
      longText: 'LED-Einlegeleuchte 34 W',
    })
  const offer = (verdict: Offer['verdict'], quantity: number): Offer => ({
    id: 'b.3',
    supplierKey: 'b',
    seq: 3,
    referenced: false,
    verdict,
    by: 'model',
    pairs: [],
    pack: null,
    unitPrice: 80,
    quantity,
    findings:
      verdict === 'mismatch' ? [{ code: 'SPEC_MISMATCH', detail: {} }] : [],
  })

  /** Another line of the same supplier. */
  const other = (
    id: string,
    verdict: Offer['verdict'],
    quantity: number,
  ): Offer => ({ ...offer(verdict, quantity), id, seq: Number(id.slice(2)) })
  /** The same downlight in two ratings: one short text, two things. */
  const downlight = (oz: string, qty: number, rating: string) =>
    position({
      oz,
      qty,
      shortText: 'LED-Downlight, 26 W',
      longText: `LED-Downlight, Systemleistung 26 W, Schutzart ${rating}, liefern.`,
    })

  it('accepts the quantity of some of the positions that ask for the article', () => {
    // The supplier quoted two of the three floors: 20 + 30 of 62.
    const result = attribute([
      { position: lamp34('07.01.0010', 20), offers: [offer('confirmed', 50)] },
      { position: lamp34('07.02.0010', 30), offers: [offer('confirmed', 50)] },
      { position: lamp34('07.03.0010', 12), offers: [offer('confirmed', 50)] },
    ])
    expect(result.flatMap((entry) => entry.offers[0]?.findings)).toEqual([])
  })

  it('still says so when no choice of positions comes to the quantity', () => {
    const result = attribute([
      { position: lamp34('07.01.0010', 20), offers: [offer('confirmed', 90)] },
      { position: lamp34('07.02.0010', 30), offers: [offer('confirmed', 90)] },
    ])
    expect(
      result.map((entry) => entry.offers[0]?.findings.map((f) => f.code)),
    ).toEqual([['QTY_MISMATCH'], ['QTY_MISMATCH']])
  })

  it('tells apart two ratings that share a short text', () => {
    // 50 pieces of the IP 44 light: what the IP 20 positions add up to.
    const result = attribute([
      {
        position: downlight('07.01.0010', 20, 'IP 20'),
        offers: [offer('mismatch', 50)],
      },
      {
        position: downlight('07.02.0010', 30, 'IP20'),
        offers: [offer('mismatch', 50)],
      },
      {
        position: downlight('07.01.0020', 14, 'IP 44'),
        offers: [offer('confirmed', 50)],
      },
    ])
    // An offer of the wrong product for the IP 20 positions, and still a
    // price for the position that does ask for IP 44.
    expect(result.map((entry) => entry.offers.length)).toEqual([1, 1, 1])
    expect(result[0]?.offers[0]?.findings.map((f) => f.code)).toEqual([
      'SPEC_MISMATCH',
    ])
    expect(result[2]?.offers[0]?.findings).toEqual([])
  })

  it("does not take a line for a position's answer when its quantity is for others", () => {
    // b.3 is the 28 W light with the quantity of the 34 W positions; b.4 is
    // the 34 W light, but with a quantity that belongs elsewhere. So b.4
    // does not settle what was quoted for the 34 W positions, and b.3 is
    // seen as quoted in their place.
    const result = attribute([
      {
        position: lamp34('07.01.0010', 20),
        offers: [offer('mismatch', 50), other('b.4', 'confirmed', 77)],
      },
      {
        position: lamp34('07.02.0010', 30),
        offers: [offer('mismatch', 50), other('b.4', 'confirmed', 77)],
      },
      { position: lamp28('07.01.0020', 12), offers: [offer('confirmed', 50)] },
    ])
    expect(
      result[0]?.offers.find((entry) => entry.id === 'b.3')?.findings[0]?.code,
    ).toBe('SPEC_MISMATCH')
  })

  it('drops a near match whose quantity is accounted for by exact matches', () => {
    const result = attribute([
      { position: lamp34('07.01.0010', 20), offers: [offer('confirmed', 50)] },
      { position: lamp34('07.02.0010', 30), offers: [offer('confirmed', 50)] },
      { position: lamp28('07.01.0020', 12), offers: [offer('mismatch', 50)] },
    ])
    expect(result.map((entry) => entry.offers.length)).toEqual([1, 1, 0])
  })

  it('keeps a near match as an offer of the wrong product when its quantity is theirs', () => {
    // 34 W quoted, 50 pieces: exactly what the 28 W positions add up to.
    const result = attribute([
      { position: lamp28('07.01.0020', 20), offers: [offer('mismatch', 50)] },
      { position: lamp28('07.02.0020', 30), offers: [offer('mismatch', 50)] },
    ])
    expect(
      result.map((entry) => entry.offers.map((o) => o.findings[0]?.code)),
    ).toEqual([['SPEC_MISMATCH'], ['SPEC_MISMATCH']])
  })

  it("keeps the article price for positions that ask for it when the quantity was another group's", () => {
    const result = attribute([
      { position: lamp34('07.01.0010', 7), offers: [offer('confirmed', 50)] },
      { position: lamp28('07.01.0020', 20), offers: [offer('mismatch', 50)] },
      { position: lamp28('07.02.0020', 30), offers: [offer('mismatch', 50)] },
    ])
    expect(result.map((entry) => entry.offers.length)).toEqual([1, 1, 1])
    expect(result[0]!.offers[0]!.findings).toEqual([])
  })

  it('does not pin a substitution on positions the supplier already answers', () => {
    // Two groups of near matches add up to the line's 50. One of them has
    // its own exact line from this supplier; the other has none.
    const own: Offer = { ...offer('confirmed', 50), id: 'b.9', seq: 9 }
    const result = attribute([
      {
        position: lamp34('07.01.0010', 20),
        offers: [offer('mismatch', 50), own],
      },
      {
        position: lamp34('07.02.0010', 30),
        offers: [offer('mismatch', 50), own],
      },
      { position: lamp28('07.01.0020', 20), offers: [offer('mismatch', 50)] },
      { position: lamp28('07.02.0020', 30), offers: [offer('mismatch', 50)] },
    ])
    expect(
      result.map((entry) => entry.offers.map((entry2) => entry2.id)),
    ).toEqual([['b.9'], ['b.9'], ['b.3'], ['b.3']])
  })

  it('lets the quantity pick between variants the text could not tell apart', () => {
    // The line is for 50 pieces. Positions for 34 W add up to 50; the 28 W
    // ones, wrongly read as the same, add up to 12 more.
    const result = attribute([
      { position: lamp34('07.01.0010', 20), offers: [offer('confirmed', 50)] },
      { position: lamp34('07.02.0010', 30), offers: [offer('confirmed', 50)] },
      { position: lamp28('07.01.0020', 12), offers: [offer('confirmed', 50)] },
    ])
    expect(result.map((entry) => entry.offers.length)).toEqual([1, 1, 0])
    expect(
      result.flatMap((entry) => entry.offers.flatMap((o) => o.findings)),
    ).toEqual([])
  })

  it('lets the quantity complete a kind of position the reading left a gap in', () => {
    // 20 + 30 = 50, the line's quantity. The line was read as the same for
    // the first position and left open for the second.
    const result = attribute([
      { position: lamp34('07.01.0010', 20), offers: [offer('confirmed', 50)] },
      {
        position: lamp34('07.02.0010', 30),
        offers: [offer('unconfirmed', 50)],
      },
      {
        position: lamp28('07.01.0020', 12),
        offers: [offer('unconfirmed', 50)],
      },
    ])
    expect(
      result.map((entry) => entry.offers.map((o) => [o.verdict, o.by])),
    ).toEqual([[['confirmed', 'model']], [['confirmed', 'code']], []])
    expect(
      result.flatMap((entry) => entry.offers.flatMap((o) => o.findings)),
    ).toEqual([])
  })

  it('does not let a quantity overrule a difference arithmetic found', () => {
    const proven: Offer = {
      ...offer('mismatch', 50),
      pairs: [
        {
          attribute: 'Bemessungsstrom',
          tender: { value: '16 A', quote: '16 A' },
          offer: { value: '10 A', quote: '10 A' },
          agrees: false,
          decidedBy: 'code',
        },
      ],
    }
    const result = attribute([
      { position: lamp34('07.01.0010', 20), offers: [offer('confirmed', 50)] },
      { position: lamp34('07.02.0010', 30), offers: [proven] },
    ])
    // The quantity covers both positions, so the line was quoted for both.
    // For the second it stays what arithmetic says it is: another product.
    expect(result[1]!.offers[0]).toMatchObject({
      verdict: 'mismatch',
      by: 'model',
    })
    expect(result[1]!.offers[0]!.findings.map((f) => f.code)).toEqual([
      'SPEC_MISMATCH',
    ])
    expect(result[0]!.offers[0]!.findings).toEqual([])
  })

  it('keeps a doubt about the product apart from a doubt about the line', () => {
    const byId = new Map([[lineId(line()), line()]])
    const doubted = assess(position(), byId, [
      confirmed('a.0', { verdict: 'unconfirmed', said: 'different' }),
    ])
    expect(doubted[0]!.findings).toEqual([
      { code: 'SPEC_MISMATCH', detail: { unconfirmed: 1 } },
    ])
  })

  it('says so when nothing accounts for the quantity', () => {
    const result = attribute([
      { position: lamp34('07.01.0010', 20), offers: [offer('confirmed', 500)] },
    ])
    expect(result[0]!.offers[0]!.findings).toEqual([
      { code: 'QTY_MISMATCH', detail: { asked: 20, offered: 500 } },
    ])
  })
})

describe('decide', () => {
  const offer = (
    id: string,
    unitPrice: number | null,
    codes: Array<Offer['findings'][number]['code']> = [],
    verdict: Offer['verdict'] = 'confirmed',
  ): Offer => ({
    id,
    supplierKey: id[0]!,
    seq: 0,
    referenced: true,
    verdict,
    by: 'model',
    pairs: [],
    pack: null,
    unitPrice,
    quantity: 1,
    findings: codes.map((code) => ({ code, detail: {} })),
  })

  it('prices a position from its cheapest clean offer', () => {
    expect(
      decide(position({ qty: 3 }), [offer('a.0', 12), offer('c.0', 10)]),
    ).toEqual({
      status: 'auto',
      reasons: [],
      noted: [],
      best: { id: 'c.0', supplierKey: 'c', unitPrice: 10 },
      materialTotal: 30,
      atRisk: null,
    })
  })

  it('asks a person when the cheapest offer is flagged, and says what it is worth', () => {
    const decision = decide(position({ qty: 2 }), [
      offer('a.0', 4502.13, ['SPEC_MISMATCH'], 'mismatch'),
      offer('c.0', 4893.62),
    ])
    expect(decision).toMatchObject({
      status: 'review',
      reasons: ['SPEC_MISMATCH'],
      best: { id: 'c.0' },
      atRisk: 782.98,
    })
  })

  it('only notes a flagged offer that is dearer than a clean one', () => {
    expect(
      decide(position(), [offer('a.0', 20, ['ARITHMETIC']), offer('c.0', 10)]),
    ).toMatchObject({
      status: 'auto',
      reasons: [],
      noted: ['ARITHMETIC'],
    })
  })

  it('asks when a flagged offer has no price per unit', () => {
    expect(
      decide(position(), [
        offer('a.0', null, ['UNIT_BASIS']),
        offer('c.0', 10),
      ]),
    ).toMatchObject({
      status: 'review',
      reasons: ['UNIT_BASIS'],
      atRisk: null,
    })
  })

  it('asks when there is no clean offer at all, or no offer', () => {
    expect(
      decide(position({ qty: 4 }), [offer('a.0', 5, ['ALTERNATIVE_PRODUCT'])]),
    ).toMatchObject({
      status: 'review',
      reasons: ['ALTERNATIVE_PRODUCT'],
      best: null,
      atRisk: 20,
    })
    expect(decide(position(), [])).toMatchObject({
      status: 'review',
      reasons: ['NO_OFFER'],
    })
  })
})

describe('markOutliers', () => {
  const priced = (id: string, unitPrice: number): Offer => ({
    id,
    supplierKey: id[0]!,
    seq: 0,
    referenced: true,
    verdict: 'confirmed',
    by: 'model',
    pairs: [],
    pack: null,
    unitPrice,
    quantity: 1,
    findings: [],
  })

  it('marks the one price far from two that agree', () => {
    const offers = [priced('a.0', 10), priced('b.0', 11), priced('c.0', 104)]
    markOutliers(offers)
    expect(offers.map((offer) => offer.findings.length)).toEqual([0, 0, 1])
  })

  it('marks both where only two suppliers quote and they are far apart', () => {
    const offers = [priced('a.0', 10), priced('c.0', 100)]
    markOutliers(offers)
    expect(offers.map((offer) => offer.findings.length)).toEqual([1, 1])
  })

  it('leaves an ordinary spread alone', () => {
    const offers = [priced('a.0', 10), priced('c.0', 13)]
    markOutliers(offers)
    expect(offers.flatMap((offer) => offer.findings)).toEqual([])
  })

  it('does not measure a price against the price of another product', () => {
    // A three-pole breaker where a one-pole one was asked for costs four
    // times as much. That says nothing about the one-pole price.
    const wrong: Offer = { ...priced('a.0', 40), verdict: 'mismatch' }
    const offers = [wrong, priced('c.0', 10)]
    markOutliers(offers)
    expect(offers.flatMap((offer) => offer.findings)).toEqual([])
  })
})

describe('triage', () => {
  it('runs the featured position from lines to decision', () => {
    const at = position()
    const wrong = line()
    const right = line({
      supplierKey: 'c',
      seq: 1,
      articleNo: null,
      text: at.shortText,
      unit: 'St',
      unitPrice: 4893.62,
      total: 4893.62,
    })
    const [asked] = buildQuestions([at], [wrong, right])
    const judgements = verifyAnswer(asked!, [
      {
        id: 'a.0',
        verdict: 'same',
        pairs: [
          {
            attribute: 'Bemessungsstrom',
            tenderValue: '250 A',
            tenderQuote: 'Bemessungsstrom 250 A',
            offerValue: '138 kVA',
            offerQuote: 'AVS 138 kVA',
            agrees: true,
          },
        ],
        packSize: null,
        packQuote: null,
        alternativeQuote: null,
      },
    ])
    const [result] = triage(
      [at],
      [wrong, right],
      new Map([[at.oz, judgements]]),
    )
    expect(result!.decision).toMatchObject({
      status: 'review',
      reasons: ['SPEC_MISMATCH'],
      best: { id: 'c.1', unitPrice: 4893.62 },
      atRisk: 391.49,
    })
    expect(
      result!.offers.find((offer) => offer.id === 'a.0')!.findings[0],
    ).toEqual({
      code: 'SPEC_MISMATCH',
      detail: {
        attribute: 'Bemessungsstrom',
        tender: '250 A',
        offer: '138 kVA',
        arithmetic: '138 kVA / (√3 × 400 V) = 199 A',
        askedValue: 250,
        offeredValue: 199.19,
        scaleUnit: 'A',
      },
    })
  })
})

describe('valueIn', () => {
  it('finds a value only as a whole number of its quote', async () => {
    const { valueIn } = await import('./pipeline')
    expect(valueIn('Bemessungsstrom 250 A', '250 A')).toBe(true)
    expect(valueIn('Bemessungsstrom 250 A', '50 A')).toBe(false)
    expect(valueIn('NYM-J 3X1,5 (100 m/Ring)', '100')).toBe(true)
    expect(valueIn('NYM-J 3X1,5 (100 m/Ring)', '10')).toBe(false)
    expect(valueIn('NYY-J 5 x 16 mm²', '5x16')).toBe(true)
    expect(valueIn('NYM-J 3x2,5', '2')).toBe(false)
    expect(valueIn('NYM-J 3x2,5 mm²', '2,5')).toBe(true)
    expect(valueIn('LS-Schalter B16 1p', 'B16')).toBe(true)
    expect(valueIn('Typ A', 'A')).toBe(true)
    expect(valueIn('anything', '')).toBe(false)
  })
})
