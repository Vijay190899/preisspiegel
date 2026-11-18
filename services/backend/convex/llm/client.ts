import { internal } from '../_generated/api'
import { env } from '../_generated/server'
import { callModel, utcDay } from './call'
import {
  LlmConfigError,
  budgets,
  capabilities,
  createClient,
  roleConfig,
} from './registry'
import type { z } from 'zod'
import type { ActionCtx } from '../_generated/server'
import type { CallFailure, CallOutcome, CallRequest } from './call'
import type { Role } from './registry'

/**
 * The single call path to a model. Nothing else in the backend talks to the
 * SDK. Two ways in:
 *
 * - `llmCall` makes one call and hands back the answer with its ledger
 *   entry. The agent runtime uses it, makes many calls side by side, and
 *   puts each on the ledger the moment it returns (`recordMany`).
 * - `llmParse` is for a single call: it checks the daily budget, calls, and
 *   records the cost before it looks at the answer.
 */

export type LlmFailure = 'role_off' | 'daily_budget' | CallFailure

export type LlmResult<T> =
  | { ok: true; value: T; model: string; usd: number }
  | { ok: false; reason: LlmFailure; model: string | null; usd: number }

export interface ParseRequest<
  TSchema extends z.ZodType,
> extends CallRequest<TSchema> {
  role: Role
}

/** The model a role runs on in this deployment, or `null` if the role is off. */
export function roleModel(role: Role): string | null {
  return roleConfig(role, env)?.model ?? null
}

/** The guards a run works under. */
export function spendLimits(): { dailyUsd: number; runUsd: number } {
  return budgets(env)
}

/**
 * One call for a role, not recorded. The caller must write `entry` to the
 * ledger, and must have checked the budgets before calling.
 */
export async function llmCall<TSchema extends z.ZodType>(
  request: ParseRequest<TSchema>,
): Promise<CallOutcome<z.infer<TSchema>> | null> {
  // Configuration errors surface here, before anything is spent: an unknown
  // provider, a model with no price, a capability the provider lacks.
  const config = roleConfig(request.role, env)
  if (config === null) return null

  const caps = capabilities(env)
  if (!caps.structured_outputs) {
    throw new LlmConfigError(
      'structured_outputs is switched off for this provider (LLM_CAPS_OFF); structured calls need it.',
    )
  }
  const client = createClient(env)
  return callModel(config, caps, request, (body) =>
    client.messages.create(body),
  )
}

/** One structured-output call for a role, budget-checked and recorded. */
export async function llmParse<TSchema extends z.ZodType>(
  ctx: ActionCtx,
  request: ParseRequest<TSchema>,
): Promise<LlmResult<z.infer<TSchema>>> {
  const model = roleModel(request.role)
  if (model === null) {
    return { ok: false, reason: 'role_off', model: null, usd: 0 }
  }
  const spent = await ctx.runQuery(internal.llm.ledger.spentOn, {
    day: utcDay(Date.now()),
  })
  if (spent.usd >= budgets(env).dailyUsd) {
    return { ok: false, reason: 'daily_budget', model, usd: 0 }
  }

  const outcome = await llmCall(request)
  if (outcome === null) {
    return { ok: false, reason: 'role_off', model: null, usd: 0 }
  }
  // Record what the call cost before looking at what it said.
  if (outcome.entry !== null) {
    await ctx.runMutation(internal.llm.ledger.recordMany, {
      entries: [outcome.entry],
    })
  }
  const usd = outcome.entry?.usd ?? 0
  return outcome.result.ok
    ? { ok: true, value: outcome.result.value, model, usd }
    : { ok: false, reason: outcome.result.reason, model, usd }
}
