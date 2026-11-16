/**
 * `pnpm probe:llm`: confirms what the configured provider supports, with one
 * cheap call per capability on the matcher model. Results go to
 * `bench/results/provider_probe.json`; a failed check names the flag to add
 * to `LLM_CAPS_OFF`.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { VERSION as SDK_VERSION } from '@anthropic-ai/sdk/version'
import {
  LlmConfigError,
  costUsd,
  createClient,
  roleConfig,
  tokenUsage,
} from '@preisspiegel/backend/llm/registry'
import { z } from 'zod'
import { loadLocalEnv } from '../../scripts/localEnv'
import type { Capability, RoleConfig } from '@preisspiegel/backend/llm/registry'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const resultsPath = resolve(repoRoot, 'bench/results/provider_probe.json')

interface Check {
  ok: boolean
  detail: string
  ms: number
  usd: number
}

type CheckName = 'basic' | Capability

interface Outcome {
  detail: string
  usd: number
}

async function main(): Promise<void> {
  loadLocalEnv()

  const config = roleConfig('match', process.env)
  if (config === null) {
    throw new LlmConfigError('The match role is off; nothing to probe.')
  }
  const client = createClient(process.env)

  console.log(
    `Probing ${config.provider} with ${config.model} (${config.wireModel})`,
  )

  const checks: Record<CheckName, Check> = {
    basic: await run('basic', () => probeBasic(client, config)),
    effort: await run('effort', () => probeEffort(client, config)),
    structured_outputs: await run('structured_outputs', () =>
      probeStructuredOutputs(client, config),
    ),
    strict_tools: await run('strict_tools', () =>
      probeStrictTools(client, config),
    ),
    prompt_cache: await run('prompt_cache', () =>
      probePromptCache(client, config),
    ),
  }

  const capsOff = (Object.keys(checks) as Array<CheckName>).filter(
    (name) => name !== 'basic' && !checks[name].ok,
  )
  const report = {
    provider: config.provider,
    model: config.model,
    wire_model: config.wireModel,
    sdk_version: SDK_VERSION,
    ran_at: new Date().toISOString(),
    git_sha: gitSha(),
    checks,
    total_usd: round(
      Object.values(checks).reduce((sum, check) => sum + check.usd, 0),
    ),
    recommended_llm_caps_off: capsOff.join(','),
  }

  mkdirSync(dirname(resultsPath), { recursive: true })
  writeFileSync(resultsPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`\nWrote ${resultsPath}`)
  console.log(`Total: $${report.total_usd}`)

  if (!checks.basic.ok) {
    console.error('\nThe basic call failed, so no model call will work.')
    process.exitCode = 1
  } else if (capsOff.length > 0) {
    console.log(`\nSet LLM_CAPS_OFF=${capsOff.join(',')} for this provider.`)
  }
}

async function run(
  name: CheckName,
  probe: () => Promise<Outcome>,
): Promise<Check> {
  const started = performance.now()
  let check: Check
  try {
    const outcome = await probe()
    check = { ok: true, ...outcome, ms: 0 }
  } catch (error) {
    check = { ok: false, detail: describeError(error), ms: 0, usd: 0 }
  }
  check.ms = Math.round(performance.now() - started)
  check.usd = round(check.usd)
  console.log(`  ${check.ok ? 'ok  ' : 'FAIL'} ${name}: ${check.detail}`)
  return check
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

async function probeBasic(
  client: Anthropic,
  config: RoleConfig,
): Promise<Outcome> {
  const message = await client.messages.create({
    model: config.wireModel,
    max_tokens: 1000,
    messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
  })
  expectStop(message.stop_reason, 'end_turn')
  const text = textOf(message).trim()
  if (text === '') throw new Error('empty response')
  return {
    detail: `stop_reason=${message.stop_reason} text=${JSON.stringify(text)}`,
    usd: cost(config, message),
  }
}

async function probeEffort(
  client: Anthropic,
  config: RoleConfig,
): Promise<Outcome> {
  const message = await client.messages.create({
    model: config.wireModel,
    max_tokens: 1000,
    output_config: { effort: 'low' },
    messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
  })
  expectStop(message.stop_reason, 'end_turn')
  return {
    detail: `output_config.effort=low accepted; stop_reason=${message.stop_reason}`,
    usd: cost(config, message),
  }
}

const OfferLine = z.object({
  article: z.string(),
  rated_current_a: z.number(),
  poles: z.number(),
})

async function probeStructuredOutputs(
  client: Anthropic,
  config: RoleConfig,
): Promise<Outcome> {
  const message = await client.messages.parse({
    model: config.wireModel,
    max_tokens: 2000,
    output_config: { effort: 'low', format: zodOutputFormat(OfferLine) },
    messages: [
      {
        role: 'user',
        content:
          'Extract the article, rated current in amps and number of poles: "LS-Schalter B16 3-polig, 10 kA"',
      },
    ],
  })
  expectStop(message.stop_reason, 'end_turn')
  const parsed = message.parsed_output
  if (parsed === null) throw new Error('parsed_output is null')
  if (parsed.rated_current_a !== 16 || parsed.poles !== 3) {
    throw new Error(`unexpected extraction ${JSON.stringify(parsed)}`)
  }
  return {
    detail: `parsed=${JSON.stringify(parsed)}`,
    usd: cost(config, message),
  }
}

async function probeStrictTools(
  client: Anthropic,
  config: RoleConfig,
): Promise<Outcome> {
  const message = await client.messages.create({
    model: config.wireModel,
    max_tokens: 2000,
    output_config: { effort: 'low' },
    tools: [
      {
        name: 'search_offers',
        description:
          'Search supplier offer lines. Call this to look up an article.',
        strict: true,
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            max_results: { type: 'integer' },
          },
          required: ['query', 'max_results'],
          additionalProperties: false,
        },
      },
    ],
    messages: [
      {
        role: 'user',
        content:
          'Use the search_offers tool to find up to 5 offer lines for "NYM-J 5x16".',
      },
    ],
  })
  expectStop(message.stop_reason, 'tool_use')
  const call = message.content.find((block) => block.type === 'tool_use')
  if (call === undefined) throw new Error('no tool_use block')
  const input = z
    .object({ query: z.string(), max_results: z.number().int() })
    .strict()
    .parse(call.input)
  return {
    detail: `stop_reason=tool_use input=${JSON.stringify(input)}`,
    usd: cost(config, message),
  }
}

async function probePromptCache(
  client: Anthropic,
  config: RoleConfig,
): Promise<Outcome> {
  // A stable prefix long enough to clear any model's minimum cacheable size.
  // The nonce keeps this run from hitting an entry left by an earlier run.
  const nonce = Date.now().toString(36)
  const system = [
    `Probe ${nonce}. You answer questions about the catalogue below.`,
    ...Array.from(
      { length: 600 },
      (_, i) =>
        `Artikel ${1000 + i}: Leitungsschutzschalter, Charakteristik B, Bemessungsstrom ${6 + (i % 58)} A, ${1 + (i % 4)}-polig, Schaltvermögen 10 kA.`,
    ),
  ].join('\n')

  const ask = () =>
    client.messages.create({
      model: config.wireModel,
      max_tokens: 1000,
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
      ],
      messages: [
        { role: 'user', content: 'Reply with the single word: ready' },
      ],
    })

  const first = await ask()
  const second = await ask()
  const written = first.usage.cache_creation_input_tokens ?? 0
  const read = second.usage.cache_read_input_tokens ?? 0
  if (read === 0) {
    throw new Error(
      `no cache hit on the repeat call (first call cache_write=${written})`,
    )
  }
  return {
    detail: `first call cache_write=${written}, second call cache_read=${read}`,
    usd: cost(config, first) + cost(config, second),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cost(config: RoleConfig, message: Anthropic.Message): number {
  return costUsd(config.model, tokenUsage(message.usage))
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
}

function expectStop(actual: string | null, expected: string): void {
  if (actual !== expected) {
    throw new Error(`stop_reason=${actual}, expected ${expected}`)
  }
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'authentication failed (401): check the API key'
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'rate limited (429) after retries'
  }
  if (error instanceof Anthropic.BadRequestError) {
    return `rejected (400): ${error.message}`
  }
  if (error instanceof Anthropic.APIError) {
    return `API error ${error.status}: ${error.message}`
  }
  return error instanceof Error ? error.message : String(error)
}

function gitSha(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return 'uncommitted'
  }
}

function round(usd: number): number {
  return Number(usd.toFixed(6))
}

main().catch((error: unknown) => {
  console.error(error instanceof LlmConfigError ? error.message : error)
  process.exitCode = 1
})
