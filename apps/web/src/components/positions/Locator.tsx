import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { BLOCK, layoutFacade, outline, paneStates, place } from '~/lib/facade'
import { settleStatuses } from '~/lib/decisions'
import { useT } from '~/lib/i18n'
import { statusesQuery } from '~/lib/queries'
import { useTenderText } from '~/lib/tenderText'
import { useDecisions } from '~/lib/useDecisions'
import type { Tender } from '~/lib/queries'

const round = (value: number) => Math.round(value * 10) / 10

/**
 * Where a position is in the building: the front from the overview, small,
 * with this position's window picked out by two hairlines that cross on it.
 * It leads back to the overview.
 */
export function Locator({ tender, seq }: { tender: Tender; seq: number }) {
  const t = useT()
  const said = useTenderText()
  const { data: runStatuses } = useQuery(statusesQuery)
  const { decided } = useDecisions()
  const statuses = settleStatuses(runStatuses ?? null, decided)
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
    const states = paneStates(layout.panes.length, statuses, null)
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
      : said.storey(tender.storeys[spot.storey] ?? ''),
    spot === undefined
      ? undefined
      : said.heading(tender.titles[spot.title]?.label ?? ''),
  ]
    .filter(Boolean)
    .join(', ')
  const { wall } = layout
  /** Half the size of the mark, in drawing units. */
  const mark = 24
  // The mark stays inside the picture for a window at its edge.
  const x = Math.min(
    Math.max(pane.x + pane.width / 2, wall.x + mark),
    wall.x + wall.width - mark,
  )
  const y = Math.min(
    Math.max(pane.y + pane.height / 2, wall.y + mark),
    wall.y + wall.height - mark,
  )

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
        <path d={drawn.all} className="fill-glass-off" />
        <path
          d={drawn.lit}
          className="fill-glass opacity-35 transition-opacity duration-200 group-hover:opacity-60"
        />
        <path d={drawn.open} className="fill-glass-open opacity-60" />
        {/* Two hairlines that cross on the window, and the window itself,
            drawn larger than life so it can be found. */}
        <path
          d={`M${round(wall.x)} ${round(y)}H${round(x - mark)}M${round(x + mark)} ${round(y)}H${round(wall.x + wall.width)}M${round(x)} ${round(wall.y)}V${round(y - mark)}M${round(x)} ${round(y + mark)}V${round(wall.y + wall.height)}`}
          className="stroke-on-wall-2"
          strokeWidth="2.5"
          fill="none"
        />
        <rect
          x={round(x - mark + 6)}
          y={round(y - mark + 6)}
          width={round(2 * mark - 12)}
          height={round(2 * mark - 12)}
          className="fill-on-wall"
          rx="3"
        />
      </svg>
    </Link>
  )
}
