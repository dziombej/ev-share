<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: POC Registration & Listing Implementation Plan

- **Plan**: context/changes/poc-registration-and-listing/plan.md
- **Scope**: Phase 3 of 3 (full plan)
- **Date**: 2026-08-15
- **Verdict**: NEEDS ATTENTION → APPROVED (all 7 findings fixed during triage)
- **Findings**: 0 critical, 3 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Missing lat/lng silently creates a (0,0) POC instead of being rejected

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/pocs/create.ts:6-10
- **Detail**: `z.coerce.number().min(-90).max(90)` on a missing form field: `form.get("latitude")` is `null`, `Number(null)` is `0` — in-range and "valid". Confirmed live: omitting latitude/longitude entirely creates a real row at (0,0) with a clean 302, no error. `powerRatingKw` is incidentally protected by `.positive()`; lat/lng are not, since `0` is a legitimate coordinate value.
- **Fix**: Require presence before coercion — `z.string().trim().min(1, "Latitude is required").pipe(z.coerce.number().min(-90).max(90))` for both fields (zod v4 `.pipe()`).
  - Strength: Closes the gap precisely where it exists.
  - Tradeoff: None meaningful — standard zod pattern.
  - Confidence: HIGH — reproduced live.
  - Blind spot: Didn't check whether other future numeric form fields in this repo should adopt the same pattern as a documented convention.
- **Decision**: FIXED (Fix now — verified live: missing fields now redirect with a clear error, no (0,0) row created; valid submissions still succeed)

### F2 — Raw Postgrest error text can leak to the user-facing ?error= message

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/pocs/create.ts:37
- **Detail**: `PostgrestError` extends `Error`, so `error instanceof Error ? error.message : ...` passes raw DB error text into the `?error=` query string. Not currently triggerable (zod ranges match DB check constraints), but latent — activates the moment they diverge or a new constraint/FK appears.
- **Fix**: Map unexpected DB errors to a generic message and log the real error server-side.
- **Decision**: FIXED (Fix now — required switching F1's zod pattern from `.pipe(z.coerce.number()...)` to `.transform(Number).pipe(z.number()...)` since the former didn't type-check under zod v4; verified live that missing, non-numeric, and valid inputs all behave correctly, and lint/build/astro check all pass)

### F3 — Rapid double-toggle on the availability Switch can desync the UI

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/pocs/PocList.tsx:15-33
- **Detail**: The switch is only disabled for non-owners, never while a toggle request is in flight. Two overlapping PATCH requests plus a revert closure over stale `next` values can leave the optimistic UI out of sync with the server until a refresh.
- **Fix**: Track in-flight POC ids (e.g. a `Set<string>` state) and disable the switch for a POC while its request is pending.
- **Decision**: FIXED (Fix now — added `pendingIds` Set state, guarded `handleToggle` re-entry, disabled the switch while pending; lint/astro check both clean)

### F4 — Unplanned but justified: database.types.ts / supabase.ts / eslint.config.js

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/lib/database.types.ts, src/lib/supabase.ts, eslint.config.js
- **Detail**: Not in the plan's Phase 1 file list. Added to satisfy the plan's own "lint passes"/"type-check passes" success criteria (strict-typed ESLint failed on untyped `.from("pocs")` calls) — already disclosed and approved during the Phase 1 commit-message confirmation.
- **Fix**: None needed. Worth a one-line addendum to plan.md's Phase 1 file list for future readers.
- **Decision**: FIXED (added an "Addendum" subsection to plan.md's Phase 1 documenting the 3 unplanned files and why)

### F5 — Toggle route's non-UUID id param falls through to a generic 500

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/pocs/[id]/toggle.ts:19-22
- **Detail**: A non-UUID `id` causes a Postgres invalid-input-syntax error (not PGRST116), so `isNoRowsError` returns false and the route falls through to a generic 500 instead of a clean 400. Low likelihood — no UI path produces this.
- **Fix**: Validate `id` with `z.string().uuid()` before calling `setPocAvailability`.
- **Decision**: FIXED (Fix now — used `z.uuid()` per zod v4's non-deprecated form; verified live: non-UUID id now returns a clean 400 instead of 500)

### F6 — updated_at never refreshes on an availability toggle

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: supabase/migrations/20260815100000_create_pocs.sql:10
- **Detail**: No `BEFORE UPDATE` trigger refreshes `updated_at`; `setPocAvailability` only writes `is_available`. Dormant since nothing currently reads `updated_at`.
- **Fix**: Add a follow-up migration with a `moddatetime`-style trigger if/when `updated_at` becomes load-bearing (e.g. S-02's history view).
- **Decision**: FIXED (added `supabase/migrations/20260815110000_pocs_updated_at_trigger.sql` with a `BEFORE UPDATE` trigger; verified live that toggling availability now refreshes `updated_at`)

### F7 — Redundant type cast in listPocs

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/pocs.ts:31
- **Detail**: `(data as PocRow[]).map(mapRow)` casts a value that should already be typed as `PocRow[]` once `error` is null-checked via the `SupabaseDb` generic. Harmless but could mask a real type mismatch.
- **Fix**: Remove the cast and confirm `data` infers as `PocRow[]` directly.
- **Decision**: FIXED (removed the cast; `astro check` confirms `data` infers correctly without it — the other two casts in `createPoc`/`setPocAvailability` had already been auto-removed by `eslint --fix` during Phase 1)
