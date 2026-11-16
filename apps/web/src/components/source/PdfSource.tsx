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

/**
 * One page of a PDF with the place a value was read from marked on it, the
 * way a checker marks a drawing: a ruled box, a leader, and a note.
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
  const frame = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)
  const [page, setPage] = useState<{ scale: number; height: number } | null>(
    null,
  )
  const [failed, setFailed] = useState(false)

  // Fit the page to the pane, and again when the pane changes width.
  useEffect(() => {
    const element = frame.current
    if (element === null) return
    const measure = () => setWidth(Math.floor(element.clientWidth))
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
        setPage({ scale, height: natural.height * scale })
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
  }, [url, box.page, width])

  // Bring the marked place into view once the page is drawn.
  useEffect(() => {
    const element = frame.current
    if (element === null || page === null) return
    const top = box.y * page.scale - element.clientHeight * 0.32
    element.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }, [page, box.y, box.page])

  const mark =
    page === null
      ? null
      : {
          x: box.x * page.scale - 4,
          y: box.y * page.scale - 3,
          w: box.w * page.scale + 8,
          h: box.h * page.scale + 6,
        }

  return (
    <div ref={frame} className="relative h-full overflow-auto">
      {failed && (
        <p role="alert" className="p-5 text-[0.93rem] text-open-ink">
          {t('source.failed')}
        </p>
      )}
      {page === null && !failed && (
        <p className="label p-5" aria-live="polite">
          {t('source.loading')} …
        </p>
      )}

      <div
        className="relative bg-white shadow-sheet dark:brightness-[0.94]"
        style={{ height: page?.height }}
      >
        <canvas
          ref={canvas}
          aria-label={caption}
          role="img"
          className="block w-full"
        />

        {mark !== null && (
          <svg
            key={`${box.page}-${box.x}-${box.y}`}
            className="pointer-events-none absolute inset-0 size-full overflow-visible"
            aria-hidden="true"
          >
            <rect
              x={mark.x}
              y={mark.y}
              width={mark.w}
              height={mark.h}
              className="fill-marker-wash"
            />
            <rect
              x={mark.x}
              y={mark.y}
              width={mark.w}
              height={mark.h}
              pathLength={1}
              fill="none"
              strokeWidth={1.75}
              className="draw stroke-marker"
            />
            {/* Leader up to the note. */}
            <path
              d={`M ${mark.x + mark.w} ${mark.y} l 14 -16 h 10`}
              pathLength={1}
              fill="none"
              strokeWidth={1.25}
              className="draw stroke-marker"
            />
            <foreignObject
              x={Math.min(mark.x + mark.w + 26, width - 150)}
              y={mark.y - 28}
              width={150}
              height={24}
            >
              <span className="label enter inline-block whitespace-nowrap bg-marker px-1.5 py-1 !text-white">
                {caption}
              </span>
            </foreignObject>
          </svg>
        )}
      </div>
    </div>
  )
}
