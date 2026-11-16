/**
 * Reads a structured answer out of a model response without ever throwing.
 *
 * The SDK's own `messages.parse()` raises when the text is not valid JSON for
 * the schema, which is exactly what a response cut off at `max_tokens` looks
 * like. A raised error would skip the ledger write for a call that was billed.
 * So the call path uses `messages.create()` and this function instead: every
 * outcome is a value, and the caller records the cost before it looks at it.
 */

export type StructuredFailure = 'refusal' | 'max_tokens' | 'unparsed'

export type Structured<T> =
  { ok: true; value: T } | { ok: false; reason: StructuredFailure }

/** The parts of a response this needs. The SDK's `Message` satisfies it. */
export interface ModelResponse {
  stop_reason: string | null
  content: ReadonlyArray<{ type: string; text?: string }>
}

/** A schema check that reports instead of throwing, as zod's `safeParse` does. */
export type SafeParse<T> = (
  value: unknown,
) => { success: true; data: T } | { success: false }

export function readStructured<T>(
  response: ModelResponse,
  safeParse: SafeParse<T>,
): Structured<T> {
  // The stop reason comes first: a refusal or a cut-off has no answer to read,
  // whatever text came with it.
  if (response.stop_reason === 'refusal') {
    return { ok: false, reason: 'refusal' }
  }
  if (response.stop_reason === 'max_tokens') {
    return { ok: false, reason: 'max_tokens' }
  }

  const text = response.content
    .map((block) => (block.type === 'text' ? (block.text ?? '') : ''))
    .join('')
  if (text.trim() === '') return { ok: false, reason: 'unparsed' }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'unparsed' }
  }

  const parsed = safeParse(json)
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, reason: 'unparsed' }
}
