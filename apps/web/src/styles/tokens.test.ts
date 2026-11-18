import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Contrast is a property of the tokens, so it is checked where they are
 * defined. Every pair listed here is in use in a component; a new pair
 * belongs in this list before it ships.
 */
const css = readFileSync(
  fileURLToPath(new URL('./tokens.css', import.meta.url)),
  'utf8',
)
const [lightBlock = '', darkBlock = ''] = css.split(":root[data-theme='dark']")

function tokens(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/--t-([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)].map(
      (match) => [match[1], match[2]],
    ),
  )
}

const light = tokens(lightBlock)
const themes = { light, dark: { ...light, ...tokens(darkBlock) } }

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [lighter = 0, darker = 0] = [luminance(a), luminance(b)].sort(
    (x, y) => y - x,
  )
  return (lighter + 0.05) / (darker + 0.05)
}

/** Text on the surface it is set on: WCAG AA for body text. */
const TEXT: Array<[string, string]> = [
  ['ink', 'bg'],
  ['ink', 'sky'],
  ['ink', 'sky-top'],
  ['ink', 'surface'],
  ['ink', 'surface-raised'],
  ['ink-2', 'bg'],
  ['ink-2', 'sky'],
  ['ink-2', 'sky-top'],
  ['ink-2', 'surface'],
  ['ink-2', 'surface-raised'],
  ['ink-2', 'surface-sunken'],
  ['ink-3', 'bg'],
  ['ink-3', 'sky'],
  ['ink-3', 'sky-top'],
  ['ink-3', 'water'],
  ['ink-3', 'shore'],
  ['ink-3', 'surface'],
  ['ink-3', 'surface-raised'],
  ['ink-3', 'surface-sunken'],
  ['on-action', 'action'],
  ['lamp-ink', 'bg'],
  ['lamp-ink', 'surface'],
  ['lamp-ink', 'surface-raised'],
  ['lamp-ink', 'lamp-soft'],
  ['on-marker', 'marker'],
  ['open-ink', 'bg'],
  ['open-ink', 'sky'],
  ['open-ink', 'sky-top'],
  ['open-ink', 'shore'],
  ['open-ink', 'surface'],
  ['open-ink', 'surface-sunken'],
  ['approved-ink', 'surface'],
  ['settled-ink', 'surface'],
  // The numbers of the bays, on the band under the roof.
  ['on-wall-2', 'wall'],
]

/** Marks that carry meaning without text: WCAG 1.4.11, 3:1. */
const MARKS: Array<[string, string]> = [
  // The house: a priced window, one that needs a decision and one nobody
  // has read have to be told apart from the wall and from each other, by
  // night and by day.
  ['glass', 'wall'],
  ['glass-open', 'wall'],
  ['glass', 'glass-off'],
  ['glass-open', 'glass-off'],
  ['on-wall', 'wall'],
  ['wall-focus', 'wall'],
  // A priced position as a mark on the page: a bar, a line.
  ['pane', 'bg'],
  ['pane', 'surface'],
  ['copper', 'bg'],
  ['copper', 'surface'],
  ['open', 'bg'],
  ['open', 'surface'],
  ['marker', 'paper'],
  ['focus', 'bg'],
  ['focus', 'surface'],
  ['focus', 'surface-raised'],
  ['approved', 'surface'],
  ['settled', 'surface'],
  ['caution', 'surface'],
  ['ink-3', 'surface-sunken'],
  ['ink-3', 'bg'],
]

describe.each(Object.entries(themes))('%s theme', (_name, theme) => {
  const value = (token: string): string => {
    const hex = theme[token]
    if (hex === undefined) throw new Error(`No colour token --t-${token}`)
    return hex
  }

  it.each(TEXT)('%s on %s is readable as text', (fore, back) => {
    expect(contrast(value(fore), value(back))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(MARKS)('%s on %s can be told apart', (fore, back) => {
    expect(contrast(value(fore), value(back))).toBeGreaterThanOrEqual(3)
  })
})
