import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  formatMoney,
  formatQty,
  formatUnitPrice,
  unitLabel,
} from '~/lib/format'
import { useT } from '~/lib/i18n'
import { offers } from '~/lib/queries'
import { offerSource, tenderSource } from '~/lib/sources'
import { FormatChip } from '../overview/DocumentRegister'
import type { ReactNode } from 'react'
import type {
  PositionDetail,
  ReferringLine,
  Tender,
  TenderDocument,
} from '~/lib/queries'
import type { OfferField } from '~/lib/sources'

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
      aria-pressed={active === source}
      className={`traceable ${className}`}
    >
      {children}
    </Link>
  )
}

/**
 * One position: what the tender asks for, and what each supplier offers for
 * it, side by side.
 */
export function PositionSheet({
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
  const { position, referring } = detail
  const [title, subtitle] = position.path

  return (
    <article className="mx-auto w-full max-w-[920px] px-4 py-5 sm:px-6 sm:py-7">
      <header className="sheet sheet-marked enter border-frame">
        <div className="flex items-stretch border-b border-frame/80">
          <div className="flex-1 px-4 py-3 sm:px-5">
            <p className="label mb-2">OZ</p>
            <p className="num text-[1.33rem] leading-none">{position.oz}</p>
          </div>
          <div className="border-l border-frame/80 px-4 py-3 text-right sm:px-5">
            <p className="label mb-2">{t('pos.quantity')}</p>
            <p className="text-[1.33rem] leading-none">
              <Traceable
                source={tenderSource('qty')}
                active={source}
                className="num"
              >
                {formatQty(position.qty)}
              </Traceable>{' '}
              <span className="text-[1rem] text-ink-2">
                {unitLabel(position.unit)}
              </span>
            </p>
          </div>
          <nav className="flex items-stretch border-l border-frame/80">
            <Step to={previous} label={t('pos.previous')}>
              <ChevronLeft size={18} aria-hidden />
            </Step>
            <Step to={next} label={t('pos.next')}>
              <ChevronRight size={18} aria-hidden />
            </Step>
          </nav>
        </div>

        <div className="px-4 pb-5 pt-4 sm:px-5">
          <p className="label mb-2.5 flex flex-wrap gap-x-2 gap-y-1 !normal-case !tracking-normal">
            {title !== undefined && (
              <span>
                <span className="num">{title.rno}</span> {title.label}
              </span>
            )}
            {subtitle !== undefined && (
              <>
                <span aria-hidden="true" className="text-line-strong">
                  /
                </span>
                <span>
                  <span className="num">{subtitle.rno}</span> {subtitle.label}
                </span>
              </>
            )}
          </p>
          <h1 className="text-[1.6rem] font-semibold leading-[1.18] tracking-[-0.012em] sm:text-[1.87rem]">
            {position.shortText}
          </h1>
        </div>
      </header>

      <section
        className="sheet enter mt-5 px-4 pb-5 pt-3 sm:px-5"
        style={{ '--enter-delay': '50ms' } as React.CSSProperties}
      >
        <h2 className="label mb-3 flex items-center justify-between gap-3">
          {t('pos.description')}
          <Traceable
            source={tenderSource('text')}
            active={source}
            className="num !tracking-normal text-ink-2"
          >
            {tender.documents.find((entry) => entry.kind === 'tender')
              ?.fileName ?? ''}
          </Traceable>
        </h2>
        <div className="max-w-[72ch] space-y-2.5 text-[1rem] leading-[1.65] text-ink-2">
          {position.longText.split('\n').map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section
        className="enter mt-7"
        style={{ '--enter-delay': '100ms' } as React.CSSProperties}
      >
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="text-[1.2rem] font-semibold tracking-[-0.01em]">
            {t('pos.comparison')}
          </h2>
          <p className="max-w-[52ch] text-[0.87rem] text-ink-3">
            {t('pos.comparisonHint')}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {offers(tender).map((offer, index) => (
            <OfferColumn
              key={offer.key}
              offer={offer}
              letter={String.fromCharCode(65 + index)}
              lines={referring.filter((line) => line.supplierKey === offer.key)}
              tenderUnit={position.unit}
              source={source}
            />
          ))}
        </div>
      </section>
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
    'grid w-11 place-items-center text-ink-2 transition-colors duration-150 first:border-r first:border-frame/80'
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
      className={`${className} hover:bg-surface-sunken hover:text-ink`}
    >
      {children}
    </Link>
  )
}

function OfferColumn({
  offer,
  letter,
  lines,
  tenderUnit,
  source,
}: {
  offer: TenderDocument
  letter: string
  lines: Array<ReferringLine>
  tenderUnit: string
  source: string | undefined
}) {
  const t = useT()
  // Some suppliers quote by article and give no ordinal numbers at all.
  const givesReferences = offer.referenceCount > 0

  return (
    <div className="sheet flex flex-col">
      <header className="flex items-start gap-3 border-b border-line px-4 py-3">
        <span className="num grid size-7 shrink-0 place-items-center border border-frame text-[0.87rem] font-medium">
          {letter}
        </span>
        <div className="min-w-0 flex-1">
          <p
            lang="de"
            className="hyphens-auto break-words text-[0.9rem] font-medium leading-tight"
          >
            {offer.supplierName}
          </p>
          <p className="mt-1.5">
            <FormatChip format={offer.format} />
          </p>
        </div>
      </header>

      {lines.length === 0 ? (
        <p className="px-4 py-5 text-[0.87rem] leading-relaxed text-ink-3">
          {t(givesReferences ? 'offer.noLine' : 'offer.noRefs')}
        </p>
      ) : (
        lines.map((line, index) => (
          <div key={line.seq}>
            {index > 0 && (
              <p className="label border-y border-line bg-caution-soft px-4 py-2 !normal-case !tracking-normal text-ink">
                {t('offer.second')}
              </p>
            )}
            <OfferLineBody
              line={line}
              tenderUnit={tenderUnit}
              source={source}
            />
          </div>
        ))
      )}
    </div>
  )
}

function OfferLineBody({
  line,
  tenderUnit,
  source,
}: {
  line: ReferringLine
  tenderUnit: string
  source: string | undefined
}) {
  const t = useT()
  const name = (field: OfferField) =>
    offerSource(line.supplierKey, line.seq, field)
  const perUnit =
    line.unitPrice === null ? null : line.unitPrice / line.priceBasis
  // A supplier that answers in GAEB repeats the tender's own text.
  const ownWording = line.sources.text?.kind === 'pdf'

  return (
    <div className="px-4 pb-4 pt-3">
      {ownWording && (
        <p className="text-[0.93rem] leading-snug">
          <Traceable source={name('text')} active={source}>
            {line.text}
          </Traceable>
        </p>
      )}
      {line.articleNo !== null && line.articleNo !== '' && (
        <p className="label mt-2 !normal-case !tracking-normal">
          {t('offer.articleNo')}{' '}
          <Traceable
            source={name('articleNo')}
            active={source}
            className="num text-ink-2"
          >
            {line.articleNo}
          </Traceable>
        </p>
      )}
      {line.alternative && (
        <p className="label mt-2.5 inline-block bg-caution-soft px-1.5 py-1 text-ink">
          {t('offer.alternative')}
        </p>
      )}

      <dl
        className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[0.93rem] ${
          ownWording ? 'mt-4 border-t border-line pt-3' : ''
        }`}
      >
        {line.qty !== null && (
          <Figure label={t('offer.qty')}>
            <Traceable source={name('qty')} active={source} className="num">
              {formatQty(line.qty)}
            </Traceable>{' '}
            <span className="text-ink-3">{line.unit}</span>
          </Figure>
        )}
        {line.listPrice !== null && (
          <Figure label={t('offer.list')}>
            <Traceable
              source={name('listPrice')}
              active={source}
              className="num"
            >
              {formatMoney(line.listPrice)}
            </Traceable>
            {line.discountPct !== null && (
              <span className="text-ink-3">
                {' '}
                −{' '}
                <Traceable
                  source={name('discountPct')}
                  active={source}
                  className="num"
                >
                  {formatQty(line.discountPct)}
                </Traceable>{' '}
                %
              </span>
            )}
          </Figure>
        )}
        {line.unitPrice !== null && (
          <Figure label={t('offer.price')}>
            <Traceable
              source={name('unitPrice')}
              active={source}
              className="num"
            >
              {formatMoney(line.unitPrice)}
            </Traceable>
            {line.priceBasis !== 1 && (
              <span className="whitespace-nowrap text-ink-3">
                {' '}
                {t('offer.per')}{' '}
                <Traceable
                  source={name('priceBasis')}
                  active={source}
                  className="num"
                >
                  {formatQty(line.priceBasis)}
                </Traceable>
              </span>
            )}
          </Figure>
        )}
        {line.total !== null && (
          <Figure label={t('offer.total')}>
            <Traceable source={name('total')} active={source} className="num">
              {formatMoney(line.total)}
            </Traceable>
          </Figure>
        )}
      </dl>

      {perUnit !== null && (
        <div className="mt-4 border-t border-frame/70 pt-3">
          <p className="label mb-2">
            {t('offer.perUnit')} ({unitLabel(tenderUnit)})
          </p>
          <p className="num whitespace-nowrap text-right text-[1.2rem] font-medium">
            {formatUnitPrice(perUnit)}{' '}
            <span className="text-[0.87rem] font-normal text-ink-3">€</span>
          </p>
        </div>
      )}
    </div>
  )
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-right">{children}</dd>
    </>
  )
}
