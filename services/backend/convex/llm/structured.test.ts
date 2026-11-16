import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { readStructured } from './structured'
import type { ModelResponse } from './structured'

const Line = z.object({ article: z.string(), ratedCurrentA: z.number() })
const read = (response: ModelResponse) =>
  readStructured(response, (value) => Line.safeParse(value))

const text = (
  value: string,
  stop: string | null = 'end_turn',
): ModelResponse => ({
  stop_reason: stop,
  content: [{ type: 'text', text: value }],
})

describe('readStructured', () => {
  it('returns the value when the text is JSON that fits the schema', () => {
    expect(read(text('{"article":"LS B16","ratedCurrentA":16}'))).toEqual({
      ok: true,
      value: { article: 'LS B16', ratedCurrentA: 16 },
    })
  })

  it('reports a cut-off as max_tokens, not as an exception', () => {
    // What a response that ran out of tokens looks like: half an object.
    expect(read(text('{"article":"LS B16","ratedCur', 'max_tokens'))).toEqual({
      ok: false,
      reason: 'max_tokens',
    })
  })

  it('reports a refusal even when text came with it', () => {
    expect(read(text('I cannot help with that.', 'refusal'))).toEqual({
      ok: false,
      reason: 'refusal',
    })
  })

  it('reports text that is not JSON as unparsed', () => {
    expect(read(text('Here is the line: LS B16'))).toEqual({
      ok: false,
      reason: 'unparsed',
    })
  })

  it('reports JSON that does not fit the schema as unparsed', () => {
    expect(read(text('{"article":"LS B16","ratedCurrentA":"16 A"}'))).toEqual({
      ok: false,
      reason: 'unparsed',
    })
  })

  it('reports a response with no text as unparsed', () => {
    expect(read({ stop_reason: 'end_turn', content: [] })).toEqual({
      ok: false,
      reason: 'unparsed',
    })
    expect(
      read({ stop_reason: 'end_turn', content: [{ type: 'thinking' }] }),
    ).toEqual({ ok: false, reason: 'unparsed' })
  })

  it('reads the text blocks and skips thinking blocks beside them', () => {
    expect(
      read({
        stop_reason: 'end_turn',
        content: [
          { type: 'thinking' },
          { type: 'text', text: '{"article":"FI 40",' },
          { type: 'text', text: '"ratedCurrentA":40}' },
        ],
      }),
    ).toEqual({ ok: true, value: { article: 'FI 40', ratedCurrentA: 40 } })
  })
})
