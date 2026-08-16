# Session-Creation kWh Guardrails — Plan Brief

> Full plan: `context/changes/testing-session-creation-guardrails/plan.md`
> Research: `context/changes/testing-session-creation-guardrails/research.md`

## What & Why

Close test-plan.md Risk #1: a charging session logged with zero, negative, or non-numeric kWh must be rejected before it ever reaches the ledger. The rule already exists (three layers deep) but has **zero automated test coverage** — it was only verified once, manually, during the original implementation. This plan adds that coverage and, since it's the repo's first unit test, stands up the test harness itself.

## Starting Point

kWh is validated by a private, unexported zod schema inline in `src/pages/api/sessions/create.ts`. The route file transitively imports `astro:env/server` (an Astro virtual module Vitest can't resolve out of the box), and no unit-test runner exists in the repo at all — only Playwright, covering one e2e happy-path spec.

## Desired End State

`npm run test:unit` exists and passes, proving zero/negative/non-numeric/missing/oversized/non-finite kWh are all rejected by the validation schema — independent of the browser-driven e2e suite, and fast enough to run on every change.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | Risk #1 only, not Risk #2 (ownership) | Risk #2 wasn't researched this pass; folding it in would mean planning against ungrounded assumptions | Plan (user Q&A) |
| Schema testability | Extract `logSessionSchema` into a new pure module (`src/lib/validation/session.ts`) | Avoids `astro:env/server` resolution entirely — cheaper than configuring Astro's Vite pipeline into Vitest | Plan (user Q&A) |
| Defense-in-depth in `logSession()` | Out of scope | This is a test-rollout plan, not a feature change; the service layer's "trust the caller" gap is pre-existing, not new | Plan (user Q&A) |
| Route-level wiring test | Skipped | The schema unit tests already give full signal; a redirect-assertion test would mostly catch a wiring typo TypeScript already catches | Plan |
| `Infinity` assertion | Assert generic rejection only, not "caught by `.max(500)`" | Verified against the actual installed `zod@4.4.3`: it rejects `Infinity` in its base check (finite-by-default), unlike v3 — pinning to a specific rule would be version-fragile | Research (follow-up) |

## Scope

**In scope:**
- Install Vitest + minimal config (path alias, node environment)
- Extract the session-logging validation schema into `src/lib/validation/session.ts`
- Parameterized unit tests for the kWh boundary cases
- `test-plan.md` §6.1/§6.4 cookbook entries

**Out of scope:**
- Risk #2 (ownership/authorization checks)
- Any production-code defensive validation beyond what already exists
- Route-level integration/wiring tests
- Risk #4 (decimal/large-value ledger drift — test-plan.md Phase 2)

## Architecture / Approach

`create.ts`'s inline schema moves verbatim into `src/lib/validation/session.ts`, which has zero Astro/Supabase imports — so a plain `vitest.config.ts` (path alias + node environment, no Astro plugin) can import and test it directly. `create.ts` imports the schema back; behavior is unchanged. Validation already runs before any Supabase call in the route, so the rejection path needs no DB stubbing at all.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Vitest environment setup | Working `npm run test:unit`, one smoke test | Vite 7 / Vitest version mismatch |
| 2. Extract validation schema | `src/lib/validation/session.ts`, route refactored to use it | Silent behavior drift during extraction — mitigated by re-running the e2e happy path |
| 3. kWh guardrail unit tests | Parameterized test proving Risk #1 is closed | Asserting against zod's internal rule identity instead of the outcome (version-fragile) |
| 4. Cookbook + change sync | `test-plan.md` §6.1/§6.4 filled in | None significant |

**Prerequisites:** none beyond what's already in the repo (Node v22.14.0, local Supabase only needed for Phase 2's manual e2e check).
**Estimated effort:** ~1 session across 4 phases — this is a small, contained addition (one new module, one new test file, one config file).

## Open Risks & Assumptions

- Assumes `vitest@^4.1.10` is compatible with the `vite@^7.3.2` override already pinned via `package.json`'s `overrides` field — worth a quick `npm install` sanity check at the start of Phase 1.
- Assumes no other code currently imports `logSessionSchema` from `create.ts` by relying on its module-private scope in some indirect way — grep confirms it isn't exported or re-imported anywhere today.

## Success Criteria (Summary)

- `npm run test:unit` passes and individually names every kWh boundary case (zero, negative, non-numeric, missing, over-500, `Infinity`)
- The existing `log-session-flow.spec.ts` e2e happy path still passes after the schema extraction
- A future contributor adding a second unit test can follow `test-plan.md` §6.1 without re-deriving the Vitest/path-alias/schema-extraction setup
