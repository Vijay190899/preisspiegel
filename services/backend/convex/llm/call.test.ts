import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { callModel } from './call'
import { capabilities, roleConfig } from './registry'
import type Anthropic from '@anthropic-ai/sdk'
import type { SendMessage } from './call'

const env = { LLM_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-key' }
const config = roleConfig('match', env)!
const caps = capabilities(env)
const schema = z.object({ verdict: z.enum(['same', 'different']) })
const request = { system: 'Compare.', user: 'Position and lines.', schema }
const at = Date.UTC(2026, 10, 17, 9, 30)

/** A response as the SDK returns it, with only what the call path reads. */
const message = (
  text: string,
  over: Partial<Anthropic.Message> = {},
): Anthropic.Message =>
  ({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: config.wireModel,
    content: [{ type: 'text', text, citations: null }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 400,
      output_tokens: 120,
      cache_read_input_tokens: 1500,
      cache_creation_input_tokens: 0,
    },
    ...over,
  }) as Anthropic.Message

describe('callModel', () => {
  it('sends the frozen instructions with a cache mark, effort and the schema', async () => {
    let sent: Anthropic.MessageCreateParamsNonStreaming | undefined
    const send: SendMessage = (body) => {
      sent = body
      return Promise.resolve(message('{"verdict":"same"}'))
    }
    await callModel(config, caps, request, send, at)

    expect(sent?.model).toBe(config.wireModel)
    expect(sent?.system).toEqual([
      { type: 'text', text: 'Compare.', cache_control: { type: 'ephemeral' } },
    ])
    expect(sent?.messages).toEqual([
      { role: 'user', content: 'Position and lines.' },
    ])
    expect(sent?.output_config?.effort).toBe('low')
    expect(sent?.output_config?.format?.type).toBe('json_schema')
    // Nothing the current models reject.
    expect(sent).not.toHaveProperty('temperature')
    expect(sent).not.toHaveProperty('thinking')
    expect(sent).not.toHaveProperty('tool_choice')
  })

  it('returns the answer with what the call cost', async () => {
    const outcome = await callModel(
      config,
      caps,
      { ...request, runId: 'run_1' },
      () => Promise.resolve(message('{"verdict":"different"}')),
      at,
    )
    expect(outcome.result).toEqual({
      ok: true,
      value: { verdict: 'different' },
    })
    expect(outcome.entry).toMatchObject({
      day: '2026-11-17',
      at,
      provider: 'openrouter',
      role: 'match',
      model: 'claude-haiku-5-5',
      inputTokens: 400,
      outputTokens: 120,
      cacheReadTokens: 1500,
      stopReason: 'end_turn',
      runId: 'run_1',
    })
    expect(outcome.entry!.usd).toBeGreaterThan(0)
  })

  it('still reports the cost when the answer was cut off', async () => {
    const outcome = await callModel(
      config,
      caps,
      request,
      () =>
        Promise.resolve(
          message('{"verdict":"sa', { stop_reason: 'max_tokens' }),
        ),
      at,
    )
    expect(outcome.result).toEqual({ ok: false, reason: 'max_tokens' })
    expect(outcome.entry).toMatchObject({ stopReason: 'max_tokens' })
    expect(outcome.entry!.usd).toBeGreaterThan(0)
  })

  it('still reports the cost of a refusal and of an answer off the schema', async () => {
    const refused = await callModel(
      config,
      caps,
      request,
      () => Promise.resolve(message('', { stop_reason: 'refusal' })),
      at,
    )
    expect(refused.result).toEqual({ ok: false, reason: 'refusal' })
    expect(refused.entry).not.toBeNull()

    const wrong = await callModel(
      config,
      caps,
      request,
      () => Promise.resolve(message('{"verdict":"maybe"}')),
      at,
    )
    expect(wrong.result).toEqual({ ok: false, reason: 'unparsed' })
    expect(wrong.entry).not.toBeNull()
  })

  it('returns a provider error as a value, with nothing to record', async () => {
    const overloaded = Object.assign(new Error('Overloaded'), { status: 529 })
    const outcome = await callModel(
      config,
      caps,
      request,
      () => Promise.reject(overloaded),
      at,
    )
    expect(outcome).toEqual({
      result: {
        ok: false,
        reason: 'provider_error',
        detail: '529 Error: Overloaded',
      },
      entry: null,
    })
  })

  it('one failed call does not take down the calls beside it', async () => {
    const sends: Array<SendMessage> = [
      () => Promise.resolve(message('{"verdict":"same"}')),
      () => Promise.reject(new Error('socket hang up')),
      () => Promise.resolve(message('{"verdict":"different"}')),
    ]
    const outcomes = await Promise.all(
      sends.map((send) => callModel(config, caps, request, send, at)),
    )
    expect(outcomes.map((outcome) => outcome.result.ok)).toEqual([
      true,
      false,
      true,
    ])
    // Two responses arrived, so two calls are on the bill.
    expect(outcomes.filter((outcome) => outcome.entry !== null)).toHaveLength(2)
  })
})
