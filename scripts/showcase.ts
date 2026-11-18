/**
 * `pnpm showcase`: records the two-minute demo in under a minute, as the
 * frames Chrome paints, for the README. Each frame is kept with the moment it
 * was painted, so the film can be put together at an even rate afterwards.
 *
 * Writes var/showcase/frames/*.jpg and var/showcase/frames.json. Needs
 * `pnpm dev` running with a finished run; reads the answers back once, which
 * calls no model. A higher frame rate wants a screen recorder on a machine
 * with a GPU; this is the version any machine can make.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import type { Locator } from 'playwright'

const base = process.env.SHOTS_BASE_URL ?? 'http://localhost:3000'
const out = fileURLToPath(new URL('../var/showcase/', import.meta.url))
const WIDTH = 1280
const HEIGHT = 800

rmSync(out, { recursive: true, force: true })
mkdirSync(`${out}frames`, { recursive: true })

/** A pointer the viewer can follow; a headless browser draws none. */
const POINTER = `
  addEventListener('DOMContentLoaded', () => {
    const dot = document.createElement('div')
    dot.setAttribute('aria-hidden', 'true')
    dot.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;' +
      'width:22px;height:22px;margin:-3px 0 0 -3px;transition:transform 120ms ease-out;' +
      'background:no-repeat center/contain url("data:image/svg+xml,' +
      encodeURIComponent('<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\'><path d=\\'M3 2l7.5 19 2.6-7.9L21 10.5z\\' fill=\\'white\\' stroke=\\'black\\' stroke-width=\\'1.4\\' stroke-linejoin=\\'round\\'/></svg>') + '")'
    document.body.appendChild(dot)
    addEventListener('mousemove', (event) => {
      dot.style.left = event.clientX + 'px'
      dot.style.top = event.clientY + 'px'
    }, true)
    addEventListener('mousedown', () => { dot.style.transform = 'scale(0.82)' }, true)
    addEventListener('mouseup', () => { dot.style.transform = '' }, true)
  })
`

const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
})
await context.addCookies([
  { name: 'preisspiegel-locale', value: 'en', url: base },
])
await context.addInitScript(POINTER)
const page = await context.newPage()

// Every frame Chrome paints, with the time it was painted.
const frames: Array<{ file: string; at: number }> = []
const cdp = await context.newCDPSession(page)
cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
  const file = `${String(frames.length).padStart(5, '0')}.jpg`
  writeFileSync(`${out}frames/${file}`, Buffer.from(data, 'base64'))
  frames.push({ file, at: metadata.timestamp ?? Date.now() / 1000 })
  void cdp.send('Page.screencastFrameAck', { sessionId })
})

const marks: Array<{ name: string; at: number }> = []
const mark = (name: string) => marks.push({ name, at: Date.now() / 1000 })
const hold = (ms: number) => page.waitForTimeout(ms)

/** Moves the pointer to an element in a way an eye can follow. */
async function glide(target: Locator) {
  const box = await target.boundingBox()
  if (box === null) throw new Error('Nothing to move to.')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 28,
  })
}

async function scrollBy(pixels: number, steps = 18) {
  for (let step = 0; step < steps; step++) {
    await page.mouse.wheel(0, pixels / steps)
    await hold(16)
  }
}

await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await page.mouse.move(640, 600)
await cdp.send('Page.startScreencast', {
  format: 'jpeg',
  quality: 90,
  maxWidth: WIDTH,
  maxHeight: HEIGHT,
  everyNthFrame: 1,
})

// 1. The tender as the building it is for: the lights come on.
mark('overview')
await page.reload({ waitUntil: 'networkidle' })
await hold(4200)

// 2. A reason picks its windows out on the house.
mark('reason')
const reason = page.getByRole('button', { name: /Not what was specified/ })
// Far enough down that the house and the key under it are both in view.
await scrollBy(330)
await hold(500)
await glide(reason)
await hold(2600)
await page.mouse.move(640, 300, { steps: 20 })
await hold(600)

// 3. The costliest decisions, and the cabinet: 250 A asked, 138 kVA offered.
mark('cabinet')
await scrollBy(560)
await hold(900)
const cabinet = page.locator('a.ledger-row', { hasText: '01.01.0020' })
await cabinet.scrollIntoViewIfNeeded()
await glide(cabinet)
await hold(500)
await cabinet.click()
await page.waitForURL(/01\.01\.0020/)
await hold(3600)
await scrollBy(360)
await hold(2200)

// 4. A price opens the supplier's document at the place it was read.
mark('source')
// The large figure in a supplier's column is its unit price.
const price = page.locator('.offers-column .traceable.font-display').first()
await price.scrollIntoViewIfNeeded()
await glide(price)
await hold(400)
await price.click()
await hold(3800)
await page.keyboard.press('Escape')
await hold(900)

// 5. A key takes the clean offer; the position leaves the queue.
mark('decide')
await page.locator('h1').first().scrollIntoViewIfNeeded()
await scrollBy(-400)
await hold(600)
// The page takes keys once it has focus; the heading is a quiet place to click.
await page.locator('h1').first().click()
await page.keyboard.press('3')
await hold(2600)

// 6. The copper notation moves the bid by five figures.
mark('costing')
const costing = page.getByRole('link', { name: 'Costing', exact: true })
await glide(costing)
await costing.click()
await page.waitForURL(/kalkulation/)
await hold(1800)
const control = page.locator('input[type="range"]')
const track = await control.boundingBox()
if (track === null) throw new Error('No copper control.')
const at = (share: number) => track.x + track.width * share
const middle = track.y + track.height / 2
await page.mouse.move(at(0.5), middle, { steps: 24 })
await page.mouse.down()
await page.mouse.move(at(0.98), middle, { steps: 60 })
await hold(700)
await page.mouse.move(at(0.08), middle, { steps: 80 })
await hold(700)
await page.mouse.move(at(0.5), middle, { steps: 40 })
await page.mouse.up()
await hold(1600)

// 7. The tender read again from the stored answers, no model called.
mark('again')
const overview = page.getByRole('link', { name: 'Overview', exact: true })
await glide(overview)
await overview.click()
await page.waitForURL((url) => url.pathname === '/')
await hold(2600)
const again = page.getByRole('button', { name: 'Read it again' })
await glide(again)
await hold(300)
await again.click()
await page.mouse.move(900, 700, { steps: 20 })
await again.waitFor({ timeout: 90_000 })
mark('read')
await hold(3500)

await cdp.send('Page.stopScreencast')
mark('end')
writeFileSync(`${out}frames.json`, JSON.stringify({ frames, marks }, null, 1))
console.log(
  `${frames.length} frames over ${Math.round((marks.at(-1)?.at ?? 0) - (marks[0]?.at ?? 0))} s`,
)
await browser.close()
