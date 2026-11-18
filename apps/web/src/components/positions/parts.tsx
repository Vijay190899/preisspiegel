/** Pieces the parts of a position page share. */
import { Link } from '@tanstack/react-router'
import type { usePace } from '~/lib/pace'
import type { ReactNode } from 'react'
import type { MatchOffer, ReferringLine, TenderDocument } from '~/lib/queries'

export const EASE = [0.22, 1, 0.36, 1] as const

export type Pace = ReturnType<typeof usePace>['pace']
export type Lamp = 'settled' | 'open' | 'caution' | 'idle'

export const lampStyle = (lamp: Lamp) =>
  ({ '--lamp': `var(--t-${lamp})` }) as React.CSSProperties

/** A value that leads to the place it was read from. */
export function Traceable({
  source,
  active,
  children,
  className = '',
}: {
  source: string
  active: string | undefined
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      to="."
      search={(previous) => ({ ...previous, quelle: source })}
      replace
      resetScroll={false}
      aria-current={active === source ? 'true' : undefined}
      activeProps={{}}
      className={`traceable ${className}`}
    >
      {children}
    </Link>
  )
}

/** What a supplier charges for one unit, whatever quantity the price is for. */
export function perUnit(line: ReferringLine): number | null {
  return line.unitPrice === null ? null : line.unitPrice / line.priceBasis
}

/** One offer as the page shows it: the line, and what a run made of it. */
export interface Shown {
  supplier: TenderDocument
  line: ReferringLine
  /** What a run found, once there has been one. */
  offer: MatchOffer | null
  /** The price for one unit of the tender, where it can be worked out. */
  unitPrice: number | null
  /** A further line of the same supplier for this position. */
  second: boolean
}

/** A sentence with some of its figures set strong. */
export function strong(
  text: string,
  figures: ReadonlyArray<string>,
): ReactNode {
  const figure = figures.find((candidate) => text.includes(candidate))
  if (figure === undefined) return text
  const at = text.lastIndexOf(figure)
  return (
    <>
      {text.slice(0, at)}
      <b className="whitespace-nowrap">{figure}</b>
      {text.slice(at + figure.length)}
    </>
  )
}
