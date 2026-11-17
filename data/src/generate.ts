/**
 * Generates the whole demo tender from one seed: the request for prices, the
 * three offers, the labor time table and the ground truth.
 */
import { writeGaeb } from '@preisspiegel/core'
import { ZEITWERTE, buildCatalog } from './catalog'
import { SUPPLIERS, TENDER } from './names'
import { buildOffers } from './offers'
import { renderSpecialistOffer, renderWholesalerOffer } from './renderPdf'
import { createRng } from './rng'
import { buildTender } from './tender'
import { buildTruth } from './truth'
import type { TenderPosition } from './tender'
import type { OfferDraft, Offers } from './offers'
import type { GaebCategory, GaebDocument } from '@preisspiegel/core'
import type { Truth } from './truth'

/** The seed the committed demo files were generated from. */
export const SEED = 118

export const FILES = {
  tender: 'tender.x83',
  offerA: SUPPLIERS.a.fileName,
  offerB: SUPPLIERS.b.fileName,
  offerC: SUPPLIERS.c.fileName,
  zeitwerte: 'zeitwerte.json',
  truth: 'truth.json',
} as const

export interface Generated {
  /** File name to contents, exactly as written to `data/seed/`. */
  files: Map<string, Uint8Array>
  truth: Truth
  /** What the files were rendered from, for tests. The pipeline never sees these. */
  positions: Array<TenderPosition>
  offers: Offers
}

const utf8 = (text: string) => new TextEncoder().encode(text)
const json = (value: unknown) => utf8(`${JSON.stringify(value, null, 2)}\n`)

export async function generate(seed: number = SEED): Promise<Generated> {
  const rng = createRng(seed)
  const catalog = buildCatalog()
  const { positions, gaeb } = buildTender(catalog, rng)
  const offers = buildOffers(catalog, positions, rng)
  const truth = buildTruth(seed, catalog, positions, offers)

  const files = new Map<string, Uint8Array>([
    [FILES.tender, utf8(writeGaeb(gaeb))],
    [FILES.offerA, await renderWholesalerOffer(SUPPLIERS.a, offers.lines.a)],
    [FILES.offerB, await renderSpecialistOffer(SUPPLIERS.b, offers.lines.b)],
    [FILES.offerC, utf8(writeGaeb(pricedTender(gaeb, offers.lines.c)))],
    [
      FILES.zeitwerte,
      json({
        note: `Labor time table of ${TENDER.contractor}. Invented for the demo.`,
        unit: 'minutes per unit',
        hourlyRate: TENDER.laborRate,
        hourlyRateUnit: 'EUR per hour of labor',
        entries: ZEITWERTE,
      }),
    ],
    [FILES.truth, json(truth)],
  ])

  return { files, truth, positions, offers }
}

/**
 * The supplier's answer in kind: the tender itself as a phase 84 file, with a
 * unit price and a total on the positions the supplier quotes.
 */
function pricedTender(
  tender: GaebDocument,
  lines: Array<OfferDraft>,
): GaebDocument {
  const byPosition = new Map(lines.map((line) => [line.positions[0], line]))

  const price = (
    categories: Array<GaebCategory>,
    path: Array<string>,
  ): Array<GaebCategory> =>
    categories.map((category) => {
      const here = [...path, category.rno]
      return {
        ...category,
        categories: price(category.categories, here),
        items: category.items.map((item) => {
          const line = byPosition.get([...here, item.rno].join('.'))
          return line === undefined
            ? item
            : {
                ...item,
                qty: line.qty,
                unitPrice: line.unitPrice,
                total: line.total,
              }
        }),
      }
    })

  return {
    ...tender,
    phase: 84,
    date: SUPPLIERS.c.offerDate,
    time: '14:10:00',
    program: { system: 'Preisspiegel Demo', name: 'Offer generator 1.0' },
    boq: { ...tender.boq, categories: price(tender.boq.categories, []) },
  }
}
