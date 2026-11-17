import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useState } from 'react'
import { findingText, reasonLabel } from '~/lib/findings'
import {
  formatMoney,
  formatQty,
  formatUnitPrice,
  unitLabel,
} from '~/lib/format'
import { useT } from '~/lib/i18n'
import { usePace } from '~/lib/pace'
import { offers } from '~/lib/queries'
import { offerSource, tenderSource } from '~/lib/sources'
import type { ReactNode } from 'react'
import type {
  Match,
  MatchOffer,
  PositionDetail,
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
  source,
  previous,
  next,
}: {
  tender: Tender
  detail: PositionDetail
  /** The decision of the last run, if there has been one. */
  match: Match | null
  source: string | undefined
  previous: string | undefined
  next: string | undefined
}) {
  const t = useT()
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
  const silent = suppliers.filter(
    (supplier) => !shown.some((entry) => entry.supplier.key === supplier.key),
  )

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

  return (
    <article className="mx-auto w-full max-w-[680px] px-5 pb-20 pt-5 sm:px-8 lg:pt-8">
      <motion.header {...arrive(0)}>
        <div className="flex items-center justify-between gap-4">
          <p className="caption min-w-0 truncate">
            {title !== undefined && (
              <Link
                to="/positionen"
                search={{ titel: title.rno }}
                className="transition-colors duration-150 hover:text-ink"
              >
                {title.label}
              </Link>
            )}
            {subtitle !== undefined && (
              <>
                <span aria-hidden="true" className="mx-1.5 text-line-strong">
                  /
                </span>
                {subtitle.label}
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

        <p className="code mt-7 text-[0.95rem] text-copper-ink">
          {position.oz}
        </p>
        <h1 className="heading mt-2 text-[clamp(1.55rem,2.6vw,2.1rem)]">
          {position.shortText}
        </h1>
      </motion.header>

      <motion.div
        {...arrive(1)}
        className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1"
      >
        <p className="text-[1.9rem] leading-none">
          <Traceable
            source={tenderSource('qty')}
            active={source}
            className="num font-medium"
          >
            {formatQty(position.qty)}
          </Traceable>
          <span className="ml-2 text-[1.15rem] text-ink-2">
            {unitLabel(position.unit)}
          </span>
        </p>
        <p className="caption">{t('pos.quantity')}</p>
      </motion.div>

      {match !== null && (
        <motion.div {...arrive(2)} className="mt-7">
          <Decision
            match={match}
            unit={unitLabel(position.unit)}
            supplier={
              match.best === null
                ? undefined
                : (supplierOf(match.best.supplierKey)?.supplierName ??
                  undefined)
            }
          />
        </motion.div>
      )}

      <motion.div {...arrive(3)} className="mt-7">
        <Description text={position.longText} />
        <p className="mt-3 text-[0.92rem]">
          <Traceable
            source={tenderSource('text')}
            active={source}
            className="text-ink-2"
          >
            {t('pos.source')}
          </Traceable>
        </p>
      </motion.div>

      <motion.section {...arrive(4)} className="mt-12">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="heading text-[1.2rem]">{t('pos.offers')}</h2>
          <p className="caption">{t('pos.offersHint')}</p>
        </div>

        <div className="module divide-y divide-line overflow-hidden">
          {shown.map((entry) => (
            <OfferRow
              key={`${entry.line.supplierKey}.${entry.line.seq}`}
              shown={entry}
              chosen={
                entry.offer !== null && match?.best?.id === entry.offer.id
              }
              tenderUnit={position.unit}
              share={
                compare && entry.unitPrice !== null
                  ? entry.unitPrice / highest
                  : undefined
              }
              source={source}
              pace={pace}
            />
          ))}
          {silent.map((supplier) => (
            <Unanswered
              key={supplier.key}
              offer={supplier}
              afterRun={match !== null}
            />
          ))}
        </div>
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

  return (
    <div
      className={`rounded-module border px-4 py-3.5 sm:px-5 ${
        review ? 'border-open/35 bg-open-soft' : 'border-line bg-surface'
      }`}
    >
      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 font-medium">
        <span className="lamp" style={lampStyle(review ? 'open' : 'settled')} />
        {t(review ? 'decision.review' : 'decision.auto')}
        {review &&
          match.reasons.map((reason) => (
            <span
              key={reason}
              className="rounded-full border border-open/40 px-2.5 py-0.5 text-[0.84rem] font-medium text-open-ink"
            >
              {t(reasonLabel(reason))}
            </span>
          ))}
      </p>
      {body !== '' && (
        <p className="num mt-1.5 max-w-[60ch] leading-snug text-ink-2">
          {body}
        </p>
      )}
      {match.noted.length > 0 && (
        <p className="caption mt-2">
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
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 px-4 py-4 sm:px-5">
      <span className="lamp translate-y-[-1px]" />
      <div className="min-w-0">
        <p className="truncate text-ink-2">{offer.supplierName}</p>
        <p className="mt-0.5 text-[0.92rem] text-ink-3">
          {/* Before a run, a supplier that quotes by article shows nothing
              here yet; after one, nothing means it did not offer this. */}
          {t(
            afterRun || offer.referenceCount > 0
              ? 'offer.noLine'
              : 'offer.noRefs',
          )}
        </p>
      </div>
    </div>
  )
}

function OfferRow({
  shown,
  chosen,
  tenderUnit,
  share,
  source,
  pace,
}: {
  shown: Shown
  /** The offer the position is priced with. */
  chosen: boolean
  tenderUnit: string
  /** This price as a share of the highest one offered, if there are several. */
  share: number | undefined
  source: string | undefined
  pace: Pace
}) {
  const t = useT()
  const details = useId()
  const { supplier, line, offer, second } = shown
  const name = (field: OfferField) =>
    offerSource(line.supplierKey, line.seq, field)

  // A number traced from inside the details opens them; the price and the
  // wording in the row itself are in view either way.
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
  const lamp: Lamp =
    offer === null
      ? second
        ? 'caution'
        : 'settled'
      : flagged
        ? 'open'
        : 'settled'

  return (
    <div className={flagged ? 'bg-open-soft/40' : ''}>
      <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-4 transition-colors duration-150 hover:bg-ink/[0.03] sm:px-5">
        <span className="lamp" style={lampStyle(lamp)} />

        <div className="min-w-0">
          {/* The whole row opens the details; the links in it stay links. */}
          <button
            type="button"
            onClick={() => setPicked(!open)}
            aria-expanded={open}
            aria-controls={details}
            aria-label={`${supplier.supplierName}: ${t(open ? 'offer.hide' : 'offer.show')}`}
            className="block max-w-full truncate text-left font-medium outline-none after:absolute after:inset-0 focus-visible:after:rounded-[inherit] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
          >
            {second ? t('offer.second') : supplier.supplierName}
          </button>

          {ownWording ? (
            // What the supplier wrote: one line, and all of it once open.
            <p
              className={`relative z-[1] mt-0.5 w-fit max-w-full text-[0.92rem] text-ink-2 ${
                open ? '' : 'truncate'
              }`}
            >
              <Traceable source={name('text')} active={source}>
                {line.text}
              </Traceable>
            </p>
          ) : (
            <p className="mt-0.5 truncate text-[0.92rem] text-ink-3">
              {hasArticle
                ? `${t('offer.articleNo')} ${line.articleNo}`
                : supplier.fileName}
            </p>
          )}

          {chosen && (
            <p className="mt-1.5 flex items-center gap-2 text-[0.86rem] font-medium text-copper-ink">
              <span className="h-[3px] w-4 rounded-full bg-copper" />
              {t('offer.chosen')}
            </p>
          )}
          {offer === null && line.alternative && (
            <p className="mt-1.5 flex items-center gap-2 text-[0.86rem] text-ink-2">
              <span className="lamp" style={lampStyle('caution')} />
              {t('offer.alternative')}
            </p>
          )}
        </div>

        <div className="relative z-[1] text-right">
          {line.unitPrice !== null && (
            <>
              <p className="whitespace-nowrap leading-tight">
                <Traceable
                  source={name('unitPrice')}
                  active={source}
                  className="num text-[1.3rem] font-medium"
                >
                  {formatMoney(line.unitPrice)}
                </Traceable>
                <span className="ml-1.5 text-ink-3">€</span>
              </p>
              <p className="caption num mt-0.5 whitespace-nowrap">
                {t('offer.per')}{' '}
                {line.priceBasis !== 1 && `${formatQty(line.priceBasis)} `}
                {unit}
              </p>
            </>
          )}
        </div>

        <ChevronDown
          size={17}
          aria-hidden
          className={`text-ink-3 transition-transform duration-300 ease-arrive ${
            open ? 'rotate-180' : ''
          }`}
        />

        {flagged && (
          // What was found, in words, with the arithmetic where there is one.
          <ul className="col-span-full mt-3 grid gap-2 pl-[1.35rem]">
            {findings.map((finding, index) => {
              const said = findingText(t, finding)
              return (
                <li key={index} className="text-[0.95rem] leading-snug">
                  <span className="font-medium text-open-ink">
                    {t(reasonLabel(finding.code))}.
                  </span>{' '}
                  <span className="num">{said.text}</span>
                  {said.arithmetic !== undefined && (
                    <span className="code mt-1 block text-[0.84rem] text-ink-2">
                      {said.arithmetic}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {share !== undefined && (
          // The Preisspiegel itself: each price as a length, side by side.
          <span className="col-span-full mt-3.5 block h-[3px] rounded-full bg-surface-sunken">
            <motion.span
              className={`block h-full origin-left rounded-full ${
                chosen ? 'bg-copper' : 'bg-ink-3'
              }`}
              style={{ width: `${Math.max(1.5, share * 100)}%` }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={pace({ delay: 0.3, duration: 0.7, ease: EASE })}
            />
          </span>
        )}
      </div>

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
            <div className="px-4 pb-5 pl-[2.35rem] sm:px-5 sm:pl-[2.6rem]">
              <dl className="mt-1 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
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
                    unit: unitLabel(tenderUnit),
                  })}
                </p>
              )}

              {offer !== null && <Evidence offer={offer} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** What was compared to tell that the line is, or is not, what was asked for. */
function Evidence({ offer }: { offer: MatchOffer }) {
  const t = useT()
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
      <ul className="mt-1.5 grid gap-1 text-[0.92rem] text-ink-2">
        {offer.pairs.map((pair, index) => (
          <li key={index} className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-ink-3">{pair.attribute}</span>
            <span className="num">{pair.tender.value}</span>
            <span aria-hidden="true" className="text-ink-3">
              {pair.agrees ? '=' : '≠'}
            </span>
            <span className="num">{pair.offer.value}</span>
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
      <dd className="mt-1 whitespace-nowrap text-[1.02rem]">{children}</dd>
    </div>
  )
}
