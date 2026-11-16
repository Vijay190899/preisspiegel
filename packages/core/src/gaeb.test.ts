import { describe, expect, it } from 'vitest'
import {
  GaebError,
  gaebOfferLines,
  gaebPositions,
  parseGaeb,
  writeGaeb,
} from './gaeb'
import type { GaebDocument } from './gaeb'

// This package is runtime-agnostic, so it has no `structuredClone` to lean on.
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const tender: GaebDocument = {
  phase: 83,
  date: '2026-11-02',
  time: '09:00:00',
  program: { system: 'Test', name: 'Test 1.0' },
  project: { name: 'P-1', label: 'Bürogebäude <Nord> & Süd', currency: 'EUR' },
  boq: {
    id: 'BOQ1',
    name: 'LV-1',
    label: 'Elektroinstallation',
    date: '2026-11-02',
    levels: [
      { type: 'BoQLevel', label: 'Titel', length: 2 },
      { type: 'BoQLevel', label: 'Untertitel', length: 2 },
      { type: 'Item', length: 4 },
    ],
    categories: [
      {
        id: 'C1',
        rno: '03',
        label: 'Unterverteilungen',
        items: [],
        categories: [
          {
            id: 'C2',
            rno: '02',
            label: 'UV 1. OG',
            categories: [],
            items: [
              {
                id: 'I1',
                rno: '0010',
                qty: 24,
                unit: 'St',
                shortText: 'Leitungsschutzschalter B16, 1-polig',
                longText:
                  'Leitungsschutzschalter nach DIN EN 60898-1.\nBemessungsstrom 16 A, Charakteristik B, "6 kA".',
              },
              {
                id: 'I2',
                rno: '0020',
                qty: 120.5,
                unit: 'm',
                shortText: 'Mantelleitung NYM-J 5x2,5 mm²',
                longText:
                  'Mantelleitung NYM-J 5x2,5 mm², liefern und verlegen.',
              },
            ],
          },
        ],
      },
    ],
    items: [],
  },
}

describe('GAEB round trip', () => {
  it('reads back exactly what it wrote', () => {
    expect(parseGaeb(writeGaeb(tender))).toEqual(tender)
  })

  it('writes the same bytes for the same document', () => {
    expect(writeGaeb(tender)).toBe(writeGaeb(clone(tender)))
  })

  it('declares the exchange phase in the namespace and in <DP>', () => {
    const xml = writeGaeb(tender)
    expect(xml).toContain('xmlns="http://www.gaeb.de/GAEB_DA_XML/DA83/3.2"')
    expect(xml).toContain('<DP>83</DP>')
  })

  it('escapes markup characters in texts', () => {
    expect(writeGaeb(tender)).toContain('Bürogebäude &lt;Nord&gt; &amp; Süd')
  })

  it('carries unit prices and totals in phase 84', () => {
    const offer = clone(tender)
    offer.phase = 84
    const items = offer.boq.categories[0]!.categories[0]!.items
    items[0]!.unitPrice = 4.85
    items[0]!.total = 116.4

    const read = parseGaeb(writeGaeb(offer))
    expect(read).toEqual(offer)
    expect(writeGaeb(offer)).toContain('<UP>4.85</UP>')
  })
})

describe('positions', () => {
  const positions = gaebPositions(tender)

  it('builds the ordinal number from every level', () => {
    expect(positions.map((position) => position.oz)).toEqual([
      '03.02.0010',
      '03.02.0020',
    ])
  })

  it('keeps leading zeros, quantity, unit, texts and the title path', () => {
    expect(positions[1]).toMatchObject({
      seq: 1,
      qty: 120.5,
      unit: 'm',
      shortText: 'Mantelleitung NYM-J 5x2,5 mm²',
      gaebId: 'I2',
      path: [
        { rno: '03', label: 'Unterverteilungen' },
        { rno: '02', label: 'UV 1. OG' },
      ],
    })
  })

  it('keeps paragraphs of the long text apart', () => {
    expect(positions[0]!.longText.split('\n')).toHaveLength(2)
  })
})

