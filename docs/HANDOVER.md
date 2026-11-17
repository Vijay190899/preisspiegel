# Handover — read this first in a new session or on a new machine

## 1. Where we are

**M0, M1 and M2 are built. M2 has been audited; its one high-severity finding is fixed. Waiting for a "go" for M3.** Updated 2026-11-17.

Two pull requests are open and neither is merged: the third interface direction (`design/third-direction`) and, stacked on it, the fix for the audit's finding (`fix/m2-audit-search`). `main` is still at the M2 commit.

Built and verified:

- **M0:** workspace, task runner, CI, model layer with cost meter. The provider probe passed on OpenRouter with `claude-haiku-5-5` (`bench/results/provider_probe.json`).
- **M1:** GAEB and PDF readers in `packages/core`; a seeded tender of 1,170 positions with three supplier offers and 60 planted traps; `pnpm seed`. See [DATA](DATA.md).
- **M2, pipeline:** the lines that could answer a position, found by reference, by text and by quantity; the matcher on `claude-haiku-5-5`; quote verification; comparison of values by arithmetic; per-line checks; attribution of by-article lines by quantity; the decision ([ARCHITECTURE §4](ARCHITECTURE.md#4-pipeline-built-in-packagescoresrcpipelinets)). The agent runtime runs it in batches with an event log, budgets and an answer cache ([§3](ARCHITECTURE.md#3-backend-servicesbackend)).
- **M2, benchmarks:** `pnpm bench` (B1 to B3), `pnpm bench:replay`, `pnpm bench:heldout`, `pnpm bench:seeds`. On the newest tender the pipeline had not seen (seed 501, one run): everything it prices by itself is rightly priced without a person; every expected review is found; 94.7% of raised reviews belong; 58 of 60 traps; seven positions are priced at a valid offer that is not the cheapest, 1,417 € of 781,237 €. One full run costs about 40 cents on an empty cache. [DATA](DATA.md#what-the-benchmarks-show) has the table, the first run, both unseen runs and the failures written up.
- **Interface, "Weidenufer" (ADR-42), the third direction:** the overview is the front of the building at night with one window per position, lit when priced and red when it needs a person, mirrored in the river; it says how many positions are priced, how many wait for a decision and how many euros rest on them, and lists the costliest decisions. A window says what it is and opens its position. A position shows what was decided as a sentence, the suppliers side by side with their prices on one scale, findings in words with the arithmetic and, for a measure, a drawing to scale, and where its window is in the building. A traced number opens its document beside the position at the place it was read.
- `pnpm check` green: lint, formatting, typecheck of six projects, 306 tests. `pnpm build` green. `pnpm shots` green on six routes at four widths in both themes. `pnpm probe:ui` green: 34 behaviour checks.

**Audits so far.** Three, each by an agent with no part in the work, and each with the verdict "on plan, with gaps". The third, of M2, in its own words: "The gate passes on re-run and every table figure recounts, but the write-up of the unseen-tender failures is wrong in its cause, and the deterministic part is fitted to seed 118: a perfect reader fails on 6 of 9 other seeds." That finding is fixed and the write-up corrected (ADR-45 to 47). Its medium and low findings are open items below. It also judged the second interface: distinctive on the overview, ordinary in the workspace. That interface has since been replaced; the third has not been audited.

**What an honest reader should know about the numbers:**

- The demo tender agrees with its ground truth on every position. That was reached by changing the prompt and the checks while looking at that tender, so it is not the headline. The first run and the unseen tenders are ([ADR-37, 38, 46](DECISIONS.md)).
- The first unseen tender (seed 119) was run before the search was fixed, and its write-up named the wrong cause. The second (seed 501) was run once after the fix. Both took part of their answers from the cache.
- With flawless reading the checks still disagree with the ground truth on two of eight further tenders (`pnpm bench:seeds`). Those two have not been looked into.
- The weak spot that remains is luminaires that differ from another tendered luminaire in one word, quoted by article.
- The unseen tenders come from the same generator, so they are unseen in their numbers, not in their language.
- The order of "first run, changes, unseen run" in M2 rests on file times; git does not show it.

Next, after a "go": M3 (labor and the copper surcharge, run replay and the access code, starting a run from the interface, the `/bench` page), starting with the audit's runtime findings, because labor matching will run on the same runtime.

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

- **Luminaire variants that differ in one word** are attributed to the wrong kind when quoted by article ([DATA](DATA.md#where-it-fails-on-the-newest-unseen-tender-seed-501)). Group positions by their compared attributes instead of their short text. Seeds 119 to 123, 2026 and 501 have been read; measure on others.
- **A line quoted for part of a kind beside another line of the same supplier** cannot be attributed, because a kind stands or falls together (seed 121).
- **From the M2 audit, medium:**
  - Quotes and values are checked by substring: "10" passes with "(100 m/Ring)", "50 A" with "250 A", and a "same" answer that leaves out the one attribute that differs confirms the wrong product. Match on word boundaries and require the attributes the long text states with a unit.
  - The attribution leans on how the generator writes by-article quantities (exact totals; rounding only on single-position lines; the same 30% allowance in both). Plant rounded by-article lines.
  - Ledger rows are written when a batch is stored, so up to 30 billed calls are on no ledger if the action dies between the calls and the write. A step that dies leaves the run in its state for good: there is no watchdog. `prepare` is not safe to run twice, and two runs of one tender can run at once. Nothing tests `run.ts`, `store.ts` or `prompt.ts`.
  - The answer cache is keyed by a prompt version kept by hand. Hash the instructions and the answer schema into the key.
  - `decide` and the ground truth differ at the edges: an only offer with an unreadable price is priced at nothing, and a price is called an outlier against offers of other products.
- **From the M2 audit, low:** a review counts as found whatever its reason, and the euro error of a wrongly automatic position is only the price difference; `score.ts` and `judges.ts` have no test; the review queue is cut at 300 without saying so; one document title for every route.
- **A model call that fails** leaves its lines unconfirmed; the position is still priced if another supplier answers it cleanly, and nothing on it says a line went unread.
- **Labor is not priced** (ADR-40). The labor time table is loaded and unused.
- **A trial run over part of the tender** (`limit`) decides by-article lines wrongly, because their quantities cover the whole tender. Trial runs are for checking that the steps work, not for scores.
- **The model is not perfectly even:** the same article is occasionally read differently for two positions, and once in several hundred answers it compares an attribute with a brand name. The quantity rules absorb most of it; they should not be the only defence.
- **The list query sends every position** (about 280 kB). Status comes from its own small query, so a run does not re-send the list, but the first load is heavy.
- **The GAEB source downloads the whole file** to show one item. The excerpt should come from Convex.
- **The palette does not lock the page behind it.**
- **B3 says a number the readers took is where the interface points, not that it is right,** and it does not cover figures worked out from those numbers or the values the model compared.
- Convex cloud deployment and Vercel project: needed at M4, both need the owner's accounts.

## 6. Update protocol

At every gate: update §1 (what is built, what is open, what is next), move resolved items out of §5, and add any deviation to DECISIONS.
