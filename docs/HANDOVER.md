# Handover — read this first in a new session or on a new machine

## 1. Where we are

**M0 and M1 are closed and audited. A first slice of the interface is built. M2 has not started.** Updated 2026-11-17.

Built and verified:

- **M0:** workspace, task runner, CI, model layer with cost meter. The provider probe passed on OpenRouter with `claude-haiku-5-5`: every check returned the expected shape, and prompt caching showed a cache read on the repeat call (`bench/results/provider_probe.json`).
- **M1:** GAEB and PDF readers in `packages/core`; a seeded tender of 1,170 positions with three supplier offers and 60 planted traps; `pnpm seed`; the tender tables in Convex. See [DATA](DATA.md).
- **Interface:** the "Planblatt" design system; the overview; the positions workspace with a virtualised list, the open position with each supplier's offer side by side, and the source viewer that opens a PDF at the page a value was read from and marks it, or shows the GAEB item's lines; ⌘K jump. `pnpm shots` passes on the overview and on positions at 390 px and 1440 px in both themes.
- `pnpm check` green: lint, formatting, typecheck of six projects, 93 tests. `pnpm build` green.

**Audit of M0 and M1: on plan, with gaps.** Every count in the docs was recounted and holds, every gate check that could be re-run passed, and no non-negotiable was breached. Fixed since:

- The model call path could bill a call without recording it when an answer was cut off or malformed. It now records first and returns a typed failure (ADR-24). A role can no longer name a model without a price. Ledger rows carry a run id.
- The PDF reader dropped text silently in four cases. It now warns: no header found, a page without its own header, a priced row with no description. It also accepts centred headers and no longer mistakes an article named "Summen..." for a total. Twelve hand-written tables test it apart from the generator.
- Claims in the docs that overstated were corrected (trap density, which attributes the mismatches use, what the rectangle check proves, what the probe proves).
- Unlogged deviations are logged (ADR-25).

Open from the audit, scheduled as the first tasks of M2 (see [BUILD_PLAN](BUILD_PLAN.md) and "What this data does not prove yet" in [DATA](DATA.md)):

- **The benchmark is too easy to mean much.** Six plain rules with no model reproduce the expected decision on 94.7% of positions, because most trap kinds leave a mark no clean line has. The generator needs clean lines with the same oddities, one price per article per offer, and a published no-model baseline.
- Disputed expectations in the ground truth.
- The GAEB reader mishandles mixed text and markup, some entities, prefixed namespaces and a missing quantity.
- No PDF from other software is tested yet. A wrapped header ("Artikel-" over "Nr.") is still not recognised; the reader now says so instead of returning nothing quietly.
- The ledger patches one row per call and will contend under a concurrent batch: record per batch in M2.

`llm/client.ts` has still made no real call. The first is in M2.

Next: M2, starting with the audit items above. The interface continues alongside.

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
- **The interface is a drawing sheet, built by hand on the tokens** (ADR-20, 21). No component library, no rounded cards.
- **An independent audit closes every milestone** (ADR-23).

## 4. Working agreements

- Verify every change with the cheapest sufficient check and report the evidence. Never say "done" on an unverified change.
- Stop at every milestone gate, show the evidence, and wait for "go".
- No AI attribution anywhere in git: no `Co-Authored-By` trailers, no "Generated with" footers.
- Cost-conscious runtime models, swappable by environment variable, and documented as such.
- Small commits at each gate.

## 5. Open items

- Convex cloud deployment and Vercel project: needed at M4, both need the owner's accounts.
- The interface shows offer lines that name a position by ordinal number. The specialist's lines, which carry none, appear once the pipeline has matched them.
- Units arrive as each supplier prints them (ST, M, Stck, Mtr, RG, VE), and a PDF reader returns the micro sign as the Greek letter mu. Normalise before comparing or quoting.
- Reloading the tender replaces four tables; once runs and matches exist, a reload needs a reset that clears them too.

## 6. Update protocol

At every gate: update §1 (what is built, what is open, what is next), move resolved items out of §5, and add any deviation to DECISIONS.
