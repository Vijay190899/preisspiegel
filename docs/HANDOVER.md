# Handover — read this first in a new session or on a new machine

## 1. Where we are

**M0, M1 and M2 are built. M2 is at its gate, waiting for its audit and a "go".** Updated 2026-11-17.

Built and verified:

- **M0:** workspace, task runner, CI, model layer with cost meter. The provider probe passed on OpenRouter with `claude-haiku-5-5` (`bench/results/provider_probe.json`).
- **M1:** GAEB and PDF readers in `packages/core`; a seeded tender of 1,170 positions with three supplier offers and 60 planted traps; `pnpm seed`. See [DATA](DATA.md).
- **M2, pipeline:** search for the lines that could answer a position, the matcher on `claude-haiku-5-5`, quote verification, comparison of values by arithmetic, per-line checks, attribution of by-article lines by quantity, and the decision ([ARCHITECTURE §4](ARCHITECTURE.md#4-pipeline-built-in-packagescoresrcpipelinets)). The agent runtime runs it in batches with an event log, budgets and an answer cache ([§3](ARCHITECTURE.md#3-backend-servicesbackend)).
- **M2, benchmarks:** `pnpm bench` (B1 to B3), `pnpm bench:replay`, `pnpm bench:heldout`. On a tender the pipeline had not seen: 99.4% of what it prices by itself is right, with a euro error of zero; 57 of 60 traps found; 93.3% of expected reviews found; 85.7% of raised reviews belong; every shown number is at its source. One full run costs about 40 cents. [DATA](DATA.md#what-the-benchmarks-show) has the table, the first run, and the failure written up.
- **Interface, "Weidenufer" (ADR-42), the third direction:** the overview is the front of the building at night with one window per position, lit when priced and red when it needs a person, mirrored in the river; it says how many positions are priced, how many wait for a decision and how many euros rest on them, and lists the costliest decisions. A window says what it is and opens its position. A position shows what was decided as a sentence, the suppliers side by side with their prices on one scale, findings in words with the arithmetic and, for a measure, a drawing to scale, and where its window is in the building. A traced number opens its document beside the position at the place it was read.
- `pnpm check` green: lint, formatting, typecheck of six projects, 298 tests. `pnpm build` green. `pnpm shots` green on six routes at four widths in both themes. `pnpm probe:ui` green: 34 behaviour checks.

**Audits so far.** The first (M0 and M1) and the second (the first interface and the fixes to the first audit) both said "on plan, with gaps". Their findings are closed, each with a test or a probe check, except the ones listed under open items below. The audit of M2 is the next thing to run.

**What an honest reader should know about the numbers:**

- The demo tender now agrees with its ground truth on every position. That was reached by changing the prompt and the checks while looking at that tender, so it is not the headline. The first run and the unseen tender are ([ADR-37, 38](DECISIONS.md)).
- Every miss on the unseen tender has one cause: luminaires quoted by article in variants that share a short text. A perfect reader misses some of them too.
- The unseen tender comes from the same generator, so it is unseen in its numbers, not in its language.

Next, after the gate: M3 (labor and the copper surcharge, run replay and the access code, starting a run from the interface, the `/bench` page).

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
- `pnpm shots` and `pnpm probe:ui` drive the Chrome installed on the machine and need `pnpm dev` running with the seed loaded and a finished run. A fresh deployment has no run: `pnpm bench --start` makes one (about 40 cents on a cold answer cache, nothing on a warm one).

## 3. Decisions already made (do not re-litigate)

The full list is [DECISIONS](DECISIONS.md). The ones a new session is most likely to question:

- **Haiku 5.5 does the bulk work and escalation is off** (ADR-4). No role defaults to a larger model.
- **The model proposes, code decides; LLMs never originate numbers** (ADR-2, 3).
- **OpenRouter by default**, Anthropic direct as a switch (ADR-5).
- **Own agent runtime on Convex**, not an agent framework (ADR-6).
- **Synthetic data, fictional names** (ADR-1). No real company's name, branding or copy anywhere.
- **The ground truth stays out of the database** (ADR-17). Only the benchmarks read `data/seed/truth.json`.
- **The interface is "Weidenufer", built by hand on the tokens** (ADR-42, 21). One headline, one sentence, one action per view; no component library. Night is the default theme.
- **Branches and pull requests** (ADR-44). Nothing goes straight to `main`.
- **An independent audit closes every milestone** (ADR-23).

## 4. Working agreements

- Verify every change with the cheapest sufficient check and report the evidence. Never say "done" on an unverified change.
- Stop at every milestone gate, show the evidence, and wait for "go".
- No AI attribution anywhere in git: no `Co-Authored-By` trailers, no "Generated with" footers.
- Cost-conscious runtime models, swappable by environment variable, and documented as such.
- Small commits at each gate.

## 5. Open items

- **Lighting variants that share a short text** defeat the attribution by quantity (ADR-33). Group positions by their compared attributes instead. This is the one known cause of wrong decisions.
- **Labor is not priced** (ADR-40). The labor time table is loaded and unused.
- **A trial run over part of the tender** (`limit`) decides by-article lines wrongly, because their quantities cover the whole tender. Trial runs are for checking that the steps work, not for scores.
- **The model is not perfectly even:** the same article is occasionally read differently for two positions, and once in several hundred answers it compares an attribute with a brand name. The quantity rules absorb most of it; they should not be the only defence.
- **The list query sends every position** (about 280 kB). Status comes from its own small query, so a run does not re-send the list, but the first load is heavy.
- **The GAEB source downloads the whole file** to show one item. The excerpt should come from Convex.
- **The palette does not lock the page behind it.**
- **B3 says a number is where the interface points, not that it is right.**
- Convex cloud deployment and Vercel project: needed at M4, both need the owner's accounts.

## 6. Update protocol

At every gate: update §1 (what is built, what is open, what is next), move resolved items out of §5, and add any deviation to DECISIONS.
