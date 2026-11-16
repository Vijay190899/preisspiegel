import { defineApp } from 'convex/server'
import { v } from 'convex/values'

/**
 * Typed deployment environment. Read it as `env` from `./_generated/server`.
 * Names, defaults and meaning are documented in `.env.example`.
 */
const app = defineApp({
  env: {
    // Provider
    LLM_PROVIDER: v.optional(v.string()),
    OPENROUTER_API_KEY: v.optional(v.string()),
    OPENROUTER_APP_NAME: v.optional(v.string()),
    OPENROUTER_SITE_URL: v.optional(v.string()),
    OPENROUTER_FEE_PCT: v.optional(v.string()),
    ANTHROPIC_API_KEY: v.optional(v.string()),
    LLM_CAPS_OFF: v.optional(v.string()),

    // Model roles
    LLM_MATCH_MODEL: v.optional(v.string()),
    LLM_MATCH_EFFORT: v.optional(v.string()),
    LLM_ESCALATION_MODEL: v.optional(v.string()),
    LLM_ESCALATION_EFFORT: v.optional(v.string()),
    LLM_INVESTIGATOR_MODEL: v.optional(v.string()),
    LLM_INVESTIGATOR_EFFORT: v.optional(v.string()),

    // Guards
    LLM_DAILY_BUDGET_USD: v.optional(v.string()),
    RUN_MAX_USD: v.optional(v.string()),

    // Demo
    DEMO_MODE: v.optional(v.string()),
    DEMO_ACCESS_CODE: v.optional(v.string()),
  },
})

export default app
