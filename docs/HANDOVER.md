# Handover — read this first in a new session or on a new machine

## 1. Where we are

**M0 Foundations: built, gate partly open.** Updated 2026-11-16.

Built and verified:

- Workspace, task runner, CI workflow.
- Web shell: tokens, fonts, theme and language toggles; renders live backend data at 390 px and 1440 px, light and dark, with no console errors (`pnpm shots /`).
- Convex backend on a local deployment: schema, `health:get`, typed env.
- Model layer: registry, the single call path, ledger, daily budget guard; 18 unit tests on the registry.
- `pnpm check` green: lint, formatting, typecheck of five projects, 22 tests. `pnpm build` green.

Open at the M0 gate:

- **`pnpm probe:llm` has not run.** There is no provider key on this machine yet. Add `OPENROUTER_API_KEY` to `.env.local`, run it, and commit `bench/results/provider_probe.json`.
- `llm/client.ts` typechecks and deploys but has made no real call yet. The probe covers the same SDK features; the first real call through it happens in M2.

Next: M1, data and parsers. See [BUILD_PLAN](BUILD_PLAN.md).

## 2. Setup

Needs Node 24 and Corepack (ships with Node).

```bash
corepack enable
pnpm install
cp .env.example .env.local      # add OPENROUTER_API_KEY
pnpm dev                        # Convex local deployment + web on :3000
pnpm check
```

- The first `pnpm dev` on a machine without a Convex login asks whether to sign in. To skip that and use a local deployment with no account, run it once as `CONVEX_AGENT_MODE=anonymous pnpm dev`. The choice is saved in `services/backend/.env.local`.
- `pnpm env:push` copies `.env.local` into the Convex deployment's environment. Run it after changing a model role or a key.
- `pnpm shots` drives the Chrome installed on the machine.

## 3. Decisions already made (do not re-litigate)

The full list is [DECISIONS](DECISIONS.md). The ones a new session is most likely to question:

- **Haiku 5.5 does the bulk work and escalation is off** (ADR-4). No role defaults to a larger model.
- **The model proposes, code decides; LLMs never originate numbers** (ADR-2, 3).
- **OpenRouter by default**, Anthropic direct as a switch (ADR-5).
- **Own agent runtime on Convex**, not an agent framework (ADR-6).
- **Synthetic data, fictional names** (ADR-1). No real company's name, branding or copy anywhere.

## 4. Working agreements

- Verify every change with the cheapest sufficient check and report the evidence. Never say "done" on an unverified change.
- Stop at every milestone gate, show the evidence, and wait for "go".
- No AI attribution anywhere in git: no `Co-Authored-By` trailers, no "Generated with" footers.
- Cost-conscious runtime models, swappable by environment variable, and documented as such.
- Small commits at each gate.

## 5. Open items

- Provider key and the probe (see §1).
- `pnpm-workspace.yaml` carries a release-age exception for `@anthropic-ai/sdk@1.9.0`, added by pnpm because that version was published on the day it was installed (ADR-13). Pinning `^1.8.0` and removing the exception is the stricter choice.
- Convex cloud deployment and Vercel project: needed at M4, both need the owner's accounts.
- Fictional names for the contractor, the suppliers and the building are chosen in M1 and checked against real company names before they are committed.

## 6. Update protocol

At every gate: update §1 (what is built, what is open, what is next), move resolved items out of §5, and add any deviation to DECISIONS.
