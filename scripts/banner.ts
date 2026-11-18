/**
 * `pnpm banner`: makes the README banner and the image a shared link shows,
 * from the running app. The building on the right is the overview's own
 * front, photographed at night with its lights on, not a drawing of it.
 *
 * Writes docs/assets/banner.png (2560 × 800) and apps/web/public/og.png
 * (1200 × 630). Needs `pnpm dev` running with a finished run.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const base = process.env.SHOTS_BASE_URL ?? 'http://localhost:3000'
const root = (path: string) =>
  fileURLToPath(new URL(`../${path}`, import.meta.url))
const fonts = 'apps/web/node_modules/@fontsource-variable'

const dataUrl = (path: string, type: string) =>
  `data:${type};base64,${readFileSync(root(path)).toString('base64')}`

/** How far below the front the reflection reaches, in CSS pixels. */
const REFLECTION = 250

const browser = await chromium.launch({ channel: 'chrome' })

// 1. The front of the building, lit, with the river under it.
const app = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
  reducedMotion: 'reduce',
})
await app.addInitScript(() => {
  localStorage.setItem('preisspiegel:theme', 'dark')
})
const page = await app.newPage()
await page.goto(`${base}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const front = page.locator('[role="application"]:visible')
const box = await front.boundingBox()
if (box === null)
  throw new Error('The front of the building is not on the page.')
// The page is scrolled to the top, so the box is where the page has it.
const building = await page.screenshot({
  fullPage: true,
  // A strip of sky above, and the river with the reflection below.
  clip: {
    x: box.x,
    y: box.y - 60,
    width: box.width,
    height: box.height + 60 + REFLECTION,
  },
})
console.log(
  `The front: ${Math.round(box.width)} × ${Math.round(box.height)} px`,
)
await app.close()

// 2. The building beside the name, as the banner and as the share image.
const css = `
  @font-face { font-family: Jost; font-weight: 100 900;
    src: url(${dataUrl(`${fonts}/jost/files/jost-latin-wght-normal.woff2`, 'font/woff2')}) format('woff2'); }
  @font-face { font-family: Archivo; font-weight: 100 900; font-stretch: 62% 125%;
    src: url(${dataUrl(`${fonts}/archivo/files/archivo-latin-standard-normal.woff2`, 'font/woff2')}) format('woff2'); }
  html, body { margin: 0; height: 100%; }
  body {
    position: relative; overflow: hidden; color: #edf2f8;
    font-family: Archivo, system-ui, sans-serif;
    background:
      radial-gradient(70% 90% at 78% 70%, #13213a 0%, transparent 70%),
      linear-gradient(180deg, #070b12 0%, #0a1220 70%, #0c1626 100%);
  }
  .copy { position: absolute; top: 50%; transform: translateY(-50%); z-index: 1; }
  .word { display: flex; align-items: center; font-weight: 600;
    letter-spacing: -0.035em; line-height: 1; font-stretch: 108%; }
  .tag { margin: 0; font-family: Jost, sans-serif; font-weight: 300;
    color: #a8b5c5; letter-spacing: -0.005em; line-height: 1.38; }
  .tag b { font-weight: 450; color: #ffcf8a; }
  .scene { position: absolute; background: url(data:image/png;base64,${building.toString('base64')}) center / contain no-repeat;
    -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%),
      linear-gradient(180deg, transparent 0%, #000 10%, #000 70%, transparent 100%);
    -webkit-mask-composite: source-in; mask-composite: intersect; }
  .mark rect.ink { fill: #edf2f8; }
  .mark rect.lamp { fill: #ffcf8a; }
  .mark { filter: drop-shadow(0 0 18px rgb(255 207 138 / 0.35)); }
`
const mark = (size: number) => `
  <svg class="mark" width="${size}" height="${size}" viewBox="0 0 22 22" aria-hidden="true">
    <rect class="ink" x="1" y="7" width="5" height="14" rx="1.5" />
    <rect class="lamp" x="8.5" y="11" width="5" height="10" rx="1.5" />
    <rect class="ink" x="16" y="1" width="5" height="20" rx="1.5" />
  </svg>`
const tagline = `Tender pricing for electrical contractors: <b>every item matched</b>,
  <b>only the decisions shown</b>, <b>every number traced</b> to its source.`

const layouts = [
  {
    out: 'docs/assets/banner.png',
    width: 1280,
    height: 400,
    scale: 2,
    copy: 'left: 80px; width: 500px;',
    word: 'font-size: 64px; gap: 18px;',
    mark: 46,
    tag: 'margin-top: 22px; font-size: 23px;',
    scene: 'right: 28px; top: 14px; width: 640px; height: 372px;',
  },
  {
    out: 'apps/web/public/og.png',
    width: 1200,
    height: 630,
    scale: 1,
    copy: 'left: 60px; width: 470px;',
    word: 'font-size: 60px; gap: 16px;',
    mark: 50,
    tag: 'margin-top: 20px; font-size: 27px; max-width: 900px;',
    scene: 'right: 24px; top: 105px; width: 640px; height: 420px;',
  },
]

for (const layout of layouts) {
  const context = await browser.newContext({
    viewport: { width: layout.width, height: layout.height },
    deviceScaleFactor: layout.scale,
  })
  const banner = await context.newPage()
  await banner.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8">
    <style>${css}</style></head><body>
    <div class="scene" style="${layout.scene}"></div>
    <div class="copy" style="${layout.copy}">
      <div class="word" style="${layout.word}">${mark(layout.mark)}preisspiegel</div>
      <p class="tag" style="${layout.tag}">${tagline}</p>
    </div></body></html>`)
  await banner.evaluate(() => document.fonts.ready)
  writeFileSync(root(layout.out), await banner.screenshot({ type: 'png' }))
  console.log(`Wrote ${layout.out}`)
  await context.close()
}
await browser.close()
