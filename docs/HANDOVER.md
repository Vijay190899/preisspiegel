# Handover — read this first in a new session or on a new machine

## 1. Where we are

**M0, M1 and M2 are built. M2 has been audited twice more since its gate; what the audits rated high is fixed and measured on tenders nobody had looked at. Waiting for a "go" for M3.** Updated 2026-11-18.

Two pull requests are open and neither is merged: the third interface direction (`design/third-direction`) and, stacked on it, the fixes for the audits' findings (`fix/m2-audit-search`). `main` is still at the M2 commit.

Built and verified:

- **M0:** workspace, task runner, CI, model layer with cost meter. The provider probe passed on OpenRouter with `claude-haiku-5-5` (`bench/results/provider_probe.json`).
- **M1:** GAEB and PDF readers in `packages/core`; a seeded tender of 1,170 positions with three supplier offers and 60 planted traps; `pnpm seed`. See [DATA](DATA.md).
- **M2, pipeline:** the lines that could answer a position, found by reference, by text and by quantity; the matcher on `claude-haiku-5-5`; quote verification; comparison of values by arithmetic; per-line checks; attribution of by-article lines by quantity, per kind of position; the decision ([ARCHITECTURE §4](ARCHITECTURE.md#4-pipeline-built-in-packagescoresrcpipelinets)). The agent runtime runs it in batches with an event log, budgets and an answer cache ([§3](ARCHITECTURE.md#3-backend-servicesbackend)).
- **M2, benchmarks:** `pnpm bench` (B1 to B3), `pnpm bench:replay`, `pnpm bench:heldout`, `pnpm bench:seeds`. On the newest tender the pipeline had not seen (seed 502, one run): everything it prices by itself is rightly priced without a person; 96 of 96 expected reviews are found; 98.0% of raised reviews belong; 60 of 60 traps; one position is priced 170 € too high. With flawless reading and no model, the checks agree with the ground truth on every position of 198 of 200 further tenders. One full run costs about 40 cents on an empty cache. [DATA](DATA.md#what-the-benchmarks-show) has the table, the first run, all three unseen runs, the sweep and the failures written up.
- **Interface, "Weidenufer" (ADR-42), the third direction:** the overview is the front of the building at night with one window per position, lit when priced and red when it needs a person, mirrored in the river; it says how many positions are priced, how many wait for a decision and how many euros rest on them, names the tender's titles, and lists the costliest decisions, one line per article. A window says what it is and opens its position. A position shows what was decided as a sentence, the suppliers side by side with their prices on one scale, findings in words with the arithmetic and, for a measure, a drawing to scale, and where its window is in the building. A traced number opens its document beside the position at the place it was read.
- `pnpm check` green: lint, formatting, typecheck of six projects, 315 tests. `pnpm build` green. `pnpm shots` green on six routes (`/`, `/positionen`, `/positionen?offen=true`, `/positionen/01.01.0020`, and that position with `?quelle=a.0.unitPrice` and `?quelle=lv.qty`) at four widths in both themes. `pnpm probe:ui` green: 34 behaviour checks.

**Audits so far.** Four, each by an agent with no part in the work, and each with the verdict "on plan, with gaps".

- The third, of M2: "The gate passes on re-run and every table figure recounts, but the write-up of the unseen-tender failures is wrong in its cause, and the deterministic part is fitted to seed 118: a perfect reader fails on 6 of 9 other seeds."
- The fourth, of the third interface and of the fix for that: "The gate re-runs green and every table figure recounts, but the high finding is narrowed, not closed: on 136 seeds nobody had named the search still loses true offers on 21, and a perfect reader prices positions that needed a person on 20." It also judged the interface: the lights coming on work, the reflection appeared too early, the front could not be read without hovering, and the lower half of the overview and the positions list still read as ordinary.
- Both were right. What they rated high is changed and measured on 200 tenders nobody had looked at (ADR-45, 48). Their medium and low findings that are not fixed are open items below. **The changes made after the fourth audit have not been audited.**

**What an honest reader should know about the numbers:**

- The demo tender agrees with its ground truth on every position. That was reached by changing the prompt and the checks while looking at that tender, so it is not the headline ([ADR-37, 38, 46, 49](DECISIONS.md)).
- Twice a fix was reported as done on the strength of a handful of tenders, and twice an audit showed it did not hold on others. The figure to trust is the sweep: 198 of 200 with flawless reading, a trap missed on 8 of 200.
- That sweep uses a perfect reader. With the model there is one run on the current checks, on one tender.
- Each unseen run took part of its answers from earlier tenders through the cache.
- The unseen tenders come from the same generator, so they are unseen in their numbers, not in their language.
- The order of "first run, changes, unseen run" in M2 rests on file times; git does not show it.

Next, after a "go": M3 (labor and the copper surcharge, run replay and the access code, starting a run from the interface, the `/bench` page, and deciding a position), starting with the audits' runtime findings, because labor matching will run on the same runtime.

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

- **Nothing can be decided.** A red window opens a position that can be read but not settled; the PRD has the estimator decide from the keyboard. It is in M3.
- **A by-article line for a single position that is read but not taken as an offer** (a bollard luminaire, on seeds 501 and 502): the position is priced with the next valid offer.
- **The model leaves a plain line open now and then** (two earthing conductors on seed 502), which raises a review nobody needs.
- **Seeds that have been read** and must not carry a headline again: 118 to 123, 2026, 7, 1, 999, 431 to 438, 501, 502, 3000 to 3149. Seeds 5000 to 5199 were scored, not read; the audits also ran 1 to 99, 200, 600 to 603, 777 to 999, 9001 to 9005, 31337 and 65536.
- **From the fourth audit, not fixed:**
  - The drawing of a measure (250 A, 199 A, "51 A less") shows values that come from the model's strings, with no link to a source, behind a quote check that is by substring.
  - The lower half of the overview is a ranked list beside two bar lists, and the positions list is a standard list. The plinth's groups do not stand under their bays. In the day theme a priced window is dark, so the picture of a lit house is gone.
  - Both shapes of the building are mounted (2,340 window elements); the pulse and the water never stop, about 290 ms of main-thread time in 5 s on an idle page.
  - On a phone the traced quantity is 14 by 26 px, text links are 16 px high and a tower window about 5 px.
  - The front is sized for this tender: more positions mean windows under 4 px.
  - Results can still be written from a tree with uncommitted changes.
- **From the M2 audit, medium:**
  - Quotes and values are checked by substring: "10" passes with "(100 m/Ring)", "50 A" with "250 A", and a "same" answer that leaves out the one attribute that differs confirms the wrong product. Match on word boundaries and require the attributes the long text states with a unit.
  - The attribution leans on how the generator writes by-article quantities (exact totals; rounding only on single-position lines; the same 30% allowance in both). Plant rounded by-article lines.
  - Ledger rows are written when a batch is stored, so up to 30 billed calls are on no ledger if the action dies between the calls and the write. A step that dies leaves the run in its state for good: there is no watchdog. `prepare` is not safe to run twice, and two runs of one tender can run at once. Nothing tests `run.ts`, `store.ts` or `prompt.ts`.
  - The answer cache is keyed by a prompt version kept by hand. Hash the instructions and the answer schema into the key.
  - `decide` and the ground truth differ at the edges: an only offer with an unreadable price is priced at nothing, and a price is called an outlier against offers of other products.
- **From the M2 audit, low:** a review counts as found whatever its reason, and the euro error of a wrongly automatic position is only the price difference; `score.ts` and `judges.ts` have no test; the review queue is cut at 300 without saying so; one document title for every route. A price far off the only other one is a review in the ground truth but invisible to the pipeline when the other offer is not for the same product. A near match with no exact total is dropped without a note. The search field's focus is a 1 px border colour. Reloading the seed can race a run that is under way.
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
