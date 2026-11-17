import NumberFlow from '@number-flow/react'
import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { formatDate, formatQty } from '~/lib/format'
import { positionsNoun, positionsText, useT } from '~/lib/i18n'
import { usePace } from '~/lib/pace'
import { offers, tenderDocument } from '~/lib/queries'
import { PLAN, layoutPlan, openContact } from '~/lib/schematic'
import type { Transition } from 'motion/react'
import type { Tender, TenderDocument } from '~/lib/queries'
import type { Plan, PlanFeeder } from '~/lib/schematic'

/** Where a switch's gap sits on its wire. */
const INCOMER_GAP = { from: PLAN.incomerTop + 54, to: PLAN.incomerTop + 84 }
const FEEDER_GAP = {
  from: PLAN.busbarY + PLAN.busbarThickness + 22,
  to: PLAN.busbarY + PLAN.busbarThickness + 50,
}

/** When each part switches on, in seconds from load. One sequence, then still. */
const TIMING = {
  incomer: (index: number) => 0.15 + index * 0.12,
  busbar: 0.7,
  feeder: (index: number) => 1.1 + index * 0.055,
}

const EASE = [0.22, 1, 0.36, 1] as const
const SPRING = { type: 'spring', stiffness: 380, damping: 22 } as const

type Pace = (transition: Transition) => Transition

/**
 * The tender as a single-line diagram. The suppliers' offers come in from
 * above, the Leistungsverzeichnis is the busbar they feed, and each of its
 * titles goes out below through a switch. The bar hanging from a feeder is
 * as long as the title has positions.
 */
export function Schematic({
  tender,
  statuses = null,
}: {
  tender: Tender
  /** One letter per position, once a run has decided them. */
  statuses?: string | null
}) {
  const t = useT()
  const { still, pace } = usePace()
  const suppliers = offers(tender)
  const plan = layoutPlan(
    tender.titles,
    suppliers.map((supplier) => supplier.key),
    statuses,
  )
  const decided = statuses !== null
  const [pointed, setPointed] = useState<number | null>(null)
  const feeder = pointed === null ? undefined : plan.feeders[pointed]

  return (
    <figure aria-label={t('plan.label')}>
      {/* Wide screens: the drawing. */}
      <div className="relative hidden lg:block">
        <svg
          viewBox={`0 0 ${plan.width} ${plan.height}`}
          className="block w-full overflow-visible"
          role="group"
          aria-label={t('plan.label')}
        >
          <defs>
            <linearGradient id="plan-busbar" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0"
                style={{ stopColor: 'var(--t-copper-bright)' }}
              />
              <stop offset="0.55" style={{ stopColor: 'var(--t-copper)' }} />
              <stop offset="1" style={{ stopColor: 'var(--t-copper-ink)' }} />
            </linearGradient>
            <linearGradient id="plan-load" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: 'var(--t-copper)' }} />
              <stop
                offset="1"
                style={{ stopColor: 'var(--t-copper-bright)' }}
              />
            </linearGradient>
            <linearGradient id="plan-sheen" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="white" stopOpacity="0" />
              <stop offset="0.5" stopColor="white" stopOpacity="0.7" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <clipPath id="plan-busbar-shape">
              <rect
                x={plan.busbar.x1}
                y={plan.busbar.y}
                width={plan.busbar.x2 - plan.busbar.x1}
                height={plan.busbar.thickness}
                rx={3}
              />
            </clipPath>
          </defs>

          {suppliers.map((supplier, index) => (
            <Incomer
              key={supplier.key}
              supplier={supplier}
              x={plan.incomers[index]?.x ?? 0}
              room={plan.incomerRoom}
              delay={TIMING.incomer(index)}
              pace={pace}
            />
          ))}

          <Busbar tender={tender} plan={plan} still={still} pace={pace} />

          {plan.feeders.map((entry, index) => (
            <Feeder
              key={entry.rno}
              feeder={entry}
              plan={plan}
              delay={TIMING.feeder(index)}
              still={still}
              pace={pace}
              pointed={pointed === index}
              dimmed={pointed !== null && pointed !== index}
              onPoint={(on) => setPointed(on ? index : null)}
            />
          ))}
        </svg>

        {/* What the pointed-at feeder is, in words, right under it. */}
        <AnimatePresence>
          {feeder !== undefined && (
            <motion.p
              key={feeder.rno}
              role="status"
              className="pointer-events-none absolute z-10 w-max max-w-[19rem] -translate-x-1/2 rounded-control border border-line bg-surface-raised px-3 py-2 text-[0.9rem] shadow-lifted"
              style={{
                left: `clamp(9.5rem, ${(feeder.x / plan.width) * 100}%, calc(100% - 9.5rem))`,
                top: `${((PLAN.barTop + feeder.bar + 52) / plan.height) * 100}%`,
              }}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={pace({ duration: 0.14 })}
            >
              <span className="font-medium">{feeder.label}</span>
              <span className="block text-ink-3">
                {positionsText(t, feeder.count)}
                {feeder.open !== null &&
                  feeder.open > 0 &&
                  `, ${t('plan.openCount', { n: formatQty(feeder.open) })}`}
              </span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Narrow screens: the same distribution, turned on its side. */}
      <NarrowPlan tender={tender} suppliers={suppliers} plan={plan} />

      {decided && (
        <ul className="mt-6 flex flex-wrap gap-x-7 gap-y-2 text-[0.92rem] text-ink-2 lg:mt-2">
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-[3px] bg-settled" />
            {t('plan.legend.settled')}
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-[3px] bg-open" />
            {t('plan.legend.open')}
          </li>
        </ul>
      )}

      <figcaption className="mt-8 max-w-[68ch] text-[0.98rem] leading-relaxed text-ink-2 lg:mt-12">
        {t('plan.read', {
          referenced: formatQty(tender.referencedPositionCount),
          total: formatQty(tender.positionCount),
          rest: formatQty(
            tender.positionCount - tender.referencedPositionCount,
          ),
        })}{' '}
        <span className="text-ink-3">{t('plan.hint')}</span>
      </figcaption>
    </figure>
  )
}

