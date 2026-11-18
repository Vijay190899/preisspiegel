import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BLOCK,
  TOWER,
  layoutFacade,
  outline,
  paneAt,
  paneBeside,
  paneStates,
  place,
} from '~/lib/facade'
import { formatQty } from '~/lib/format'
import { useT } from '~/lib/i18n'
import { positionsQuery } from '~/lib/queries'
import { useTenderText } from '~/lib/tenderText'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import type {
  FacadeInput,
  FacadeLayout,
  FacadeShape,
  Pane,
  PaneState,
  Step,
} from '~/lib/facade'
import type { MessageKey } from '~/lib/i18n'
import type { Tender } from '~/lib/queries'

/** How long the lights take to come on across the whole front. */
const SWEEP_MS = 1700
/** The words above arrive first. */
const LEAD_MS = 420
/** How deep the water is drawn, as a share of the building's height. */
const MIRROR = 0.62
/** Water draws the picture out: the house is taller in it than on the bank. */
const STRETCH = 1.15

const STEPS: Partial<Record<string, Step>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

const STATE_LABEL: Record<PaneState, MessageKey> = {
  priced: 'facade.state.priced',
  open: 'facade.state.open',
  read: 'facade.state.read',
  off: 'facade.state.off',
}

const round = (value: number) => Math.round(value * 100) / 100

/**
 * No two lit rooms in a real building are equally bright. This varies the
 * windows a little, the same way on every render; it says nothing about the
 * position behind the window.
 */
function brightness(index: number): number {
  const mixed = Math.imul(index + 1, 2654435761) >>> 0
  return 0.74 + ((mixed % 1000) / 1000) * 0.26
}

/**
 * The building the tender is for, seen from across the river. Every window
 * is a position: lit when it is priced, red when it needs a person, dark
 * when nobody has read it yet. A wide screen shows the long front; a narrow
 * one shows the same house standing upright.
 */
export function Facade({
  tender,
  statuses,
  reading,
  pointing = null,
}: {
  tender: Tender
  statuses: string | null
  /** How far a run that is under way has read, or `null`. */
  reading: number | null
  /** Positions to pick out, by their place in the document: the rest step back. */
  pointing?: ReadonlySet<number> | null
}) {
  const input = useMemo<FacadeInput>(
    () => ({
      titles: tender.titles,
      storeys: tender.storeys,
      storeyByPosition: tender.storeyByPosition,
    }),
    [tender.titles, tender.storeys, tender.storeyByPosition],
  )
  const states = useMemo(
    () => paneStates(tender.positionCount, statuses, reading),
    [tender.positionCount, statuses, reading],
  )
  // The house carries its name on the roof: the last word of the project's.
  const sign = tender.project.trim().split(/\s+/).at(-1) ?? ''
  const shared = { input, states, pointing, sign }

  return (
    <>
      <div className="hidden xl:block">
        <Elevation name="block" shape={BLOCK} {...shared} />
      </div>
      <div className="xl:hidden">
        <Elevation name="tower" shape={TOWER} {...shared} />
      </div>
    </>
  )
}

