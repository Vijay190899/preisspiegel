# Preisspiegel — agent guide

Tender pricing for electrical contractors: a Leistungsverzeichnis and supplier offers go in, every position comes out matched and priced, and the estimator sees only what needs a decision. Every number traces to its source. A public portfolio demo.

## Verify every change

**Find the cheapest check that actually proves the change works, run it, and only then move on, including between steps of one task.**

| Change                                          | Sufficient check                                                                                                                                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure logic (`packages/core`, `llm/registry.ts`) | targeted `pnpm exec vitest run <file>` + `pnpm lint` + `pnpm typecheck`                                                                                                                             |
| Convex function                                 | push to the local deployment, `pnpm -C services/backend exec convex run <module>:<fn>`, assert the result shape                                                                                     |
| Parser or generator                             | round-trip test; same seed gives byte-identical output                                                                                                                                              |
| Pipeline or agent step                          | unit test in `packages/core`, then `pnpm bench:replay` (stored answers, no model). A trial run: `convex run agent/run:start '{"slug":"demo","limit":120}'`; check reason codes and the ledger total |
| LLM code                                        | one real call: check `stop_reason`, tokens and $ in the ledger, `cache_read_input_tokens > 0` on the repeat call                                                                                    |
| UI                                              | `pnpm shots <path>` (four widths, light and dark, zero console errors, no overflow), then look at the images. `pnpm probe:ui` for behaviour                                                         |
| Docs or config                                  | links resolve, JSON and YAML parse                                                                                                                                                                  |

Rules:

- A failed check is fixed before anything else.
- When reporting done, state the evidence (command and result).
- Never call something done on an unverified change.
- Run `pnpm check` before every commit and at each milestone gate.
- Stop at every milestone gate, show the evidence, and wait for "go".

## Read order (stop when you have enough)

1. `docs/HANDOVER.md`: current state, setup, open items. **Update it at every milestone gate.**
2. `docs/BUILD_PLAN.md`: the current milestone and its gate.
3. Only the PRD and ARCHITECTURE sections the task touches.
4. Before any Convex code: `services/backend/convex/_generated/ai/guidelines.md`. It overrides what you remember about Convex.
5. Before any Anthropic SDK code: load the `claude-api` skill.

## Stack and commands

- pnpm workspace, TypeScript throughout, Node 24.
- `apps/web`: TanStack Start, React 19, TanStack Query, Tailwind v4.
- `services/backend`: Convex (functions in `convex/`).
- `packages/core`: pure logic shared by backend, bench and generator. No runtime-specific imports.
- `data`: seeded tender generator. `bench`: benchmarks and the provider probe.
- Root scripts are the only entry points: `pnpm check` · `pnpm dev` · `pnpm build` · `pnpm seed` · `pnpm shots` · `pnpm probe:ui` · `pnpm probe:llm` · `pnpm env:push` · `pnpm bench` · `pnpm bench:replay` · `pnpm bench:heldout`.
- `pnpm seed generate` rewrites `data/seed/` and must be re-run whenever the generator changes; a test fails if the committed files are stale. `pnpm seed load` needs `pnpm dev` running.
- Convex runs as a local deployment with no account in development. In a shell without a Convex login, set `CONVEX_AGENT_MODE=anonymous` for the first `convex dev`.

## Non-negotiables

