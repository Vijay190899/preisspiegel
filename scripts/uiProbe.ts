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
    // The wholesaler's price: its offer is a PDF, so a page gets drawn.
    await page
      .locator('.offers-column', { hasText: 'Rheinbogen' })
      .locator('.traceable.num')
      .first()
      .click()
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
    // The palette leaves with a short animation. It has to be gone, and it
    // has to stay gone: the key press must not have reopened it.
    const palette = page.locator('[role="dialog"]')
    const left = await palette
      .waitFor({ state: 'detached', timeout: 3000 })
      .then(() => true)
      .catch(() => false)
    await settle(page, 500)
    check(
      'Enter opens the result and the palette stays closed',
      left && (await palette.count()) === 0,
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

    console.log('Decisions')
    await page.goto(`${base}/`, { waitUntil: 'networkidle' })
    const lead = (await page.locator('main p.statement').innerText()).replace(
      /\s+/g,
      ' ',
    )
    const split =
      /([\d.]+) von ([\d.]+) Positionen sind kalkuliert\. ([\d.]+) warten/.exec(
        lead,
      )
    check(
      'the overview says how many positions are priced and how many are open',
      split !== null,
      lead,
    )
    const openCount = split?.[3] ?? ''

    console.log('The building')
    await settle(page, 3000)
    const front = page.locator('[role="application"]:visible')
    const windows = await front.locator('rect.pane').count()
    const red = await front.locator('rect.pane[data-s="open"]').count()
    check(
      'every position has a window and the open ones are red',
      String(windows) === (split?.[2] ?? '').replace('.', '') &&
        String(red) === openCount,
      { windows, red },
    )
    const target = front.locator('rect.pane[data-s="open"]').nth(3)
    const spot = await target.boundingBox()
    if (spot !== null) {
      await page.mouse.move(spot.x + spot.width / 2, spot.y + spot.height / 2)
    }
    await settle(page, 400)
    const note = await front.locator('.note').innerText()
    const pointed = /\d\d\.\d\d\.\d{4}/.exec(note)?.[0]
    check(
      'pointing at a window says which position it is and how it stands',
      pointed !== undefined && note.includes('braucht eine Entscheidung'),
      note,
    )
    if (spot !== null) {
      await page.mouse.click(spot.x + spot.width / 2, spot.y + spot.height / 2)
    }
    await page.waitForURL(/\/positionen\/\d/)
    check(
      'a click on the window opens that position',
      pointed !== undefined && path(page) === `/positionen/${pointed}`,
      path(page),
    )
    check(
      'the position shows where it is in the building',
      await page
        .locator('article a.locator')
        .waitFor({ timeout: 5000 })
        .then(() => true)
        .catch(() => false),
    )

    await page.goto(`${base}/`, { waitUntil: 'networkidle' })
    await settle(page, 600)
    await page.getByRole('link', { name: 'Alle Positionen' }).focus()
    await page.keyboard.press('Tab')
    const onFront = await page.evaluate(
      () => document.activeElement?.getAttribute('role') === 'application',
    )
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowUp')
    await settle(page, 200)
    const walked = await front.locator('.note').innerText()
    const chosenOz = /\d\d\.\d\d\.\d{4}/.exec(walked)?.[0]
    await page.keyboard.press('Enter')
    await page.waitForURL(/\/positionen\/\d/)
    check(
      'the building is one Tab stop; arrows choose a window and Enter opens it',
      onFront &&
        chosenOz !== undefined &&
        path(page) === `/positionen/${chosenOz}`,
      { onFront, chosenOz, at: path(page) },
    )
    await page.goto(`${base}/`, { waitUntil: 'networkidle' })

    await page.getByRole('link', { name: 'Entscheidungen öffnen' }).click()
    await page.waitForURL(/offen=true/)
    await page.waitForURL(/\/positionen\/\d/)
    await settle(page, 500)
    const queued = await page
      .locator('[data-position-list] [aria-live]')
      .innerText()
    check(
      'the open filter lists exactly the positions that need a decision',
      queued.startsWith(`${openCount} `),
      { queued, openCount },
    )
    const amounts = await page
      .locator(
        '[data-position-list] a[data-selected], [data-position-list] a[tabindex]',
      )
      .evaluateAll((rows) =>
        rows
          .slice(0, 6)
          .map((row) =>
            Number(
              (row.lastElementChild?.textContent ?? '')
                .replace(/[^\d,]/g, '')
                .replace(',', '.'),
            ),
          ),
      )
    check(
      'the costliest decision comes first',
      amounts.length > 1 &&
        amounts.every(
          (amount, index) => index === 0 || amount <= (amounts[index - 1] ?? 0),
        ),
      amounts,
    )
    const firstOpen = path(page)
    await page.locator('h1').click()
    await page.keyboard.press('j')
    await settle(page, 500)
    check(
      'J steps to the next decision and keeps the filter',
      path(page) !== firstOpen && path(page).includes('offen=true'),
      path(page),
    )

    await page.goto(`${base}/positionen/01.01.0020`, {
      waitUntil: 'networkidle',
    })
    const featured = await page.locator('article').innerText()
    check(
      'the undersized cabinet is flagged with its arithmetic',
      featured.includes('138 kVA / (√3 × 400 V) = 199 A') &&
        featured.includes('verlangt 250 A, angeboten 138 kVA'),
      featured.slice(0, 400),
    )
    check(
      'the decision says what it is worth',
      /kostet die Position [\d.,]+ € mehr/.test(featured),
    )
    check(
      'the offer the position is priced with is marked',
      (await page
        .locator('article')
        .getByText('Günstigstes gültiges Angebot')
        .count()) === 1,
    )

    console.log('Deciding')
    const openCountNow = async () =>
      Number(
        (
          await page.locator('[data-position-list] [aria-live]').innerText()
        ).split(' ')[0],
      )
    const verdict = async () =>
      (await page.locator('.verdict').innerText()).replace(/\s+/g, ' ')
    await page.goto(`${base}/positionen/01.01.0020?offen=true`, {
      waitUntil: 'networkidle',
    })
    await settle(page, 600)
    const stillOpen = await openCountNow()
    await page.locator('h1').click()
    await page.keyboard.press('3')
    await settle(page, 900)
    check(
      'a key takes the offer in that column, and the position leaves the queue',
      (await verdict()).startsWith('Entschieden. Kalkuliert mit Osterholt') &&
        (await openCountNow()) === stillOpen - 1,
      { verdict: await verdict(), stillOpen, now: await openCountNow() },
    )
    await page.goto(`${base}/`, { waitUntil: 'networkidle' })
    await settle(page, 3000)
    const after = (await page.locator('main p.statement').innerText()).replace(
      /\s+/g,
      ' ',
    )
    check(
      'the overview counts the decision in and its window is no longer red',
      after.includes(`${stillOpen - 1} warten`) &&
        (await page
          .locator('svg.front:visible rect.pane[data-s="open"]')
          .count()) ===
          stillOpen - 1,
      after,
    )
    await page.goto(`${base}/positionen/01.01.0020?offen=true`, {
      waitUntil: 'networkidle',
    })
    await settle(page, 500)
    await page.locator('h1').click()
    await page.keyboard.press('u')
    await settle(page, 800)
    check(
      'U takes the decision back',
      (await verdict()).startsWith('Braucht eine Entscheidung') &&
        (await openCountNow()) === stillOpen,
      await verdict(),
    )
    await page.getByLabel(/Eigener Preis/).fill('4321,5')
    await page
      .getByRole('button', { name: 'Mit diesem Preis kalkulieren' })
      .click()
    await settle(page, 800)
    check(
      "a price of one's own settles a position too",
      (await verdict()).includes('eigenen Preis: 4.321,50 €'),
      await verdict(),
    )
    await page
      .getByRole('button', { name: 'Entscheidung zurücknehmen' })
      .click()
    await settle(page, 600)

    console.log('Costing')
    await page.goto(`${base}/kalkulation`, { waitUntil: 'networkidle' })
    await settle(page, 400)
    const sum = async () => {
      const text = (await page.locator('main p.statement').innerText()).replace(
        /\s+/g,
        ' ',
      )
      const figures = [...text.matchAll(/([\d.]+,\d\d) €/g)].map((found) =>
        Number((found[1] ?? '').replaceAll('.', '').replace(',', '.')),
      )
      return { text, surcharge: figures[1] ?? 0, total: figures[2] ?? 0 }
    }
    const atFirst = await sum()
    await page.locator('input[type="range"]').focus()
    await page.keyboard.press('End')
    await settle(page, 300)
    const atMost = await sum()
    await page.keyboard.press('Home')
    await settle(page, 300)
    const atLeast = await sum()
    check(
      'the copper control moves the bid by five figures',
      atFirst.surcharge > 10000 &&
        atMost.total - atLeast.total > 10000 &&
        atMost.total - atLeast.total < 1000000 &&
        Math.abs(
          atMost.total - atMost.surcharge - (atFirst.total - atFirst.surcharge),
        ) < 0.02,
      { atFirst, atMost, atLeast },
    )

    console.log('Overview, below the picture')
    await page.goto(`${base}/`, { waitUntil: 'networkidle' })
    // What a line is about: its article and the reason beside the lamp.
    const ledger = await page.locator('a.ledger-row').evaluateAll((rows) =>
      rows.map((row) => ({
        about: [
          row.querySelector('.line-clamp-2')?.textContent ?? '',
          row.querySelector('.lamp')?.nextSibling?.textContent ?? '',
        ].join(' | '),
        text: row.textContent,
      })),
    )
    check(
      'one article for one reason is one line of the ledger, with its positions counted',
      ledger.length > 1 &&
        new Set(ledger.map((row) => row.about)).size === ledger.length &&
        ledger.some((row) => /\d+ Positionen: /.test(row.text)),
      ledger.map((row) => row.about),
    )
    // Pointing at a title picks its windows out; holding a reason does too.
    const picked = () =>
      page.locator('svg.front:visible rect.pane[data-on]').count()
    await page.getByRole('link', { name: /^07\s*Beleuchtung$/ }).hover()
    await settle(page, 200)
    const ofTitle = await picked()
    await page.mouse.move(5, 300)
    await settle(page, 200)
    const released = await picked()
    await page.getByRole('button', { name: /^Kein Angebot/ }).click()
    await page.mouse.move(5, 300)
    await settle(page, 200)
    const held = await picked()
    await page.getByRole('button', { name: /^Kein Angebot/ }).click()
    check(
      'pointing at a title shows its windows; a reason stays shown once clicked',
      ofTitle === 171 && released === 0 && held === 41,
      { ofTitle, released, held },
    )
    await page.getByRole('link', { name: /^07\s*Beleuchtung$/ }).click()
    await page.waitForURL(/titel=07/)
    await page.waitForURL(/\/positionen\/07\./)
    check('a title named under the picture opens its positions', true)

    await page.goto(`${base}/positionen/01.01.0020`, {
      waitUntil: 'networkidle',
    })
    const columnTops = () =>
      page
        .locator('.offers-column')
        .evaluateAll((columns) =>
          columns.map((column) =>
            Math.round(column.getBoundingClientRect().top),
          ),
        )
    const besideEachOther = new Set(await columnTops()).size === 1
    await page.goto(`${base}/positionen/01.01.0020?quelle=lv.qty`, {
      waitUntil: 'networkidle',
    })
    await settle(page, 900)
    const stacked = await columnTops()
    check(
      'the suppliers stand side by side, and stack when a document takes half the room',
      besideEachOther && new Set(stacked).size === stacked.length,
      { besideEachOther, stacked },
    )

    console.log('Units')
    await page.goto(`${base}/positionen?offen=true`, {
      waitUntil: 'networkidle',
    })
    await page.locator('[data-position-list] input').fill('')
    const unclear = page
      .locator('[data-position-list] a', { hasText: 'Einheit unklar' })
      .first()
    // The list only renders what is on screen, so scroll until one shows.
    for (let step = 0; step < 40 && (await unclear.count()) === 0; step++) {
      await page
        .locator('[data-position-list] .overflow-auto')
        .evaluate((list) => list.scrollBy(0, 500))
      await settle(page, 80)
    }
    if ((await unclear.count()) > 0) {
      await unclear.click()
      await settle(page, 600)
      const text = await page.locator('article').innerText()
      check(
        'a pack without a stated size is named as such, in its own unit',
        /Preis je (RG|VE), ausgeschrieben in (m|St)/.test(text),
        text.slice(0, 300),
      )
    } else {
      check(
        'a pack without a stated size is in the queue',
        false,
        'no such decision in view',
      )
    }

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
    // In English the page is English: its own words, the tender's sections
    // and item names, and the figures.
    await page.goto(`${base}/`, { waitUntil: 'networkidle' })
    await settle(page, 300)
    const english = (await page.locator('main').innerText()).replace(
      /\s+/g,
      ' ',
    )
    check(
      'the overview is in English, down to the tender and the figures',
      english.includes('New office building') &&
        english.includes('1,078 of 1,170 items are priced') &&
        english.includes('Sub-distribution boards') &&
        english.includes('Ground') &&
        !/Positionen|Leistungsverzeichnis|Unterverteilungen|Obergeschoss/.test(
          english,
        ),
      english.slice(0, 300),
    )
    await page.goto(`${base}/positionen/01.01.0020`, {
      waitUntil: 'networkidle',
    })
    const item = (await page.locator('article').innerText()).replace(
      /\s+/g,
      ' ',
    )
    check(
      "an item is named in English with the tender's wording under it",
      item.includes('Site distribution cabinet 250 A for site power') &&
        item.includes('Anschlussverteilerschrank 250 A für Baustrom') &&
        item.includes('Rated current: 250 A specified, 138 kVA offered') &&
        item.includes('4,502.13'),
      item.slice(0, 300),
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
    // Nothing may wait for an animation: every window, the light around
    // them and the picture in the water are there at once.
    const waiting = await calmPage.evaluate(
      () =>
        [...document.querySelectorAll('rect.pane, .halo, .mirror')].filter(
          (element) =>
            element.closest('svg')?.getClientRects().length !== 0 &&
            getComputedStyle(element).opacity === '0',
        ).length,
    )
    check('no part of the building waits for an animation', waiting === 0, {
      waiting,
    })
    check(
      'the interface opens at night unless day was chosen',
      (await calmPage.evaluate(
        () => document.documentElement.dataset.theme,
      )) === 'dark',
    )
    await calm.close()

    console.log('Phone')
    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
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
    await phonePage.goto(`${base}/`, { waitUntil: 'networkidle' })
    await settle(phonePage, 600)
    const upright = phonePage.locator('[role="application"]:visible')
    const shape = await upright.boundingBox()
    check(
      'on a phone the house stands upright',
      shape !== null && shape.height > shape.width,
      shape,
    )
    const pane = upright.locator('rect.pane[data-s="open"]').first()
    await pane.scrollIntoViewIfNeeded()
    await pane.tap()
    await settle(phonePage, 300)
    check(
      'a tap says what the window is and offers to open it',
      (await upright.getByRole('link', { name: 'Position öffnen' }).count()) ===
        1,
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
