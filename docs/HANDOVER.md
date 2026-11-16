# Handover — read this first in a new session or on a new machine

## 1. Where we are

**M1 Data and parsers: built, at its gate.** Updated 2026-11-16.

Built and verified in M1:

- `packages/core`: GAEB DA XML reader and writer (phases 83 and 84), German number parsing, and a PDF table reader that keeps the page and rectangle of every field.
- `data`: a seeded generator for the catalogue (254 products), the tender (1,170 positions), three supplier offers (two PDF layouts, one GAEB X84), 60 planted traps and the ground truth. See [DATA](DATA.md).
- `pnpm seed`: writes `data/seed/`, parses it back with the real readers, loads Convex.
- Convex tables `tenders`, `documents`, `positions`, `offerLines`; queries `tenders:get` and `tenders:position`.
- `pnpm check` green: lint, formatting, typecheck of six projects, 56 tests.

M1 gate evidence:

- Same seed, same bytes: a test generates twice and compares, and a second test compares against the committed files.
- Round trips: 1,170 of 1,170 positions from the X83; 994 of 994 wholesaler lines and 80 of 80 specialist lines from the PDFs, field for field, with no reader warnings; 847 of 847 priced positions from the X84.
- Every price, quantity and total read from a PDF has a rectangle on the page that contains that value (3,222 checks).
- The seed loads: 1,170 positions and 1,921 offer lines, passing schema validation.

The M0 gate is closed: `pnpm probe:llm` passed on OpenRouter with `claude-haiku-5-5` on 2026-11-17. Structured outputs, strict tools, effort and prompt caching all work; results are in `bench/results/provider_probe.json`. `llm/client.ts` has still made no real call; the first one happens in M2.

Next: M2, pipeline, runtime and benchmarks. See [BUILD_PLAN](BUILD_PLAN.md).

## 2. Setup

Needs Node 24 and Corepack (ships with Node).

```bash
corepack enable
pnpm install
cp .env.example .env.local      # add OPENROUTER_API_KEY
pnpm env:push                   # with pnpm dev running: copies the key and model roles to Convex
pnpm dev                        # Convex local deployment + web on :3000
pnpm seed load                  # in a second terminal: loads the demo tender
pnpm check
```

- The first `pnpm dev` on a machine without a Convex login asks whether to sign in. To skip that and use a local deployment with no account, run it once as `CONVEX_AGENT_MODE=anonymous pnpm dev`. The choice is saved in `services/backend/.env.local`.
- A local Convex deployment only runs while `pnpm dev` does. `pnpm seed load` and `convex run` need it up.
- After changing the Convex schema or `convex.config.ts`, `pnpm dev` regenerates `convex/_generated/`, which is committed.
- `pnpm env:push` copies `.env.local` into the Convex deployment's environment. Run it after changing a model role or a key.
- `pnpm shots` drives the Chrome installed on the machine.

## 3. Decisions already made (do not re-litigate)

The full list is [DECISIONS](DECISIONS.md). The ones a new session is most likely to question:

- **Haiku 5.5 does the bulk work and escalation is off** (ADR-4). No role defaults to a larger model.
- **The model proposes, code decides; LLMs never originate numbers** (ADR-2, 3).
- **OpenRouter by default**, Anthropic direct as a switch (ADR-5).
- **Own agent runtime on Convex**, not an agent framework (ADR-6).
- **Synthetic data, fictional names** (ADR-1). No real company's name, branding or copy anywhere.
- **The ground truth stays out of the database** (ADR-17). Only the benchmarks read `data/seed/truth.json`.

## 4. Working agreements

- Verify every change with the cheapest sufficient check and report the evidence. Never say "done" on an unverified change.
- Stop at every milestone gate, show the evidence, and wait for "go".
- No AI attribution anywhere in git: no `Co-Authored-By` trailers, no "Generated with" footers.
- Cost-conscious runtime models, swappable by environment variable, and documented as such.
- Small commits at each gate.

## 5. Open items

- Convex cloud deployment and Vercel project: needed at M4, both need the owner's accounts.
- The web app does not show the loaded tender yet. That is M3.
- The source viewer (M3) needs the PDFs served to the browser. They are committed under `data/seed/` and not yet copied to the web app.

## 6. Update protocol

At every gate: update §1 (what is built, what is open, what is next), move resolved items out of §5, and add any deviation to DECISIONS.