// ---------------------------------------------------------------------------
// Parts of the drawing
// ---------------------------------------------------------------------------

/**
 * A wire with a switch in it. The grey wire is always there; the copper one
 * draws over it when the part is energised, and the contact closes.
 */
function SwitchedWire({
  x,
  from,
  gap,
  to,
  delay,
  pace,
  live = false,
}: {
  x: number
  from: number
  gap: { from: number; to: number }
  to: number
  delay: number
  pace: Pace
  /** Pointed at: the conductor brightens and current runs along it. */
  live?: boolean
}) {
  const open = openContact(gap.to - gap.from)
  const upper = `M ${x} ${from} V ${gap.from}`
  const lower = `M ${x} ${gap.to} V ${to}`

  return (
    <g fill="none" strokeLinecap="round">
      <path d={`${upper} ${lower}`} strokeWidth={2} className="stroke-wire" />

      <g
        strokeWidth={2.5}
        className={`transition-colors duration-200 [filter:drop-shadow(0_0_4px_var(--t-glow))] ${
          live ? 'stroke-copper-bright' : 'stroke-copper'
        }`}
      >
        <motion.path
          d={upper}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={pace({ delay, duration: 0.26, ease: 'easeOut' })}
        />
        <motion.path
          d={lower}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={pace({
            delay: delay + 0.34,
            duration: 0.26,
            ease: 'easeOut',
          })}
        />
        {/* The moving contact: hinged below, it swings shut onto the dot. */}
        <motion.line
          x1={x}
          y1={gap.to}
          initial={{ x2: x + open.x, y2: gap.to + open.y, opacity: 0 }}
          animate={{ x2: x, y2: gap.from, opacity: 1 }}
          transition={pace({ ...SPRING, delay: delay + 0.2 })}
        />
        {/* The fixed contact the lever closes onto. */}
        <motion.circle
          cx={x}
          cy={gap.from}
          r={3}
          className="fill-bg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={pace({ delay: delay + 0.2, duration: 0.15 })}
        />
      </g>

      {live && (
        // Current, for as long as the feeder is pointed at.
        <motion.path
          d={`M ${x} ${from} V ${to}`}
          strokeWidth={2.5}
          strokeDasharray="5 34"
          className="stroke-surface-raised"
          initial={{ strokeDashoffset: 0, opacity: 0 }}
          animate={{ strokeDashoffset: -39, opacity: 0.9 }}
          transition={{
            strokeDashoffset: {
              repeat: Infinity,
              duration: 0.55,
              ease: 'linear',
            },
            opacity: { duration: 0.15 },
          }}
        />
      )}
    </g>
  )
}

