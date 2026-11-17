import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '~/lib/i18n'
import type * as PdfJs from 'pdfjs-dist'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

interface Box {
  page: number
  x: number
  y: number
  w: number
  h: number
}

interface Drawn {
  /** Which page of which file is on the canvas. */
  key: string
  scale: number
  height: number
}

// pdf.js is large and browser-only: load it on first use, once.
let library: Promise<typeof PdfJs> | null = null
function pdfjs() {
  library ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default
    return lib
  })
  return library
}

const documents = new Map<string, Promise<PDFDocumentProxy>>()
function loadDocument(url: string): Promise<PDFDocumentProxy> {
  let pending = documents.get(url)
  if (pending === undefined) {
    pending = pdfjs().then((lib) => lib.getDocument({ url }).promise)
    pending.catch(() => documents.delete(url))
    documents.set(url, pending)
  }
  return pending
}

/** Room around the page inside the panel. */
const INSET = 16
/** How long the reading light takes to pass down the page. */
const SCAN_MS = 900
/**
 * The narrowest a page is drawn. A panel narrower than this, on a phone,
 * shows the page at this width and opens on the marked place.
 */
const MIN_PAGE_WIDTH = 640

/**
 * One page of a PDF with the place a value was read from marked on it. A
 * light passes down the page as it is read; where it reaches the value, a
 * checker's box draws itself around it, with a note saying what it is.
 */
export function PdfSource({
  url,
  box,
  caption,
}: {
  url: string
  box: Box
  caption: string
}) {
  const t = useT()
  const still = useReducedMotion() === true
  const frame = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)
  const [drawn, setDrawn] = useState<Drawn | null>(null)
  const [failed, setFailed] = useState(false)

  const key = `${url}#${box.page}`
  // A mark belongs to the page it was measured on, never to the one before.
  const page = drawn?.key === key ? drawn : null

  // Fit the page to the panel, and again when the panel changes width.
  useEffect(() => {
    const element = frame.current
    if (element === null) return
    const measure = () =>
      setWidth(
        Math.max(MIN_PAGE_WIDTH, Math.floor(element.clientWidth) - 2 * INSET),
      )
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const target = canvas.current
    if (target === null || width === 0) return
    // Cleanup flips this while the work below is waiting, so it is read
    // through a function: the value is not what it was a line earlier.
    const run: { cancelled: boolean; task: RenderTask | null } = {
      cancelled: false,
      task: null,
    }
    const cancelled = () => run.cancelled

    void (async () => {
      try {
        const pdf = await loadDocument(url)
        const pdfPage = await pdf.getPage(box.page)
        if (cancelled()) return

        const natural = pdfPage.getViewport({ scale: 1 })
        const scale = width / natural.width
        const density = Math.min(window.devicePixelRatio || 1, 2)
        const viewport = pdfPage.getViewport({ scale: scale * density })

        target.width = Math.floor(viewport.width)
        target.height = Math.floor(viewport.height)
        run.task = pdfPage.render({ canvas: target, viewport })
        await run.task.promise
        if (cancelled()) return

        setFailed(false)
        setDrawn({ key, scale, height: natural.height * scale })
      } catch (error) {
        // A newer render replacing this one is not a failure.
        const name = error instanceof Error ? error.name : ''
        if (!cancelled() && name !== 'RenderingCancelledException') {
          setFailed(true)
        }
      }
    })()

    return () => {
      run.cancelled = true
      run.task?.cancel()
    }
  }, [url, box.page, width, key])

  // Bring the marked place into view once the page is drawn.
  useEffect(() => {
    const element = frame.current
    if (element === null || page === null) return
    const top = box.y * page.scale - element.clientHeight * 0.34
    const left =
      (box.x + box.w / 2) * page.scale + INSET - element.clientWidth / 2
    element.scrollTo({
      top: Math.max(0, top),
      left: Math.max(0, left),
      behavior: still ? 'auto' : 'smooth',
    })
  }, [page, box.x, box.y, box.w, still])

  const mark =
    page === null
      ? null
      : {
          x: box.x * page.scale - 5,
          y: box.y * page.scale - 4,
          w: box.w * page.scale + 10,
          h: box.h * page.scale + 8,
        }
  // The box is drawn when the light gets to it.
  const reached =
    still || page === null || mark === null
      ? 0
      : 140 + SCAN_MS * 0.72 * (mark.y / page.height)

  return (
    <div ref={frame} className="relative h-full overflow-auto">
      {failed && (
        <p role="alert" className="p-5 text-open-ink">
          {t('source.failed')}
        </p>
      )}
      {page === null && !failed && (
        <p className="caption p-5" aria-live="polite">
          {t('source.loading')} …
        </p>
      )}

      <div
        className="relative overflow-hidden rounded-[6px] bg-paper shadow-module transition-opacity duration-300"
        style={{
          margin: INSET,
          width,
          height: page?.height,
          opacity: page === null ? 0 : 1,
        }}
      >
        {/* On a dark screen the page is shown as dark paper, hues kept. */}
        <canvas
          ref={canvas}
          aria-label={caption}
          role="img"
          className="block w-full dark:[filter:invert(0.9)_hue-rotate(180deg)]"
        />

        {page !== null && mark !== null && (
          <>
            <div
              key={`scan-${key}-${box.y}-${box.x}`}
              aria-hidden="true"
              className="scan pointer-events-none absolute inset-x-0 top-0 h-[9%]"
            />
            <svg
              key={`mark-${key}-${box.y}-${box.x}`}
              className="pointer-events-none absolute inset-0 size-full overflow-visible"
              aria-hidden="true"
            >
              <rect
                x={mark.x}
                y={mark.y}
                width={mark.w}
                height={mark.h}
                rx={3}
                className="mark-wash fill-marker-wash"
                style={{ animationDelay: `${reached + 180}ms` }}
              />
              <rect
                x={mark.x}
                y={mark.y}
                width={mark.w}
                height={mark.h}
                rx={3}
                pathLength={1}
                fill="none"
                strokeWidth={2}
                className="draw stroke-marker"
                style={{ animationDelay: `${reached}ms` }}
              />
            </svg>
          </>
        )}
      </div>
    </div>
  )
}
