import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'
import { findingText, reasonLabel } from '~/lib/findings'
import {
  formatMoney,
  formatQty,
  formatUnitPrice,
  perUnitLabel,
  quoted,
  unitLabel,
} from '~/lib/format'
import { useT } from '~/lib/i18n'
import { usePace } from '~/lib/pace'
import { offers } from '~/lib/queries'
import { offerSource, tenderSource } from '~/lib/sources'
import { useTenderText } from '~/lib/tenderText'
import { Labor } from './Labor'
import { Locator } from './Locator'
import type { ReactNode } from 'react'
import type { Decided } from '~/lib/decisions'
import type {
  Finding,
  Match,
  MatchOffer,
  PositionDetail,
  PositionLabor,
  ReferringLine,
  Tender,
  TenderDocument,
} from '~/lib/queries'
import type { OfferField } from '~/lib/sources'

const EASE = [0.22, 1, 0.36, 1] as const

type Pace = ReturnType<typeof usePace>['pace']
type Lamp = 'settled' | 'open' | 'caution' | 'idle'

const lampStyle = (lamp: Lamp) =>
  ({ '--lamp': `var(--t-${lamp})` }) as React.CSSProperties

/** A value that leads to the place it was read from. */
function Traceable({
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
function perUnit(line: ReferringLine): number | null {
  return line.unitPrice === null ? null : line.unitPrice / line.priceBasis
}

/** One offer as the page shows it: the line, and what a run made of it. */
interface Shown {
  supplier: TenderDocument
  line: ReferringLine
  /** What a run found, once there has been one. */
  offer: MatchOffer | null
  /** The price for one unit of the tender, where it can be worked out. */
  unitPrice: number | null
  /** A further line of the same supplier for this position. */
  second: boolean
}

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

/** What a run decided about the position, and what the decision is worth. */
function Decision({
  match,
  unit,
  supplier,
}: {
  match: Match
  unit: string
  supplier: string | undefined
}) {
  const t = useT()
  const review = match.status === 'review'
  const unpriced = match.offers.some(
    (offer) => offer.findings.length > 0 && offer.unitPrice === null,
  )

  const body =
    !review && match.best !== null
      ? t('decision.auto.body', {
          supplier: supplier ?? '',
          price: formatUnitPrice(match.best.unitPrice),
          unit,
          total: formatMoney(match.materialTotal ?? 0),
        })
      : match.offers.length === 0
        ? t('decision.review.none')
        : match.atRisk !== null && match.best !== null
          ? t('decision.review.cheaper', { atRisk: formatMoney(match.atRisk) })
          : match.atRisk !== null
            ? t('decision.review.only', { atRisk: formatMoney(match.atRisk) })
            : unpriced
              ? t('decision.review.unpriced', { unit })
              : ''

  // The figures in the sentence are what it is about.
  const figures = [
    match.atRisk === null ? null : `${formatMoney(match.atRisk)} €`,
    !review && match.materialTotal !== null
      ? `${formatMoney(match.materialTotal)} €`
      : null,
  ].filter((figure): figure is string => figure !== null)

  return (
    <div>
      <p className="statement verdict">
        <span
          className="lamp mr-3 translate-y-[-0.18em]"
          style={lampStyle(review ? 'open' : 'settled')}
        />
        <b>{t(review ? 'decision.review' : 'decision.auto')}</b>
        {review && match.reasons.length > 0 && (
          <>
            {': '}
            <span className="text-open-ink">
              {match.reasons.map((reason) => t(reasonLabel(reason))).join(', ')}
            </span>
          </>
        )}
        {'. '}
        {body !== '' && <span className="num">{strong(body, figures)}</span>}
      </p>
      {match.noted.length > 0 && (
        <p className="caption mt-3">
          {t('decision.noted', {
            reasons: match.noted
              .map((reason) => t(reasonLabel(reason)))
              .join(', '),
          })}
        </p>
      )}
    </div>
  )
}

/** What the estimator decided, and the way back. */
function Settled({
  decision,
  qty,
  unit,
  supplier,
  onReopen,
}: {
  decision: Decided
  qty: number
  unit: string
  supplier: string | undefined
  onReopen: () => void
}) {
  const t = useT()
  const total = `${formatMoney(Math.round(qty * decision.unitPrice * 100) / 100)} €`
  const body = t(
    decision.offerId === null
      ? 'decision.decided.own'
      : 'decision.decided.offer',
    {
      supplier: supplier ?? '',
      price: formatUnitPrice(decision.unitPrice),
      unit,
      total,
    },
  )
  return (
    <div>
      <p className="statement verdict">
        <span
          className="lamp mr-3 translate-y-[-0.18em]"
          style={lampStyle('settled')}
        />
        <b>{t('decision.decided')}</b>
        {'. '}
        <span className="num">{strong(body, [total])}</span>
      </p>
      <button
        type="button"
        onClick={onReopen}
        className="quiet-action -ml-3.5 mt-2 !h-9 text-[0.92rem]"
      >
        {t('decision.undo')}
      </button>
    </div>
  )
}

/** A price of the estimator's own, for a position no offer settles. */
function OwnPrice({
  unit,
  onDecide,
}: {
  unit: string
  onDecide: (offerId: null, unitPrice: number) => void
}) {
  const t = useT()
  const field = useId()
  const [text, setText] = useState('')
  // Both ways of writing a decimal are accepted: 12,50 and 12.50.
  const price = Number(text.trim().replace(',', '.'))
  const valid = text.trim() !== '' && Number.isFinite(price) && price > 0

  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) onDecide(null, price)
      }}
    >
      <div>
        <label htmlFor={field} className="caption block">
          {t('decision.own.label', { unit })}
        </label>
        <input
          id={field}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="num mt-1.5 h-10 w-36 rounded-control border border-line-strong bg-surface px-3 text-[1rem] text-ink outline-none transition-colors duration-150 focus:border-focus"
        />
      </div>
      <button
        type="submit"
        disabled={!valid}
        className="flex h-10 items-center rounded-control border border-line-strong px-3 text-[0.92rem] font-medium text-ink transition-colors duration-150 hover:bg-ink/[0.06] disabled:opacity-40"
      >
        {t('decision.own.submit')}
      </button>
    </form>
  )
}

