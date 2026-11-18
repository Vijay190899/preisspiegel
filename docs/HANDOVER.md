# Handover — read this first in a new session or on a new machine

## 1. Where we are

**M0 to M3 are built. M3 is at its gate: re-run green, audited ("on plan, with gaps", nothing high), and its medium findings fixed. A production review followed before the first deployment ([PRODUCTION](PRODUCTION.md), ADR-63 to 66). Waiting for a "go" for M4.** Updated 2026-11-18.

M0 to M2 and the third interface direction are on `main` (pull requests 1 and 2, merged on 2026-11-17 at the owner's word). M3 is a stack of pull requests, none merged, each based on the one before, so they merge in order: 3 `design/house-sky-sea` (the house, sky and sea; English; ADR-52, 53), 4 `feat/m3-deciding` (ADR-54), 5 `feat/m3-copper` (ADR-55), 6 `fix/house-audit` (answers the audit of 3, ADR-56; 3 should not be merged without it), 7 `feat/m3-replay` (ADR-57), 8 `feat/m3-measured` (ADR-58), 9 `feat/m3-labor` (ADR-59), 10 `fix/m3-runtime` (ADR-60), 11 `fix/m3-tie` (ADR-61 and the gate docs), 12 `fix/m3-audit` (the M3 audit's findings, ADR-62) and 13 `prod/hardening` (the production review, ADR-63 to 66). Work goes on a branch (ADR-44).

Built and verified:

