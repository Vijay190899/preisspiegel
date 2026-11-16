# Build Plan

Every milestone has a **gate**: the next one does not start until its checks pass, or scope is cut on purpose and logged in [DECISIONS](DECISIONS.md). Every step inside a milestone is verified before the next one starts (see "Verify every change" in [CLAUDE.md](../CLAUDE.md)). The cut list is in [PRD §6](PRD.md#6-prioritisation).

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

- Units and checks, written test-first.
- Candidate retrieval, the matcher step, quote verification, triage, pricing.
- Agent runtime: event log, batching through the scheduler, idempotent steps, per-run budget.
- `pnpm bench` for B1–B3.
- **Gate:**
  - A full run completes on the default model inside the budget.
  - B1–B3 results are written.
  - The undersized cabinet is flagged with the right reason code.

## M3 — Product surface

- Overview with the split and euros at risk.
- Review queue, keyboard-driven.
- Position detail: highlighted attributes, the Preisspiegel, the source viewer.
- Virtualised full table with live status.
- Kalkulation breakdown and the copper control.
- Replay mode and the access code for live runs.
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
