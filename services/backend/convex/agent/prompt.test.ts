import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  LABOR_PROMPT_VERSION,
  laborAnswerSchema,
  laborSystem,
} from './laborPrompt'
import { PROMPT_VERSION, SYSTEM, answerSchema } from './prompt'

/**
 * Each answer cache is keyed by a version kept by hand. A change to the
 * instructions or the answer's shape without a new version would serve old
 * answers to new questions. These are the hashes the versions stand for: when
 * a test fails, change the version in the prompt file and the hash here.
 */
const KNOWN: Record<string, string> = {
  'match-4': '65578e99ed50e363',
  'labor-2': '44b6dfdf3272922b',
}

/** The instructions and the answer's shape, hashed. */
function fingerprint(system: string, schema: z.ZodType): string {
  return createHash('sha256')
    .update(system)
    .update('\n')
    .update(JSON.stringify(z.toJSONSchema(schema)))
    .digest('hex')
    .slice(0, 16)
}

describe('the cached prompts', () => {
  it('match the version they are cached under', () => {
    expect({ [PROMPT_VERSION]: fingerprint(SYSTEM, answerSchema) }).toEqual({
      [PROMPT_VERSION]: KNOWN[PROMPT_VERSION],
    })
  })

  it('do the same for labor, whose table is part of the key already', () => {
    // The table differs per tender, so the instructions are hashed with none.
    expect({
      [LABOR_PROMPT_VERSION]: fingerprint(laborSystem([]), laborAnswerSchema),
    }).toEqual({ [LABOR_PROMPT_VERSION]: KNOWN[LABOR_PROMPT_VERSION] })
  })
})
