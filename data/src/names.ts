/**
 * Every name in the demo world. All of them are invented; any resemblance to
 * a real company, building or brand is coincidental.
 */

export const TENDER = {
  slug: 'demo',
  /** Project number and name as a planning office would write them. */
  projectNo: '2026-118',
  project: 'Neubau Bürogebäude Kontorhaus Weidenufer',
  lot: 'Los 12 Elektroinstallation',
  client: 'Weidenufer Projektgesellschaft mbH',
  /** The contractor pricing the tender: the user of this product. */
  contractor: 'Ampenhof Elektrotechnik GmbH',
  /** What the contractor charges for an hour of labor, in EUR. Invented. */
  laborRate: 62,
  contractorCity: '50997 Köln',
  /** Fixed, so generated files never depend on the day they were made. */
  issued: '2026-10-19',
  offersDue: '2026-11-13',
} as const

export type SupplierKey = 'a' | 'b' | 'c'

export interface Supplier {
  key: SupplierKey
  name: string
  street: string
  city: string
  /** How the offer arrives. */
  format: 'pdf' | 'x84'
  fileName: string
  offerNo: string
  offerDate: string
  contact: string
}

export const SUPPLIERS: Readonly<Record<SupplierKey, Supplier>> = {
  // A full-range wholesaler: answers position by position, in shorthand,
  // with prices per price unit (per 1, 100 or 1000).
  a: {
    key: 'a',
    name: 'Rheinbogen Elektrogroßhandel GmbH',
    street: 'Am Güterhof 14',
    city: '50735 Köln',
    format: 'pdf',
    fileName: 'angebot-rheinbogen.pdf',
    offerNo: 'AN-2611-04782',
    offerDate: '2026-11-05',
    contact: 'Vertrieb Objektgeschäft',
  },
  // A lighting and installation-device specialist: one line per article with
  // the summed quantity, list price and discount, no position references.
  b: {
    key: 'b',
    name: 'Kesselried Licht- und Schaltertechnik GmbH',
    street: 'Hafenallee 31',
    city: '63067 Offenbach am Main',
    format: 'pdf',
    fileName: 'angebot-kesselried.pdf',
    offerNo: '26-11-3391',
    offerDate: '2026-11-09',
    contact: 'Projektvertrieb',
  },
  // Answers the request for prices in kind: the tender's own positions with
  // a unit price each, as a GAEB phase 84 file.
  c: {
    key: 'c',
    name: 'Osterholt Elektrobedarf KG',
    street: 'Industriestraße 62',
    city: '48153 Münster',
    format: 'x84',
    fileName: 'angebot-osterholt.x84',
    offerNo: 'OST-118-A',
    offerDate: '2026-11-11',
    contact: 'Angebotswesen',
  },
}

/** A second make that suppliers offer as an alternative. */
export const ALTERNATIVE_BRAND = 'Elmaro'