function Incomer({
  supplier,
  x,
  room,
  delay,
  pace,
}: {
  supplier: TenderDocument
  x: number
  room: number
  delay: number
  pace: Pace
}) {
  const t = useT()
  const parts = [
    supplier.format.toUpperCase(),
    supplier.pageCount === null
      ? null
      : t('plan.pages', { n: supplier.pageCount }),
    t('plan.lines', { n: formatQty(supplier.lineCount) }),
  ].filter((part) => part !== null)
  const width = room - 20

  return (
    <g>
      <foreignObject
        x={x - width / 2}
        y={0}
        width={width}
        height={PLAN.incomerTop - 22}
      >
        <div className="flex h-full flex-col items-center justify-end text-center">
          <p className="max-w-full truncate text-[0.98rem] font-medium">
            {supplier.supplierName}
          </p>
          <p className="caption mt-0.5 max-w-full truncate">
            {parts.join(', ')}{' '}
            {t('plan.from', { date: formatDate(supplier.date) })}
          </p>
        </div>
      </foreignObject>

      {/* Read in: the lamp at the head of the incomer comes on. */}
      <motion.circle
        cx={x}
        cy={PLAN.incomerTop - 8}
        r={4}
        className="fill-settled [filter:drop-shadow(0_0_5px_var(--t-settled))]"
        initial={{ opacity: 0.2 }}
        animate={{ opacity: 1 }}
        transition={pace({ delay, duration: 0.25 })}
      />

      <SwitchedWire
        x={x}
        from={PLAN.incomerTop}
        gap={INCOMER_GAP}
        to={PLAN.busbarY}
        delay={delay}
        pace={pace}
      />
    </g>
  )
}

