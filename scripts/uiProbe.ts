/**
 * `pnpm probe:ui`: drives the running app the way a person would and checks
 * what a screenshot cannot show: keyboard access, where the focus goes, what
 * a hand-typed address does, and that reduced motion still shows everything.
 *
 * Needs `pnpm dev` and a loaded seed. Uses the Chrome installed on the
 * machine. Exits non-zero if a check fails or the browser logs an error.
 */
import { chromium } from 'playwright'
import type { Page } from 'playwright'

const base = process.env.SHOTS_BASE_URL ?? 'http://localhost:3000'
const failures: Array<string> = []

function check(name: string, ok: boolean, detail?: unknown): void {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}`)
  if (!ok) failures.push(`${name}: ${JSON.stringify(detail)}`)
}

function watch(page: Page, label: string): void {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      failures.push(`${label}: console error: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => {
    failures.push(`${label}: page error: ${error.message}`)
  })
}

const path = (page: Page) => page.url().replace(base, '')
const settle = (page: Page, ms = 700) => page.waitForTimeout(ms)
const listWidth = (page: Page) =>
  page.evaluate(() =>
    Math.round(
      document.querySelector('[data-position-list]')?.getBoundingClientRect()
        .width ?? -1,
    ),
  )

async function main(): Promise<void> {
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    })
    const page = await context.newPage()
    watch(page, 'desktop')

    console.log('Positions workspace')
    await page.goto(`${base}/positionen`, { waitUntil: 'networkidle' })
    await page.waitForURL(/\/positionen\/01\.01\.0010/)
    check('a wide screen opens the first position', true)

    // The list is one Tab stop, so the numbers are a few presses away.
    await page.locator('[data-position-list] input').focus()
    let presses = 0
    let reached = false
    while (presses < 10 && !reached) {
      await page.keyboard.press('Tab')
      presses++
      reached = await page.evaluate(
        () => document.activeElement?.classList.contains('traceable') === true,
      )
    }
    check('Tab reaches a traceable number in under 10 presses', reached, {
      presses,
    })

    await page.locator('[data-position-list] a[data-selected]').focus()
    await page.keyboard.press('ArrowDown')
    await page.waitForURL(/01\.01\.0020/)
    await settle(page, 200)
    const focused = await page.evaluate(() =>
      document.activeElement?.getAttribute('href'),
    )
    check(
      'arrow keys move the focus with the selection',
      focused === '/positionen/01.01.0020',
      focused,
    )

    await page.locator('h1').click()
    await page.keyboard.press('j')
    await settle(page, 500)
    const afterJ = path(page)
    await page.keyboard.press('k')
    await settle(page, 500)
    check(
      'J and K step through the list',
      afterJ === '/positionen/01.01.0030' &&
        path(page) === '/positionen/01.01.0020',
      [afterJ, path(page)],
    )

    console.log('Source of a number')
    await page.locator('.traceable.num').nth(1).click()
    await page.waitForURL(/quelle=/)
    await settle(page, 900)
    check(
      'the address names the source',
      path(page).includes('quelle=a.0.unitPrice'),
      path(page),
    )
    check(
      'the list gives its room to the document',
      (await listWidth(page)) === 0,
      await listWidth(page),
    )
    const panel = await page.evaluate(() =>
      Math.round(
        document.querySelector('.reader-source')?.getBoundingClientRect()
          .width ?? 0,
      ),
    )
    check('the document takes half the screen', panel === 720, panel)
    check(
      'the traced number is marked as current',
      (await page.locator('.traceable[aria-current]').count()) === 1,
    )
    check(
      'the page of the PDF is drawn',
      (await page.locator('.reader-source canvas').count()) === 1,
    )
    await page.keyboard.press('Escape')
    await page.waitForURL((url) => !url.search.includes('quelle'))
    await settle(page, 900)
    check(
      'Escape closes the source and the list returns',
      (await listWidth(page)) === 320,
      await listWidth(page),
    )

    console.log('Jump to a position')
    await page.getByRole('button', { name: 'Position suchen' }).click()
    await page.keyboard.type('NYY-J 4x95')
    await settle(page, 300)
    await page.keyboard.press('Enter')
    await page.waitForURL(/01\.01\.0040/)
    await settle(page, 400)
    check(
      'Enter opens the result and the palette stays closed',
      (await page.locator('[role="dialog"]').count()) === 0,
    )

    console.log('Hand-typed addresses')
    await page.goto(`${base}/positionen/01.01.0020?quelle=123`, {
      waitUntil: 'networkidle',
    })
    await settle(page, 500)
    check(
      'a source name that points at nothing is dropped',
      path(page) === '/positionen/01.01.0020' &&
        (await page.locator('[role="alert"]').count()) === 0,
      path(page),
    )
    await page.goto(`${base}/positionen?titel=10`, { waitUntil: 'networkidle' })
    await page.waitForURL(/\/positionen\/10\./)
    const count = await page
      .locator('[data-position-list] [aria-live]')
      .innerText()
    check(
      'a title typed as a number filters the list',
      count.startsWith('73'),
      count,
    )
    await page.goto(`${base}/positionen/99.99.9999`, {
      waitUntil: 'networkidle',
    })
    check(
      'an unknown position offers a way back',
      (await page.locator('a.action').count()) === 1,
    )

    console.log('Units')
    await page.goto(`${base}/positionen/04.08.0070`, {
      waitUntil: 'networkidle',
    })
    const units = await page.locator('.module .caption.num').allInnerTexts()
    check(
      'a price per ring is not labelled as a price per metre',
      units.includes('je RG') && units.includes('je m'),
      units,
    )
    check(
      'prices in different units are not compared',
      (await page.locator('.module .origin-left').count()) === 0,
    )

    console.log('Language')
    await page.getByRole('button', { name: 'Switch to English' }).click()
    await page.reload({ waitUntil: 'networkidle' })
    await settle(page, 300)
    const lang = await page.evaluate(() => document.documentElement.lang)
    check(
      'the document language follows the stored choice',
      lang === 'en',
      lang,
    )
    await page.getByRole('button', { name: 'Auf Deutsch umschalten' }).click()
    await context.close()

    console.log('Reduced motion')
    const calm = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    })
    const calmPage = await calm.newPage()
    watch(calmPage, 'reduced motion')
    await calmPage.goto(`${base}/`, { waitUntil: 'networkidle' })
    await settle(calmPage, 300)
    const total = await calmPage
      .locator('figure foreignObject p.num')
      .innerText()
    check(
      'the diagram shows its total at once',
      total.replace(/\s+/g, ' ').includes('1.170'),
      total,
    )
    const hidden = await calmPage.evaluate(
      () =>
        [...document.querySelectorAll('figure svg *')].filter(
          (element) =>
            getComputedStyle(element).opacity === '0' &&
            element.closest('[clip-path]') === null,
        ).length,
    )
    check('no part of the diagram waits for an animation', hidden === 0, hidden)
    await calm.close()

    console.log('Phone')
    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
    })
    const phonePage = await phone.newPage()
    watch(phonePage, 'phone')
    await phonePage.goto(`${base}/positionen`, { waitUntil: 'networkidle' })
    await settle(phonePage, 400)
    check(
      'a phone shows the list and opens no position by itself',
      path(phonePage) === '/positionen',
      path(phonePage),
    )
    await phonePage.goto(`${base}/positionen/01.01.0020?quelle=a.0.unitPrice`, {
      waitUntil: 'networkidle',
    })
    await settle(phonePage, 1500)
    const scrolled = await phonePage.evaluate(
      () =>
        document.querySelector('.reader-source .overflow-auto')?.scrollLeft ??
        0,
    )
    check(
      'the document opens scrolled to the marked value',
      scrolled > 100,
      scrolled,
    )
    await phone.close()
  } finally {
    await browser.close()
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} problem(s):`)
    for (const failure of failures) console.error(`  ${failure}`)
    process.exit(1)
  }
  console.log('\nEvery check passed, with no console errors.')
}

await main()