- **All LLM access goes through `services/backend/convex/llm/`.** `registry.ts` builds the client, maps model IDs and owns the price table. `client.ts` is the only call path. Never construct a client or write a model ID anywhere else.
- **Model roles come from env.** Defaults: matcher and investigator `claude-haiku-5-5`, escalation off. Do not default any role to a larger model. A larger model is switched on only after a benchmark shows it earns its cost.
- Current API rules: adaptive thinking (no `budget_tokens`); no `temperature`, `top_p` or `top_k`; no forced `tool_choice` (use `auto` plus `strict: true`); always check `stop_reason`; cache stable prefixes.
- **The model proposes, code decides.** Every extracted attribute carries a verbatim quote that code verifies against the source. Auto-accept requires every deterministic check to pass.
- **LLMs never originate numbers.** Prices, quantities and totals are parsed from the source by code.
- Every LLM call goes through the ledger and the daily budget guard.
- Secrets live in `.env.local` and the Convex deployment env. Never in prompts, logs or commits.
- **The pipeline never reads `data/seed/truth.json`.** Only the benchmarks do.
- **`pnpm bench --start` and `pnpm bench:heldout` call the model and cost money** (about 40 cents a full run). Try a change with `pnpm bench:replay` first. Never tune anything against the held-out tender; if it is looked at for a fix, generate a new one for the next number.
- A change to the matcher's instructions changes `PROMPT_VERSION` in `agent/prompt.ts`, which starts a new answer cache.
- **Fictional names only.** No real company's name, branding or copy in the UI, the README or the docs. All data is synthetic and labelled as such.
- In Convex code, read configuration from the typed `env` export, never `process.env`.

## Audit at every gate

An independent audit closes each milestone (ADR-23). A fresh agent with no part in the work re-runs the gate in a clean checkout, recounts every number in the docs, searches for breaches of the non-negotiables, and ranks what to tighten. Fix high-severity findings before reporting the gate. List the rest in `docs/HANDOVER.md` and log deviations in `docs/DECISIONS.md`. Give the user the auditor's verdict with the gate evidence, not a softened version of it.

## Frontend quality bar

- The direction is "Weidenufer" (ADR-42, PRD §7): the building the tender is for, seen across the river at night. Every position is a window, lit when priced and red when it needs a person. The light of a window is also the colour of the one primary action; red means "a person decides" and nothing else. Use the building blocks in `apps/web/src/styles/app.css`: `display` for what is said large, `heading` for a section, `statement` for the sentence that says how things stand, `caption` for field names, `num` for figures, `code` for ordinal and article numbers, `lamp` for status, `traceable` for a value that leads to its source, `action` for the one primary action. No drop-in component library.
- One headline, one sentence and one action per view. Detail opens on request. If a view feels crowded, remove something before adding a container. No label above a heading, no boxed alert, no grid of equal cards; a comparison is columns ruled apart.
- Motion answers an action, apart from the lights coming on across the building. That sequence is CSS, so it needs no script and ends at once under reduced motion; every other animation goes through `usePace()` in `src/lib/pace.ts`, which keeps the starting state in the markup and removes the way there.
- No capitals for labels, no arrows on links, no mono for running text.
- A layout inside a position follows the room the position has (container queries on `.sheet`), not the screen: with a document open beside it, it is half as wide.

- Tokens live in `apps/web/src/styles/tokens.css` and are the single source of colour. Use the Tailwind utilities mapped from them (`bg-surface`, `text-ink-2`), never raw hex in components.
- Figures use the `num` class so columns line up.
- Status colours carry meaning (priced, open, caution, approved) and are never decoration. They ship with a label, never colour alone. Every new colour pair is added to `src/styles/tokens.test.ts`; a chart that needs more than these goes through the `dataviz` skill's validator first.
- Every value shown has a source. If it cannot be traced, it is not shown.
- UI copy is German first with an English mirror in `src/lib/i18n.ts`. Domain terms stay German in both.
- Honour `prefers-reduced-motion`. Keyboard access and visible focus on everything interactive; a long list is one Tab stop. A new behaviour gets a check in `scripts/uiProbe.ts`.

## Git

- Small commits at each gate: `feat(m2): matcher step + quote verification`.
- **Work on a branch and open a pull request** (ADR-44). Nothing is committed straight to `main`; the merge is the owner's.
- **Do not add `Co-Authored-By` trailers or any AI attribution to commits or PRs.**
- Log deviations from the plan in `docs/DECISIONS.md` (one numbered line plus why).
