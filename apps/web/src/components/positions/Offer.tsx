import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useState } from 'react'
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
import { offerSource } from '~/lib/sources'
import { useTenderText } from '~/lib/tenderText'
import { EASE, Traceable, lampStyle } from './parts'
import type { ReactNode } from 'react'
import type { Finding, MatchOffer } from '~/lib/queries'
import type { OfferField } from '~/lib/sources'
import type { Pace, Shown } from './parts'

/** One offer in its supplier's column. */
export function Offer({
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
                className={`grow-in block h-full rounded-[2px] ${row.tone}`}
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
