# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-08-16

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic check that already catches the
   regression. This rollout is explicitly scoped for speed (Phase 2
   interview Q5: "MVP — need tests fast, don't care about quality now") —
   prefer hermetic/unit tests over integration or e2e wherever the risk
   allows it.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in area Y"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/`, `e2e/`
(excluding generated `src/lib/database.types.ts`), last 30 days.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                                                                     | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A charging session is logged with zero, negative, or non-numeric kWh and is accepted, corrupting the ledger                                                                                 | High   | Medium     | PRD US-01 acceptance criteria ("cannot be logged for zero or negative kWh"); interview Q1, Q4; hot-spot `src/lib/` — 4 commits/30d on the sessions module                              |
| 2   | A user who does not own a POC can still log a session against it (authorization bypass) — RLS is deliberately disabled on `pocs`/`profiles`, so the API route is the only enforcement point | High   | Medium     | PRD US-01 acceptance criteria ("only the owner of a POC can log a session for that POC"); tech-stack/migration evidence: RLS disabled by explicit project-stage decision; interview Q1 |
| 3   | The wrong seeker is resolved from the email-search lookup, crediting/debiting the wrong account                                                                                             | High   | Medium     | PRD US-01; hot-spot `supabase/migrations/` — 3 commits/2d fixing email-search prefix-escaping and min-length bugs (evidence of prior regressions in this exact area)                   |
| 4   | Debit and credit drift apart on edge-case kWh amounts (decimals, large values) — only one hardcoded value is proven today                                                                   | High   | Low        | PRD guardrail (ledger must always net to zero drift); existing `e2e` coverage proves one happy-path value only (partial coverage, not absent)                                          |

### Risk Response Guidance

| Risk | What would prove protection                                                                                    | Must challenge                                                                                        | Context `/10x-research` must ground                                                               | Likely cheapest layer                                                                          | Anti-pattern to avoid                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| #1   | Invalid kWh (0, negative, NaN, missing) is rejected before any balance mutation happens                        | "Client-side form validation is enough" — the server route must reject independently of the UI        | Exact validation location/shape in the session-creation request path                              | unit/hermetic                                                                                  | Asserting against whatever the current validation happens to accept (implementation mirror) |
| #2   | Logging a session for a POC the caller does not own is rejected by the API itself, not merely hidden in the UI | "No RLS policy failing in tests means it's safe" — RLS is off by design; only app code can catch this | Where (or whether) ownership is checked in the session-create code path                           | unit/hermetic (stub Supabase client — the DB will not enforce this)                            | Testing only through the UI, which would not catch a direct API call bypassing the form     |
| #3   | The session is created against the exact user resolved by the seeker-email lookup, not a prefix/partial match  | "The combobox shows the right one" — verify the server-resolved user id, not just what's displayed    | The search RPC behind the email-lookup endpoint and how session-creation consumes the selected id | integration (real Supabase — this exact bug class has already occurred twice against real SQL) | Mocking the search RPC and missing the prefix/escaping bug class that already shipped twice |
| #4   | A decimal or large kWh value still produces an exactly-equal debit/credit pair                                 | "The e2e test already proves this" — one value is not the boundary                                    | Balance-update arithmetic in the session-logging domain logic                                     | unit/hermetic                                                                                  | Copying the e2e spec's single value as the only edge case tested                            |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                            | Goal (one line)                                                                 | Risks covered | Test types                  | Status        | Change folder                                          |
| --- | ------------------------------------- | ------------------------------------------------------------------------------- | ------------- | --------------------------- | ------------- | ------------------------------------------------------ |
| 1   | Session-creation guardrails           | Prove invalid kWh and non-owner session logging are both rejected server-side   | #1, #2        | unit/hermetic               | change opened | `context/changes/testing-session-creation-guardrails/` |
| 2   | Seeker-resolution & ledger edge cases | Prove the right user is credited/debited and amounts stay exact at the boundary | #3, #4        | integration + unit/hermetic | not started   | —                                                      |

**Status vocabulary** (fixed — parser literals): `not started` →
`change opened` → `researched` → `planned` → `implementing` → `complete`.

Rollout deliberately kept to 2 phases (below the usual 3–5 sweet spot) per
explicit user direction in Phase 2 interview Q5: ship fast, minimize scope.
No AI-native or quality-gates phase is included — cost × signal does not
justify either yet at this project stage.

## 4. Stack

| Layer                | Tool                   | Version                          | Notes                                                                                                                          |
| -------------------- | ---------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| unit + integration   | none yet — see Phase 1 | —                                | Astro 6 runs on Vite; Vitest is the natural fit (shares Vite config/transform pipeline) but is not yet installed               |
| API mocking          | none yet — see Phase 1 | —                                | Stub the Supabase client at the module boundary for hermetic tests; no MSW/HTTP-mock library installed                         |
| e2e                  | Playwright             | per `package.json` devDependency | Already wired (`playwright.config.ts`, `e2e/`); covers auth round-trip, dashboard session, and one happy-path log-session flow |
| accessibility        | none                   | —                                | Not in scope for this rollout                                                                                                  |
| (optional) AI-native | none                   | n/a                              | Not justified by cost × signal at this project stage; revisit at `--refresh` if the risk profile changes                       |

If a row reads "none yet — see Phase 1", that gap is addressed by the named
rollout phase.

