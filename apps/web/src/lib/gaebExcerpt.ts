export interface Excerpt {
  /** Line number of the excerpt's first line within the file, from 1. */
  firstLine: number
  lines: Array<string>
  /** Indexes into `lines` that hold the value. */
  marked: Set<number>
}

/** The lines of one item of a GAEB file, and which of them carry `element`. */
export function excerptItem(
  xml: string,
  itemId: string,
  element: string,
): Excerpt | null {
  const start = xml.indexOf(`<Item ID="${itemId}"`)
  if (start === -1) return null
  const end = xml.indexOf('</Item>', start)
  if (end === -1) return null

  const lineStart = xml.lastIndexOf('\n', start) + 1
  const raw = xml.slice(lineStart, end + '</Item>'.length).split('\n')
  const firstLine = xml.slice(0, lineStart).split('\n').length

  // Drop the indentation every line shares; nesting inside the item stays.
  const shared = Math.min(
    ...raw
      .filter((line) => line.trim() !== '')
      .map((line) => line.length - line.trimStart().length),
  )
  const lines = raw.map((line) => line.slice(shared))

  const marked = new Set<number>()
  if (element === 'RNoPart') {
    marked.add(0)
  } else {
    const open = lines.findIndex((line) => line.includes(`<${element}>`))
    if (open !== -1) {
      const close = lines.findIndex(
        (line, index) => index >= open && line.includes(`</${element}>`),
      )
      for (let index = open; index <= (close === -1 ? open : close); index++) {
        marked.add(index)
      }
    }
  }
  return { firstLine, lines, marked }
}
