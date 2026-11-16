import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
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

  const excerpt = xml === undefined ? null : excerptItem(xml, itemId, element)

  useEffect(() => {
    mark.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [excerpt?.firstLine, element])

  if (isError || (xml !== undefined && excerpt === null)) {
    return (
      <p role="alert" className="p-5 text-[0.93rem] text-open-ink">
        {t('source.failed')}
      </p>
    )
  }
  if (excerpt === null) {
    return (
      <p className="label p-5" aria-live="polite">
        {t('source.loading')} …
      </p>
    )
  }

  const firstMarked = Math.min(...excerpt.marked)
  return (
    <ol className="num h-full overflow-auto bg-surface-raised py-3 text-[0.8rem] leading-[1.7]">
      {excerpt.lines.map((line, index) => {
        const isMarked = excerpt.marked.has(index)
        return (
          <li
            key={index}
            ref={index === firstMarked ? mark : undefined}
            className={`flex gap-4 border-l-2 pr-4 ${
              isMarked
                ? 'border-marker bg-marker-wash text-ink'
                : 'border-transparent text-ink-2'
            }`}
          >
            <span
              aria-hidden="true"
              className="w-14 shrink-0 select-none text-right text-ink-3"
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
  )
}
