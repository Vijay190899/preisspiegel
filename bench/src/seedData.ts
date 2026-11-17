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

export interface SeedData {
  positions: Array<Position>
  lines: Array<OfferLine>
  truth: Truth
}

/** Reads a tender's files with the real readers, wherever the files are. */
export async function readSeed(
  read: (name: string) => Uint8Array,
): Promise<SeedData> {
  const text = (name: string) => Buffer.from(read(name)).toString('utf8')
  const positions = gaebPositions(parseGaeb(text('tender.x83')))
  const lines: Array<OfferLine> = []
  for (const [key, file] of [
    ['a', 'angebot-rheinbogen.pdf'],
    ['b', 'angebot-kesselried.pdf'],
  ] as const) {
    const pdf = await extractPdfText(new Uint8Array(read(file)))
    lines.push(...parseOfferPdf(pdf.items, key).lines)
  }
  lines.push(...gaebOfferLines(parseGaeb(text('angebot-osterholt.x84')), 'c'))
  const truth = JSON.parse(text('truth.json')) as Truth
  return { positions, lines, truth }
}

export function loadSeed(): Promise<SeedData> {
  return readSeed((name) => readFileSync(resolve(seedDir, name)))
}