**Stack grounding tools (current session):**

- Docs: none available in current session — no Context7 or framework-docs MCP exposed; checked: 2026-08-16
- Search: none available in current session — no Exa.ai or web-search MCP exposed; checked: 2026-08-16
- Runtime/browser: none used — Playwright is already the project's e2e tool via its own config, not invoked as an MCP; checked: 2026-08-16
- Provider/platform: Supabase MCP present in session but only its `authenticate`/`complete_authentication` tools are exposed (no schema/query access used here); not used for this plan; checked: 2026-08-16

## 5. Quality Gates

| Gate                        | Where                | Required?                 | Catches                                                      |
| --------------------------- | -------------------- | ------------------------- | ------------------------------------------------------------ |
| lint + typecheck            | local + CI           | required                  | syntactic / type drift                                       |
| unit + integration          | local + CI           | required after §3 Phase 1 | logic regressions in session validation and ownership checks |
| e2e on critical flows       | CI on PR             | required (already wired)  | broken critical user paths (auth, session logging)           |
| post-edit hook              | local (agent loop)   | not planned               | not justified by cost × signal at this stage                 |
| visual diff (deterministic) | CI on PR             | not planned               | not justified by cost × signal at this stage                 |
| multimodal visual review    | CI on PR             | not planned               | not justified by cost × signal at this stage                 |
| pre-prod smoke              | between merge + prod | optional                  | environment-specific failures                                |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase <N>."

### 6.1 Adding a unit test

- **Location**: co-located with the module under test, `src/lib/**/*.test.ts`
  (e.g. `src/lib/validation/session.ts` → `src/lib/validation/session.test.ts`).
  Vitest's default file-matching glob also picks up `*.spec.ts`, which
  collides with Playwright's `e2e/specs/`; `vitest.config.ts` explicitly
  excludes `e2e/**` to keep the two runners separate.
- **Run locally**: `npm run test:unit` (single run) or
  `npm run test:unit:watch` (watch mode).
- **Boundary-case pattern**: for a validation rule with several distinct
  invalid inputs (zero, negative, non-numeric, missing, over-limit,
  non-finite, ...), use one parameterized `it.each` table against a shared
  valid baseline object, varying only the field under test — not one
  hand-written test per case (redundant-copies anti-pattern) and not a
  single aggregate assertion (loses per-case failure legibility). Assert
  the outcome (`.safeParse(...).success`), not _which_ internal rule of the
  validation library caught it — that can be library-version-dependent.
- **Reference test**: `src/lib/validation/session.test.ts` (Risk #1 kWh
  guardrail — established in
  `context/changes/testing-session-creation-guardrails/plan.md` Phase 3).

### 6.2 Adding an integration test

- TBD — see §3 Phase 2 for the seeker-email-resolution pattern (real
  Supabase, since this exact bug class has already occurred against real
  SQL prefix-matching).

### 6.3 Adding an e2e test

- **Location**: `e2e/specs/`.
- **Naming**: `<flow-name>.spec.ts`.
- **Reference test**: `e2e/specs/log-session-flow.spec.ts` (two real
  identities, host + seeker, storageState-based session reuse).
- **Run locally**: `npm run test:e2e` (requires `npx supabase start`
  already running).

### 6.4 Adding a test for a new API endpoint

- TBD — see §3 Phase 2 for the pattern this rollout still needs to
  establish (hermetic test with a stubbed Supabase client, asserting
  request → rejection/acceptance and no balance side-effect on rejection).
- **Request-validation addendum** (established in Phase 1, see
  `context/changes/testing-session-creation-guardrails/plan.md`): extract
  the route's `zod` schema into its own module under `src/lib/validation/`
  and unit-test the schema directly there, rather than driving the full
  `POST` handler through a fake `APIContext`. This repo's API routes
  commonly import `astro:env/server` transitively (via `@/lib/supabase` or
  `@/lib/config-status`) — an Astro virtual module plain Vitest cannot
  resolve — so keeping the schema in a module with no Astro/Supabase
  imports is what makes it testable without extra Vitest/Astro plumbing.
  Reference: `src/lib/validation/session.ts` +
  `src/pages/api/sessions/create.ts`.

### 6.5 Adding a ledger/balance-math test

- TBD — see §3 Phase 2 for the boundary-value pattern (decimal and
  large-kWh cases beyond the single value the e2e spec covers).

### 6.6 Per-rollout-phase notes

(Filled in as each phase lands.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Anything beyond the session-creation path** — no rollout phase covers
  POC registration/toggle, location profile, or landing-page assembly;
  those already have partial e2e coverage and were not raised as a
  concern. Re-evaluate at `--refresh` if a concern surfaces there. (Source:
  Phase 2 interview Q5.)
- **AI-native test layers, post-edit hooks, and new CI gates** — explicitly
  out of scope; speed was prioritized over depth for this rollout.
  Re-evaluate once Phases 1–2 ship and more time is available. (Source:
  Phase 2 interview Q5.)
- **Accessibility and visual-regression testing** — not raised as a
  concern and no rollout phase justifies the cost yet. Re-evaluate if the
  UI surface grows past the current MVP scope. (Source: Phase 2 interview
  Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-08-16
- Stack versions last verified: 2026-08-16
- AI-native tool references last verified: 2026-08-16 (none in use)

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
