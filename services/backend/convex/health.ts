import { env, query } from './_generated/server'
import { resolveProvider, roleModels } from './llm/registry'

/** Liveness plus the model configuration the deployment is running with. */
export const get = query({
  args: {},
  handler: () => {
    return {
      ok: true as const,
      provider: resolveProvider(env),
      models: roleModels(env),
    }
  },
})