describe('offer lines from a phase 84 file', () => {
  const offer = clone(tender)
  offer.phase = 84
  const items = offer.boq.categories[0]!.categories[0]!.items
  items[0]!.unitPrice = 4.85
  items[0]!.total = 116.4
  const lines = gaebOfferLines(offer, 'supplier-c')

  it('skips items the supplier did not price', () => {
    expect(lines).toHaveLength(1)
  })

  it('refers each line to its position and each number to its element', () => {
    expect(lines[0]).toMatchObject({
      supplierKey: 'supplier-c',
      posRef: '03.02.0010',
      qty: 24,
      unitPrice: 4.85,
      priceBasis: 1,
      total: 116.4,
      sources: {
        unitPrice: { kind: 'gaeb', itemId: 'I1', element: 'UP' },
        total: { kind: 'gaeb', itemId: 'I1', element: 'IT' },
      },
    })
  })

  it('refuses a request-for-prices file', () => {
    expect(() => gaebOfferLines(tender, 'supplier-c')).toThrow(GaebError)
  })
})

describe('files from other exporters', () => {
  // The shape of a publicly available DA XML 3.2 export: styled paragraphs,
  // one flat item list, a standalone declaration.
  const foreign = `<?xml version="1.0" standalone="no"?>
<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/DA83/3.2">
  <GAEBInfo><Version>3.2</Version><Date>2026-05-12</Date><Time>08:14:31</Time>
    <ProgSystem>Some PIM</ProgSystem><ProgName>Converter 1.0</ProgName></GAEBInfo>
  <PrjInfo><NamePrj>Prj</NamePrj><LblPrj>Projekt</LblPrj><Cur>EUR</Cur></PrjInfo>
  <Award><DP>83</DP>
    <BoQ ID="ID242"><BoQInfo><Name>LV</Name><LblBoQ>LV-Bezeichnung</LblBoQ>
      <BoQBkdn><Type>Item</Type><Length>1</Length><Num>Yes</Num></BoQBkdn></BoQInfo>
      <BoQBody><Itemlist>
        <Item ID="ID243" RNoPart="1"><Qty>1.000</Qty><QU>Stk</QU>
          <Description><CompleteText>
            <DetailTxt><Text>
<p style="text-align:left;">
<span style="font-family:'Arial';font-size:10pt;">Erste Zeile </span><span>mit Fortsetzung.</span>
</p>
<p style="text-align:left;"><span>Zweiter Absatz.</span></p>
            </Text></DetailTxt>
            <OutlineText><OutlTxt><TextOutlTxt>
              <p style="text-align:left;"><span style="font-size:10pt;">Kurztext</span></p>
            </TextOutlTxt></OutlTxt></OutlineText>
          </CompleteText></Description>
        </Item>
      </Itemlist></BoQBody>
    </BoQ>
  </Award>
</GAEB>`

  it('reads styled paragraphs and a flat item list', () => {
    const [position] = gaebPositions(parseGaeb(foreign))
    expect(position).toMatchObject({
      oz: '1',
      qty: 1,
      unit: 'Stk',
      shortText: 'Kurztext',
      longText: 'Erste Zeile mit Fortsetzung.\nZweiter Absatz.',
      path: [],
    })
  })

  it('rejects a phase it does not read, and a file with no bill of quantities', () => {
    expect(() =>
      parseGaeb(foreign.replace('<DP>83</DP>', '<DP>81</DP>')),
    ).toThrow(/phase "81"/)
    expect(() => parseGaeb('<GAEB><GAEBInfo/></GAEB>')).toThrow(GaebError)
  })

  it('rejects a quantity that is not a number rather than reading zero', () => {
    expect(() =>
      parseGaeb(foreign.replace('<Qty>1.000</Qty>', '<Qty>1,000</Qty>')),
    ).toThrow(/Qty of item ID243/)
  })
})
