# Handover — read this first in a new session or on a new machine

## 1. Where we are

**M0 and M1 are closed and audited. The interface was rebuilt in a new direction and audited again. M2 is next.** Updated 2026-11-17.

Built and verified:

- **M0:** workspace, task runner, CI, model layer with cost meter. The provider probe passed on OpenRouter with `claude-haiku-5-5`: every check returned the expected shape, and prompt caching showed a cache read on the repeat call (`bench/results/provider_probe.json`).
- **M1:** GAEB and PDF readers in `packages/core`; a seeded tender of 1,170 positions with three supplier offers and 60 planted traps; `pnpm seed`; the tender tables in Convex. See [DATA](DATA.md).
- **Interface, "Schaltplan" (ADR-26):** the overview draws the tender as a single-line diagram that switches on once; the positions workspace has a virtualised list, the open position, and one row per offer; a traced number opens its document beside the position, at the page and the place it was read, while the list gives way (ADR-31); ⌘K jump; German and English; light and dark.
- `pnpm check` green: lint, formatting, typecheck of six projects, 174 tests. `pnpm build` green. `pnpm shots` green on five routes at 390, 1024, 1280 and 1440 px in both themes. `pnpm probe:ui` green: 21 behaviour checks.

**First audit (M0 and M1): on plan, with gaps.** Every count in the docs was recounted and holds, and no non-negotiable was breached. Fixed since: the model call path records a billed call before reading its answer (ADR-24); the PDF reader warns in four cases where it used to drop text; overstated claims were corrected; deviations logged (ADR-25).

**Second audit (the first interface and those fixes): on plan, with gaps.** Its words: the slice "is not yet stunning, one displayed figure is wrong under its label, the layout breaks at 1280 to 1440 px, and the two fixes close the reported paths but not the whole class". No non-negotiable was breached and every count held. What was done with it:

- The interface it reviewed was replaced (ADR-26). Its defects were checked against the new one and are closed, each with a check in `pnpm probe:ui` or a test: a price per ring labelled per metre; offer columns overflowing at 1280 px; 1,170 Tab stops in front of the numbers; the palette reopening on Enter; a crash on `?quelle=123` and an empty list on `?titel=10`; contrast failures; the description link marking the wrong element; a PDF too small to read; the document language after a reload; step arrows ignoring the title filter.
- Still open, scheduled first in M2: the PDF reader loses lines without a warning on two ordinary layouts (left-aligned headers over right-aligned numbers; an indented continuation that reaches the quantity column). `llmParse` still throws on a provider error and loses the answer if the ledger write fails, and has no test of its own.
- Still open, later: the list query sends every position (about 280 kB), so live status needs its own query; the GAEB source downloads the whole file to show one item; the palette does not lock the page behind it.
- Docs corrected where it found them wrong, and four unlogged deviations logged (ADR-27 to 29).

Open from the first audit, also first in M2 (see [BUILD_PLAN](BUILD_PLAN.md) and "What this data does not prove yet" in [DATA](DATA.md)):

- **The benchmark is too easy to mean much.** Six plain rules with no model reproduce the expected decision on 94.7% of positions. The generator needs clean lines with the same oddities, one price per article per offer, and a published no-model baseline.
- Disputed expectations in the ground truth.
- The GAEB reader mishandles mixed text and markup, some entities, prefixed namespaces and a missing quantity.
- No PDF from other software is tested yet. A wrapped header ("Artikel-" over "Nr.") is still not recognised.
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
- `pnpm shots` and `pnpm probe:ui` drive the Chrome installed on the machine and need `pnpm dev` running with the seed loaded.

## 3. Decisions already made (do not re-litigate)

The full list is [DECISIONS](DECISIONS.md). The ones a new session is most likely to question:

- **Haiku 5.5 does the bulk work and escalation is off** (ADR-4). No role defaults to a larger model.
- **The model proposes, code decides; LLMs never originate numbers** (ADR-2, 3).
- **OpenRouter by default**, Anthropic direct as a switch (ADR-5).
- **Own agent runtime on Convex**, not an agent framework (ADR-6).
- **Synthetic data, fictional names** (ADR-1). No real company's name, branding or copy anywhere.
- **The ground truth stays out of the database** (ADR-17). Only the benchmarks read `data/seed/truth.json`.
- **The interface is "Schaltplan", built by hand on the tokens** (ADR-26, 21). One headline, one sentence, one action per view; no component library.
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
