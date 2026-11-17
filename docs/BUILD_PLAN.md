# Build Plan

Every milestone has a **gate**: the next one does not start until its checks pass, or scope is cut on purpose and logged in [DECISIONS](DECISIONS.md). Every step inside a milestone is verified before the next one starts (see "Verify every change" in [CLAUDE.md](../CLAUDE.md)). The cut list is in [PRD §6](PRD.md#6-prioritisation).

Every milestone ends with an independent audit before its gate is reported (ADR-23). From M2 on, the interface is built alongside the pipeline instead of after it: each has its own list below and they share a gate.

## M0 — Foundations

- pnpm workspace: `apps/web`, `services/backend`, `packages/core`, `data`, `bench`; root scripts as the single task runner.
- TanStack Start app with Tailwind v4, design tokens, self-hosted fonts, app shell, theme and language toggles.
- Convex backend on a local deployment; typed deployment env.
- Model layer: `llm/registry.ts` (provider, roles, capability flags, price table), `llm/client.ts` (the one call path), ledger and daily budget guard.
- `pnpm probe:llm`, `pnpm shots`, `pnpm env:push`.
- CI: lint, formatting, typecheck, tests, build, Markdown link check.
- **Gate:**
  - `pnpm check` is green locally and in CI.
  - The shell renders at 390 px and 1440 px, light and dark, with no console errors.
  - The web app reads live data from the backend.
  - `pnpm probe:llm` passes on the configured provider, or the flags are recorded in DECISIONS.

## M1 — Data and parsers

- Catalogue: 254 products in 29 groups, with typed attributes, three wordings each and a labor time table.
- LV: 1,170 positions in realistic German, written to GAEB DA XML X83.
- Three supplier offers (two PDF layouts, one GAEB X84) with manufacturer shorthand, packaging units and partial coverage.
- Sixty planted traps of eight kinds, with a ground-truth file.
- Parsers: GAEB X83 and X84; PDF lines with bounding boxes.
- `pnpm seed`.
- **Gate:**
  - The same seed gives byte-identical files.
  - Parser round-trip tests pass.
  - The seed loads into Convex.

## M2 — Pipeline, runtime, benchmarks (riskiest)

**Built, from the audits of M0, M1 and the first interface:**

- Generator: one price per article per offer; the wholesaler quotes bulk material by article; 107 clean lines carry the surface of a trap (stated pack sizes, split quantities, rounded quantities, totals a cent off, a price unit of 1000).
- Ground truth: one rule, written down in [DATA](DATA.md#what-the-ground-truth-says).
- Readers: GAEB texts with mixed content, line breaks, entities and prefixed namespaces, and a missing quantity as a warning; the PDF reader works out column extents from the rows, takes apart merged cells, reads wrapped headers and warns when a header has no line under it; an offer printed by Chrome is a committed fixture with hand-typed expectations.
- A reference run with no reader and one with a perfect reader, beside every benchmark.
- `llmParse` returns provider errors as a value, records per batch, and is tested with a stand-in client.

**Built, pipeline:**

- Values written in different units compared by arithmetic (`measure.ts`), test-first.
- Search for lines that name no position, the matcher, quote verification, per-line checks, attribution by quantity, the decision.
- Agent runtime: prepare, read in batches through the scheduler, decide; an event log; idempotent steps; a per-run and a per-day budget; an answer cache.
- Runs cleared when the tender is reloaded.
- `pnpm bench` for B1 to B3, `pnpm bench:replay`, `pnpm bench:heldout`.

**Built, interface:**

- The design system (now "Weidenufer", ADR-42), the overview as the front of the building with one window per position, the positions workspace, the source of every number, ⌘K jump, `pnpm probe:ui`.
- With the run's results: the split and the euros at stake on the overview, with every window lit or red; the review queue, the costliest decision first, stepped through with J and K; the decision on each position with what it is worth; findings in words on the offer they concern, with the arithmetic; what was compared, per offer; the run's state, live.

**Moved to M3:** labor and the copper surcharge (ADR-40); starting a run from the interface (ADR-39). **Not run:** B4 (ADR-41).

- **Gate:**
  - A full run completes on the default model inside the budget. _Done: the first full run made 787 calls for $0.37, the unseen runs 731 for $0.34, 642 for $0.29 and 503 for $0.24; limit $1.50._
  - B1–B3 results are written, with the reference runs beside them. _Done: `bench/results/`._
  - The undersized cabinet is flagged with the right reason code, and the interface shows why. _Done: `SPEC_MISMATCH`, 138 kVA = 199 A < 250 A, 391.49 € at stake._
  - `pnpm shots` and `pnpm probe:ui` pass on every route.
  - The audit's high-severity findings are fixed.

## M3 — Product surface, completed

- The copper control. _Built (ADR-55):_ `/kalkulation` works out the copper surcharge from the tender's own cable and moves it with the day's notation.
- Labor: each position tied to an entry of the labor time table, and with it the rest of the Kalkulation breakdown. _Built (ADR-59):_ a labor pass of its own; on unseen seed 504, 1,169 of 1,170 positions settled without a person and 99.6% of those right; on the costing page and each position.
- **Deciding.** _Built (ADR-54):_ the estimator takes an offer as it stands or sets a price, by key or by button, and takes it back; the window turns from red to lit, the position leaves the queue and the sums follow. Decisions belong to the browser that made them.
- A by-article line for a single position that is read but not taken as an offer (the bollard luminaire on seeds 501 and 502, see [DATA](DATA.md#where-it-fails-on-the-newest-unseen-tender-seed-502)). Measure on a range of seeds nobody has looked at.
- From the M2 audit, before labor is added on the same runtime: hash the prompt and the answer schema into the cache key; write ledger rows per group of calls and add a watchdog for a step that dies; match quoted values on word boundaries and require the attributes the long text states; score the reason of a review.
- Run replay and the access code for live runs; `pnpm demo:reset`. _Built (ADR-57):_ "Read it again" on the overview reads the stored answers back in about 20 s without a model; a live run needs the access code; a watchdog fails a run whose step died.
- `/bench` page. _Built (ADR-58) as `/messung`:_ the committed result files, side by side, led by the newest unseen tender.
- The GAEB excerpt served from Convex instead of downloading the file.
- **Gate:**
  - The [DEMO_SCRIPT](DEMO_SCRIPT.md) works end to end locally.
  - `pnpm shots` passes on every route.

## M4 — Ship

- Deploy the web app and a Convex cloud deployment.
- `/bench` page, banner, showcase recording, README, docs brought up to date.
- B4 if time allows.
- **Gate:**
  - The public URL works in a private window in replay mode, with no model calls in the Convex logs.
  - The README is complete and CI is green.