function Elevation({
  name,
  input,
  shape,
  states,
  pointing,
  sign,
}: {
  name: string
  input: FacadeInput
  shape: FacadeShape
  states: ReadonlyArray<PaneState>
  pointing: ReadonlySet<number> | null
  sign: string
}) {
  const t = useT()
  const said = useTenderText()
  const navigate = useNavigate()
  const frame = useRef<SVGSVGElement>(null)
  // The window pointed at, and whether a pointer, a finger or a key chose it.
  const [chosen, setChosen] = useState<{
    index: number
    by: 'pointer' | 'touch' | 'keys'
  } | null>(null)
  // The words for a window come from the list of positions, which is not
  // needed to draw the building and loads beside it.
  const { data: rows } = useQuery(positionsQuery)

  const layout = useMemo(() => layoutFacade(input, shape), [input, shape])
  const placed = useMemo(() => place(input), [input])
  const drawn = useMemo(() => {
    const lit = layout.panes.filter((pane) => states[pane.index] === 'priced')
    const open = layout.panes.filter((pane) => states[pane.index] === 'open')
    return {
      all: outline(layout.panes),
      lit: outline(lit),
      open: outline(open),
    }
  }, [layout, states])

  // How many windows on each storey need a person, top storey first.
  const openByStorey = useMemo(() => {
    const counts = new Map<number, number>()
    for (const item of placed) {
      if (states[item.index] !== 'open') continue
      counts.set(item.storey, (counts.get(item.storey) ?? 0) + 1)
    }
    return counts
  }, [placed, states])

  const total = layout.panes.length
  // The lights cross the front once. A window that changes later, because
  // a run moved on or a position was decided, comes on without waiting.
  const up = useRef(false)
  useEffect(() => {
    up.current = true
  }, [])
  const { wall } = layout
  const base = layout.height
  const water = base * MIRROR
  const storeyCount = input.storeys.length

  const pane = chosen === null ? undefined : layout.panes[chosen.index]
  const spot = pane === undefined ? undefined : placed[pane.index]
  const row = pane === undefined ? undefined : rows?.[pane.index]
  const state = pane === undefined ? undefined : states[pane.index]

  const under = (event: PointerEvent<SVGSVGElement>): Pane | null => {
    const svg = frame.current
    if (svg === null) return null
    const box = svg.getBoundingClientRect()
    const scale = layout.width / box.width
    return paneAt(
      layout,
      (event.clientX - box.left) * scale,
      (event.clientY - box.top) * scale,
      event.pointerType === 'touch' ? 5 : 2.5,
    )
  }

  const open = (index: number) => {
    const oz = rows?.[index]?.oz
    if (oz === undefined) return
    void navigate({ to: '/positionen/$oz', params: { oz } })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEPS[event.key]
    if (step !== undefined) {
      event.preventDefault()
      const from = pane ?? layout.panes.find((p) => states[p.index] === 'open')
      const next =
        pane === undefined
          ? (from ?? layout.panes[0])
          : paneBeside(layout, pane, step)
      if (next !== undefined && next !== null) {
        setChosen({ index: next.index, by: 'keys' })
      }
      return
    }
    if ((event.key === 'Enter' || event.key === ' ') && pane !== undefined) {
      event.preventDefault()
      open(pane.index)
    }
    if (event.key === 'Escape') setChosen(null)
  }

  const where =
    spot === undefined
      ? ''
      : [
          spot.storey < 0
            ? t('facade.house')
            : said.storey(input.storeys[spot.storey] ?? ''),
          said.heading(input.titles[spot.title]?.label ?? ''),
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <div>
      <div className="relative">
        <Shore />
        <div className="relative mx-auto w-full max-w-[1320px] px-4 sm:px-8">
          <div
            role="application"
            tabIndex={0}
            aria-label={t('facade.label', {
              total: formatQty(total),
              priced: formatQty(states.filter((s) => s === 'priced').length),
              open: formatQty(states.filter((s) => s === 'open').length),
            })}
            aria-describedby={`${name}-hint`}
            onKeyDown={onKeyDown}
            onFocus={(event) => {
              // A click focuses too; only a key should place the marker.
              if (!event.currentTarget.matches(':focus-visible')) return
              if (chosen !== null) return
              const first =
                layout.panes.find((p) => states[p.index] === 'open') ??
                layout.panes[0]
              if (first !== undefined) {
                setChosen({ index: first.index, by: 'keys' })
              }
            }}
            onBlur={(event) => {
              if (event.currentTarget.contains(event.relatedTarget)) return
              setChosen(null)
            }}
            className={`relative mx-auto rounded-[6px] outline-offset-8 ${
              shape.columns === null ? '' : 'max-w-[26rem]'
            }`}
          >
            <svg
              ref={frame}
              viewBox={`0 0 ${round(layout.width)} ${round(base)}`}
              className="front block w-full select-none overflow-visible"
              data-pointing={pointing !== null}
              style={{ cursor: pane === undefined ? 'default' : 'pointer' }}
              aria-hidden="true"
              onPointerMove={(event) => {
                if (event.pointerType === 'touch') return
                const hit = under(event)
                // Only a move onto another window is news.
                setChosen((before) =>
                  hit === null
                    ? before === null || before.by === 'keys'
                      ? before
                      : null
                    : before?.index === hit.index && before.by === 'pointer'
                      ? before
                      : { index: hit.index, by: 'pointer' },
                )
              }}
              onPointerLeave={(event) => {
                if (event.pointerType !== 'touch') setChosen(null)
              }}
              onClick={(event) => {
                const hit = under(
                  event as unknown as PointerEvent<SVGSVGElement>,
                )
                const touch =
                  (event.nativeEvent as globalThis.PointerEvent).pointerType ===
                  'touch'
                if (hit === null) {
                  setChosen(null)
                  return
                }
                // A finger first asks what a window is; a pointer has already
                // been told by hovering.
                if (touch && chosen?.index !== hit.index) {
                  setChosen({ index: hit.index, by: 'touch' })
                  return
                }
                open(hit.index)
              }}
            >
              <defs>
                <filter
                  id={`${name}-halo`}
                  x="-4%"
                  y="-12%"
                  width="108%"
                  height="124%"
                >
                  <feGaussianBlur stdDeviation="3.4" />
                </filter>
              </defs>

              <Roof wall={wall} room={shape.headRoom} sign={sign} />

              {/* The wall, its roof edge and the floors. */}
              <rect
                x={round(wall.x)}
                y={round(wall.y)}
                width={round(wall.width)}
                height={round(wall.height)}
                className="fill-wall"
              />
              {/* The roof edge stands out a little over the front. */}
              <path
                d={`M${round(wall.x - 5)} ${round(wall.y)}h${round(wall.width + 10)}`}
                className="stroke-on-wall-2"
                strokeWidth="2"
                fill="none"
              />
              {/* Each bay carries the number of its title on the band under the roof. */}
              {layout.bays.map((bay) => (
                <text
                  key={bay.rno}
                  x={round(bay.x + bay.width / 2)}
                  y={round(wall.y + shape.parapet / 2 + 0.5)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="code fill-on-wall-2"
                  fontSize="11.5"
                >
                  {bay.rno}
                  <title>{said.heading(bay.label)}</title>
                </text>
              ))}
              {layout.slabs.map((y) => (
                <path
                  key={y}
                  d={`M${round(wall.x)} ${round(y + shape.slab / 2)}h${round(wall.width)}`}
                  className="stroke-slab"
                  strokeWidth="1"
                  fill="none"
                />
              ))}

              {/* Every window, dark. The lit ones are drawn over it. */}
              <path d={drawn.all} className="fill-glass-off" />

              {/* The light the windows throw on the wall around them. */}
              <g className="halo" filter={`url(#${name}-halo)`}>
                <path d={drawn.lit} className="fill-glass" opacity="0.5" />
                <path
                  d={drawn.open}
                  className="fill-glass-open"
                  opacity="0.75"
                />
              </g>

              {layout.panes.map((p) => {
                const s = states[p.index]
                if (s === undefined || s === 'off') return null
                const at = up.current
                  ? 0
                  : s === 'read'
                    ? (p.index % 30) * 14
                    : LEAD_MS + (p.index / total) * SWEEP_MS
                return (
                  <rect
                    key={`${p.index}${s}`}
                    className="pane"
                    data-s={s}
                    data-on={pointing?.has(p.index) === true ? '' : undefined}
                    x={round(p.x)}
                    y={round(p.y)}
                    width={round(p.width)}
                    height={round(p.height)}
                    fillOpacity={
                      s === 'open'
                        ? 1
                        : s === 'read'
                          ? 0.38
                          : round(brightness(p.index))
                    }
                    style={{ '--at': `${Math.round(at)}ms` } as CSSProperties}
                  />
                )
              })}

              {/* What the figures at the right count. */}
              {[...openByStorey.values()].some((count) => count > 0) && (
                <text
                  x={round(wall.x + wall.width + 11)}
                  y={round(wall.y - 11)}
                  dominantBaseline="central"
                  fontSize="12"
                  className="fill-open-ink"
                >
                  {t('facade.openHead')}
                </text>
              )}

              {/* Storey names on the left, what is open on each at the right. */}
              {layout.storeys.map((storey, at) => {
                const count = openByStorey.get(storeyCount - 1 - at) ?? 0
                const y = round(storey.y + storey.height / 2)
                return (
                  <g key={storey.label} fontSize="12">
                    <text
                      x={round(wall.x - 11)}
                      y={y}
                      textAnchor="end"
                      dominantBaseline="central"
                      className="fill-ink-3"
                    >
                      {said.storey(storey.label, true)}
                    </text>
                    {count > 0 && (
                      <text
                        x={round(wall.x + wall.width + 11)}
                        y={y}
                        dominantBaseline="central"
                        className="num fill-open-ink"
                      >
                        {count}
                      </text>
                    )}
                  </g>
                )
              })}
              {layout.plinth !== null && (
                <g fontSize="12">
                  <text
                    x={round(wall.x - 11)}
                    y={round(layout.plinth.y + layout.plinth.height / 2)}
                    textAnchor="end"
                    dominantBaseline="central"
                    className="fill-ink-3"
                  >
                    {t('facade.house')}
                  </text>
                  {(openByStorey.get(-1) ?? 0) > 0 && (
                    <text
                      x={round(wall.x + wall.width + 11)}
                      y={round(layout.plinth.y + layout.plinth.height / 2)}
                      dominantBaseline="central"
                      className="num fill-open-ink"
                    >
                      {openByStorey.get(-1)}
                    </text>
                  )}
                </g>
              )}

              {pane !== undefined && (
                <rect
                  x={round(pane.x - 2.5)}
                  y={round(pane.y - 2.5)}
                  width={round(pane.width + 5)}
                  height={round(pane.height + 5)}
                  rx="2"
                  fill="none"
                  strokeWidth="1.4"
                  className={
                    chosen?.by === 'keys'
                      ? 'stroke-wall-focus'
                      : 'stroke-on-wall'
                  }
                />
              )}
            </svg>

            {pane !== undefined && state !== undefined && (
              <Note
                layout={layout}
                pane={pane}
                touch={chosen?.by === 'touch'}
                oz={row?.oz}
                text={row === undefined ? undefined : said.item(row.shortText)}
                where={where}
                state={state}
              />
            )}

            <p id={`${name}-hint`} className="sr-only">
              {t('facade.hint')}
            </p>
            <p className="sr-only" aria-live="polite">
              {pane === undefined || state === undefined
                ? ''
                : [
                    row?.oz,
                    row === undefined ? undefined : said.item(row.shortText),
                    where,
                    t(STATE_LABEL[state]),
                  ]
                    .filter(Boolean)
                    .join(', ')}
            </p>
          </div>
        </div>
      </div>

      {/* The quay, and the house again in the sea. */}
      <div className="water" aria-hidden="true">
        <div className="mx-auto w-full max-w-[1320px] px-4 sm:px-8">
          <svg
            viewBox={`0 0 ${round(layout.width)} ${round(water)}`}
            className={`mx-auto block w-full overflow-visible ${
              shape.columns === null ? '' : 'max-w-[26rem]'
            }`}
          >
            <defs>
              <linearGradient id={`${name}-sink`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
                <stop offset="0.35" stopColor="#fff" stopOpacity="0.34" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              {/*
                Water breaks up what it shows: every line of the picture is
                pushed a little sideways, differently at every depth, and the
                whole is smeared downwards. The picture does not move, so this
                is worked out once.
              */}
              <filter
                id={`${name}-smear`}
                x="-3%"
                y="-5%"
                width="106%"
                height="110%"
                colorInterpolationFilters="sRGB"
              >
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.002 0.085"
                  numOctaves="2"
                  seed="11"
                  result="waves"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="waves"
                  scale="9"
                  xChannelSelector="R"
                  yChannelSelector="B"
                />
                <feGaussianBlur stdDeviation="0.4 4.5" />
              </filter>
              <mask id={`${name}-depth`}>
                <rect
                  x="-200"
                  y="0"
                  width={round(layout.width + 400)}
                  height={round(water)}
                  fill={`url(#${name}-sink)`}
                />
              </mask>
            </defs>
            <g mask={`url(#${name}-depth)`} className="mirror">
              <g
                transform={`translate(0 ${round(base * STRETCH)}) scale(1 ${-STRETCH})`}
                filter={`url(#${name}-smear)`}
              >
                <rect
                  x={round(wall.x)}
                  y={round(wall.y)}
                  width={round(wall.width)}
                  height={round(wall.height)}
                  className="fill-wall"
                />
                <path d={drawn.all} className="fill-glass-off" />
                <path d={drawn.lit} className="fill-glass" opacity="0.85" />
                <path d={drawn.open} className="fill-glass-open" />
              </g>
            </g>
            {/* Water never lies still: bands of it drift across the picture. */}
            {RIPPLES.map((ripple) => (
              <path
                key={ripple.y}
                d={`M-60 ${round(water * ripple.y)}H${round(layout.width + 60)}`}
                className="ripple stroke-water"
                strokeOpacity="0.55"
                fill="none"
                strokeWidth={ripple.width}
                strokeDasharray={ripple.dash}
                strokeLinecap="round"
                style={{ '--period': `${ripple.period}s` } as CSSProperties}
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  )
}

/**
 * Bands of still water that drift across the picture, close together near
 * the bank and wider further out.
 */
const RIPPLES = [
  { y: 0.1, width: 1, dash: '90 30 150 44 60 26', period: 11 },
  { y: 0.2, width: 1.2, dash: '140 38 80 52 190 34', period: 8 },
  { y: 0.31, width: 1.6, dash: '70 46 210 40 120 58', period: 13 },
  { y: 0.44, width: 2, dash: '180 52 100 66 150 48', period: 9 },
  { y: 0.58, width: 2.6, dash: '110 64 230 56 90 72', period: 12 },
  { y: 0.74, width: 3.2, dash: '200 78 130 70 160 84', period: 10 },
] as const

/** What a window is, shown beside it. */
function Note({
  layout,
  pane,
  touch,
  oz,
  text,
  where,
  state,
}: {
  layout: FacadeLayout
  pane: Pane
  touch: boolean
  oz: string | undefined
  text: string | undefined
  where: string
  state: PaneState
}) {
  const t = useT()
  const centre = (pane.x + pane.width / 2) / layout.width
  // Near an edge the note hangs to the inside, so it stays on the screen.
  const hang = centre < 0.22 ? 'start' : centre > 0.78 ? 'end' : 'middle'
  const below = pane.y / layout.height < 0.3
  const shift =
    hang === 'start' ? '-14px' : hang === 'end' ? 'calc(-100% + 14px)' : '-50%'

  return (
    <div
      className={`note absolute z-10 w-max max-w-[min(20rem,80vw)] ${
        touch ? '' : 'pointer-events-none'
      }`}
      style={{
        left: `${centre * 100}%`,
        top: `${((below ? pane.y + pane.height : pane.y) / layout.height) * 100}%`,
        transform: `translate(${shift}, ${below ? '12px' : 'calc(-100% - 12px)'})`,
      }}
    >
      <p className="flex items-baseline justify-between gap-5">
        <span className="code text-[0.8rem] text-ink-2">{oz ?? ''}</span>
        <span className="caption">{where}</span>
      </p>
      {text !== undefined && (
        <p className="mt-1 text-[0.95rem] font-medium leading-snug">{text}</p>
      )}
      <p className="mt-1.5 flex items-center gap-2 text-[0.85rem] text-ink-2">
        <span
          className="lamp"
          style={
            {
              '--lamp':
                state === 'open'
                  ? 'var(--t-open)'
                  : state === 'off'
                    ? 'var(--t-idle)'
                    : 'var(--t-pane)',
            } as CSSProperties
          }
        />
        {t(STATE_LABEL[state])}
      </p>
      {touch && oz !== undefined && (
        <Link
          to="/positionen/$oz"
          params={{ oz }}
          className="mt-2.5 inline-flex h-9 items-center rounded-control bg-action px-3 text-[0.9rem] font-semibold text-on-action"
        >
          {t('facade.open')}
        </Link>
      )}
    </div>
  )
}

/**
 * What stands on the roof: a storey set back from the front, the plant on
 * top of it, a mast, and the house's name in lit letters. None of it is
 * data; it is there so the front reads as a house.
 */
function Roof({
  wall,
  room,
  sign,
}: {
  wall: FacadeLayout['wall']
  room: number
  sign: string
}) {
  const top = wall.y
  // Everything is sized from the room above the roof edge.
  const attic = { x: wall.x + wall.width * 0.14, width: wall.width * 0.72 }
  const height = room * 0.36
  const atticTop = top - height
  const letters = room * 0.3
  const plant = { width: wall.width * 0.07, height: room * 0.2 }
  const mast = wall.x + wall.width * 0.93

  return (
    <g>
      {/* The mast, on the main roof. */}
      <path
        d={`M${round(mast)} ${round(top)}V${round(top - room * 0.92)}M${round(mast - 5)} ${round(top - room * 0.7)}h10M${round(mast - 3.5)} ${round(top - room * 0.56)}h7`}
        className="stroke-on-wall-2"
        strokeWidth="1.2"
        fill="none"
      />
      {/* The storey that is set back. */}
      <rect
        x={round(attic.x)}
        y={round(atticTop)}
        width={round(attic.width)}
        height={round(height)}
        className="fill-roof"
      />
      <path
        d={`M${round(attic.x - 3)} ${round(atticTop)}h${round(attic.width + 6)}`}
        className="stroke-slab"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Plant on top of it: two housings and a pair of stacks. */}
      <rect
        x={round(attic.x + attic.width * 0.7)}
        y={round(atticTop - plant.height)}
        width={round(plant.width)}
        height={round(plant.height)}
        className="fill-roof"
      />
      <rect
        x={round(attic.x + attic.width * 0.7 + plant.width + 6)}
        y={round(atticTop - plant.height * 0.6)}
        width={round(plant.width * 0.55)}
        height={round(plant.height * 0.6)}
        className="fill-roof"
      />
      <path
        d={`M${round(attic.x + attic.width * 0.93)} ${round(atticTop)}v${round(-plant.height * 1.25)}M${round(attic.x + attic.width * 0.93 + 6)} ${round(atticTop)}v${round(-plant.height * 0.95)}`}
        className="stroke-roof"
        strokeWidth="3"
        fill="none"
      />
      {/* The name, standing on the roof of that storey. */}
      <text
        x={round(attic.x + attic.width * 0.04)}
        y={round(atticTop - 2.5)}
        fontSize={round(letters)}
        letterSpacing={round(letters * 0.16)}
        className="sign"
      >
        {sign}
      </text>
    </g>
  )
}

/** One stretch of the far shore: where it starts, how wide, how high. */
const FAR_SHORE: ReadonlyArray<readonly [number, number, number]> = [
  [0, 90, 16],
  [90, 46, 30],
  [136, 70, 20],
  [206, 30, 44],
  [236, 84, 24],
  [320, 52, 34],
  [372, 120, 17],
  [492, 40, 27],
  [532, 96, 20],
  [628, 34, 38],
  [662, 130, 22],
  [792, 60, 30],
  [852, 110, 18],
  [962, 44, 40],
  [1006, 90, 25],
  [1096, 56, 33],
  [1152, 120, 19],
  [1272, 38, 46],
  [1310, 96, 24],
  [1406, 64, 31],
  [1470, 130, 18],
]

/**
 * The other side of the water: a low line of roofs along the horizon, with
 * a few lights in it by night. It runs the full width behind the house.
 */
function Shore() {
  return (
    <svg
      viewBox="0 0 1600 60"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-x-0 bottom-0 h-[60px] w-full"
      aria-hidden="true"
    >
      <path
        d={`M0 60${FAR_SHORE.map(([x, width, height]) => `V${60 - height}H${x + width}`).join('')}V60z`}
        className="fill-shore"
      />
      {FAR_SHORE.filter(([, , height]) => height > 26).map(
        ([x, width, height]) => (
          <rect
            key={x}
            x={x + width * 0.3}
            y={60 - height * 0.62}
            width="2.2"
            height="2.6"
            className="fill-shore-light"
            opacity="0.7"
          />
        ),
      )}
    </svg>
  )
}
