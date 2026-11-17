/**
 * The demo tender as the pipeline sees it: read from `data/seed/` with the
 * real readers. The ground truth is loaded beside it for scoring only.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  gaebOfferLines,
  gaebPositions,
  parseGaeb,
  parseOfferPdf,
} from '@preisspiegel/core'
import { extractPdfText } from '../../data/src/extractPdf'
import type { OfferLine, Position } from '@preisspiegel/core'
import type { Truth } from '../../data/src/truth'

const seedDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..',
  process.env.SEED_DIR ?? 'data/seed',
)
const read = (name: string) => readFileSync(resolve(seedDir, name))

export interface SeedData {
  positions: Array<Position>
  lines: Array<OfferLine>
  truth: Truth
}

export async function loadSeed(): Promise<SeedData> {
  const positions = gaebPositions(
    parseGaeb(read('tender.x83').toString('utf8')),
  )
  const lines: Array<OfferLine> = []
  for (const [key, file] of [
    ['a', 'angebot-rheinbogen.pdf'],
    ['b', 'angebot-kesselried.pdf'],
  ] as const) {
    const pdf = await extractPdfText(new Uint8Array(read(file)))
    lines.push(...parseOfferPdf(pdf.items, key).lines)
  }
  lines.push(
    ...gaebOfferLines(
      parseGaeb(read('angebot-osterholt.x84').toString('utf8')),
      'c',
    ),
  )
  const truth = JSON.parse(read('truth.json').toString('utf8')) as Truth
  return { positions, lines, truth }
}
