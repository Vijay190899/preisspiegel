/**
 * One structured-output call, with nothing of the deployment in it: the
 * model, the capabilities and the function that sends the request are all
 * passed in. That keeps the whole path testable with a stand-in for the SDK.
 *
 * Every outcome is a value. A provider error, a refusal, a cut-off and an
 * answer that does not fit the schema all come back as a typed failure, and
 * a call that produced a response comes back with the ledger entry for it,
 * whatever the response said.
 */
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { costUsd, tokenUsage } from './registry'
import { readStructured } from './structured'
import type Anthropic from '@anthropic-ai/sdk'
import type { z } from 'zod'
import type { Capability, RoleConfig, TokenUsage } from './registry'
import type { StructuredFailure } from './structured'

export type CallFailure = 'provider_error' | StructuredFailure

export type CallResult<T> =
  { ok: true; value: T } | { ok: false; reason: CallFailure; detail?: string }

/** What the ledger keeps about one call. */
export interface LedgerEntry extends TokenUsage {
  day: string
  at: number
  provider: string
  role: string
  model: string
  usd: number
  stopReason: string | null
  runId?: string
}

export interface CallRequest<TSchema extends z.ZodType> {
  /** Frozen instructions. This prefix is cached, so nothing volatile goes here. */
  system: string
  /** The per-call content. */
  user: string
  schema: TSchema
  maxTokens?: number
  /** The run this call belongs to, so its spend can be capped and shown. */
  runId?: string
}

export type SendMessage = (
  body: Anthropic.MessageCreateParamsNonStreaming,
) => Promise<Anthropic.Message>

export interface CallOutcome<T> {
  result: CallResult<T>
  /** The cost of the call. `null` only when no response arrived at all. */
  entry: LedgerEntry | null
}

/** `YYYY-MM-DD` in UTC. Budgets and the ledger are keyed by this. */
export function utcDay(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10)
}

export async function callModel<TSchema extends z.ZodType>(
  config: RoleConfig,
  caps: Record<Capability, boolean>,
  request: CallRequest<TSchema>,
  send: SendMessage,
  now: number = Date.now(),
): Promise<CallOutcome<z.infer<TSchema>>> {
  // `create`, not the SDK's `parse`: that one raises on text that does not
  // fit the schema, which would lose the usage of a billed call.
  const format = zodOutputFormat(request.schema)
  let message: Anthropic.Message
  try {
    message = await send({
      model: config.wireModel,
      max_tokens: request.maxTokens ?? 8000,
      system: [
        {
          type: 'text',
          text: request.system,
          ...(caps.prompt_cache
            ? { cache_control: { type: 'ephemeral' as const } }
            : {}),
        },
      ],
      messages: [{ role: 'user', content: request.user }],
      output_config: {
        ...(caps.effort ? { effort: config.effort } : {}),
        format: { type: format.type, schema: format.schema },
      },
    })
  } catch (error) {
    // Rate limits, overload, a timeout, a dropped connection. The SDK has
    // already retried what can be retried. No response means no usage.
    return {
      result: {
        ok: false,
        reason: 'provider_error',
        detail: describe(error),
      },
      entry: null,
    }
  }

  const usage = tokenUsage(message.usage)
  const entry: LedgerEntry = {
    day: utcDay(now),
    at: now,
    provider: config.provider,
    role: config.role,
    model: config.model,
    ...usage,
    usd: costUsd(config.model, usage),
    stopReason: message.stop_reason,
    ...(request.runId === undefined ? {} : { runId: request.runId }),
  }

  const answer = readStructured<z.infer<TSchema>>(message, (value) =>
    request.schema.safeParse(value),
  )
  return {
    result: answer.ok
      ? { ok: true, value: answer.value }
      : { ok: false, reason: answer.reason },
    entry,
  }
}

function describe(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const status =
      'status' in error && typeof error.status === 'number'
        ? `${error.status} `
        : ''
    const name = error instanceof Error ? error.name : 'Error'
    const message = error instanceof Error ? error.message : String(error)
    return `${status}${name}: ${message}`.slice(0, 300)
  }
  return String(error).slice(0, 300)
}
