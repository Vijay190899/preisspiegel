import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { BLOCK, layoutFacade, paneStates, place } from '~/lib/facade'
import { useT } from '~/lib/i18n'
import { statusesQuery } from '~/lib/queries'
import type { Pane } from '~/lib/facade'
import type { Tender } from '~/lib/queries'

const round = (value: number) => Math.round(value * 10) / 10

const outline = (panes: ReadonlyArray<Pane>) =>
  panes
    .map(
      (pane) =>
        `M${round(pane.x)} ${round(pane.y)}h${round(pane.width)}v${round(pane.height)}h${round(-pane.width)}z`,
    )
    .join('')

/**
 * Where a position is in the building: the front from the overview, small,
 * with this position's window picked out by two hairlines that cross on it.
 * It leads back to the overview.
 */
export function Locator({ tender, seq }: { tender: Tender; seq: number }) {
  const t = useT()
  const { data: statuses } = useQuery(statusesQuery)
  const input = useMemo(
    () => ({
      titles: tender.titles,
      storeys: tender.storeys,
      storeyByPosition: tender.storeyByPosition,
    }),
    [tender.titles, tender.storeys, tender.storeyByPosition],
  )
  const layout = useMemo(() => layoutFacade(input, BLOCK), [input])
  const drawn = useMemo(() => {
    const states = paneStates(layout.panes.length, statuses ?? null, null)
    return {
      all: outline(layout.panes),
      lit: outline(layout.panes.filter((p) => states[p.index] === 'priced')),
      open: outline(layout.panes.filter((p) => states[p.index] === 'open')),
    }
  }, [layout, statuses])

  const pane = layout.panes[seq]
  if (pane === undefined || tender.storeys.length === 0) return null
  const spot = place(input)[seq]
  const where = [
    spot === undefined || spot.storey < 0
      ? t('facade.house')
      : tender.storeys[spot.storey],
    spot === undefined ? undefined : tender.titles[spot.title]?.label,
  ]
    .filter(Boolean)
    .join(', ')
  const { wall } = layout
  const x = pane.x + pane.width / 2
  const y = pane.y + pane.height / 2

  return (
    <Link
      to="/"
      aria-label={t('pos.where', { where })}
      title={where}
      className="locator group w-[15.5rem] rounded-[4px]"
    >
      <svg
        viewBox={`${round(wall.x)} ${round(wall.y)} ${round(wall.width)} ${round(wall.height)}`}
        className="block w-full"
        aria-hidden="true"
      >
        <rect
          x={round(wall.x)}
          y={round(wall.y)}
          width={round(wall.width)}
          height={round(wall.height)}
          className="fill-wall"
        />
        <path d={drawn.all} className="fill-pane-off" />
        <path
          d={drawn.lit}
          className="fill-pane opacity-35 transition-opacity duration-200 group-hover:opacity-60"
        />
        <path d={drawn.open} className="fill-open opacity-60" />
        <path
          d={`M${round(wall.x)} ${round(y)}H${round(pane.x - 9)}M${round(pane.x + pane.width + 9)} ${round(y)}H${round(wall.x + wall.width)}M${round(x)} ${round(wall.y)}V${round(pane.y - 9)}M${round(x)} ${round(pane.y + pane.height + 9)}V${round(wall.y + wall.height)}`}
          className="stroke-ink-2"
          strokeWidth="2.5"
          fill="none"
        />
        <rect
          x={round(pane.x - 6)}
          y={round(pane.y - 6)}
          width={round(pane.width + 12)}
          height={round(pane.height + 12)}
          className="fill-ink"
          rx="2"
        />
      </svg>
    </Link>
  )
}