/** A sentence with some of its figures set strong. */
function strong(text: string, figures: ReadonlyArray<string>): ReactNode {
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

/** One offer in its supplier's column. */
function Offer({
  shown,
  chosen,
  taken,
  onTake,
  tenderUnit,
  tenderQty,
  share,
  source,
  pace,
}: {
  shown: Shown
  /** The offer the position is priced with. */
  chosen: boolean
  /** The estimator took this offer. */
  taken: boolean
  /** Takes this offer for the position, where that is a choice to make. */
  onTake: (() => void) | undefined
  tenderUnit: string
  tenderQty: number
  /** This price as a share of the highest one offered, if there are several. */
  share: number | undefined
  source: string | undefined
  pace: Pace
}) {
  const t = useT()
  const { attribute } = useTenderText()
  const details = useId()
  const { supplier, line, offer, second } = shown
  const name = (field: OfferField) =>
    offerSource(line.supplierKey, line.seq, field)

  // A number traced from inside the details opens them; the price and the
  // wording above them are in view either way.
  const traced =
    source !== undefined &&
    source.startsWith(`${line.supplierKey}.${line.seq}.`) &&
    source !== name('unitPrice') &&
    source !== name('text')
  const [picked, setPicked] = useState<boolean | null>(null)
  const open = picked ?? traced

  const unit = unitLabel(line.unit ?? tenderUnit)
  // A supplier that answers in GAEB repeats the tender's own text.
  const ownWording = line.sources.text?.kind === 'pdf'
  const hasArticle = line.articleNo !== null && line.articleNo !== ''
  const findings = offer?.findings ?? []
  const flagged = findings.length > 0
  // The price for one unit of the tender, where it is not the printed one.
  const converted =
    shown.unitPrice !== null &&
    line.unitPrice !== null &&
    Math.abs(shown.unitPrice - line.unitPrice) > 1e-9

  return (
    <div className="py-5">
      <p className="caption flex items-center gap-2">
        {flagged && <span className="lamp" style={lampStyle('open')} />}
        <span className="min-w-0">
          {second ? t('offer.second') : supplier.supplierName}
        </span>
      </p>

      {line.unitPrice !== null && (
        <>
          <p className="mt-3 whitespace-nowrap leading-none">
            <Traceable
              source={name('unitPrice')}
              active={source}
              className="num font-display text-[1.9rem] font-normal tracking-[-0.02em]"
            >
              {formatMoney(line.unitPrice)}
            </Traceable>
            <span className="ml-1.5 text-[1.05rem] text-ink-3">€</span>
          </p>
          <p className="caption num mt-1.5">
            {t('offer.per')}{' '}
            {line.priceBasis !== 1 && `${formatQty(line.priceBasis)} `}
            {line.priceBasis === 1
              ? perUnitLabel(line.unit ?? tenderUnit)
              : unit}
            {shown.unitPrice !== null &&
              (tenderQty !== 1 || converted) &&
              ` · ${t('offer.forAll', {
                qty: formatQty(tenderQty),
                unit: unitLabel(tenderUnit),
                total: formatMoney(
                  Math.round(tenderQty * shown.unitPrice * 100) / 100,
                ),
              })}`}
          </p>
        </>
      )}

      {share !== undefined && (
        // Each price as a length, on the same scale in every column.
        <span className="mt-4 block h-[3px] rounded-full bg-surface-sunken">
          <motion.span
            className={`block h-full origin-left rounded-full ${
              chosen ? 'bg-settled' : flagged ? 'bg-open' : 'bg-ink-3'
            }`}
            style={{ width: `${Math.max(1.5, share * 100)}%` }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={pace({ delay: 0.25, duration: 0.7, ease: EASE })}
          />
        </span>
      )}

      {ownWording ? (
        // What the supplier wrote, in the supplier's words.
        <p className="mt-4 text-[0.92rem] leading-snug text-ink-2" lang="de">
          <Traceable source={name('text')} active={source}>
            {line.text}
          </Traceable>
        </p>
      ) : (
        <p className="mt-4 text-[0.92rem] text-ink-3">
          {hasArticle
            ? `${t('offer.articleNo')} ${line.articleNo}`
            : t('offer.tenderWording')}
        </p>
      )}

      {chosen && (
        <p className="mt-3 flex items-center gap-2 text-[0.9rem] font-medium text-settled-ink">
          <span className="h-[3px] w-4 shrink-0 rounded-full bg-settled" />
          {t(taken ? 'decision.taken' : 'offer.chosen')}
        </p>
      )}
      {offer === null && (line.alternative || second) && (
        <p className="mt-3 flex items-center gap-2 text-[0.9rem] text-ink-2">
          <span className="lamp" style={lampStyle('caution')} />
          {t(line.alternative ? 'offer.alternative' : 'offer.second')}
        </p>
      )}

      {flagged && (
        // What was found, in words, drawn to scale where it is a measure.
        <ul className="mt-4 grid gap-4">
          {findings.map((finding, index) => {
            const words = findingText(t, finding, attribute)
            return (
              <li key={index} className="text-[0.95rem] leading-snug">
                <span className="font-medium text-open-ink">
                  {t(reasonLabel(finding.code))}.
                </span>{' '}
                <span className="num">{words.text}</span>
                <Gauge finding={finding} />
                {words.arithmetic !== undefined && (
                  <span className="code mt-2 block text-[0.84rem] text-ink-2">
                    {words.arithmetic}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {onTake !== undefined && (
        <button
          type="button"
          onClick={onTake}
          className="mt-4 flex h-9 items-center rounded-control border border-line-strong px-3 text-[0.9rem] font-medium text-ink transition-colors duration-150 hover:border-ink-3 hover:bg-ink/[0.06]"
        >
          {t('decision.take')}
        </button>
      )}

      <button
        type="button"
        onClick={() => setPicked(!open)}
        aria-expanded={open}
        aria-controls={details}
        aria-label={`${supplier.supplierName}: ${t(open ? 'offer.hide' : 'offer.show')}`}
        className="-ml-2 mt-4 flex h-9 items-center gap-1.5 rounded-control px-2 text-[0.9rem] text-ink-2 transition-colors duration-150 hover:bg-ink/[0.07] hover:text-ink"
      >
        {t('offer.details')}
        <ChevronDown
          size={16}
          aria-hidden
          className={`transition-transform duration-300 ease-arrive ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={details}
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={pace({ duration: 0.32, ease: EASE })}
          >
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 pt-3">
              {line.qty !== null && (
                <Fact label={t('offer.qty')}>
                  <Traceable
                    source={name('qty')}
                    active={source}
                    className="num"
                  >
                    {formatQty(line.qty)}
                  </Traceable>{' '}
                  <span className="text-ink-3">{unit}</span>
                </Fact>
              )}
              {line.listPrice !== null && (
                <Fact label={t('offer.list')}>
                  <Traceable
                    source={name('listPrice')}
                    active={source}
                    className="num"
                  >
                    {formatMoney(line.listPrice)}
                  </Traceable>
                </Fact>
              )}
              {line.discountPct !== null && (
                <Fact label={t('offer.discount')}>
                  <Traceable
                    source={name('discountPct')}
                    active={source}
                    className="num"
                  >
                    {formatQty(line.discountPct)}
                  </Traceable>{' '}
                  <span className="text-ink-3">%</span>
                </Fact>
              )}
              {line.total !== null && (
                <Fact label={t('offer.total')}>
                  <Traceable
                    source={name('total')}
                    active={source}
                    className="num"
                  >
                    {formatMoney(line.total)}
                  </Traceable>{' '}
                  <span className="text-ink-3">€</span>
                </Fact>
              )}
              {hasArticle && (
                <Fact label={t('offer.articleNo')} wide>
                  <Traceable
                    source={name('articleNo')}
                    active={source}
                    className="code text-[0.92rem]"
                  >
                    {line.articleNo}
                  </Traceable>
                </Fact>
              )}
            </dl>

            {converted && shown.unitPrice !== null && (
              <p className="caption num mt-4">
                {t('offer.converted', {
                  price: formatUnitPrice(shown.unitPrice),
                  unit: perUnitLabel(tenderUnit),
                })}
              </p>
            )}

            {offer !== null && <Evidence offer={offer} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const measure = (value: number) =>
  formatQty(
    Math.abs(value) >= 20 ? Math.round(value) : Math.round(value * 10) / 10,
  )

/**
 * What was asked for and what is offered, as two lengths on one scale. Only
 * drawn where the checks compared the two as measures in the same unit.
 */
function Gauge({ finding }: { finding: Finding }) {
  const t = useT()
  const { askedValue, offeredValue, scaleUnit } = finding.detail
  if (
    typeof askedValue !== 'number' ||
    typeof offeredValue !== 'number' ||
    typeof scaleUnit !== 'string' ||
    askedValue <= 0 ||
    offeredValue <= 0
  ) {
    return null
  }
  const full = Math.max(askedValue, offeredValue)
  const gap = offeredValue - askedValue
  const rows = [
    { label: t('gauge.asked'), value: askedValue, tone: 'bg-ink-3' },
    { label: t('gauge.offered'), value: offeredValue, tone: 'bg-open' },
  ]

  return (
    <span className="mt-3 block">
      <span className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-[0.86rem]">
        {rows.map((row) => (
          <span key={row.label} className="contents">
            <span className="text-ink-3">{row.label}</span>
            <span className="block h-2 rounded-[2px] bg-surface-sunken">
              <span
                className={`block h-full rounded-[2px] ${row.tone}`}
                style={{ width: `${(row.value / full) * 100}%` }}
              />
            </span>
            <span className="num text-right text-ink">
              {measure(row.value)} {scaleUnit}
            </span>
          </span>
        ))}
      </span>
      {Math.abs(gap) >= 0.05 && (
        <span className="num mt-1.5 block text-[0.86rem] text-ink-2">
          {t(gap < 0 ? 'gauge.less' : 'gauge.more', {
            gap: measure(Math.abs(gap)),
            unit: scaleUnit,
          })}
        </span>
      )}
    </span>
  )
}

/** What was compared to tell that the line is, or is not, what was asked for. */
function Evidence({ offer }: { offer: MatchOffer }) {
  const t = useT()
  const { attribute } = useTenderText()
  const note =
    offer.by === 'code' && offer.pairs.length === 0 && offer.referenced
      ? t('offer.sameText')
      : offer.by === 'code' &&
          !offer.referenced &&
          offer.verdict === 'confirmed'
        ? t('offer.byQuantity')
        : null
  if (offer.pairs.length === 0 && note === null) return null

  return (
    <div className="mt-5">
      <p className="caption">{t('offer.compared')}</p>
      <ul className="mt-2 grid gap-2.5 text-[0.92rem] text-ink-2">
        {offer.pairs.map((pair, index) => (
          <li key={index}>
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-ink-3">{attribute(pair.attribute)}</span>
              <span className="num text-ink">{pair.tender.value}</span>
              <span aria-hidden="true" className="text-ink-3">
                {pair.agrees ? '=' : '≠'}
              </span>
              <span className="sr-only">
                {t(pair.agrees ? 'offer.agrees' : 'offer.differs')}
              </span>
              <span className="num text-ink">{pair.offer.value}</span>
            </span>
            {/* The words each value was read from, as they stand in the files. */}
            <span
              className="mt-0.5 block text-[0.84rem] leading-snug text-ink-3"
              lang="de"
            >
              {quoted(pair.tender.quote)} · {quoted(pair.offer.quote)}
            </span>
          </li>
        ))}
        {note !== null && <li>{note}</li>}
      </ul>
    </div>
  )
}

function Fact({
  label,
  wide = false,
  children,
}: {
  label: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="caption">{label}</dt>
      <dd className="mt-1 text-[1.02rem]">{children}</dd>
    </div>
  )
}
