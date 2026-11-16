/**
 * Reads the text of a PDF with its positions, using pdf.js. The table reader
 * in `@preisspiegel/core` turns the result into offer lines.
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PdfTextItem } from '@preisspiegel/core'

export interface ExtractedPdf {
  items: Array<PdfTextItem>
  pages: Array<{ width: number; height: number }>
}

export async function extractPdfText(bytes: Uint8Array): Promise<ExtractedPdf> {
  // pdf.js takes ownership of the buffer it is given, so hand it a copy.
  const task = getDocument({
    data: bytes.slice(),
    useSystemFonts: false,
    verbosity: 0,
  })
  const pdf = await task.promise

  const items: Array<PdfTextItem> = []
  const pages: Array<{ width: number; height: number }> = []
  try {
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo)
      const { width, height } = page.getViewport({ scale: 1 })
      pages.push({ width, height })

      const content = await page.getTextContent()
      for (const item of content.items) {
        if (!('str' in item) || item.str.trim() === '') continue
        // transform = [a, b, c, d, e, f]: (e, f) is the start of the baseline,
        // measured from the bottom-left corner of the page.
        const [, , c, d, e, f] = item.transform as Array<number>
        const size = Math.hypot(c ?? 0, d ?? 0) || item.height
        items.push({
          page: pageNo,
          text: item.str,
          x: e ?? 0,
          w: item.width,
          baseline: height - (f ?? 0),
          size,
        })
      }
    }
  } finally {
    await task.destroy()
  }
  return { items, pages }
}
