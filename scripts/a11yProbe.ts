/**
 * `pnpm probe:a11y`: runs axe against the pages that matter, by night and by
 * day and at a phone's width, and fails on any WCAG 2.2 AA violation. Needs
 * `pnpm dev` running with a finished run (or SHOTS_BASE_URL set).
 */
import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright'

const base = process.env.SHOTS_BASE_URL ?? 'http://localhost:3000'
const PAGES = [
  '/',
  '/positionen',
  '/positionen?offen=true',
  '/positionen/01.01.0020',
  '/positionen/01.01.0020?quelle=a.0.unitPrice',
  '/kalkulation',
  '/messung',
  '/nirgendwo',
]
const VIEWS = [
  { name: 'night', theme: 'dark', width: 1440, height: 900 },
  { name: 'day', theme: 'light', width: 1440, height: 900 },
  { name: 'phone', theme: 'dark', width: 390, height: 844 },
] as const
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const browser = await chromium.launch({ channel: 'chrome' })
let problems = 0
for (const view of VIEWS) {
  const context = await browser.newContext({
    viewport: { width: view.width, height: view.height },
    reducedMotion: 'reduce',
  })
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem('preisspiegel:intro', '1')
    } catch {
      // Storage blocked: the opening does not play either.
    }
  })
  await context.addInitScript((theme) => {
    localStorage.setItem('preisspiegel:theme', theme)
  }, view.theme)
  const page = await context.newPage()
  for (const path of PAGES) {
    await page.goto(base + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    const { violations } = await new AxeBuilder({ page })
      .withTags(TAGS)
      .analyze()
    if (violations.length === 0) {
      console.log(`  ok   ${view.name} ${path}`)
      continue
    }
    for (const violation of violations) {
      problems++
      console.log(
        `  FAIL ${view.name} ${path}: ${violation.id} (${violation.impact}) on ${violation.nodes.length}`,
      )
      for (const node of violation.nodes.slice(0, 3)) {
        console.log(`         ${node.target.join(' ')}`)
      }
    }
  }
  await context.close()
}
await browser.close()

if (problems > 0) {
  console.log(`\n${problems} violation(s).`)
  process.exit(1)
}
console.log('\nNo WCAG 2.2 AA violations found by axe.')
