/**
 * Copies the demo tender's source documents into the web app's public folder,
 * so the source viewer can show the page a number was read from. The files
 * live in data/seed/; the copy is not committed.
 */
import { cpSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const from = resolve(here, '../../../data/seed')
const to = resolve(here, '../public/demo')

mkdirSync(to, { recursive: true })
const documents = readdirSync(from).filter((name) =>
  /\.(pdf|x83|x84)$/.test(name),
)
for (const name of documents) cpSync(resolve(from, name), resolve(to, name))
console.log(`Copied ${documents.length} source documents to public/demo.`)
