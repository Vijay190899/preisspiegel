import Anthropic from '@anthropic-ai/sdk'

/**
 * The model layer.
 *
 * Every provider and model choice is an environment variable. This is the only
 * module that names a model or builds an SDK client; `client.ts` is the only
 * module that calls one. Defaults favour cost: the cheapest current model does
 * the bulk work and no larger model runs unless a role is pointed at one.
 *
 * Docs: docs/ARCHITECTURE.md, "Model layer".
 */

export type Env = Readonly<Record<string, string | undefined>>

export const PROVIDERS = ['openrouter', 'anthropic'] as const
export type Provider = (typeof PROVIDERS)[number]

export const ROLES = ['match', 'escalation', 'investigator'] as const
export type Role = (typeof ROLES)[number]

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export type Effort = (typeof EFFORTS)[number]

export const CAPABILITIES = [
  'effort',
  'structured_outputs',
  'strict_tools',
  'prompt_cache',
] as const
export type Capability = (typeof CAPABILITIES)[number]

export class LlmConfigError extends Error {
  override name = 'LlmConfigError'
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

interface RoleSpec {
  modelVar: string
  effortVar: string
  /** `null` means the role is off unless its env var names a model. */
  defaultModel: string | null
  defaultEffort: Effort
}

const ROLE_SPECS: Record<Role, RoleSpec> = {
  // One call per tender position: typed attributes with quotes, and a proposal.
  match: {
    modelVar: 'LLM_MATCH_MODEL',
    effortVar: 'LLM_MATCH_EFFORT',
    defaultModel: 'claude-haiku-5-5',
    defaultEffort: 'low',
  },
  // Second read of positions the matcher could not settle. Off by default:
  // unsettled positions go to the estimator's review queue instead.
  escalation: {
    modelVar: 'LLM_ESCALATION_MODEL',
    effortVar: 'LLM_ESCALATION_EFFORT',
    defaultModel: null,
    defaultEffort: 'medium',
  },
  // Drafts a suggested resolution for a flagged position.
  investigator: {
    modelVar: 'LLM_INVESTIGATOR_MODEL',
    effortVar: 'LLM_INVESTIGATOR_EFFORT',
    defaultModel: 'claude-haiku-5-5',
    defaultEffort: 'low',
  },
}

export interface RoleConfig {
  role: Role
  provider: Provider
  /** Canonical model ID, e.g. `claude-haiku-5-5`. */
  model: string
  /** The ID the provider expects on the wire. */
  wireModel: string
  effort: Effort
}

export function resolveProvider(env: Env): Provider {
  const raw = (env.LLM_PROVIDER ?? 'openrouter').trim().toLowerCase()
  if (!isOneOf(PROVIDERS, raw)) {
    throw new LlmConfigError(
      `LLM_PROVIDER must be one of ${PROVIDERS.join(', ')}; got "${raw}"`,
    )
  }
  return raw
}

/** The configuration for a role, or `null` when the role is switched off. */
export function roleConfig(role: Role, env: Env): RoleConfig | null {
  const spec = ROLE_SPECS[role]
  const model = blankToNull(env[spec.modelVar]) ?? spec.defaultModel
  if (model === null) return null

  const effort = blankToNull(env[spec.effortVar]) ?? spec.defaultEffort
  if (!isOneOf(EFFORTS, effort)) {
    throw new LlmConfigError(
      `${spec.effortVar} must be one of ${EFFORTS.join(', ')}; got "${effort}"`,
    )
  }

  if (PRICES[model] === undefined) {
    throw new LlmConfigError(
      `${spec.modelVar} names "${model}", which has no entry in PRICES. A call to it could not be metered, so it is refused before it is made.`,
    )
  }

  const provider = resolveProvider(env)
  return {
    role,
    provider,
    model,
    wireModel: wireModel(provider, model),
    effort,
  }
}

/** The model configured for every role, `null` where a role is off. */
export function roleModels(env: Env): Record<Role, string | null> {
  return {
    match: roleConfig('match', env)?.model ?? null,
    escalation: roleConfig('escalation', env)?.model ?? null,
    investigator: roleConfig('investigator', env)?.model ?? null,
  }
}

// ---------------------------------------------------------------------------
// Provider mapping
// ---------------------------------------------------------------------------

const OPENROUTER_IDS: Partial<Record<string, string>> = {
  'claude-haiku-5-5': 'anthropic/claude-haiku-5.5',
  'claude-sonnet-5-5': 'anthropic/claude-sonnet-5.5',
  'claude-opus-5-5': 'anthropic/claude-opus-5.5',
}

/**
 * Env vars always hold canonical IDs. On OpenRouter an ID that already
 * contains a slash passes through untouched, for model-comparison runs; a
 * role can only use one once it has a price in PRICES.
 */
export function wireModel(provider: Provider, model: string): string {
  if (provider === 'anthropic' || model.includes('/')) return model
  const mapped = OPENROUTER_IDS[model]
  if (mapped === undefined) {
    throw new LlmConfigError(
      `No OpenRouter mapping for "${model}". Add it to OPENROUTER_IDS or use a provider-qualified ID.`,
    )
  }
  return mapped
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

/**
 * What the configured provider supports. Call sites check a flag; they never
 * branch on the provider name. `pnpm probe:llm` confirms each flag with one
 * cheap call, and a flag is switched off with `LLM_CAPS_OFF=effort,prompt_cache`.
 */
export function capabilities(env: Env): Record<Capability, boolean> {
  const off = (env.LLM_CAPS_OFF ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '')

  for (const name of off) {
    if (!isOneOf(CAPABILITIES, name)) {
      throw new LlmConfigError(
        `LLM_CAPS_OFF names an unknown capability "${name}". Known: ${CAPABILITIES.join(', ')}`,
      )
    }
  }

  return {
    effort: !off.includes('effort'),
    structured_outputs: !off.includes('structured_outputs'),
    strict_tools: !off.includes('strict_tools'),
    prompt_cache: !off.includes('prompt_cache'),
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * One code path: the official SDK, pointed at the chosen provider. OpenRouter
 * is reached through its Anthropic-compatible Messages endpoint.
 */
export function createClient(env: Env): Anthropic {
  if (resolveProvider(env) === 'openrouter') {
    const token = blankToNull(env.OPENROUTER_API_KEY)
    if (token === null) {
      throw new LlmConfigError(
        'OPENROUTER_API_KEY is not set (LLM_PROVIDER=openrouter).',
      )
    }
    // Attribution headers are opt-in: nothing identifying is sent unless set.
    const headers: Record<string, string> = {}
    const appName = blankToNull(env.OPENROUTER_APP_NAME)
    const siteUrl = blankToNull(env.OPENROUTER_SITE_URL)
    if (appName !== null) headers['X-Title'] = appName
    if (siteUrl !== null) headers['HTTP-Referer'] = siteUrl

    return new Anthropic({
      baseURL: 'https://openrouter.ai/api',
      authToken: token,
      apiKey: null,
      defaultHeaders: headers,
    })
  }

  const apiKey = blankToNull(env.ANTHROPIC_API_KEY)
  // Without an explicit key the SDK resolves credentials itself.
  return apiKey === null ? new Anthropic() : new Anthropic({ apiKey })
}

// ---------------------------------------------------------------------------
// Prices and the cost meter
// ---------------------------------------------------------------------------

/** USD per one million tokens. */
export interface Price {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  /** Some models charge more once the prompt passes a size threshold. */
  longPrompt?: { aboveTokens: number; input: number; output: number }
}

/**
 * Anthropic first-party rates, checked 2026-11-16. Cache writes are 1.25x
 * input (5-minute TTL). Cache reads are 0.1x input on Haiku 5.5 and 0.05x on
 * Sonnet 5.5 and Opus 5.5.
 */
export const PRICES: Readonly<Partial<Record<string, Price>>> = {
  'claude-haiku-5-5': {
    input: 0.1,
    output: 0.5,
    cacheRead: 0.01,
    cacheWrite: 0.125,
    longPrompt: { aboveTokens: 100_000, input: 0.5, output: 2.5 },
  },
  'claude-sonnet-5-5': {
    input: 2,
    output: 10,
    cacheRead: 0.1,
    cacheWrite: 2.5,
  },
  'claude-opus-5-5': {
    input: 4,
    output: 20,
    cacheRead: 0.2,
    cacheWrite: 5,
  },
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

/** Normalises the SDK's usage block; cache fields can be null or absent. */
export function tokenUsage(usage: {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
}): TokenUsage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
  }
}

/** What a call cost, from the canonical model ID and its token usage. */
export function costUsd(model: string, usage: TokenUsage): number {
  const price = PRICES[model]
  if (price === undefined) {
    throw new LlmConfigError(
      `No price for "${model}". Add it to PRICES so the cost meter stays honest.`,
    )
  }

  const promptTokens =
    usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
  const long =
    price.longPrompt !== undefined &&
    promptTokens > price.longPrompt.aboveTokens
      ? price.longPrompt
      : null

  // The long-prompt tier scales every input-side rate by the same factor.
  const inputScale = long === null ? 1 : long.input / price.input
  const outputRate = long === null ? price.output : long.output

  return (
    (usage.inputTokens * price.input * inputScale +
      usage.cacheReadTokens * price.cacheRead * inputScale +
      usage.cacheWriteTokens * price.cacheWrite * inputScale +
      usage.outputTokens * outputRate) /
    1_000_000
  )
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export interface Budgets {
  /** Hard stop for model spend per UTC day. */
  dailyUsd: number
  /** Hard stop for model spend within a single run. */
  runUsd: number
}

export function budgets(env: Env): Budgets {
  return {
    dailyUsd: positiveNumber(env, 'LLM_DAILY_BUDGET_USD', 3),
    runUsd: positiveNumber(env, 'RUN_MAX_USD', 1.5),
  }
}

/** OpenRouter's credit fee, reported as its own line beside model spend. */
export function providerFeePct(env: Env): number {
  if (resolveProvider(env) !== 'openrouter') return 0
  return positiveNumber(env, 'OPENROUTER_FEE_PCT', 5.5)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

function positiveNumber(env: Env, name: string, fallback: number): number {
  const raw = blankToNull(env[name])
  if (raw === null) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) {
    throw new LlmConfigError(
      `${name} must be a non-negative number; got "${raw}"`,
    )
  }
  return value
}

function isOneOf<const T extends ReadonlyArray<string>>(
  options: T,
  value: string,
): value is T[number] {
  return options.includes(value)
}
