# POC Registration & Listing Implementation Plan

## Overview

Users can register one or more of their own charging points (POCs) with a location (latitude/longitude), a power rating (kW), and an availability flag; toggle that availability instantly from a list view; and see all registered POCs (their own and others') with current availability. This is roadmap slice **S-01**, covering FR-004, FR-005, FR-006, and the POC-registration precondition of US-01.

## Current State Analysis

No domain schema, API routes, or UI exist for this feature — the codebase currently has only auth scaffolding:

- No `supabase/migrations/` directory and no `.sql` files anywhere under `supabase/` — this is the first migration in the project.
- No `src/types.ts` — no shared domain types exist yet.
- `src/components/ui/` contains only a shadcn `button.tsx`; `input`, `label`, `card`, `switch` are not yet added.
- `/dashboard` is currently a single flat file (`src/pages/dashboard.astro`), already gated by `src/middleware.ts`'s `PROTECTED_ROUTES = ["/dashboard"]` prefix match — a new `src/pages/dashboard/pocs.astro` inherits protection automatically with no middleware change needed.
- Existing API routes (`src/pages/api/auth/{signin,signup,signout}.ts`) all follow one convention: native `formData()` POST → `context.redirect(...)`, success or `?error=<message>` on failure. No JSON API route exists anywhere yet, and no `zod` dependency is installed despite `CLAUDE.md` mandating it for new routes.
- The e2e harness (`e2e/`, change `e2e-primary-flow-harness`) covers only auth round-trip and the post-login dashboard welcome message. Its own plan explicitly deferred "the actual US-01 flow (POC registration, session logging, balance updates)" to S-01/S-02/S-03 — it contains no POC fixtures, routes, or `data-testid` conventions to satisfy yet.

## Desired End State

A signed-in user visiting `/dashboard/pocs` sees a registration form (latitude, longitude, power rating in kW) and, below it, a list of every registered POC (their own and other users') each showing power rating, coordinates, and an availability `Switch`. Submitting the form adds a new POC owned by the current user. Flipping the `Switch` on a POC the current user owns updates its availability immediately (no page reload) and persists — refreshing the page shows the same state. A user cannot toggle another user's POC (enforced by RLS, not just UI). Visiting `/dashboard/pocs` while unauthenticated redirects to `/auth/signin` (existing middleware behavior, no new code needed).

**Verification**: manually walk through registering a POC, confirming it appears in the list, toggling its availability and confirming the change persists across a refresh, and confirming a second test account can see the first user's POC in its own list but cannot toggle it.

### Key Discoveries:

- `src/lib/supabase.ts:5` — `createClient(requestHeaders, cookies)` returns a configured Supabase server client or `null`; every new route/page follows the existing null-check pattern only where reachable while unauthenticated. Since `/dashboard/pocs` is protected, code reachable there can assume a non-null client and a real `Astro.locals.user` (see Critical Implementation Details).
- `src/middleware.ts:4,18-20` — `PROTECTED_ROUTES` prefix-matches `/dashboard`, so `/dashboard/pocs` and `/api/pocs/*` under it need no middleware edit. (`/api/pocs/*` is not under `/dashboard` — see the API routes phase for why this doesn't matter here.)
- `src/pages/dashboard.astro:1-5` — pages read `const { user } = Astro.locals;` directly rather than re-deriving auth state; new pages/routes should do the same.
- `CLAUDE.md` — "API routes: export uppercase HTTP-verb handlers ... validate input with zod" and "Supabase migrations go in `supabase/migrations/`, named `YYYYMMDDHHmmss_short_description.sql`, with RLS enabled and granular per-operation/per-role policies on every new table" — both apply directly to this change as the first domain feature.
- `components.json` — shadcn "new-york" style is configured but only `button` has been added; `input`, `label`, `switch`, `card` must be added via `npx shadcn@latest add <name>` before use.

## What We're NOT Doing

- Editing or deleting a POC after creation — only create + toggle availability, per FR-004/FR-005 exactly.
- Address-based location entry or geocoding — location is two manually-entered numeric fields (latitude, longitude) only, per the PRD's "no device geolocation, no map/routing integration" non-goals.
- Distance-sorting (FR-012) or power-level filtering (FR-013) — both nice-to-have and parked in the roadmap.
- Any e2e/Playwright coverage for this slice — the one required primary-flow e2e test (`CLAUDE.md`'s "at least one e2e test verifying US-01") covers the full register→charge→log→balance loop, which isn't buildable until S-02 exists. Verification here is manual only; this slice's flows should be folded into that later e2e spec, not duplicated with a standalone one now.
- Duplicate-POC detection (rejecting a second POC at the same coordinates) — self-reported POC data is an accepted MVP limitation per the PRD (no verification mechanism for any POC field).
- Any change to `src/lib/config-status.ts` or the `Layout.astro` degraded-mode banner — `/dashboard/pocs` is only reachable when already authenticated, which already implies Supabase is configured; no new degraded-mode branching is needed.

## Implementation Approach

Build bottom-up: schema + RLS first (nothing above it can be verified without a real table), then the two API routes it needs, then the UI that calls them. The availability toggle uses a small JSON API route (a new convention alongside the existing form-POST pattern) because a full-page reload for a single switch flip would fail the PRD's ~1-second acknowledgement NFR on a list of multiple POCs; POC creation keeps the existing form-POST + redirect convention since a full-page reload for registering a new POC (an infrequent action) is unremarkable UX.

## Critical Implementation Details

- **Timing & lifecycle**: API routes execute after the global middleware (`src/middleware.ts`) on every request, so `context.locals.user` is already populated by the time a route handler runs — read it directly instead of calling `supabase.auth.getUser()` again inside `src/pages/api/pocs/*` handlers.

## Phase 1: Data Layer

### Overview

Creates the `pocs` table with RLS policies and the shared TypeScript types the API/UI phases depend on.

### Changes Required:

#### 1. Supabase migration

**File**: `supabase/migrations/20260815100000_create_pocs.sql`

**Intent**: Create the `pocs` table (one row per registered charging point) with RLS enabled so any authenticated user can read all rows, but only the owning user can insert or update their own.

**Contract**:
- Columns: `id uuid primary key default gen_random_uuid()`, `owner_id uuid not null references auth.users(id) on delete cascade`, `latitude numeric(9,6) not null`, `longitude numeric(9,6) not null`, `power_rating_kw numeric(6,2) not null`, `is_available boolean not null default true`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`.
- Check constraints: `latitude between -90 and 90`, `longitude between -180 and 180`, `power_rating_kw > 0 and power_rating_kw <= 350` (defense-in-depth behind the API's zod validation, not a replacement for it).
- `alter table pocs enable row level security;`
- Policy `pocs_select_authenticated`: `for select to authenticated using (true)` — any signed-in user can view all POCs (FR-006).
- Policy `pocs_insert_own`: `for insert to authenticated with check (owner_id = auth.uid())`.
- Policy `pocs_update_own`: `for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())`.
- No delete policy — deletion is denied by default (RLS with no matching policy blocks the operation), matching "What We're NOT Doing."

#### 2. Shared domain types

**File**: `src/types.ts` (new)

**Intent**: Define the POC shape the API routes and UI components share, translating the DB's snake_case columns to camelCase at the boundary.

**Contract**: Export `Poc` (`id`, `ownerId`, `latitude`, `longitude`, `powerRatingKw`, `isAvailable`, `createdAt`, `updatedAt` — all matching the migration's columns) and `CreatePocInput` (`latitude`, `longitude`, `powerRatingKw`).

#### 3. POC data-access service

**File**: `src/lib/pocs.ts` (new)

**Intent**: Wrap the three Supabase calls this feature needs (list all, insert, toggle availability) behind typed functions, mapping DB rows to the `Poc` type from `src/types.ts`, so API routes don't hand-roll query/mapping logic.

**Contract**: Export `listPocs(supabase): Promise<Poc[]>`, `createPoc(supabase, ownerId, input: CreatePocInput): Promise<Poc>`, `setPocAvailability(supabase, pocId, ownerId, isAvailable): Promise<Poc>` (the `ownerId` param is passed through as an extra `.eq("owner_id", ownerId)` filter alongside RLS — belt-and-suspenders, not a substitute for the RLS policy). `setPocAvailability` chains `.select().single()` on the update — Supabase's `.update()` alone doesn't report affected-row count, and `.single()` throws when zero rows match, which is the signal the toggle route uses to return 403.

#### Addendum (discovered during implementation)

**Files**: `src/lib/database.types.ts` (new, generated), `src/lib/supabase.ts` (modified), `eslint.config.js` (modified)

**Why**: Strict-typed ESLint (`@typescript-eslint/no-unsafe-assignment`) failed on `.from("pocs")` calls without a generated Database schema type. Fixed by generating types via `npx supabase gen types typescript --local`, wiring `createServerClient<Database>()` in `src/lib/supabase.ts`, and adding an `ignores` entry for the generated file in `eslint.config.js` (machine-generated output shouldn't be hand-formatted/linted).

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly against local Supabase: `npx supabase migration up`
- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Type-check passes: `npx astro check` (this repo's `astro build` does not itself type-check — `@astrojs/check` is the dependency installed for this purpose but wasn't previously wired into any script)

#### Manual Verification:

- Inspecting the local Supabase Studio table editor shows the `pocs` table with RLS enabled and the three policies listed above.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: API Routes

### Overview

Exposes the two server endpoints the UI phase will call: registering a new POC, and toggling an existing POC's availability.

### Changes Required:

#### 1. Add zod dependency

**File**: `package.json`

**Intent**: `CLAUDE.md` mandates zod for input validation on new API routes; it isn't installed yet.

**Contract**: `npm install zod`.

#### 2. Create-POC route

**File**: `src/pages/api/pocs/create.ts` (new)

**Intent**: Accept a form-POST registering a new POC owned by the current user, following the existing auth-route convention (redirect back with `?error=` on failure).

**Contract**: `export const POST: APIRoute`. First statement: `if (!context.locals.user) return context.redirect('/auth/signin')` — `/api/pocs/*` is not covered by `PROTECTED_ROUTES`'s `/dashboard` prefix match, so this route must guard against an unauthenticated direct hit itself rather than relying on middleware. Then reads `latitude`, `longitude`, `powerRatingKw` from `context.request.formData()`; validates with a zod schema using `z.coerce.number()` for each field, matching the ranges in the Phase 1 check constraints. On validation failure or Supabase insert error, `context.redirect('/dashboard/pocs?error=' + encodeURIComponent(message))`. On success, `context.redirect('/dashboard/pocs')`. Uses `context.locals.user.id` as `owner_id` (see Critical Implementation Details — no redundant `getUser()` call).

#### 3. Toggle-availability route

**File**: `src/pages/api/pocs/[id]/toggle.ts` (new)

**Intent**: Accept a JSON request flipping one POC's availability, for the client-side `Switch` to call without a full page reload.

**Contract**: `export const PATCH: APIRoute`. First statement: `if (!context.locals.user) return Response.json({ error: "Unauthorized" }, { status: 401 })` — same reasoning as the create route: `/api/pocs/*` isn't covered by middleware's `/dashboard` prefix match, so this route must guard itself. Reads `id` from `context.params`, reads `{ isAvailable: boolean }` from the JSON request body — wrap `context.request.json()` in a try/catch, since malformed JSON throws synchronously before zod runs; a catch returns the same 400 error shape as a zod validation failure. Once parsed, validate with zod. Calls `setPocAvailability(supabase, id, context.locals.user.id, isAvailable)`. Returns `Response.json({ poc })` (200) on success; `Response.json({ error: message }, { status: 400 })` on validation failure; `Response.json({ error: message }, { status: 403 })` if the update affects zero rows (not the owner, or POC doesn't exist — RLS + the explicit `owner_id` filter both produce this).

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Type-check passes: `npx astro check`

#### Manual Verification:

- Using `curl` or a REST client against a running `npm run dev` instance (with a valid session cookie): POST to `/api/pocs/create` creates a row visible in Supabase Studio; PATCH to `/api/pocs/<id>/toggle` as the owner flips `is_available` and returns 200; the same PATCH as a different authenticated user returns 403.
- Using the same client with no session cookie at all: POST to `/api/pocs/create` redirects cleanly to `/auth/signin` (no 500); PATCH to `/api/pocs/<id>/toggle` returns a clean 401 JSON response (no 500).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: UI

### Overview

Adds the missing shadcn primitives and builds the registration form, POC list, and page that ties Phases 1–2 together into the user-facing flow.

### Changes Required:

#### 1. Add missing shadcn primitives

**File**: `src/components/ui/{input,label,switch,card}.tsx` (new, generated)

**Intent**: These primitives don't exist yet and are needed for the form fields, availability switch, and list card layout.

**Contract**: `npx shadcn@latest add input label switch card`.

#### 2. POC registration form

**File**: `src/components/pocs/PocForm.tsx` (new)

**Intent**: A React island form (mirroring the structural pattern of `src/components/auth/SignUpForm.tsx`: controlled inputs, per-field `errors` state, native form POST, `SubmitButton`-style pending state) for latitude, longitude, and power rating, built with the newly-added shadcn `Input`/`Label` rather than hand-rolled Tailwind inputs.

**Contract**: `export default function PocForm({ serverError }: { serverError?: string | null })`. `<form method="POST" action="/api/pocs/create" ...>` with three labeled numeric inputs (`name="latitude"`, `name="longitude"`, `name="powerRatingKw"`) and a submit button using `useFormStatus()` for pending state, per the existing `SubmitButton.tsx` pattern. Reuses `src/components/auth/ServerError.tsx` directly (it's a generic `{ message }` presentational component despite its folder) to surface `serverError`.

#### 3. POC list with availability toggle

**File**: `src/components/pocs/PocList.tsx` (new)

**Intent**: Renders every POC as a card (power rating, coordinates, owner indicator) with a `Switch` for availability; the current user's own POCs have an interactive switch, others' are read-only (disabled switch reflecting current state).

**Contract**: `export default function PocList({ pocs, currentUserId }: { pocs: Poc[]; currentUserId: string })`. On switch change (only enabled when `poc.ownerId === currentUserId`), `fetch('/api/pocs/' + poc.id + '/toggle', { method: 'PATCH', body: JSON.stringify({ isAvailable: next }) })`; update local state from the response on success, revert the switch and show an inline error on failure.

#### 4. Page

**File**: `src/pages/dashboard/pocs.astro` (new)

**Intent**: Server-render the current POC list (via `createClient` + `listPocs`) and host the two React islands.

**Contract**: Reads `Astro.locals.user`, calls `createClient(Astro.request.headers, Astro.cookies)` then `listPocs(supabase)`, passes the result and `Astro.url.searchParams.get("error")` into `<PocForm client:load>` and `<PocList client:load pocs={pocs} currentUserId={user.id}>`. Wrapped in the existing `Layout` component, matching `src/pages/dashboard.astro`'s structure.

#### 5. Dashboard nav link

**File**: `src/pages/dashboard.astro`

**Intent**: Give users a way to reach the new page from the existing dashboard.

**Contract**: Add a single `<a href="/dashboard/pocs">` link near the existing sign-out form.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Type-check passes: `npx astro check`

#### Manual Verification:

- Signed in as user A: visiting `/dashboard/pocs` shows the form and an (initially empty or seeded) list; submitting the form with valid values adds a new POC that appears in the list after the redirect.
- Flipping the availability switch on user A's own POC updates instantly (no full page reload) and the new state survives a manual page refresh.
- Signed in as user B (a second test account): user A's POC appears in the list with its current availability, but its switch is disabled/non-interactive for user B.
- Signed out: visiting `/dashboard/pocs` redirects to `/auth/signin`.
- Submitting the form with an out-of-range value (e.g., latitude of 200, or a negative power rating) shows an inline `?error=` message and does not create a row.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

No automated test runner is configured in this repo yet (`CLAUDE.md`: "No test runner is configured yet"), and this slice's flows are intentionally left out of the existing Playwright e2e harness (see "What We're NOT Doing"). Verification for all three phases is `npm run lint` + `npm run build` (automated) plus the manual walkthroughs listed under each phase's Manual Verification.

### Manual Testing Steps:

1. Register a POC as user A; confirm it appears in the list immediately after redirect.
2. Toggle its availability off, then on, confirming the switch updates without a page reload each time.
3. Refresh the page after toggling; confirm the persisted state matches the last toggle.
4. Sign in as a second user (user B); confirm user A's POC is visible but its switch is not interactive for user B.
5. Attempt to submit the registration form with an invalid value (out-of-range latitude/longitude, zero or negative power rating); confirm an inline error appears and no row is created.
6. Sign out and visit `/dashboard/pocs` directly; confirm redirect to `/auth/signin`.

## Performance Considerations

None beyond the NFR already addressed by the toggle's design (client-side fetch instead of full-page reload keeps the ~1-second acknowledgement target easy to hit even as the POC list grows within this MVP's expected small scale).

## Migration Notes

This is a net-new table with no existing data to migrate. Per `context/foundation/infrastructure.md`'s risk register, `wrangler rollback` only reverts Worker code/assets, never Supabase schema — if this migration needs to be rolled back after deploy, that must be done as a separate, explicit Supabase migration (e.g., a `drop table` migration), not via `wrangler rollback`.

## References

- Roadmap slice: `context/foundation/roadmap.md` § S-01
- PRD requirements: `context/foundation/prd.md` § Functional Requirements (FR-004, FR-005, FR-006), § US-01
- Prior art for API route pattern: `src/pages/api/auth/signin.ts`
- Prior art for React island form pattern: `src/components/auth/SignUpForm.tsx`
- e2e harness (not extended by this change): `context/changes/e2e-primary-flow-harness/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data Layer

#### Automated

- [x] 1.1 Migration applies cleanly against local Supabase: `npx supabase migration up` — 80cc033
- [x] 1.2 Lint passes: `npm run lint` — 80cc033
- [x] 1.3 Build passes: `npm run build` — 80cc033
- [x] 1.4 Type-check passes: `npx astro check` — 80cc033

#### Manual

- [x] 1.5 Local Supabase Studio shows the `pocs` table with RLS enabled and the three policies — 80cc033

### Phase 2: API Routes

#### Automated

- [x] 2.1 Lint passes: `npm run lint` — af3e818
- [x] 2.2 Build passes: `npm run build` — af3e818
- [x] 2.3 Type-check passes: `npx astro check` — af3e818

#### Manual

- [x] 2.4 POST `/api/pocs/create` creates a row; PATCH `/api/pocs/<id>/toggle` succeeds as owner (200) and fails as non-owner (403) — af3e818
- [x] 2.5 Unauthenticated POST to `/api/pocs/create` redirects to `/auth/signin`; unauthenticated PATCH to `/api/pocs/<id>/toggle` returns 401 (neither returns a 500) — af3e818

### Phase 3: UI

#### Automated

- [x] 3.1 Lint passes: `npm run lint` — 414aafb
- [x] 3.2 Build passes: `npm run build` — 414aafb
- [x] 3.3 Type-check passes: `npx astro check` — 414aafb

#### Manual

- [x] 3.4 User A can register a POC and see it appear in the list — 414aafb
- [x] 3.5 User A's availability switch toggles instantly and persists across refresh — 414aafb
- [x] 3.6 User B sees user A's POC but cannot toggle it — 414aafb
- [x] 3.7 Signed-out visit to `/dashboard/pocs` redirects to `/auth/signin` — 414aafb
- [x] 3.8 Invalid registration input (out-of-range lat/lng, non-positive power rating) shows an inline error and creates no row — 414aafb
