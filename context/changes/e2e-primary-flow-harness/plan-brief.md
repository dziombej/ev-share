# E2E Primary Flow Harness — Plan Brief

> Full plan: `context/changes/e2e-primary-flow-harness/plan.md`

## What & Why

Stand up a Playwright e2e test harness for `ev-share` — the F-01 roadmap foundation. The roadmap sequences this before the domain logic it's meant to eventually verify (POC registration, session logging, balances), so this change can't test the real US-01 flow yet. Instead it proves the harness works against today's auth scaffolding and establishes the session-reuse convention S-01/S-02/S-03 will build their own e2e coverage on top of.

## Starting Point

No test tooling exists in this repo at all — no framework, no test script, no CI test step. Only auth scaffolding (`/`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email`, `/dashboard`) exists as a testable surface. The sibling project `../flats-manager` has a proven Playwright setup this plan adapts conventions from.

## Desired End State

`npm run test:e2e` runs two passing specs locally (with local Supabase up): a full unauthenticated auth round-trip, and an authenticated-session spec proving `storageState` reuse. `data-testid` is established as the project's locator convention. CI wiring exists as a lower-priority, cuttable phase.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| First test's scope | Auth round-trip on today's flows, not US-01 | Domain logic (POC/session/balance) doesn't exist yet — testing it isn't possible |
| Unit/component testing | E2e-only, no Vitest | Matches exactly what the roadmap item and CLAUDE.md ask for; keeps scope tight |
| Test-data backend | Local Supabase (Docker), not shared cloud project | No shared mutable state across runs; matches documented local-dev workflow |
| Test-user provisioning | Pre-seeded fixed user (env vars) for session reuse; fresh signup only in the round-trip spec | Reconciles isolation (round-trip needs a real signup) with simplicity (other tests reuse one session) |
| CI wiring shape | New job in existing `ci.yml`, not a separate workflow | Matches proven sibling pattern |
| Selector convention | Adopt `data-testid` project-wide, starting now | None exists yet; sets the convention before more UI is built |
| Auth-in-tests mechanism | Playwright `storageState` + setup project | Playwright's own recommended pattern; faster and less custom code than a hand-rolled fixture |
| CI priority | Nice-to-have / fast-follow, not blocking | User's explicit call — no known grading requirement ties this to CI, and the lesson accepts a partially-implemented checkpoint |

## Scope

**In scope:**
- Playwright installation and configuration
- `data-testid` attributes on existing auth components and dashboard
- Test-user provisioning script + login-once session fixture
- Two specs: unauthenticated round-trip, authenticated session reuse
- CI job (lowest priority — cuttable)

**Out of scope:**
- Testing the actual US-01 flow (POC/session/balance) — not implemented yet
- Vitest or any unit/component test runner
- Shared cloud Supabase test project
- Fresh-signup-per-test-run for every spec

## Architecture / Approach

Playwright, configured against a local `astro dev` server backed by local Supabase (`npx supabase start`). Two auth mechanisms: `global-setup.ts` provisions a pre-seeded test user directly via Supabase's admin API (idempotent), and `auth.setup.ts` (a Playwright `setup` project) logs in once through the real UI and saves `storageState` for reuse. The round-trip spec opts out of the saved session to test signup from a clean state.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Playwright core setup | Config, deps, npm scripts, env-var docs | None significant — standard scaffolding |
| 2. Selector convention | `data-testid` on auth components + dashboard | Touches production component code purely for testability |
| 3. Auth fixtures + specs | Working, passing local e2e suite | `enable_confirmations=false` reliance is local-only — must not assume this in CI without the same local Supabase setup |
| 4. CI wiring (fast-follow) | `e2e-test` job in `ci.yml` | Explicitly lowest priority — can be dropped under time pressure |

**Prerequisites:** Local Supabase running (`npx supabase start`, Docker required); Node 22.14.0.
**Estimated effort:** ~1 session across 3 required phases, CI phase as a stretch/fast-follow.

## Open Risks & Assumptions

- Assumes GitHub Actions `ubuntu-latest` runners have Docker available for `npx supabase start` in CI (standard, but unverified in this repo's actual CI run).
- The round-trip spec's freshly-created throwaway users accumulate in local Supabase across runs — acceptable since local dev state is disposable, but worth a `supabase db reset` mention if it ever becomes noisy.

## Success Criteria (Summary)

- `npm run test:e2e` passes locally, proving both the auth round-trip and session-reuse mechanism work
- `data-testid` convention is in place for future slices to adopt
- CI job (if completed) shows green on a pushed branch
