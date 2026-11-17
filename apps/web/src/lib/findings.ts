/**
 * Puts a finding into words. A finding arrives as a reason code and the
 * figures behind it; the sentence is built here, so it can be said in either
 * language and every figure in it is one the checks produced.
 */
import { formatMoney, formatQty, unitLabel } from './format'
import type { MessageKey, Translate } from './i18n'
import type { Finding } from './queries'

const money = (value: string | number | undefined) =>
  typeof value === 'number' ? formatMoney(value) : String(value ?? '')
const count = (value: string | number | undefined) =>
  typeof value === 'number' ? formatQty(value) : String(value ?? '')

export interface FindingText {
  text: string
  /** The conversion behind it, written out, where there was one. */
  arithmetic?: string
}

export function findingText(t: Translate, finding: Finding): FindingText {
  const { code, detail } = finding
  const unconfirmed = detail.unconfirmed !== undefined

  switch (code) {
    case 'SPEC_MISMATCH':
      if (unconfirmed) return { text: t('finding.SPEC_MISMATCH.unconfirmed') }
      return {
        text: t('finding.SPEC_MISMATCH', {
          attribute: String(detail.attribute ?? ''),
          tender: String(detail.tender ?? ''),
          offer: String(detail.offer ?? ''),
        }),
        ...(typeof detail.arithmetic === 'string'
          ? { arithmetic: detail.arithmetic }
          : {}),
      }
    case 'UNIT_BASIS':
      return {
        text: t('finding.UNIT_BASIS', {
          lineUnit: String(detail.lineUnit ?? ''),
          tenderUnit: unitLabel(String(detail.tenderUnit ?? '')),
        }),
      }
    case 'ARITHMETIC':
      return {
        text: t('finding.ARITHMETIC', {
          expected: money(detail.expected),
          printed: money(detail.printed),
        }),
      }
    case 'QTY_MISMATCH':
      return {
        text: t('finding.QTY_MISMATCH', {
          asked: count(detail.asked),
          offered: count(detail.offered),
        }),
      }
    case 'AMBIGUOUS':
      return {
        text: unconfirmed
          ? t('finding.AMBIGUOUS.unconfirmed')
          : t('finding.AMBIGUOUS', { lines: count(detail.lines) }),
      }
    case 'PRICE_OUTLIER':
      return {
        text: t('finding.PRICE_OUTLIER', {
          price: money(detail.price),
          others: money(detail.others),
        }),
      }
    case 'ALTERNATIVE_PRODUCT':
    case 'NO_OFFER':
      return { text: t(`finding.${code}`) }
  }
}

export const reasonLabel = (code: Finding['code']): MessageKey =>
  `reason.${code}`
