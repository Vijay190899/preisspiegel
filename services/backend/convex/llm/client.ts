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
import type { z } from 'zod'
import type { ActionCtx } from '../_generated/server'
import type { Role } from './registry'

/**
 * The single call path to a model. It checks the daily budget, makes the call,
 * and writes the ledger row. Nothing else in the backend talks to the SDK.
 */

export type LlmFailure =
  'role_off' | 'daily_budget' | 'refusal' | 'max_tokens' | 'unparsed'

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
}

/** One structured-output call for a role, validated against `schema`. */
export async function llmParse<TSchema extends z.ZodType>(
  ctx: ActionCtx,
  request: ParseRequest<TSchema>,
): Promise<LlmResult<z.infer<TSchema>>> {
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

  const message = await createClient(env).messages.parse({
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
      format: zodOutputFormat(request.schema),
    },
  })

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
  })

  const failed = (reason: LlmFailure): LlmResult<z.infer<TSchema>> => ({
    ok: false,
    reason,
    model: config.model,
    usd,
  })
  if (message.stop_reason === 'refusal') return failed('refusal')
  if (message.stop_reason === 'max_tokens') return failed('max_tokens')
  if (message.parsed_output === null) return failed('unparsed')

  return { ok: true, value: message.parsed_output, model: config.model, usd }
}

/** `YYYY-MM-DD` in UTC. Budgets and the ledger are keyed by this. */
export function utcDay(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10)
}
