/**
 * `pnpm shots [path ...]`: screenshots of the running app at phone and desktop
 * width, light and dark, and a report of anything the browser logged.
 *
 * Used at every milestone gate. It drives the Chrome already installed on the
 * machine, so there is no browser to download. Exits non-zero on a console
 * error, a failed request or a failed page load.
 */
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(repoRoot, 'var/shots')
const baseUrl = process.env.SHOTS_BASE_URL ?? 'http://localhost:3000'

const allViewports = [
  { name: '390', width: 390, height: 844 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1440', width: 1440, height: 900 },
] as const
// SHOTS_WIDTHS=390,1440 narrows a run; a gate runs all four.
const wanted = process.env.SHOTS_WIDTHS?.split(',')
const viewports = allViewports.filter(
  (viewport) => wanted === undefined || wanted.includes(viewport.name),
)
const themes = ['light', 'dark'] as const
/** Long enough for the overview's lights to come on. */
const wait = Number(process.env.SHOTS_WAIT_MS ?? 3200)

async function main(): Promise<void> {
  const paths = process.argv.slice(2)
  if (paths.length === 0) paths.push('/')
  mkdirSync(outDir, { recursive: true })

  const browser = await chromium.launch({ channel: 'chrome' })
  const problems: Array<string> = []

  try {
    for (const path of paths) {
      for (const viewport of viewports) {
        for (const theme of themes) {
          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            colorScheme: theme,
            // SHOTS_REDUCED_MOTION=1 checks that nothing depends on animation.
            reducedMotion:
              process.env.SHOTS_REDUCED_MOTION === '1'
                ? 'reduce'
                : 'no-preference',
            deviceScaleFactor: 2,
          })
          // The app follows a stored choice, not the operating system; and
          // the opening is a moment, not a page, so it is skipped here.
          await context.addInitScript((choice) => {
            localStorage.setItem('preisspiegel:theme', choice)
            sessionStorage.setItem('preisspiegel:intro', '1')
          }, theme)
          const page = await context.newPage()
          const label = `${path} @ ${viewport.name}px ${theme}`

          page.on('console', (message) => {
            if (message.type() === 'error') {
              problems.push(`${label}: console error: ${message.text()}`)
            }
          })
          page.on('pageerror', (error) => {
            problems.push(`${label}: page error: ${error.message}`)
          })
          page.on('requestfailed', (request) => {
            problems.push(`${label}: request failed: ${request.url()}`)
          })

          const response = await page.goto(new URL(path, baseUrl).href, {
            waitUntil: 'networkidle',
          })
          if (response === null || !response.ok()) {
            problems.push(
              `${label}: HTTP ${response?.status() ?? 'no response'}`,
            )
          }

          // Let the lights come on and late content, such as a PDF page, draw.
          await page.waitForTimeout(wait)

          // A page wider than its viewport means something overflows.
          const overflow = await page.evaluate(
            () =>
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
          )
          if (overflow > 0) {
            problems.push(`${label}: horizontal overflow of ${overflow}px`)
          }

          const slug = path === '/' ? 'home' : path.replace(/[^a-z0-9]+/gi, '-')
          const file = resolve(
            outDir,
            `${slug}-${viewport.name}-${theme}.png`.replace(/^-/, ''),
          )
          // A full-page capture resizes the page behind the scenes, which
          // starts every CSS animation again and catches them at their
          // beginning. So the window is made as tall as the page first, the
          // lights get time to come on, and then the window is captured.
          const height = await page.evaluate(
            () => document.documentElement.scrollHeight,
          )
          if (height > viewport.height) {
            await page.setViewportSize({ width: viewport.width, height })
            await page.waitForTimeout(wait)
          }
          await page.screenshot({ path: file })
          console.log(`  ${label} -> ${file}`)
          await context.close()
        }
      }
    }
  } finally {
    await browser.close()
  }

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):`)
    for (const problem of problems) console.error(`  ${problem}`)
    process.exitCode = 1
  } else {
    console.log('\nNo console errors, failed requests or overflow.')
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
