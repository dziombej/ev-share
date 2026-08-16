<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: POC Contact & Management Implementation Plan

- **Plan**: context/changes/poc-contact-and-management/plan.md
- **Scope**: Phase 1-5 of 5 (full plan)
- **Date**: 2026-08-16
- **Verdict**: REJECTED (at time of review) → all findings triaged and fixed/accepted the same session; see Decisions below and the follow-up migrations in `supabase/migrations/`.
- **Findings**: 1 critical, 3 warnings, 1 observation — 4 fixed, 1 accepted

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — LIKE wildcard metacharacters unescaped in email-prefix search RPC

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260815152000_search_users_by_email_rpc.sql:8
- **Detail**: `search_users_by_email_prefix` builds `where lower(email) like lower(p_prefix) || '%'` with no escaping of `%`/`_`. `/api/users/search.ts` only enforces a 3-character minimum length and passes the raw string straight through (`src/pages/api/users/search.ts:13,23`). Typing exactly `___` (three underscores) satisfies the 3-char minimum and, because `_` is LIKE's single-character wildcard, `___%` matches every email of length ≥ 3 — i.e. effectively every registered user. This is reachable through the sanctioned seeker-combobox UI, not just via a crafted direct RPC call, and defeats the plan's stated intent ("deliberately narrow... to limit directory enumeration").
- **Fix A ⭐ Recommended**: Escape `%`, `_`, and `\` in `p_prefix` before the `like`, using an explicit `escape` clause (e.g. `where lower(email) like lower(escaped_prefix) || '%' escape '\'`).
  - Strength: Keeps prefix semantics (still a real "starts with" search) with a well-understood, standard SQL fix.
  - Tradeoff: Escaping must be done correctly inside the function (can't rely on the caller); a subtly wrong escape sequence silently reopens the hole.
  - Confidence: HIGH — standard, well-documented Postgres pattern for this exact class of bug.
  - Blind spot: None significant.
- **Fix B**: Replace the `like` with `where left(lower(email), length(p_prefix)) = lower(p_prefix)`.
  - Strength: No escaping to get wrong at all — wildcard metacharacters in the input are just literal characters being compared.
  - Tradeoff: Loses the ability to add more LIKE-style patterns later (not needed today, but slightly less flexible).
  - Confidence: HIGH — eliminates the injection class structurally rather than by careful escaping.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — `supabase/migrations/20260816100000_fix_search_users_by_email_prefix_escaping.sql` escapes `%`/`_`/`\` with an explicit `escape '\'` clause. Verified: `select * from search_users_by_email_prefix('___', 20)` now returns 0 rows against the local 3-user seed data (previously matched all 3).

### F2 — Delete grant on `pocs` has no ownership scoping, not even a dormant policy

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260815151000_pocs_delete_grant.sql:5
- **Detail**: `grant delete on public.pocs to authenticated` adds no scoping mechanism whatsoever. `select`/`insert`/`update` on `pocs` all have a matching RLS policy left in place (dormant since RLS is disabled table-wide, per `20260815140000_disable_rls.sql`) — e.g. `pocs_update_own` (`20260815100000_create_pocs.sql:30`) — so re-enabling RLS later restores real per-operation protection for those three. There is no `pocs_delete_own` policy at all, so today any authenticated caller hitting Supabase's REST endpoint directly (bypassing `removePoc`'s app-level `.eq("owner_id", ownerId)` filter) can delete another user's POC outright, and re-enabling RLS wouldn't automatically fix delete the way it would for the other three operations. Delete is irreversible, unlike a bad `update`/`toggle`, which raises the stakes of this specific gap above the already-accepted "RLS off, app-level scoping only" baseline.
- **Fix A ⭐ Recommended**: Add a `pocs_delete_own` policy (`for delete using (auth.uid() = owner_id)`) alongside the grant, dormant like its siblings until RLS is re-enabled — keeps this gap symmetric with the existing accepted pattern rather than a step below it.
  - Strength: Matches the precedent already set by `pocs_update_own`/`pocs_insert_own`; zero behavior change today (RLS is still off), just closes the future gap and documents intent.
  - Tradeoff: Still exploitable today until RLS is actually re-enabled — this is a "make the eventual fix trivial" change, not an immediate mitigation.
  - Confidence: HIGH — same policy shape as three other tables in this schema.
  - Blind spot: Doesn't address the live exposure while RLS stays off.
