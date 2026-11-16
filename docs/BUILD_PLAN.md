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

**First, from the audit of M0 and M1, before any benchmark is written:**

- Generator: one price per article per offer; clean lines that carry harmless oddities (stated pack sizes, price units of 1000, cent rounding, real price spreads between suppliers, a position split over two lines of the same article), so a plain rule on its own raises false alarms.
- Ground truth: settle the disputed expectations and write the rule down in DATA.md (a flagged offer beside a cheaper clean one; the specialist's merged lines; positions with no offer counted apart from planted traps).
- Readers: a PDF printed by other software as a committed fixture with hand-typed expectations; GAEB texts with mixed content, entities and prefixed namespaces; a missing quantity as a warning on one item, not a rejected file.
- A no-model baseline (the plain rules alone), published beside B1 and B2.

**Pipeline:**

- Units and checks, written test-first; units normalised before anything is compared.
- Candidate retrieval, the matcher step, quote verification, triage, pricing. Quantities are summed per article where a supplier quotes that way.
- Agent runtime: event log, batching through the scheduler, idempotent steps, per-run budget, ledger writes per batch.
- A reset that clears runs and matches when the tender is reloaded.
- `pnpm bench` for B1–B3.

**Interface, alongside:**

- Built: design system, overview, positions workspace, source viewer, ⌘K jump.
- With the pipeline's results: the split and euros at risk on the overview; the review queue, keyboard-driven; the checker's marks on flagged offers, with the arithmetic shown; live status in the list while a run is going.

- **Gate:**
  - A full run completes on the default model inside the budget.
  - B1–B3 results are written, with the no-model baseline beside them.
  - The undersized cabinet is flagged with the right reason code, and the interface shows why.
  - `pnpm shots` passes on every route.
  - The audit's high-severity findings are fixed.

## M3 — Product surface, completed

- Kalkulation breakdown and the copper control.
- Run replay and the access code for live runs; `pnpm demo:reset`.
- `/bench` page.
- The source viewer on a phone; zoom in the PDF view.
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
