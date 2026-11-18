import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { formatQty, perUnitLabel, unitLabel } from '~/lib/format'
import { useT } from '~/lib/i18n'
import { usePace } from '~/lib/pace'
import { offers } from '~/lib/queries'
import { tenderSource } from '~/lib/sources'
import { useTenderText } from '~/lib/tenderText'
import { Labor } from './Labor'
import { Locator } from './Locator'
import { Decision, OwnPrice, Settled } from './Decision'
import { Offer } from './Offer'
import { EASE, Traceable, perUnit } from './parts'
import type { ReactNode } from 'react'
import type { Decided } from '~/lib/decisions'
import type {
  Match,
  MatchOffer,
  PositionDetail,
  PositionLabor,
  Tender,
  TenderDocument,
} from '~/lib/queries'
import type { Shown } from './parts'

/**
 * One position: what the tender asks for, what was decided about it, and
 * under that what each supplier offers, one row per offer.
 */
export function PositionView({
  tender,
  detail,
  match,
  labor,
  source,
  previous,
  next,
  decision,
  onDecide,
  onReopen,
}: {
  tender: Tender
  detail: PositionDetail
  /** The decision of the last run, if there has been one. */
  match: Match | null
  /** The labor of the position, if a labor pass has reached it. */
  labor: PositionLabor | null
  /** What the estimator decided about it, if anything. */
  decision: Decided | undefined
  onDecide: (offerId: string | null, unitPrice?: number) => void
  onReopen: () => void
  source: string | undefined
  previous: string | undefined
  next: string | undefined
}) {
  const t = useT()
  const said = useTenderText()
  const { pace } = usePace()
  const { position, referring } = detail
  const [title, subtitle] = position.path
  const suppliers = offers(tender)
  const supplierOf = (key: string) =>
    suppliers.find((supplier) => supplier.key === key)

  // After a run, the offers are the ones the run settled on, the chosen one
  // first. Before one, they are the lines that name the position.
  const shown: Array<Shown> = []
  if (match === null) {
    const seen = new Set<string>()
    for (const line of referring) {
      const supplier = supplierOf(line.supplierKey)
      if (supplier === undefined) continue
      const sameUnit =
        unitLabel(line.unit ?? position.unit) === unitLabel(position.unit)
      shown.push({
        supplier,
        line,
        offer: null,
        unitPrice: sameUnit ? perUnit(line) : null,
        second: seen.has(line.supplierKey),
      })
      seen.add(line.supplierKey)
    }
  } else {
    const lineOf = new Map(
      match.lines.map((line) => [`${line.supplierKey}.${line.seq}`, line]),
    )
    const rank = (offer: MatchOffer) =>
      offer.id === match.best?.id ? 0 : offer.findings.length === 0 ? 1 : 2
    const ordered = [...match.offers].sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (a.unitPrice ?? Infinity) - (b.unitPrice ?? Infinity),
    )
    for (const offer of ordered) {
      const supplier = supplierOf(offer.supplierKey)
      const line = lineOf.get(offer.id)
      if (supplier === undefined || line === undefined) continue
      shown.push({
        supplier,
        line,
        offer,
        unitPrice: offer.unitPrice,
        second: false,
      })
    }
  }
  const prices = shown
    .map((entry) => entry.unitPrice)
    .filter((price): price is number => price !== null)
  const highest = Math.max(0, ...prices)
  // A bar compares; one price alone has nothing to be compared with.
  const compare = prices.length > 1 && highest > 0

  const arrive = (order: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: pace({ delay: order * 0.05, duration: 0.42, ease: EASE }),
  })

  const needsPerson = match?.status === 'review'
  // 1, 2, 3 take the cheapest priced offer of that supplier's column; U
  // takes a decision back. The columns keep their order, so the keys do.
  const takeable = suppliers.map(
    (supplier) =>
      shown
        .filter(
          (entry) =>
            entry.supplier.key === supplier.key &&
            entry.offer !== null &&
            entry.unitPrice !== null,
        )
        .sort((a, b) => (a.unitPrice ?? 0) - (b.unitPrice ?? 0))[0]?.offer?.id,
  )
  const keys = useRef({
    takeable,
    needsPerson,
    decided: decision !== undefined,
  })
  keys.current = { takeable, needsPerson, decided: decision !== undefined }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('input, textarea, [role="dialog"]')) return
      const now = keys.current
      if (!now.needsPerson) return
      if (event.key.toLowerCase() === 'u' && now.decided) {
        event.preventDefault()
        onReopen()
        return
      }
      const column = Number(event.key) - 1
      const offerId = Number.isInteger(column)
        ? now.takeable[column]
        : undefined
      if (offerId !== undefined) {
        event.preventDefault()
        onDecide(offerId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDecide, onReopen])

  return (
    <article className="sheet mx-auto w-full max-w-[940px] px-5 pb-24 pt-5 sm:px-8 lg:pt-8">
      <motion.header {...arrive(0)}>
        <div className="flex items-center justify-between gap-4">
          <p className="caption min-w-0 truncate">
            {title !== undefined && (
              <Link
                to="/positionen"
                search={{ titel: title.rno }}
                className="transition-colors duration-150 hover:text-ink"
              >
                {said.heading(title.label)}
              </Link>
            )}
            {subtitle !== undefined && (
              <>
                <span aria-hidden="true" className="mx-1.5 text-line-strong">
                  /
                </span>
                {said.heading(subtitle.label)}
              </>
            )}
          </p>
          <nav className="flex shrink-0 items-center gap-0.5">
            <Step to={previous} label={t('pos.previous')}>
              <ChevronLeft size={18} aria-hidden />
            </Step>
            <Step to={next} label={t('pos.next')}>
              <ChevronRight size={18} aria-hidden />
            </Step>
          </nav>
        </div>

        <div className="sheet-head mt-6">
          <div className="min-w-0">
            <p className="code text-[0.95rem] text-ink-3">{position.oz}</p>
            <h1 className="display mt-2.5 text-[clamp(1.75rem,4.6cqi,2.6rem)] !leading-[1.06]">
              {said.item(position.shortText)}
            </h1>
            {said.locale !== 'de' && (
              // The item's name as the tender has it.
              <p className="caption mt-2" lang="de">
                {position.shortText}
              </p>
            )}
            <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[1.5rem] leading-none">
                <Traceable
                  source={tenderSource('qty')}
                  active={source}
                  className="num font-medium"
                >
                  {formatQty(position.qty)}
                </Traceable>
                <span className="ml-1.5 text-[1.05rem] text-ink-2">
                  {unitLabel(position.unit, position.qty)}
                </span>
              </span>
              <span className="caption">{t('pos.quantity')}</span>
            </p>
          </div>
          <Locator tender={tender} seq={position.seq} />
        </div>
      </motion.header>

      {match !== null && (
        <motion.div {...arrive(1)} className="mt-8">
          {decision === undefined ? (
            <Decision
              match={match}
              unit={perUnitLabel(position.unit)}
              supplier={
                match.best === null
                  ? undefined
                  : (supplierOf(match.best.supplierKey)?.supplierName ??
                    undefined)
              }
            />
          ) : (
            <Settled
              decision={decision}
              qty={position.qty}
              unit={perUnitLabel(position.unit)}
              supplier={
                decision.supplierKey === null
                  ? undefined
                  : (supplierOf(decision.supplierKey)?.supplierName ??
                    undefined)
              }
              onReopen={onReopen}
            />
          )}
          {needsPerson && decision === undefined && (
            <OwnPrice unit={perUnitLabel(position.unit)} onDecide={onDecide} />
          )}
        </motion.div>
      )}

      <motion.section {...arrive(2)} className="mt-10">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="heading text-[1.3rem]">{t('pos.offers')}</h2>
          <p className="caption">
            {t('pos.offersHint')}
            {needsPerson &&
              takeable.some((id) => id !== undefined) &&
              ` ${t('decision.keys', { n: suppliers.length })}`}
          </p>
        </div>

        {/* The Preisspiegel: one column per supplier, always in the same order. */}
        <div
          className="offers"
          style={{ '--columns': suppliers.length } as React.CSSProperties}
        >
          {suppliers.map((supplier) => {
            const own = shown.filter(
              (entry) => entry.supplier.key === supplier.key,
            )
            return (
              <div key={supplier.key} className="offers-column">
                {own.length === 0 ? (
                  <Unanswered offer={supplier} afterRun={match !== null} />
                ) : (
                  own.map((entry) => (
                    <Offer
                      key={`${entry.line.supplierKey}.${entry.line.seq}`}
                      shown={entry}
                      chosen={
                        entry.offer !== null &&
                        (decision === undefined
                          ? match?.best?.id === entry.offer.id
                          : decision.offerId === entry.offer.id)
                      }
                      taken={
                        entry.offer !== null &&
                        decision?.offerId === entry.offer.id
                      }
                      onTake={
                        needsPerson &&
                        entry.offer !== null &&
                        entry.unitPrice !== null &&
                        decision?.offerId !== entry.offer.id
                          ? () => onDecide(entry.offer?.id ?? null)
                          : undefined
                      }
                      tenderUnit={position.unit}
                      tenderQty={position.qty}
                      share={
                        compare && entry.unitPrice !== null
                          ? entry.unitPrice / highest
                          : undefined
                      }
                      source={source}
                      pace={pace}
                    />
                  ))
                )}
              </div>
            )
          })}
        </div>
      </motion.section>

      {labor !== null && (
        <motion.section {...arrive(3)} className="mt-12">
          <h2 className="heading text-[1.3rem]">{t('labor.title')}</h2>
          <div className="mt-3">
            <Labor labor={labor} unit={position.unit} />
          </div>
        </motion.section>
      )}

      <motion.section {...arrive(3)} className="mt-12">
        <h2 className="heading text-[1.3rem]">{t('pos.asked')}</h2>
        {said.locale !== 'de' && (
          <p className="caption mt-1">{t('pos.wording')}</p>
        )}
        <div className="mt-3" lang="de">
          <Description text={position.longText} />
        </div>
        <p className="mt-3 text-[0.92rem]">
          <Traceable
            source={tenderSource('text')}
            active={source}
            className="text-ink-2"
          >
            {t('pos.source')}
          </Traceable>
        </p>
      </motion.section>
    </article>
  )
}

