/**
 * Two readers that cost nothing, to put the model's result between.
 *
 * `noReader` reads no text at all: a line is for the position it names, and
 * a line that names none is for nothing. That is what a few plain rules
 * amount to, and it is the floor a model has to beat.
 *
 * `perfectReader` answers every question from the ground truth. It shows how
 * far the checks and the triage get when the reading is flawless, which is
 * the ceiling for any model. It is a measuring device, never a pipeline step.
 */
import { lineId } from '@preisspiegel/core'
import type { Judgement, OfferLine, Question } from '@preisspiegel/core'
import type { Product } from '../../data/src/catalog'
import type { OfferDraft } from '../../data/src/offers'
import type { Truth } from '../../data/src/truth'

const plain = (id: string, verdict: Judgement['verdict']): Judgement => ({
  id,
  verdict,
  by: 'code',
  said: null,
  pairs: [],
  rejected: 0,
  pack: null,
  alternative: null,
})

export function noReader(question: Question): Array<Judgement> {
  return [
    ...question.echoes.map((id) => plain(id, 'confirmed')),
    ...question.candidates
      .filter((candidate) => candidate.referenced)
      .map((candidate) => plain(candidate.id, 'confirmed')),
  ]
}

export function perfectReader(
  truth: Truth,
  catalog: ReadonlyArray<Product>,
  drafts: Record<string, ReadonlyArray<OfferDraft>>,
  lines: ReadonlyArray<OfferLine>,
): (question: Question) => Array<Judgement> {
  const groupOf = new Map(catalog.map((product) => [product.id, product.group]))
  const asked = new Map(truth.positions.map((entry) => [entry.oz, entry]))
  const draftOf = new Map(
    lines.map((line) => [lineId(line), drafts[line.supplierKey]?.[line.seq]]),
  )

  return (question) => {
    const wanted = asked.get(question.oz)?.productId
    const judge = (id: string): Judgement => {
      const draft = draftOf.get(id)
      if (draft === undefined || wanted === undefined) {
        return plain(id, 'unconfirmed')
      }
      const verdict: Judgement['verdict'] =
        draft.productId === wanted
          ? 'confirmed'
          : groupOf.get(draft.productId) === groupOf.get(wanted)
            ? 'mismatch'
            : 'unrelated'
      return {
        ...plain(id, verdict),
        pairs:
          verdict === 'mismatch'
            ? [
                {
                  attribute: 'product',
                  tender: { value: wanted, quote: wanted },
                  offer: { value: draft.productId, quote: draft.productId },
                  agrees: false,
                  decidedBy: 'code',
                },
              ]
            : [],
        pack:
          draft.packSize !== null && draft.packStated
            ? { size: draft.packSize, quote: String(draft.packSize) }
            : null,
        alternative:
          draft.trap?.kind === 'ALTERNATIVE_PRODUCT' ? draft.text : null,
      }
    }
    return [
      ...question.echoes.map(judge),
      ...question.candidates.map((candidate) => judge(candidate.id)),
    ]
  }
}
