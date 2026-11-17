/**
 * B3: every number the interface can show for an offer is looked up at the
 * place it says it came from. For a PDF that is the text inside the stored
 * rectangle; for a GAEB file, the named element of the named item.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseGermanNumber } from '@preisspiegel/core'
import { extractPdfText } from '../../data/src/extractPdf'
import type {
  OfferField,
  OfferLine,
  PdfTextItem,
  Position,
} from '@preisspiegel/core'

const seedDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..',
  process.env.SEED_DIR ?? 'data/seed',
)

/** The figures an offer line is shown with. */
const SHOWN: ReadonlyArray<OfferField> = [
  'qty',
  'unitPrice',
  'priceBasis',
  'listPrice',
  'discountPct',
  'total',
]

export interface GuardResult {
  /** Numbers looked up. */
  checked: number
  /** Numbers found at their source. */
  found: number
  share: number
  /** The first few that were not, for a write-up. */
  misses: Array<{ where: string; field: string; value: number; saw: string }>
}

export async function numberGuard(
  positions: ReadonlyArray<Position>,
  lines: ReadonlyArray<OfferLine>,
  files: Record<string, string>,
  tenderFile: string,
): Promise<GuardResult> {
  const pdfText = new Map<string, Array<PdfTextItem>>()
  const xml = new Map<string, string>()
  for (const [key, file] of Object.entries({ ...files, tender: tenderFile })) {
    const bytes = readFileSync(resolve(seedDir, file))
    if (file.endsWith('.pdf')) {
      pdfText.set(key, (await extractPdfText(new Uint8Array(bytes))).items)
    } else {
      xml.set(key, bytes.toString('utf8'))
    }
  }

  const result: GuardResult = { checked: 0, found: 0, share: 1, misses: [] }
  const note = (where: string, field: string, value: number, saw: string) => {
    if (result.misses.length < 10)
      result.misses.push({ where, field, value, saw })
  }
  const inGaeb = (key: string, itemId: string, element: string): string => {
    const file = xml.get(key) ?? ''
    const start = file.indexOf(`<Item ID="${itemId}"`)
    const end = file.indexOf('</Item>', start)
    if (start === -1 || end === -1) return ''
    return (
      new RegExp(`<${element}>([^<]*)</${element}>`).exec(
        file.slice(start, end),
      )?.[1] ?? ''
    )
  }

  for (const line of lines) {
    const where = `${line.supplierKey}.${line.seq}`
    for (const field of SHOWN) {
      const value = line[field]
      // A price unit of 1 is not printed in the interface.
      if (
        typeof value !== 'number' ||
        (field === 'priceBasis' && value === 1)
      ) {
        continue
      }
      result.checked++
      const source = line.sources[field]
      if (source === undefined) {
        note(where, field, value, 'no source')
        continue
      }
      if (source.kind === 'gaeb') {
        const saw = inGaeb(line.supplierKey, source.itemId, source.element)
        if (saw !== '' && Number(saw) === value) result.found++
        else note(where, field, value, saw)
        continue
      }
      const saw = (pdfText.get(line.supplierKey) ?? [])
        .filter(
          (item) =>
            item.page === source.page &&
            item.x >= source.x - 0.5 &&
            item.x + item.w <= source.x + source.w + 0.5 &&
            item.baseline >= source.y &&
            item.baseline <= source.y + source.h,
        )
        .map((item) => item.text.trim())
        .join(' ')
      // The rectangle has to hold the number and nothing else.
      if (parseGermanNumber(saw) === value) result.found++
      else note(where, field, value, saw)
    }
  }

  for (const position of positions) {
    result.checked++
    const saw = inGaeb('tender', position.gaebId, 'Qty')
    if (saw !== '' && Number(saw) === position.qty) result.found++
    else note(position.oz, 'qty', position.qty, saw)
  }

  result.share =
    result.checked === 0
      ? 1
      : Math.round((result.found / result.checked) * 10000) / 10000
  return result
}
