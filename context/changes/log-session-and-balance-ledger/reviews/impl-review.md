<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Log Session & Balance Ledger Implementation Plan

- **Plan**: context/changes/log-session-and-balance-ledger/plan.md
- **Scope**: Phase 1-4 of 4 (full plan)
- **Date**: 2026-08-16
- **Verdict**: APPROVED (post-triage) — the CRITICAL (F3, discovered mid-review) and both WARNINGs fixed same session; O1 fixed, O2-O4 accepted/skipped as low-priority.
- **Findings**: 1 critical, 2 warnings, 4 observations — 4 fixed, 3 skipped/accepted

**Review methodology note**: this plan shipped across commits `14fbead..d4cbfe5`. Several files it touched (`src/types.ts`, `src/lib/sessions.ts`, `src/pages/api/sessions/create.ts`, `src/components/sessions/LogSessionForm.tsx`, `src/pages/dashboard.astro`, `src/pages/dashboard/sessions.astro`) were later modified by two different, already-reviewed changes (`poc-contact-and-management`, `unified-landing-page`). Drift detection was run against the content **as of commit `d4cbfe5`** (this plan's own final state), not current HEAD, to avoid attributing later slices' changes to this plan. All Phase 1-3 file contracts matched the plan exactly at `d4cbfe5` — the initial drift pass flagged several false positives (e.g. `seekerId` appearing in `LogSessionInput`, a search combobox replacing the plain email field, a `dashboard.astro` nav link "missing") that are fully explained by those later, separately-reviewed plans and are not findings against this one.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | FAIL (as discovered) → fixed same session, see F3 |

## Findings

### F1 — Raw Postgres/PostgREST error text leaks to the client via `?error=` redirect

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/sessions/create.ts:47 (catch block), src/lib/sessions.ts:37-68 (`logSession`'s two raw rethrows)
- **Detail**: `logSession` rethrows Supabase's raw `PostgrestError` as-is on both the POC-ownership lookup (`sessions.ts:43-45`) and the insert (`sessions.ts:68-70`). `PostgrestError extends Error` (confirmed in `node_modules/@supabase/postgrest-js`), so the API route's catch block (`error instanceof Error ? error.message : "Failed to log session"`) passes the raw Postgres message straight into the `?error=` query string. The sibling route `src/pages/api/pocs/create.ts:43-45` never does this — its catch always redirects with the fixed string `"Failed to register POC"`, logging the real error server-side only. Concretely reachable today: if a host deletes the POC they're about to log against in a second tab between the ownership check and the insert, the ensuing foreign-key-violation error's raw Postgres text (constraint name and all) reaches the browser instead of a clean message.
- **Fix**: In `logSession`, catch the two raw Supabase errors and rethrow a generic `Error("Failed to log session")` instead (console-logging the original server-side, matching `pocs/create.ts`'s convention), keeping the existing descriptive `new Error(...)` throws for the ownership/self-charge validation checks — those are the only messages meant to reach the user.
- **Decision**: FIXED — `src/lib/sessions.ts`'s two raw rethrows (POC lookup, insert) now `console.error` the real Postgrest error and throw a generic `Error("Failed to log session")`. Ownership/self-charge throws unchanged. Lint (0 errors) and `astro check` (0 errors) reverified.

### F2 — `playwright.config.ts`'s default project now depends on the seeker-auth setup, contradicting the plan's explicit "unchanged" statement

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: playwright.config.ts:30-37
- **Detail**: The plan's Phase 4 Critical Implementation Details state: *"The default project's `storageState` (host identity) and its `dependencies: ["setup"]` are unchanged; only the new spec below opts into the second file."* The actual shipped `playwright.config.ts` (confirmed via `git show d4cbfe5:playwright.config.ts`, unchanged since) has the `chromium` project's `dependencies` as `["setup", "authenticate-seeker"]` — every existing spec running under the default project now also triggers the seeker-login flow during global setup, not just the new two-actor spec. No test failures result (the seeker setup only writes `playwright/.auth/seeker.json` and doesn't touch the default `user.json` state), but it's a real, confirmed contradiction of the plan's stated test-isolation design, and adds an unnecessary login round-trip to every other spec's setup phase.
- **Fix A ⭐ Recommended**: Add a third, spec-scoped Playwright project (e.g. `"chromium-two-actor"`, `testMatch: "log-session-flow.spec.ts"`, `dependencies: ["setup", "authenticate-seeker"]`), and revert the default `chromium` project's `dependencies` back to `["setup"]` only.
  - Strength: Restores the plan's stated isolation exactly — every other spec's setup is untouched, matching "unchanged" as written.
  - Tradeoff: One more project block in the config; the new spec's project needs its own device/browser settings duplicated (or extended) from the default.
  - Confidence: HIGH — standard Playwright pattern for per-spec setup dependencies.
  - Blind spot: None significant.
- **Fix B**: Accept the current shared-dependency shape as a documented, harmless tradeoff (update the plan with an addendum note) since it doesn't change any other spec's behavior or results, only adds a fixed amount of setup time.
  - Strength: Zero further code/config changes needed.
  - Tradeoff: Every test run pays the seeker-login cost even when no two-actor spec runs; leaves the plan's own explicit statement uncorrected on disk.
  - Confidence: MEDIUM — fine today at this suite's size, but the "every spec always logs in twice" cost only grows as more specs are added.
  - Blind spot: Haven't measured the actual added wall-clock cost of the extra login flow at CI scale.
- **Decision**: FIXED via Fix A — added a `chromium-two-actor` project (`testMatch: "log-session-flow.spec.ts"`, `dependencies: ["setup", "authenticate-seeker"]`), reverted `chromium`'s `dependencies` to `["setup"]` and added `testIgnore: "log-session-flow.spec.ts"` so it isn't picked up twice. Verified via `npx playwright test --list`: the two-actor spec now runs only under `chromium-two-actor`; the other two specs stay under plain `chromium`. Lint reverified clean.

### F3 — `log-session-flow.spec.ts` never selects a seeker suggestion, so submit stays disabled (regression from a later, already-shipped combobox rework)

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: e2e/specs/log-session-flow.spec.ts:65-67, src/components/sessions/LogSessionForm.tsx:258
- **Detail**: This spec is the one primary-flow e2e test CLAUDE.md flags as mandatory (US-01 coverage). As this plan shipped it (`d4cbfe5`), it typed the seeker's email into a plain `<Input name="seekerEmail">` and clicked submit directly — correct for the UI at the time. The later, already-reviewed `poc-contact-and-management` Phase 5 replaced that field with a live-search combobox: the visible input (still `data-testid="seekerEmail"`) is now just a search box, and the submit button is `disabled={!seekerId}` (`LogSessionForm.tsx:258`) until a suggestion is explicitly clicked (`handleSeekerSelect`, which sets `seekerId`). The spec still only fills the search box and clicks submit — it never selects a suggestion, so `seekerId` stays empty, the submit button stays disabled, and `hostPage.getByTestId("submit-button").click()` would hang until Playwright's action timeout and fail the test. `poc-contact-and-management`'s own plan explicitly scoped out e2e work ("No CI/e2e wiring for this slice... the one required primary-flow e2e test already lives in log-session-and-balance-ledger") but didn't account for the fact that its own UI change silently broke that existing test. This is squarely relevant to this plan's Phase 4 Success Criteria ("`npm run test:e2e` passes locally... including the new spec"), which no longer holds against the current app.
- **Fix**: After filling the seeker search box, click the matching suggestion (`hostPage.getByRole("option", { name: seekerEmail }).click()`, using the confirmed `role="option"` on cmdk's `CommandItem`) before filling kWh and submitting.
- **Decision**: FIXED — added the missing selection step; user confirmed "keep the fix" after the process-deviation flag, and declined to also record this as a standing lessons.md rule.
- **Verification caveat**: Lint and `astro check` pass. I could **not** execute `npm run test:e2e` to confirm the fix actually makes the test pass — the local `.env.test` is missing/blank for `E2E_SEEKER_USERNAME`/`E2E_SEEKER_PASSWORD` (and, per the tool's error output, apparently for all six required vars), and I don't have permission to read or edit `.env.test` in this environment. Please run `npm run test:e2e` locally once those vars are filled in to confirm.

### O1 — `dashboard/sessions.astro` doesn't use the now-available `listPocsForOwner` helper

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/dashboard/sessions.astro:14-15
- **Detail**: This page still fetches every POC via `listPocs(supabase)` and filters to `owner_id === currentUserId` in JS — exactly as this plan's own Phase 3 contract specified at the time, since `listPocsForOwner` didn't exist yet. A later, already-reviewed change (`poc-contact-and-management` Phase 1) added `listPocsForOwner(supabase, ownerId)` and switched the sibling `dashboard/pocs.astro` to use it (`dashboard/pocs.astro:16`), but this page was never updated to match, so it's now the one remaining call site doing the manual filter.
- **Fix**: Replace `listPocs(supabase)` + `.filter(...)` with `listPocsForOwner(supabase, currentUserId)`, matching `dashboard/pocs.astro`.
- **Decision**: FIXED — swapped in `listPocsForOwner(supabase, currentUserId)`, removed the manual `.filter(...)` and the now-unused `listPocs` import. Lint and `astro check` reverified clean.

### O2 — `listSessionsForUser` has no pagination or row limit

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (performance)
- **Location**: src/lib/sessions.ts:75-87
- **Detail**: The query has no `LIMIT`/pagination and is called on every `/` (homepage) and `/dashboard/sessions` load, against a table that is append-only by design and can only grow. Acceptable at this PRD's stated "small" scale, matching the plan's own "no pagination... an accepted PRD limitation" note, but worth revisiting once session volume grows.
- **Fix**: No action needed now; add pagination/limit if history length becomes a real concern.
- **Decision**: SKIPPED — accepted as a known PRD-scale limitation.

### O3 — No server-side guard against duplicate session submission

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (reliability)
- **Location**: src/components/sessions/LogSessionForm.tsx (client-side pending-disable only), src/lib/sessions.ts:31-73 (`logSession`, no idempotency check)
- **Detail**: `SubmitButton`'s `pending` disable covers same-tab rapid double-click, but nothing prevents two distinct POSTs (network retry, a second tab) from inserting two identical `charging_sessions` rows for one real-world event. The ledger's debit=credit symmetry is preserved either way (no drift), so this is a duplicate-entry risk, not a balance-correctness risk.
- **Fix**: No action needed now; add a client-generated idempotency token or a short server-side uniqueness window on `(host_id, poc_id, seeker_id, kwh)` if duplicate submissions become a real-world problem.
- **Decision**: SKIPPED — low priority, no evidence of real-world occurrence.

### O4 — `.or()` filter built via raw string interpolation

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (defensive coding)
- **Location**: src/lib/sessions.ts:79 (`.or(\`host_id.eq.${userId},seeker_id.eq.${userId}\`)`)
- **Detail**: Not exploitable today — `userId` is always the trusted `context.locals.user.id`/`Astro.locals.user.id` from the authenticated session, never user-supplied input — but the string-interpolation pattern is fragile if ever copied to a call site with less-trusted input.
- **Fix**: No action needed now; avoid reusing this string-building pattern if a similar `.or()` filter is added elsewhere with non-session-derived values.
- **Decision**: SKIPPED — not exploitable today, `userId` is always session-derived.

## Notes (no finding — already resolved / confirmed sound)

- **`prerender = false` on `src/pages/api/sessions/create.ts`**: omitted as this plan originally shipped it (confirmed via `git show d4cbfe5`), but already fixed by the `poc-contact-and-management` implementation review's triage (current file has it at line 6). No action needed here.
- **`seeker_email` case-sensitivity**: at `d4cbfe5`, the raw host-typed `seekerEmail` was stored verbatim even though the email→id RPC matched case-insensitively — a real historical data-integrity gap. Moot today: the later `poc-contact-and-management` Phase 5 rework replaced the plain email input with a combobox that supplies the seeker's canonical email directly from the search RPC's results, so current inserts always use the canonical casing.
- **Ledger invariant / RLS defense-in-depth confirmed sound**: DB check constraints (`kwh > 0 and kwh <= 500`, `host_id <> seeker_id`) exactly mirror the app-level checks, and `sessions_insert_own`'s RLS `exists(...)` clause independently re-verifies POC ownership transactionally at insert time — real defense-in-depth, not decorative. POC ownership is immutable in this codebase (no code path ever changes `owner_id`), so an ownership-transfer TOCTOU scenario isn't realistic. Grants in `20260815123000_grant_table_privileges.sql` (an undocumented but justified addendum, same category as the Phase 1 `database.types.ts` regeneration) are minimal — `select, insert` only on `charging_sessions`, no `update`/`delete` — correct for an immutable ledger.
- **Automated Success Criteria**: `npx supabase migration up`, `npm run lint`, `npm run build`, `npx astro check` all pass cleanly. Phase 4's `npm run test:e2e` could not be completed in this environment — the local `.env.test` is missing `E2E_SEEKER_USERNAME`/`E2E_SEEKER_PASSWORD` (added by this plan's own Phase 4, per `.env.test.example`), so `e2e/global-setup.ts` fails fast with a clear "missing required env vars" error before any spec runs. This is a local-environment configuration gap, not a code defect — recommend filling in the two new vars in `.env.test` to run the suite.
