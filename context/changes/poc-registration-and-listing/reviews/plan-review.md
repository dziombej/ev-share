<!-- PLAN-REVIEW-REPORT -->
# Plan Review: POC Registration & Listing Implementation Plan

- **Plan**: context/changes/poc-registration-and-listing/plan.md
- **Mode**: Deep
- **Date**: 2026-08-15
- **Verdict**: REVISE → SOUND (after fixes applied)
- **Findings**: 1 critical, 1 warning, 2 observations — all fixed

## Verdicts

| Dimension | Verdict (pre-fix) |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

7/7 paths ✓ (`src/lib/supabase.ts`, `src/middleware.ts`, `src/pages/dashboard.astro`, `src/components/auth/SignUpForm.tsx`, `src/components/auth/ServerError.tsx`, `src/pages/api/auth/signin.ts`, `components.json`). Symbols confirmed: `PROTECTED_ROUTES` is prefix-only and does not cover `/api/pocs/*`; `build` script is bare `astro build` with no type-check. brief↔plan ✓. Independent verification subagent confirmed RLS default-deny behavior, `Response.json`/nested-dynamic-route feasibility on this stack, and the "first JSON API route" claim — no unknown blast radius found.

## Findings

### F1 — API routes have no guard against unauthenticated callers

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — API Routes (create.ts and [id]/toggle.ts)
- **Detail**: `/api/pocs/*` isn't covered by middleware's `/dashboard` prefix match, so an unauthenticated POST/PATCH reaches the handler with `context.locals.user === null`. The original contract used `context.locals.user.id` with no null check — an unhandled 500 instead of a clean rejection.
- **Fix**: Added an explicit guard as the first statement in each handler — `create.ts` redirects to `/auth/signin`; `[id]/toggle.ts` returns a 401 JSON response. Added matching manual-verification bullets (Phase 2 Manual, Progress 2.5).
- **Decision**: FIXED (Fix in plan)

### F2 — "Build (includes type-check)" claim is likely inaccurate

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phases 1, 2, 3 — Automated Verification (repeated 3×)
- **Detail**: `astro build` strips TS types without checking them; `@astrojs/check` is installed but unused by any script or CI.
- **Fix A ⭐ Recommended**: Add `npx astro check` as an explicit automated-verification command in all three phases.
- **Fix B**: Leave `npm run build` as-is, correct the label only.
- **Decision**: FIXED (Fix A — added `npx astro check` to all three phases' Automated Verification and Progress items 1.4/2.3/3.3)

### F3 — Toggle route's JSON body parse isn't guarded

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Toggle-availability route
- **Detail**: `context.request.json()` throws synchronously on non-JSON input, before zod runs — an unhandled 500 instead of the intended 400.
- **Fix**: Wrap the `.json()` call in try/catch, returning the same 400 error shape as a zod validation failure.
- **Decision**: FIXED (Fix in plan)

### F4 — Zero-row-update detection mechanism unspecified

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 item 3 (setPocAvailability) / Phase 2 toggle route
- **Detail**: Phase 2 promises 403 on zero-row updates, but `setPocAvailability`'s contract didn't specify how zero-row updates are detected (Supabase's `.update()` doesn't return a row count by default).
- **Fix**: Added one sentence specifying `.select().single()` chained on the update, with the thrown/zero-row result as the 403 signal.
- **Decision**: FIXED (Fix in plan)