function Busbar({
  tender,
  plan,
  still,
  pace,
}: {
  tender: Tender
  plan: Plan
  still: boolean
  pace: Pace
}) {
  const t = useT()
  const { x1, x2, y, thickness } = plan.busbar
  const file = tenderDocument(tender)?.fileName

  // The total counts up while the feeders switch on, one after the other.
  const [counted, setCounted] = useState(0)
  useEffect(() => {
    const timer = setTimeout(
      () => setCounted(tender.positionCount),
      still ? 0 : TIMING.feeder(0) * 1000,
    )
    return () => clearTimeout(timer)
  }, [still, tender.positionCount])

  return (
    <g>
      <rect
        x={x1}
        y={y}
        width={x2 - x1}
        height={thickness}
        rx={3}
        className="fill-wire"
      />
      <motion.rect
        x={x1}
        y={y}
        width={x2 - x1}
        height={thickness}
        rx={3}
        fill="url(#plan-busbar)"
        className="[filter:drop-shadow(0_2px_10px_var(--t-glow))]"
        style={{ originX: 0 }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={pace({ delay: TIMING.busbar, duration: 0.5, ease: EASE })}
      />
      {/* Once it is live, light runs along the bar a single time. */}
      <g clipPath="url(#plan-busbar-shape)">
        <motion.rect
          x={x1 - 220}
          y={y}
          width={220}
          height={thickness}
          fill="url(#plan-sheen)"
          initial={{ x: 0, opacity: 0 }}
          animate={
            still ? { opacity: 0 } : { x: x2 - x1 + 220, opacity: [0, 1, 1, 0] }
          }
          transition={{
            delay: TIMING.busbar + 0.5,
            duration: 1.5,
            ease: 'easeInOut',
          }}
        />
      </g>

      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={pace({ delay: TIMING.busbar + 0.1, duration: 0.4 })}
      >
        {/* Two short lines, so the label stays clear of the first incomer. */}
        <text
          x={x1}
          y={file === undefined ? y - 12 : y - 29}
          className="fill-ink text-[14px] font-medium"
        >
          {t('plan.tender')}
        </text>
        {file !== undefined && (
          <text x={x1} y={y - 12} className="code fill-ink-3 text-[12px]">
            {file}
          </text>
        )}
        <foreignObject x={x2 - 280} y={y - 36} width={280} height={30}>
          <p className="num text-right text-[15px] font-semibold leading-[30px]">
            <NumberFlow
              value={counted}
              locales="de-DE"
              aria-hidden="true"
              transformTiming={{ duration: 900, easing: 'ease-out' }}
              spinTiming={{ duration: 900, easing: 'ease-out' }}
            />{' '}
            <span className="sr-only">{formatQty(tender.positionCount)}</span>
            {positionsNoun(t, tender.positionCount)}
          </p>
        </foreignObject>
      </motion.g>
    </g>
  )
}

function Feeder({
  feeder,
  plan,
  delay,
  still,
  pace,
  pointed,
  dimmed,
  onPoint,
}: {
  feeder: PlanFeeder
  plan: Plan
  delay: number
  still: boolean
  pace: Pace
  pointed: boolean
  dimmed: boolean
  onPoint: (on: boolean) => void
}) {
  const t = useT()
  const { x, bar } = feeder
  const half = plan.barWidth / 2
  const top = PLAN.barTop
  const slot = (plan.busbar.x2 - plan.busbar.x1) / plan.feeders.length
  const left = x - half
  const width = plan.barWidth

  // A bar hangs from its top edge: square where it is anchored, rounded at
  // the free end. Once a run has decided the positions, its end stands for
  // the ones that are open, set off by a gap.
  const hanging = (from: number, length: number, round: boolean) => {
    const radius = round ? Math.min(5, length / 2) : 0
    return `M ${left} ${from} h ${width} v ${length - radius} a ${radius} ${radius} 0 0 1 ${-radius} ${radius} h ${-(width - 2 * radius)} a ${radius} ${radius} 0 0 1 ${-radius} ${-radius} z`
  }
  const { open, barOpen } = feeder
  const settledLength =
    open === null || barOpen === 0 ? bar : bar - barOpen - PLAN.partGap
  const parts: Array<{ d: string; fill: string }> =
    open === null
      ? [{ d: hanging(top, bar, true), fill: 'url(#plan-load)' }]
      : [
          ...(barOpen < bar
            ? [
                {
                  d: hanging(top, settledLength, barOpen === 0),
                  fill: 'var(--t-settled)',
                },
              ]
            : []),
          ...(barOpen > 0
            ? [
                {
                  d: hanging(top + bar - barOpen, barOpen, true),
                  fill: 'var(--t-open)',
                },
              ]
            : []),
        ]

  return (
    <Link
      to="/positionen"
      search={{ titel: feeder.rno }}
      aria-label={t('plan.openTitle', {
        rno: feeder.rno,
        label: feeder.label,
        positions: positionsText(t, feeder.count),
      })}
      onMouseEnter={() => onPoint(true)}
      onMouseLeave={() => onPoint(false)}
      onFocus={() => onPoint(true)}
      onBlur={() => onPoint(false)}
      className="cursor-pointer outline-none [&:focus-visible_.hit]:stroke-focus"
    >
      <g
        className="transition-opacity duration-200"
        style={{ opacity: dimmed ? 0.36 : 1 }}
      >
        <SwitchedWire
          x={x}
          from={plan.busbar.y + plan.busbar.thickness}
          gap={FEEDER_GAP}
          to={top}
          delay={delay}
          pace={pace}
          live={pointed && !still}
        />

        {bar > 0 && (
          <motion.g
            className={`transition-[filter] duration-200 ${
              pointed
                ? '[filter:brightness(1.12)_drop-shadow(0_6px_14px_var(--t-glow))]'
                : ''
            }`}
            style={{ originY: 0 }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={pace({
              delay: delay + 0.42,
              duration: 0.6,
              ease: EASE,
            })}
          >
            {parts.map((part) => (
              <path key={part.fill} d={part.d} style={{ fill: part.fill }} />
            ))}
          </motion.g>
        )}

        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={pace({ delay: delay + 0.62, duration: 0.3 })}
        >
          <text
            x={x}
            y={top + bar + 22}
            textAnchor="middle"
            className="num fill-ink text-[14px] font-medium"
          >
            {formatQty(feeder.count)}
          </text>
          <text
            x={x}
            y={top + bar + 40}
            textAnchor="middle"
            className="code fill-ink-3 text-[11.5px]"
          >
            {feeder.rno}
          </text>
        </motion.g>

        {/* The whole slot answers the pointer, not just the thin wire. */}
        <rect
          x={x - slot / 2 + 3}
          y={plan.busbar.y + plan.busbar.thickness + 4}
          width={slot - 6}
          height={top + bar + 46 - (plan.busbar.y + plan.busbar.thickness)}
          rx={8}
          fill="transparent"
          strokeWidth={2}
          className="hit stroke-transparent"
        />
      </g>
    </Link>
  )
}

function NarrowPlan({
  tender,
  suppliers,
  plan,
}: {
  tender: Tender
  suppliers: Array<TenderDocument>
  plan: Plan
}) {
  const t = useT()
  const largest = Math.max(1, ...plan.feeders.map((feeder) => feeder.count))

  return (
    <div className="lg:hidden">
      <ul className="grid gap-2.5 sm:grid-cols-3">
        {suppliers.map((supplier) => (
          <li key={supplier.key} className="module px-4 py-3">
            <p className="flex items-center gap-2 font-medium">
              <span
                className="lamp"
                style={{ '--lamp': 'var(--t-settled)' } as React.CSSProperties}
              />
              <span className="truncate">{supplier.supplierName}</span>
            </p>
            <p className="caption mt-1">
              {supplier.format.toUpperCase()},{' '}
              {t('plan.lines', { n: formatQty(supplier.lineCount) })}
            </p>
          </li>
        ))}
      </ul>

      {/* The busbar, upright, with the titles going out to the right. */}
      <div className="mt-5 border-l-[5px] border-copper pl-4">
        <p className="flex items-baseline justify-between gap-3">
          <span className="font-medium">{t('plan.tender')}</span>
          <span className="num font-semibold">
            {positionsText(t, tender.positionCount)}
          </span>
        </p>
        <ol className="mt-3">
          {plan.feeders.map((feeder) => (
            <li key={feeder.rno}>
              <Link
                to="/positionen"
                search={{ titel: feeder.rno }}
                className="grid grid-cols-[1.9rem_minmax(0,1fr)_2.75rem] items-center gap-x-2 border-t border-line py-3"
              >
                <span className="code text-[0.8rem] text-ink-3">
                  {feeder.rno}
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{feeder.label}</span>
                  <span className="mt-1.5 block h-1.5 rounded-full bg-surface-sunken">
                    <span
                      className="block h-1.5 rounded-full bg-copper"
                      style={{
                        width: `${Math.max(2, (feeder.count / largest) * 100)}%`,
                      }}
                    />
                  </span>
                </span>
                <span className="num text-right text-ink-2">
                  {formatQty(feeder.count)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
