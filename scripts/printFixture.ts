/**
 * Prints `data/fixtures/angebot-fremd.html` to PDF with the Chrome installed
 * on the machine. The result is a supplier offer made by software the table
 * reader was not written alongside; `data/src/foreignPdf.test.ts` reads it.
 *
 * Run it only when the HTML changes, and commit the PDF it writes.
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const fixtures = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../data/fixtures',
)

const browser = await chromium.launch({ channel: 'chrome' })
try {
  const page = await browser.newPage()
  await page.goto(pathToFileURL(resolve(fixtures, 'angebot-fremd.html')).href)
  await page.pdf({
    path: resolve(fixtures, 'angebot-fremd.pdf'),
    format: 'A4',
    preferCSSPageSize: true,
  })
} finally {
  await browser.close()
}
console.log('Wrote data/fixtures/angebot-fremd.pdf')
