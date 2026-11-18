/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent_gate from "../agent/gate.js";
import type * as agent_labor from "../agent/labor.js";
import type * as agent_laborPrompt from "../agent/laborPrompt.js";
import type * as agent_prompt from "../agent/prompt.js";
import type * as agent_run from "../agent/run.js";
import type * as agent_store from "../agent/store.js";
import type * as crons from "../crons.js";
import type * as decisions from "../decisions.js";
import type * as demo from "../demo.js";
import type * as health from "../health.js";
import type * as labor from "../labor.js";
import type * as limits from "../limits.js";
import type * as llm_call from "../llm/call.js";
import type * as llm_client from "../llm/client.js";
import type * as llm_ledger from "../llm/ledger.js";
import type * as llm_registry from "../llm/registry.js";
import type * as llm_structured from "../llm/structured.js";
import type * as positions from "../positions.js";
import type * as runs from "../runs.js";
import type * as session from "../session.js";
import type * as tenders from "../tenders.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "agent/gate": typeof agent_gate;
  "agent/labor": typeof agent_labor;
  "agent/laborPrompt": typeof agent_laborPrompt;
  "agent/prompt": typeof agent_prompt;
  "agent/run": typeof agent_run;
  "agent/store": typeof agent_store;
  crons: typeof crons;
  decisions: typeof decisions;
  demo: typeof demo;
  health: typeof health;
  labor: typeof labor;
  limits: typeof limits;
  "llm/call": typeof llm_call;
  "llm/client": typeof llm_client;
  "llm/ledger": typeof llm_ledger;
  "llm/registry": typeof llm_registry;
  "llm/structured": typeof llm_structured;
  positions: typeof positions;
  runs: typeof runs;
  session: typeof session;
  tenders: typeof tenders;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
