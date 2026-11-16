/**
 * `pnpm seed`: generates the demo tender, reads it back with the same parsers
 * an upload would go through, and loads the result into Convex.
 *
 *   generate  write data/seed/ from the seed (deterministic)
 *   load      parse data/seed/ and import the rows into the Convex deployment
 *   all       both (default)
 *
 * `load` replaces the four seeded tables. Pass `--prod` to target the
 * production deployment instead of the development one.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  gaebOfferLines,
  gaebPositions,
  parseGaeb,
  parseOfferPdf,
} from '@preisspiegel/core'
import { extractPdfText } from './extractPdf'
import { FILES, SEED, generate } from './generate'
import { SUPPLIERS, TENDER } from './names'
import type { OfferLine, Position } from '@preisspiegel/core'
import type { SupplierKey } from './names'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const seedDir = resolve(repoRoot, 'data/seed')
const outDir = resolve(repoRoot, 'data/out')

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args.find((arg) => !arg.startsWith('--')) ?? 'all'
  const prod = args.includes('--prod')

  if (!['generate', 'load', 'all'].includes(command)) {
    throw new Error(`Unknown command "${command}". Use generate, load or all.`)
  }
  if (command !== 'load') await writeSeed()
  if (command !== 'generate') await load(prod)
}

async function writeSeed(): Promise<void> {
  const { files, truth } = await generate(SEED)
  mkdirSync(seedDir, { recursive: true })
  for (const [name, bytes] of files) {
    writeFileSync(resolve(seedDir, name), bytes)
  }
  const { summary } = truth
  console.log(
    `Generated ${files.size} files in data/seed (seed ${SEED}): ` +
      `${summary.positions} positions, ` +
      `${summary.offerLines.a + summary.offerLines.b + summary.offerLines.c} offer lines, ` +
      `${Object.values(summary.traps).reduce((sum, count) => sum + count, 0)} traps.`,
  )
}

/** The rows the app works on, read from the files the way an upload would be. */
export async function parseSeed(): Promise<{
  positions: Array<Position>
  offerLines: Record<SupplierKey, Array<OfferLine>>
  pageCounts: Record<SupplierKey, number | null>
  warnings: Array<string>
}> {
  const read = (name: string) => readFileSync(resolve(seedDir, name))
  const positions = gaebPositions(
    parseGaeb(read(FILES.tender).toString('utf8')),
  )

  const warnings: Array<string> = []
  const fromPdf = async (key: SupplierKey) => {
    const { items, pages } = await extractPdfText(
      new Uint8Array(read(SUPPLIERS[key].fileName)),
    )
    const parsed = parseOfferPdf(items, key)
    warnings.push(
      ...parsed.warnings.map(
        (warning) => `${SUPPLIERS[key].fileName}: ${warning}`,
      ),
    )
    return { lines: parsed.lines, pages: pages.length }
  }

  const a = await fromPdf('a')
  const b = await fromPdf('b')
  const c = gaebOfferLines(parseGaeb(read(FILES.offerC).toString('utf8')), 'c')

  return {
    positions,
    offerLines: { a: a.lines, b: b.lines, c },
    pageCounts: { a: a.pages, b: b.pages, c: null },
    warnings,
  }
}

async function load(prod: boolean): Promise<void> {
  const { positions, offerLines, pageCounts, warnings } = await parseSeed()
  for (const warning of warnings) console.warn(`warning: ${warning}`)

  const slug = TENDER.slug
  const suppliers = ['a', 'b', 'c'] as const
  const tables: Record<string, Array<object>> = {
    tenders: [
      {
        slug,
        projectNo: TENDER.projectNo,
        project: TENDER.project,
        lot: TENDER.lot,
        client: TENDER.client,
        contractor: TENDER.contractor,
        currency: 'EUR',
        positionCount: positions.length,
      },
    ],
    documents: [
      {
        tenderSlug: slug,
        key: 'tender',
        kind: 'tender',
        supplierName: null,
        format: 'x83',
        fileName: FILES.tender,
        date: TENDER.issued,
        pageCount: null,
        lineCount: positions.length,
      },
      ...suppliers.map((key) => ({
        tenderSlug: slug,
        key,
        kind: 'offer',
        supplierName: SUPPLIERS[key].name,
        format: SUPPLIERS[key].format,
        fileName: SUPPLIERS[key].fileName,
        date: SUPPLIERS[key].offerDate,
        pageCount: pageCounts[key],
        lineCount: offerLines[key].length,
      })),
    ],
    positions: positions.map((position) => ({ tenderSlug: slug, ...position })),
    offerLines: suppliers.flatMap((key) =>
      offerLines[key].map((line) => ({ tenderSlug: slug, ...line })),
    ),
  }

  mkdirSync(outDir, { recursive: true })
  for (const [table, rows] of Object.entries(tables)) {
    const file = resolve(outDir, `${table}.jsonl`)
    writeFileSync(file, rows.map((row) => `${JSON.stringify(row)}\n`).join(''))
    try {
      execFileSync(
        'pnpm',
        [
          'exec',
          'convex',
          'import',
          ...(prod ? ['--prod'] : []),
          '--table',
          table,
          '--replace',
          '--yes',
          file,
        ],
        { cwd: resolve(repoRoot, 'services/backend'), stdio: 'inherit' },
      )
    } catch {
      throw new Error(
        `Importing "${table}" failed. A local Convex deployment only runs while \`pnpm dev\` does: start it in another terminal and run \`pnpm seed load\` again.`,
      )
    }
  }
  console.log(
    `Loaded tender "${slug}": ${positions.length} positions, ` +
      `${tables.offerLines?.length ?? 0} offer lines from ${suppliers.length} suppliers.`,
  )
}

// Run only as a script, so tests can import `parseSeed`.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