- **Fix B**: Add a `before delete` trigger function on `pocs` that raises unless `owner_id = auth.uid()`, independent of RLS state.
  - Strength: Actually closes the live exposure today, not just when RLS is eventually re-enabled.
  - Tradeoff: A new enforcement mechanism (trigger) not used anywhere else in this schema — inconsistent with the project's stated "app-code enforces ownership" model for this POC stage.
  - Confidence: MEDIUM — correct in principle, but a new pattern this codebase doesn't otherwise use.
  - Blind spot: Haven't confirmed whether the team considers direct-REST-bypass an in-scope threat at this stage, or whether "app is the only client" is an accepted assumption.
- **Decision**: FIXED via Fix A — `supabase/migrations/20260816101000_pocs_delete_own_policy.sql` adds a dormant `pocs_delete_own` policy (`for delete using (owner_id = auth.uid())`), symmetric with the existing `pocs_update_own`/`pocs_insert_own` policies. Applied cleanly against local Supabase.

### F3 — Email-prefix minimum length only enforced outside the database

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260815152000_search_users_by_email_rpc.sql:8
- **Detail**: The plan's stated 3-character minimum is enforced only in `/api/users/search.ts:13` (client/API layer). The RPC itself has no `length(p_prefix)` guard, even though its `p_limit` clamp is explicitly commented as "defense-in-depth... independent of whatever cap the API route passes." Any authenticated session can call `search_users_by_email_prefix` directly via PostgREST with an empty or 1-character prefix and page through the full user directory 20 rows at a time, bypassing the app's gate entirely.
- **Fix**: Add `and length(p_prefix) >= 3` to the RPC's `where` clause, mirroring the `p_limit` clamp's own defense-in-depth reasoning.
- **Decision**: FIXED — `supabase/migrations/20260816102000_search_users_by_email_prefix_min_length.sql` adds `length(p_prefix) >= 3` to the `where` clause. Applied cleanly against local Supabase.

### F4 — New API routes omit `export const prerender = false`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/pocs/create.ts, src/pages/api/pocs/[id].ts, src/pages/api/pocs/[id]/power.ts, src/pages/api/sessions/create.ts, src/pages/api/users/search.ts
- **Detail**: CLAUDE.md states the API-route convention as "export uppercase HTTP-verb handlers... and `const prerender = false`." Only `src/pages/api/profile/location.ts` follows it; the pre-existing `pocs/[id]/toggle.ts` already missed it, and all 5 new routes in this plan repeat the gap rather than correcting it. Functionally inert under `output: "server"`, but it's drift away from the one file that matches the documented convention.
- **Fix**: Add `export const prerender = false;` to the 5 new route files (optionally backfill `toggle.ts` too, though that's pre-existing and out of this plan's scope).
- **Decision**: FIXED — added `export const prerender = false;` (matching `profile/location.ts`'s placement, right after imports) to all 5 files: `pocs/create.ts`, `pocs/[id].ts`, `pocs/[id]/power.ts`, `sessions/create.ts`, `users/search.ts`. Lint reverified clean (0 errors).

### F5 — MyPocList power-rating field uses Save-button pattern, not blur/optimistic-revert

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/pocs/MyPocList.tsx
- **Detail**: The plan's Phase 3 contract specifies the power field PATCHes "on blur/submit with the same optimistic-update-and-revert-on-failure pattern as the toggle." The actual implementation uses an explicit "Save" button and updates local state only after the PATCH succeeds, rather than optimistically-then-reverting on failure. Functionally sound (no incorrect flash of a bad value) and arguably safer, but it's a different interaction pattern than literally specified.
- **Fix**: No action needed — accept as an intentional, benign deviation, or note it in the plan as an addendum for future reference.
- **Decision**: ACCEPTED — Save-button pattern is functionally sound (no bad-value flash); no code change made.
