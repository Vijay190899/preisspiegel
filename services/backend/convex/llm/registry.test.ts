import { describe, expect, it } from 'vitest'
import {
  LlmConfigError,
  budgets,
  capabilities,
  costUsd,
  providerFeePct,
  resolveProvider,
  roleConfig,
  roleModels,
  wireModel,
} from './registry'

describe('role defaults', () => {
  it('runs bulk matching on the cheapest model and leaves escalation off', () => {
    expect(roleModels({})).toEqual({
      match: 'claude-haiku-5-5',
      escalation: null,
      investigator: 'claude-haiku-5-5',
    })
  })

  it('never defaults a role to a larger model', () => {
    const defaults = Object.values(roleModels({}))
    expect(defaults.some((model) => model?.includes('sonnet'))).toBe(false)
    expect(defaults.some((model) => model?.includes('opus'))).toBe(false)
  })

  it('turns escalation on only when its env var names a model', () => {
    expect(roleConfig('escalation', {})).toBeNull()
    expect(roleConfig('escalation', { LLM_ESCALATION_MODEL: '  ' })).toBeNull()
    expect(
      roleConfig('escalation', { LLM_ESCALATION_MODEL: 'claude-sonnet-5-5' }),
    ).toMatchObject({ model: 'claude-sonnet-5-5', effort: 'medium' })
  })

  it('swaps a role with one env var', () => {
    expect(
      roleConfig('match', {
        LLM_MATCH_MODEL: 'claude-sonnet-5-5',
        LLM_MATCH_EFFORT: 'high',
      }),
    ).toMatchObject({ model: 'claude-sonnet-5-5', effort: 'high' })
  })

  it('refuses a model the cost meter has no price for, before any call', () => {
    expect(() =>
      roleConfig('match', { LLM_MATCH_MODEL: 'vendor/some-model' }),
    ).toThrow(/no entry in PRICES/)
    expect(() =>
      roleConfig('escalation', { LLM_ESCALATION_MODEL: 'claude-unknown-9' }),
    ).toThrow(LlmConfigError)
  })

  it('rejects an effort level that does not exist', () => {
    expect(() => roleConfig('match', { LLM_MATCH_EFFORT: 'extreme' })).toThrow(
      LlmConfigError,
    )
  })
})

describe('provider', () => {
  it('defaults to OpenRouter and switches with LLM_PROVIDER', () => {
    expect(resolveProvider({})).toBe('openrouter')
    expect(resolveProvider({ LLM_PROVIDER: 'anthropic' })).toBe('anthropic')
    expect(() => resolveProvider({ LLM_PROVIDER: 'other' })).toThrow(
      LlmConfigError,
    )
  })

  it('maps canonical IDs per provider', () => {
    expect(wireModel('anthropic', 'claude-haiku-5-5')).toBe('claude-haiku-5-5')
    expect(wireModel('openrouter', 'claude-haiku-5-5')).toBe(
      'anthropic/claude-haiku-5.5',
    )
    expect(roleConfig('match', {})?.wireModel).toBe(
      'anthropic/claude-haiku-5.5',
    )
  })

  it('passes provider-qualified IDs through and rejects unknown ones', () => {
    expect(wireModel('openrouter', 'vendor/some-model')).toBe(
      'vendor/some-model',
    )
    expect(() => wireModel('openrouter', 'claude-unknown-9')).toThrow(
      LlmConfigError,
    )
  })

  it('reports a credit fee only on OpenRouter', () => {
    expect(providerFeePct({})).toBe(5.5)
    expect(providerFeePct({ LLM_PROVIDER: 'anthropic' })).toBe(0)
  })
})

describe('capability flags', () => {
  it('are all on by default', () => {
    expect(capabilities({})).toEqual({
      effort: true,
      structured_outputs: true,
      strict_tools: true,
      prompt_cache: true,
    })
  })

  it('switch off by name and reject a misspelt name', () => {
    expect(
      capabilities({ LLM_CAPS_OFF: 'effort, prompt_cache' }),
    ).toMatchObject({ effort: false, prompt_cache: false, strict_tools: true })
    expect(() => capabilities({ LLM_CAPS_OFF: 'efort' })).toThrow(
      LlmConfigError,
    )
  })
})

describe('cost meter', () => {
  const usage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  }

  // Prompts stay under 100,000 tokens here; above that Haiku 5.5 charges more.
  it('prices Haiku 5.5 at $0.10 in and $0.50 out per million tokens', () => {
    expect(
      costUsd('claude-haiku-5-5', {
        ...usage,
        inputTokens: 50_000,
        outputTokens: 50_000,
      }),
    ).toBeCloseTo((50_000 * 0.1 + 50_000 * 0.5) / 1e6, 12)
  })

  it('prices cache reads and writes separately from fresh input', () => {
    expect(
      costUsd('claude-haiku-5-5', { ...usage, cacheReadTokens: 50_000 }),
    ).toBeCloseTo((50_000 * 0.01) / 1e6, 12)
    expect(
      costUsd('claude-haiku-5-5', { ...usage, cacheWriteTokens: 50_000 }),
    ).toBeCloseTo((50_000 * 0.125) / 1e6, 12)
  })

  it('counts cached tokens towards the long-prompt threshold', () => {
    expect(
      costUsd('claude-haiku-5-5', { ...usage, cacheReadTokens: 1_000_000 }),
    ).toBeCloseTo(0.05, 9)
  })

  it('estimates a typical matcher call at a small fraction of a cent', () => {
    const call = costUsd('claude-haiku-5-5', {
      inputTokens: 700,
      cacheReadTokens: 800,
      cacheWriteTokens: 0,
      outputTokens: 600,
    })
    expect(call).toBeCloseTo(0.000378, 6)
    expect(call * 1170).toBeLessThan(0.5)
  })

  it('applies the long-prompt tier across the whole request', () => {
    expect(
      costUsd('claude-haiku-5-5', {
        inputTokens: 100_001,
        cacheReadTokens: 100_000,
        cacheWriteTokens: 0,
        outputTokens: 1_000,
      }),
    ).toBeCloseTo((100_001 * 0.5 + 100_000 * 0.05 + 1_000 * 2.5) / 1e6, 9)
  })

  it('refuses to price a model it has no rate for', () => {
    expect(() => costUsd('claude-unknown-9', usage)).toThrow(LlmConfigError)
  })
})

describe('budgets', () => {
  it('default to a few dollars a day and read overrides from env', () => {
    expect(budgets({})).toEqual({ dailyUsd: 3, runUsd: 1.5 })
    expect(budgets({ LLM_DAILY_BUDGET_USD: '10' }).dailyUsd).toBe(10)
    expect(() => budgets({ RUN_MAX_USD: 'lots' })).toThrow(LlmConfigError)
  })
})