- **M0:** workspace, task runner, CI, model layer with cost meter. The provider probe passed on OpenRouter with `claude-haiku-5-5` (`bench/results/provider_probe.json`).
- **M1:** GAEB and PDF readers in `packages/core`; a seeded tender of 1,170 positions with three supplier offers and 60 planted traps; `pnpm seed`. See [DATA](DATA.md).
- **M2, pipeline:** the lines that could answer a position, found by reference, by text and by quantity; the matcher on `claude-haiku-5-5`; quote verification; comparison of values by arithmetic; per-line checks; attribution of by-article lines by quantity, per kind of position; the decision ([ARCHITECTURE §4](ARCHITECTURE.md#4-pipeline-built-in-packagescoresrcpipelinets)). The agent runtime runs it in batches with an event log, budgets and an answer cache ([§3](ARCHITECTURE.md#3-backend-servicesbackend)).
- **M2, benchmarks:** `pnpm bench` (B1 to B3), `pnpm bench:replay`, `pnpm bench:heldout`, `pnpm bench:seeds`. On the newest tender the pipeline had not seen (seed 502, one run): everything it prices by itself is rightly priced without a person; 96 of 96 expected reviews are found; 98.0% of raised reviews belong; 60 of 60 traps; one position is priced 170 € too high. With flawless reading and no model, the checks agree with the ground truth on every position of 1,021 of 1,046 further unseen tenders (97.6%); they price a position that needed a person on 2.2% and miss a planted trap on 4.8%. One full run costs about 40 cents on an empty cache. [DATA](DATA.md#what-the-benchmarks-show) has the table, the first run, all three unseen runs, the sweep and the failures written up.
- **Interface, "Weidenufer" (ADR-42), the third direction:** the overview is the front of the building at night with one window per position, lit when priced and red when it needs a person, mirrored in the river; it stands under a night or a day sky, with a roof, the far shore and the sea around it; it says how many positions are priced, how many wait for a decision and how many euros rest on them; the key under it names the reasons and the tender's titles and picks their windows out on the house; below that are the costliest decisions, one line per article. In English the interface, the figures, the sections, the storeys and every item name of the demo tender are English, with the tender's wording beside them, and the server sends the page in the chosen language; long texts and suppliers' lines stay German and are marked as such, and an item the glossary does not fully cover is shown as written. A window says what it is and opens its position. A position shows what was decided as a sentence, the suppliers side by side with their prices on one scale, findings in words with the arithmetic and, for a measure, a drawing to scale, and where its window is in the building. A traced number opens its document beside the position at the place it was read.
- **M3, product surface:** a position that needs a person is decided by key or button and taken back with U; the window turns from red to lit and the sums follow (ADR-54). The costing page adds material, labor and the copper surcharge and moves the bid with the day's copper notation (ADR-55, 59). Every position is tied to an entry of the contractor's labor time table by a labor pass: on unseen seed 504, 1,169 of 1,170 settled without a person and 99.6% of those right (ADR-59). "Noch einmal lesen" on the overview reads the stored answers back in about 20 s without a model; a live run needs the access code; a watchdog fails a run or a labor pass whose step died (ADR-57, 62). `/messung` shows the committed benchmark files, led by the newest unseen tender (ADR-58). Four runtime findings of the M2 audit are closed (ADR-60); the tie was measured and left (ADR-61).
- **Production review (ADR-63 to 66):** public functions limited per browser and overall through the Convex rate limiter, decisions expire after 30 days, the public functions tested with `convex-test`; the costing page counts decisions in; failed actions are said; Nitro builds for the host with security headers; a title per page and share tags; axe finds no WCAG 2.2 AA violations; Dependabot and an audit gate in CI. What is left on purpose is in [PRODUCTION](PRODUCTION.md).
- `pnpm check` green: lint, formatting, typecheck of six projects, 422 tests. `pnpm build` green. `pnpm shots` green on nine routes (`/`, `/positionen`, `/positionen?offen=true`, `/kalkulation`, `/messung`, `/positionen/02.01.0060`, `/positionen/01.01.0020`, and that position with `?quelle=a.0.unitPrice` and `?quelle=lv.qty`) at four widths in both themes. `pnpm probe:ui` green: 55 behaviour checks, on the dev server and on the production build. `pnpm probe:a11y` green: eight pages in three views. The [DEMO_SCRIPT](DEMO_SCRIPT.md) walked end to end in Chrome, ten steps, no console errors.

**Audits so far.** Eight, each by an agent with no part in the work, and each with the verdict "on plan, with gaps".

- The third, of M2: "The gate passes on re-run and every table figure recounts, but the write-up of the unseen-tender failures is wrong in its cause, and the deterministic part is fitted to seed 118: a perfect reader fails on 6 of 9 other seeds."
- The fourth, of the third interface and of the fix for that: "The gate re-runs green and every table figure recounts, but the high finding is narrowed, not closed: on 136 seeds nobody had named the search still loses true offers on 21, and a perfect reader prices positions that needed a person on 20." It also judged the interface: the lights coming on work, the reflection appeared too early, the front could not be read without hovering, and the lower half of the overview and the positions list still read as ordinary.
- The fifth, of the changes made after the fourth: "Every figure the builder reported reproduces and the rules were not fitted to seeds 3000 to 3149, but on 597 tenders of my own the quoted '198 of 200' is the best of five ranges (97.5% agree; a position that needed a person is priced on 2.3% of tenders, not 1%). The remaining failures share one cause that the write-up does not name." It rated nothing high. The pooled rate is now what the docs quote, the cause is named (a tie between two totals), and a claim that the model's errors on the unseen tender were not misreadings is withdrawn (ADR-51).
- The sixth, of the house, sky and sea and of the English (pull request 3): "On plan with gaps: the scene is built and the gate re-runs green, but the new pointing control blacks the house out in normal use, and 'English is complete' is overstated." The blackout was its one high finding and is fixed and probed; the claim is taken back (ADR-56).
- The seventh, of M3 at its gate: "On plan, with gaps. The gate re-runs green, every figure in DATA "## Labor", the README B5 rows and ADR-61 recounts, and "seed 504 read once after one change" holds up against the answer cache. But the labor size check can be passed in two ways the docs say it blocks, HANDOVER §1 still describes M3 as not begun, and labor got no watchdog. Nothing rated high." The two ways past the size check and the missing watchdog are fixed, this section is rewritten, and the rest is below (ADR-62). Its own sweep, seeds 64000 to 64249, came to 239 of 247 (96.8%); pooled with the docs' ranges that is 1,260 of 1,293 (97.4%), slightly below the 97.6% quoted.
- The eighth, of the production review (pull request 13): "On plan, with gaps. Everything the owner asked for was delivered, and the gate re-runs green in a clean checkout. Nothing is high severity. Four claims do not hold. Two medium design gaps: the overall rate-limit ceilings let anyone deny service to everyone, and the 30-day retention cannot keep up with the write rate the limits allow." Both mediums, most lows and every wrong claim are fixed (ADR-67).
- All of them were right. Their medium and low findings that are not fixed are open items below.

**What an honest reader should know about the numbers:**

- The demo tender agrees with its ground truth on every position. That was reached by changing the prompt and the checks while looking at that tender, so it is not the headline ([ADR-37, 38, 46, 49](DECISIONS.md)).
- Twice a fix was reported as done on the strength of a handful of tenders, and twice an audit showed it did not hold on others. The third time the figures held, but the range quoted was the most favourable of five. The figure to trust is the pooled sweep: 1,021 of 1,046 with flawless reading, a position that needed a person priced on 23 of them, a trap missed on 50.
- That sweep uses a perfect reader. With the model there is one run on the current checks, on one tender, and all three of its errors start in the model's answer. The auditor's own range, pooled in, gives 1,260 of 1,293 (97.4%).
- Each unseen run took part of its answers from earlier tenders through the cache.
- The unseen tenders come from the same generator, so they are unseen in their numbers, not in their language.
- The order of "first run, changes, unseen run" in M2 rests on file times; git does not show it.

Next, after a "go": M4 (deploy to a Convex cloud deployment and Vercel, both needing the owner's accounts; carry the answer caches over; banner, showcase and README; the shipping steps). Before any public live run: one cheap paid trial to see the per-call ledger match the run's cost, and an access code of at least 16 characters on the cloud deployment. The Vercel build needs `VITE_CONVEX_URL` (it fails without it, ADR-67) and `VITE_SITE_URL`; check on the deployment that `/demo/*.x83` and `*.x84` arrive compressed, which was measured on the Node server only.

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
- `pnpm shots` and `pnpm probe:ui` drive the Chrome installed on the machine and need `pnpm dev` running with the seed loaded and a finished run. A fresh deployment has no run: `pnpm bench --start` makes one (about 40 cents on a cold answer cache, nothing on a warm one). `pnpm probe:ui` presses "Noch einmal lesen", so it replaces the finished run with a replay of it (same figures, no model) and takes about 25 s longer.

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

- **Decisions are per browser.** A decision is stored under a random id the browser keeps; a script can make up ids, so the limits per browser have overall ceilings beside them (ADR-63). After a decision the position leaves the queue and the arrows on its page have nowhere to go until J or K is pressed.
- **M3 is at its gate, audited.** The tie was measured and left (ADR-61); the bollard case is left with its reason below; the GAEB excerpt is left because the files are small once compressed, and the production build serves them as XML with brotli (the tender is 20.9 KB, ADR-64). The four runtime findings of the M2 audit are closed (ADR-60); the ledger written per call has not yet been exercised by a paid call.
- **The measured page does not show the sweep** (1,021 of 1,046 tenders with flawless reading): no committed file holds it, and the page shows only what a file holds. `pnpm bench:seeds` would have to write one. Nor does it show the two write-ups of failures, which are prose in [DATA](DATA.md).
- **The replay is not the event log played back** (ADR-57): it is a run over the stored answers, paced to be watched. On a deployment whose answer cache is empty it reads nothing and every position with a candidate line goes to a person; M4 has to carry the cache to the cloud deployment.
- **Older runs are cleared when a run finishes.** A run's rows cannot be looked at once a newer one is done; the benchmark results in `bench/results/` are files and stay.
- **A tie between two totals.** Where a line's quantity is at once the total of the positions asking for its own article and of those it was quoted in place of, the wrong-product offer is dropped unseen and the position is priced at another supplier's clean offer. It is most of what a perfect reader still gets wrong. Flagging every tie was built and measured: about twelve needless reviews for each wrong price prevented, so it is not kept (ADR-61). What would decide a tie is reading, not arithmetic: whether the line's text is closer to one kind or the other.
- **The model answers "unsure" for a by-article line for a single position** (a bollard luminaire, on seeds 501 and 502): the position is priced with the next valid offer. Confirming such a line when its quantity is exactly that of one position nobody else answers would remove it. Whether a larger model reads it correctly has not been tried; it would cost a few cents. Not built in M3: the case was found on seeds 501 and 502, so a fix would need a new unseen tender run with the model to be measured, and a quantity alone is weak evidence for a line the model could not read (a quantity of 1 matches almost anything, ADR-61).
- **The model leaves a plain line open now and then** (two earthing conductors on seed 502), which raises a review nobody needs.
- **Seeds that are spent.** Read: 118 to 123, 2026, 7, 1, 999, 431 to 438, 501 to 504, 3000 to 3149, and 5047, 5143, 7344, 20019, 20052, 20066. Scored: 5000 to 5199, 7300 to 7499, 12000 to 12449 (labor), 13000 to 13249, 20000 to 20149, 41000 to 41149, 88000 to 88099. The audits also ran 1 to 99, 200, 600 to 603, 777 to 999, 9001 to 9005, 31337 and 65536. Measure the next change on a range that is in none of these.
- **From the seventh audit (M3), not fixed:**
  - `bench:seeds` and `bench:labor --perfect` write no result file, so the pooled rate and the 79% live only in prose; `/messung` assigns the labor prompt version by hand (`lib/measured.ts`).
  - Seeds 503 and 504 were scored before the size check was tightened (ADR-62); on the demo's stored answers the tightened check changes nothing.
  - The per-call ledger has not seen a paid call; the answer caches must be carried to the cloud deployment at M4.
- **From the sixth audit, not fixed:**
  - In English an amount still has the euro sign after the figure, and "cannot be converted to piece" is said clumsily.
  - Three of 187 attribute names have no English (0.2% of their uses), and the glossary knows this generator's words: a real tender brings items it shows as written.
  - The key under the picture stays in reach below 1280 px or in a window under 760 px high by sticking to the bottom edge, where its rows are pushed sideways; a row that continues is cut at the edge with nothing to say so.
  - The clouds and stars move for as long as the page is open (stopped under reduced motion).
- **From the fifth audit, not fixed:**
  - What a kind is (`specSignature`) is fitted to the generator's wording: it splits on `im 3. OG` against `im 4. OG` and on `3.000 K` against `3000 K`, and merges `Polzahl: 1` with `Polzahl: 3`. Compare parsed measures and drop storey tokens instead. Labor matching would reuse it.
  - Accepting the total of some positions lets most wrong totals through on a line for many positions, and no benchmark plants a quantity trap there. Plant them, then bound the rule.
  - The costliest list groups by short text, so two variants under one short text become one row; a grouped row opens only its costliest position.
  - The generator still fails on 3 seeds in 600 (trap sampling).
  - With a document open at 1920 px the three columns are 245 px wide and the arithmetic breaks before its unit; from 1024 to 1279 px the tower is 416 px wide on a page of that width.
  - `storeyOf` reads `KG-Rohr` as a basement, `OG 2` as the first upper storey and `1.-3. OG` as the third.
  - How far down a search is looked at when a quantity points the way (12) is a constant nobody measured.
- **From the fourth audit, not fixed:**
  - The drawing of a measure (250 A, 199 A, "51 A less") shows values that come from the model's strings, with no link to a source, behind a quote check that is by substring.
  - The positions list is a standard list, and the plinth's groups do not stand under their bays. (The scene around the front, the day theme and the key under the picture answered the rest of this finding, ADR-52; the sixth audit judged that work, ADR-56.)
  - Both shapes of the building are mounted (2,340 window elements); the pulse and the water never stop, about 290 ms of main-thread time in 5 s on an idle page.
  - On a phone the traced quantity is 14 by 26 px, text links are 16 px high and a tower window about 5 px.
  - The front is sized for this tender: more positions mean windows under 4 px.
  - Results can still be written from a tree with uncommitted changes.
- **From the M2 audit, medium:**
  - A "same" answer that leaves out the one attribute that differs confirms the wrong product. Require the attributes the long text states with a unit. (Numbers cut out of longer ones are now rejected, ADR-60.)
  - The attribution leans on how the generator writes by-article quantities (exact totals; rounding only on single-position lines; the same 30% allowance in both). Plant rounded by-article lines.
  - (Each billed call is now on the ledger as it returns, ADR-60; a step that dies is caught by a watchdog after at most 24 minutes, and the interface starts one run at a time, ADR-57.) `prepare` is not safe to run twice (a run started from the command line is now refused while one is under way, ADR-66). Nothing tests `run.ts`, `store.ts` or `prompt.ts`.
  - The answer cache is still keyed by a version kept by hand; a test now fails when the instructions or the schema change without it (ADR-60).
  - `decide` and the ground truth differ at the edges: an only offer with an unreadable price is priced at nothing, and a price is called an outlier against offers of other products.
- **From the M2 audit, low:** (a review found for a right reason is now counted beside the plain count, ADR-60) the euro error of a wrongly automatic position is only the price difference; `score.ts` and `judges.ts` have no test; the review queue is cut at 300 without saying so. A price far off the only other one is a review in the ground truth but invisible to the pipeline when the other offer is not for the same product. A near match with no exact total is dropped without a note. The search field's focus is a 1 px border colour. Reloading the seed can race a run that is under way.
- **A model call that fails** leaves its lines unconfirmed; the position is still priced if another supplier answers it cleanly, and nothing on it says a line went unread.
- **Labor (ADR-59):** the kind of work is the model's call; code checks only the unit and a size or count in the label. A cable manager (`Kabelrangierpanel`) is still timed as a patch panel. A position's verdict sentence speaks of the material only, so a position priced without asking can still have its labor decided by a person, said further down. Labor decisions cannot yet be overridden in the interface. No source viewer for the labor time table: its entry is named, not opened. The measured page shows B5 but the pooled perfect-reader sweeps are not in a committed file.
- **Changing `packages/core` does not re-bundle the Convex functions** in `pnpm dev`: touch a file under `services/backend/convex/` and wait for "Convex functions ready" before measuring on the deployment.
- **A trial run over part of the tender** (`limit`) decides by-article lines wrongly, because their quantities cover the whole tender. Trial runs are for checking that the steps work, not for scores.
- **The model is not perfectly even:** the same article is occasionally read differently for two positions, and once in several hundred answers it compares an attribute with a brand name. The quantity rules absorb most of it; they should not be the only defence.
- **The list query sends every position** (about 280 kB). Status comes from its own small query, so a run does not re-send the list, but the first load is heavy.
- **The GAEB source downloads the whole file** to show one item. The excerpt should come from Convex.
- **The palette does not lock the page behind it.**
- **B3 says a number the readers took is where the interface points, not that it is right,** and it does not cover figures worked out from those numbers or the values the model compared.
- Convex cloud deployment and Vercel project: needed at M4, both need the owner's accounts.

## 6. Update protocol

At every gate: update §1 (what is built, what is open, what is next), move resolved items out of §5, and add any deviation to DECISIONS.
