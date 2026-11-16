import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { internal } from '../_generated/api'
import { env } from '../_generated/server'
import {
  LlmConfigError,
  budgets,
  capabilities,
  costUsd,
  createClient,
  roleConfig,
  tokenUsage,
} from './registry'
import { readStructured } from './structured'
import type { z } from 'zod'
import type { ActionCtx } from '../_generated/server'
import type { Role } from './registry'
import type { StructuredFailure } from './structured'

/**
 * The single call path to a model. It checks the daily budget, makes the call,
 * writes the ledger row, and only then reads the answer. Nothing else in the
 * backend talks to the SDK.
 */

export type LlmFailure = 'role_off' | 'daily_budget' | StructuredFailure

export type LlmResult<T> =
  | { ok: true; value: T; model: string; usd: number }
  | { ok: false; reason: LlmFailure; model: string | null; usd: number }

export interface ParseRequest<TSchema extends z.ZodType> {
  role: Role
  /** Frozen instructions. This prefix is cached, so nothing volatile goes here. */
  system: string
  /** The per-call content. */
  user: string
  schema: TSchema
  maxTokens?: number
  /** The run this call belongs to, so its spend can be capped and shown. */
  runId?: string
}

/** One structured-output call for a role, validated against `schema`. */
export async function llmParse<TSchema extends z.ZodType>(
  ctx: ActionCtx,
  request: ParseRequest<TSchema>,
): Promise<LlmResult<z.infer<TSchema>>> {
  // Configuration errors surface here, before anything is spent: an unknown
  // provider, a model with no price, a capability the provider lacks.
  const config = roleConfig(request.role, env)
  if (config === null) {
    return { ok: false, reason: 'role_off', model: null, usd: 0 }
  }

  const caps = capabilities(env)
  if (!caps.structured_outputs) {
    throw new LlmConfigError(
      'structured_outputs is switched off for this provider (LLM_CAPS_OFF); llmParse needs it.',
    )
  }

  const now = Date.now()
  const day = utcDay(now)
  const spent = await ctx.runQuery(internal.llm.ledger.spentOn, { day })
  if (spent.usd >= budgets(env).dailyUsd) {
    return { ok: false, reason: 'daily_budget', model: config.model, usd: 0 }
  }

  // `create`, not the SDK's `parse`: that one raises on text that does not fit
  // the schema, and a raised error here would skip the ledger for a billed call.
  const format = zodOutputFormat(request.schema)
  const message = await createClient(env).messages.create({
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

  // Record what the call cost before looking at what it said.
  const usage = tokenUsage(message.usage)
  const usd = costUsd(config.model, usage)
  await ctx.runMutation(internal.llm.ledger.record, {
    day,
    at: now,
    provider: config.provider,
    role: config.role,
    model: config.model,
    ...usage,
    usd,
    stopReason: message.stop_reason,
    ...(request.runId === undefined ? {} : { runId: request.runId }),
  })

  const answer = readStructured<z.infer<TSchema>>(message, (value) =>
    request.schema.safeParse(value),
  )
  return answer.ok
    ? { ok: true, value: answer.value, model: config.model, usd }
    : { ok: false, reason: answer.reason, model: config.model, usd }
}

/** `YYYY-MM-DD` in UTC. Budgets and the ledger are keyed by this. */
export function utcDay(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10)
}