function Step({
  to,
  label,
  children,
}: {
  to: string | undefined
  label: string
  children: ReactNode
}) {
  const className =
    'grid size-9 place-items-center rounded-control text-ink-2 transition-colors duration-150'
  if (to === undefined) {
    return (
      <span className={`${className} opacity-30`} aria-hidden="true">
        {children}
      </span>
    )
  }
  return (
    <Link
      to="/positionen/$oz"
      params={{ oz: to }}
      search={(previous) => ({ titel: previous.titel, offen: previous.offen })}
      aria-label={label}
      title={label}
      className={`${className} hover:bg-ink/[0.07] hover:text-ink`}
    >
      {children}
    </Link>
  )
}

/** The long text of a position: a few lines, and the rest on request. */
function Description({ text }: { text: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const paragraphs = text.split('\n').filter((part) => part.trim() !== '')
  const long = text.length > 260 || paragraphs.length > 2

  return (
    <div className="max-w-[66ch] text-[1.02rem] leading-[1.65] text-ink-2">
      {open || !long ? (
        <div className="space-y-2.5">
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      ) : (
        <p className="line-clamp-3">{paragraphs.join(' ')}</p>
      )}
      {long && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="mt-2 text-[0.92rem] font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:decoration-ink"
        >
          {t(open ? 'pos.readLess' : 'pos.readMore')}
        </button>
      )}
    </div>
  )
}

/** A supplier with no offer for this position. */
function Unanswered({
  offer,
  afterRun,
}: {
  offer: TenderDocument
  afterRun: boolean
}) {
  const t = useT()
  return (
    <div className="py-5">
      <p className="caption">{offer.supplierName}</p>
      <p className="mt-3 text-[0.95rem] text-ink-3">
        {/* Before a run, a supplier that quotes by article shows nothing
            here yet; after one, nothing means it did not offer this. */}
        {t(
          afterRun || offer.referenceCount > 0
            ? 'offer.noLine'
            : 'offer.noRefs',
        )}
      </p>
    </div>
  )
}
