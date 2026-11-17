/**
 * The two reference runs that need no model: no reader, and a perfect one.
 */
import { buildQuestions, triage } from '@preisspiegel/core'
import { buildCatalog } from '../../data/src/catalog'
import { generate } from '../../data/src/generate'
import { noReader, perfectReader } from './judges'
import { score } from './score'
import { loadSeed } from './seedData'
import type { Judgement, Question } from '@preisspiegel/core'
import type { Score } from './score'
import type { SeedData } from './seedData'

export interface OfflineRuns {
  seed: SeedData
  questions: Array<Question>
  noReader: Score
  perfectReader: Score
}

export async function offlineRuns(): Promise<OfflineRuns> {
  return offlineRunsOf(await loadSeed())
}

/** The same two runs for a tender that is already read in. */
export async function offlineRunsOf(seed: SeedData): Promise<OfflineRuns> {
  const { positions, lines, truth } = seed
  const questions = buildQuestions(positions, lines)
  const run = (reader: (question: Question) => Array<Judgement>) =>
    score(
      triage(
        positions,
        lines,
        new Map(questions.map((question) => [question.oz, reader(question)])),
      ),
      truth,
    )

  // The drafts say which product a line really offers. Only the perfect
  // reader sees them.
  const generated = await generate(seed.truth.seed)
  return {
    seed,
    questions,
    noReader: run(noReader),
    perfectReader: run(
      perfectReader(truth, buildCatalog(), generated.offers.lines, lines),
    ),
  }
}
