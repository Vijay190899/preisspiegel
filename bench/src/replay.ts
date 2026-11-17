/**
 * `pnpm bench:replay`: puts the model's stored answers through the checks
 * and the triage as they are now, and scores the result. No model is
 * called. A question the model has never answered counts as unanswered.
 *
 * This is how a change to a check is tried before a run is paid for.
 */
import { buildQuestions, triage, verifyAnswer } from '@preisspiegel/core'
import {
  PROMPT_VERSION,
  questionKey,
  withLineIds,
} from '../../services/backend/convex/agent/prompt'
import { roleModels } from '../../services/backend/convex/llm/registry'
import { convexRun } from './convex'
import { score } from './score'
import { loadSeed } from './seedData'
import type { Judgement, RawJudgement } from '@preisspiegel/core'
import type { Score } from './score'
import type { SeedData } from './seedData'

export interface Replay {
  seed: SeedData
  score: Score
  results: ReturnType<typeof triage>
  /** Questions with lines to read, and how many of them had a stored answer. */
  asked: number
  answered: number
}

export async function replay(model: string): Promise<Replay> {
  const seed = await loadSeed()
  const { positions, lines, truth } = seed
  const questions = buildQuestions(positions, lines)
  const keys = await Promise.all(
    questions.map((question) => questionKey(question, model)),
  )

  const answers = new Map<string, Array<RawJudgement>>()
  const wanted = [
    ...new Set(
      keys.filter((_, i) => (questions[i]?.candidates.length ?? 0) > 0),
    ),
  ]
  for (let from = 0; from < wanted.length; from += 150) {
    const page = convexRun<Array<{ key: string; answer: Array<RawJudgement> }>>(
      'agent/store:cachedAnswers',
      { keys: wanted.slice(from, from + 150) },
    )
    for (const { key, answer } of page) answers.set(key, answer)
  }

  const judgements = new Map<string, Array<Judgement>>()
  questions.forEach((question, index) => {
    const answer = answers.get(keys[index] ?? '') ?? []
    judgements.set(
      question.oz,
      verifyAnswer(question, withLineIds(question, answer)),
    )
  })
  const results = triage(positions, lines, judgements)
  return {
    seed,
    score: score(results, truth),
    results,
    asked: wanted.length,
    answered: wanted.filter((key) => answers.has(key)).length,
  }
}

if (process.argv[1]?.endsWith('replay.ts') === true) {
  // The model whose stored answers are replayed: the one named, or the
  // matcher's configured one. The registry is the only place that names it.
  const model = process.argv[2] ?? roleModels(process.env).match
  if (model === null) throw new Error('No model is configured for the matcher.')
  const { score: scored, asked, answered } = await replay(model)
  const percent = (share: number) => `${(share * 100).toFixed(1)}%`
  console.log(`Prompt ${PROMPT_VERSION}, model ${model}: ${answered} of ${asked} questions have a stored answer.
B1  priced without a person   ${scored.b1.auto} of ${scored.b1.positions} (${percent(scored.b1.autoShare)})
    of those, rightly so      ${scored.b1.autoCorrect} (${percent(scored.b1.autoPrecision)}), ${scored.b1.autoAtRightPrice} at the right price
    euro error                ${scored.b1.euroError.toFixed(2)} of ${scored.b1.euroAuto.toFixed(2)}
B2  traps found               ${scored.b2.trapsCaught} of ${scored.b2.trapsPlanted}
    review queue              ${scored.b2.reviewRaised} raised, ${scored.b2.reviewFound} of ${scored.b2.reviewExpected} expected found
    queue recall, precision   ${percent(scored.b2.queueRecall)}, ${percent(scored.b2.queuePrecision)}`)
}
