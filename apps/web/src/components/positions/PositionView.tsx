import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useState } from 'react'
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
import type { OfferField } from '~/lib/sources'
import type {
  PositionDetail,
  ReferringLine,
  Tender,
  TenderDocument,
} from '~/lib/queries'
import type { ReactNode } from 'react'

const EASE = [0.22, 1, 0.36, 1] as const

type Pace = ReturnType<typeof usePace>['pace']

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

/**
 * One position: what the tender asks for, and under it what each supplier
 * offers, one row per offer.
 */
export function PositionView({
  tender,
  detail,
  source,
  previous,
  next,
}: {
  tender: Tender
  detail: PositionDetail
  source: string | undefined
  previous: string | undefined
  next: string | undefined
}) {
  const t = useT()
  const { pace } = usePace()
  const { position, referring } = detail
  const [title, subtitle] = position.path

  // Prices are only compared when they are for the same unit: a ring of cable
  // and a metre of it are not.
  const comparable = (line: ReferringLine) =>
    unitLabel(line.unit ?? position.unit) === unitLabel(position.unit)
  const prices = referring
    .filter(comparable)
    .map(perUnit)
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

      <motion.div {...arrive(2)} className="mt-7">
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

      <motion.section {...arrive(3)} className="mt-12">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="heading text-[1.2rem]">{t('pos.offers')}</h2>
          <p className="caption">{t('pos.offersHint')}</p>
        </div>

        <div className="module divide-y divide-line overflow-hidden">
          {offers(tender).map((offer) => {
            const lines = referring.filter(
              (line) => line.supplierKey === offer.key,
            )
            return lines.length === 0 ? (
              <Unanswered key={offer.key} offer={offer} />
            ) : (
              lines.map((line, index) => {
                const price = perUnit(line)
                return (
                  <OfferRow
                    key={`${offer.key}.${line.seq}`}
                    offer={offer}
                    line={line}
                    second={index > 0}
                    tenderUnit={position.unit}
                    share={
                      compare && price !== null && comparable(line)
                        ? price / highest
                        : undefined
                    }
                    source={source}
                    pace={pace}
                  />
                )
              })
            )
          })}
        </div>
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
      search={(previous) => ({ titel: previous.titel })}
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

/** A supplier with no line for this position. */
function Unanswered({ offer }: { offer: TenderDocument }) {
  const t = useT()
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 px-4 py-4 sm:px-5">
      <span className="lamp translate-y-[-1px]" />
      <div className="min-w-0">
        <p className="truncate text-ink-2">{offer.supplierName}</p>
        <p className="mt-0.5 text-[0.92rem] text-ink-3">
          {/* Some suppliers quote by article and give no ordinal numbers. */}
          {t(offer.referenceCount > 0 ? 'offer.noLine' : 'offer.noRefs')}
        </p>
      </div>
    </div>
  )
}

function OfferRow({
  offer,
  line,
  second,
  tenderUnit,
  share,
  source,
  pace,
}: {
  offer: TenderDocument
  line: ReferringLine
  /** A further line of the same supplier for the same position. */
  second: boolean
  tenderUnit: string
  /** This price as a share of the highest one offered, if there are several. */
  share: number | undefined
  source: string | undefined
  pace: Pace
}) {
  const t = useT()
  const details = useId()
  const name = (field: OfferField) =>
    offerSource(line.supplierKey, line.seq, field)

  // A number traced from inside the details opens them; the price in the
  // row itself is in view either way.
  const traced =
    source !== undefined &&
    source.startsWith(`${line.supplierKey}.${line.seq}.`) &&
    source !== name('unitPrice')
  const [chosen, setChosen] = useState<boolean | null>(null)
  const open = chosen ?? traced

  const unit = unitLabel(line.unit ?? tenderUnit)
  const price = perUnit(line)
  // A supplier that answers in GAEB repeats the tender's own text.
  const ownWording = line.sources.text?.kind === 'pdf'
  const hasArticle = line.articleNo !== null && line.articleNo !== ''

  return (
    <div>
      <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-4 transition-colors duration-150 hover:bg-ink/[0.03] sm:px-5">
        <span
          className="lamp"
          style={
            {
              '--lamp': second ? 'var(--t-caution)' : 'var(--t-settled)',
            } as React.CSSProperties
          }
        />

        <div className="min-w-0">
          {/* The whole row opens the details; the links in it stay links. */}
          <button
            type="button"
            onClick={() => setChosen(!open)}
            aria-expanded={open}
            aria-controls={details}
            aria-label={`${offer.supplierName}: ${t(open ? 'offer.hide' : 'offer.show')}`}
            className="block max-w-full truncate text-left font-medium outline-none after:absolute after:inset-0 focus-visible:after:rounded-[inherit] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
          >
            {second ? t('offer.second') : offer.supplierName}
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
                : offer.fileName}
            </p>
          )}

          {line.alternative && (
            <p className="mt-1.5 flex items-center gap-2 text-[0.86rem] text-ink-2">
              <span
                className="lamp"
                style={{ '--lamp': 'var(--t-caution)' } as React.CSSProperties}
              />
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

        {share !== undefined && (
          // The Preisspiegel itself: each price as a length, side by side.
          <span className="col-span-full mt-3.5 block h-[3px] rounded-full bg-surface-sunken">
            <motion.span
              className="block h-full origin-left rounded-full bg-ink-3"
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

              {line.priceBasis !== 1 && price !== null && (
                <p className="caption num mt-4">
                  {t('offer.converted', {
                    price: formatUnitPrice(price),
                    unit,
                  })}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
