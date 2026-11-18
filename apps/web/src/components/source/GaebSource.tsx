import { useQuery } from '@tanstack/react-query'
import { useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { excerptItem } from '~/lib/gaebExcerpt'
import { useT } from '~/lib/i18n'

/**
 * The item of a GAEB file a value was read from, as the file has it, with the
 * element that carries the value marked.
 */
export function GaebSource({
  url,
  itemId,
  element,
}: {
  url: string
  itemId: string
  element: string
}) {
  const t = useT()
  const still = useReducedMotion() === true
  const mark = useRef<HTMLLIElement>(null)

  const { data: xml, isError } = useQuery({
    queryKey: ['document-text', url],
    queryFn: async () => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`${url}: ${response.status}`)
      return response.text()
    },
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
  })

  const excerpt = useMemo(
    () => (xml === undefined ? null : excerptItem(xml, itemId, element)),
    [xml, itemId, element],
  )

  useEffect(() => {
    mark.current?.scrollIntoView({
      block: 'center',
      behavior: still ? 'auto' : 'smooth',
    })
  }, [excerpt, still])

  if (isError || (xml !== undefined && excerpt === null)) {
    return (
      <p role="alert" className="p-5 text-open-ink">
        {t('source.failed')}
      </p>
    )
  }
  if (excerpt === null) {
    return (
      <p className="caption p-5" aria-live="polite">
        {t('source.loading')} …
      </p>
    )
  }

  const firstMarked = Math.min(...excerpt.marked)
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={t('source.title')}
      className="h-full overflow-auto p-4"
    >
      <ol className="code module overflow-hidden bg-surface-raised py-3 text-[0.8rem] leading-[1.75]">
        {excerpt.lines.map((line, index) => {
          const isMarked = excerpt.marked.has(index)
          return (
            <li
              key={`${itemId}-${index}`}
              ref={index === firstMarked ? mark : undefined}
              className={`flex gap-4 border-l-[3px] pr-4 ${
                isMarked
                  ? 'mark-line border-marker bg-marker-wash text-ink'
                  : 'border-transparent text-ink-2'
              }`}
            >
              <span
                aria-hidden="true"
                className="w-12 shrink-0 select-none text-right text-ink-3"
              >
                {excerpt.firstLine + index}
              </span>
              <code className="whitespace-pre-wrap break-words font-[inherit]">
                {line}
              </code>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
