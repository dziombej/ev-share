# User Location Profile Implementation Plan

## Overview

Let a logged-in user set and update their own location (manual latitude/longitude entry, no device geolocation) per PRD FR-003. The location lives in a new `profiles` table (one row per user, created on first save), edited inline on the existing `/dashboard` page via an AJAX-saved form. This is roadmap slice **S-04** — the smallest slice in the roadmap, with no current consumers (distance-sorting, the FR that would read this location, is Parked).

## Current State Analysis

No representation of user location exists anywhere in the codebase today — no `profiles` table, no `src/types.ts` entry, no form. The only existing "location" concept is on `public.pocs` (a charging point's location, not a user's), built by the sibling slice `poc-registration-and-listing` (status `impl_reviewed`, commit `414aafb` and prior). That slice already solved the exact sub-problem this plan needs — "capture and validate a manually-entered lat/lng pair" — so this plan reuses its conventions rather than inventing new ones, adapted for two differences: this location is **private** (owner-only read, not `pocs`' authenticated-read-all) and **upserted** (one row per user, not append-only).

## Desired End State

A user visiting `/dashboard` sees a location card: if they've never set a location, it shows a "Location not set" placeholder alongside an empty editable form; if they have, it shows their current latitude/longitude pre-filled in the same form. Entering valid coordinates and clicking Save persists them via an AJAX request (no page reload) and shows an inline success confirmation. Invalid or out-of-range input is rejected client-side before any request is sent; a request that still fails server-side shows an inline error and leaves the previously-saved value untouched.

Verification: reload `/dashboard` after saving — the persisted value reappears (confirms server-side persistence, not just client state).

### Key Discoveries:

- `supabase/migrations/20260815100000_create_pocs.sql:1-11` — established column pattern: `numeric(9,6)` for both latitude and longitude, with `check` constraints enforcing `-90..90` / `-180..180` directly in the DB as defense-in-depth behind zod.
- `supabase/migrations/20260815110000_pocs_updated_at_trigger.sql` — already defines a reusable `public.set_updated_at()` trigger function; this plan attaches a new trigger to `profiles` using that same function rather than redefining it.
- `src/pages/api/pocs/create.ts:6-10` — the zod shape `z.string().trim().min(1,"...").transform(Number).pipe(z.number().min(x).max(y))` exists specifically to fix a bug (impl-review F1) where bare `z.coerce.number()` let a missing form field silently coerce to `0` — a legitimate in-range lat/lng — creating a bogus `(0,0)` row. That fix's premise is form-data (always strings). This plan's endpoint receives a **JSON** body instead (per the AJAX design decision), so numbers arrive as actual JS numbers — the equivalent fix here is to use plain `z.number().min().max()` (no `coerce`), which rejects `null`/`undefined` outright rather than coercing them to `0`. Do not copy the string-coercion pattern verbatim; the underlying bug class still applies if `z.coerce.number()` is used on a JSON body.
- `src/pages/api/pocs/[id]/toggle.ts:1-51` — the codebase's existing JSON-in/JSON-out AJAX API convention (as opposed to the form-POST-redirect convention used by auth and POC-create). This plan's endpoint follows this convention: `Response.json({ ... }, { status })`, `context.locals.user` auth guard returning 401, Supabase-unconfigured guard returning 500.
- `src/components/pocs/PocList.tsx:16-43` — the codebase's existing client-side AJAX-fetch pattern (optimistic local state update, revert on failure, per-field pending/error state). This plan's form follows the same shape (fetch, success/error state, no shared library).
- `src/pages/dashboard.astro:1-35` and `src/pages/dashboard/pocs.astro:1-16` — dashboard.astro is currently a thin, hand-styled page (plain `rounded-2xl border border-white/10 bg-white/10 ... backdrop-blur-xl` divs, no shadcn `Card`); the location card added here should match that existing plain-div styling, while the form's internal inputs use shadcn `Input`/`Label` (matching `PocForm.tsx`'s internal convention).
- `src/lib/database.types.ts` has no `profiles` table yet; it is CLI-generated (`supabase gen types`), not hand-maintained — this plan regenerates it rather than hand-editing it.

## What We're NOT Doing

- No consumption of this location anywhere else in the app (distance-sorting, FR-012, is Parked — this location is captured and displayed only, not yet read by any other feature).
- No device geolocation / browser Geolocation API — manual entry only, per PRD Non-Goals.
- No map, geocoding, or address lookup — raw numeric lat/lng only, matching the POC precedent.
- No forced onboarding step — setting a location is optional and can be done any time from `/dashboard`.
- No dedicated `/dashboard/profile` page — the form lives inline on the existing `/dashboard` page (explicit choice over a separate page).
- No shared/importable zod schema module — client and server validation are duplicated independently, matching the existing `PocForm.tsx` / `create.ts` convention (not a regression, a deliberate consistency choice).
- No ability for one user to view another user's location — RLS restricts reads to the owner only (unlike `pocs`, which is authenticated-read-all).
- No general-purpose "profile" concept (display name, avatar, etc.) — the table holds only what FR-003 requires.

## Implementation Approach

Three phases, each independently shippable: (1) the data layer — migration, regenerated types, DTO, data-access functions; (2) the API endpoint — a single upsert route; (3) the UI — a form component wired into the dashboard page. This mirrors the POC slice's own phase structure and lets each layer be verified before the next depends on it.

## Critical Implementation Details

**Upsert conflict target and primary key shape**: unlike `pocs` (`id uuid primary key default gen_random_uuid()`, a separate `owner_id` foreign key), `profiles.id` IS the foreign key to `auth.users(id)` — there is no separate owner column and no default generator. The upsert call must target this explicitly: `.upsert({ id: userId, latitude, longitude }, { onConflict: "id" })`. Getting this wrong (e.g. treating `id` as auto-generated and omitting it) would attempt to insert a duplicate row per save instead of updating the existing one.

**RLS read scope is narrower than the POC precedent**: `pocs_select_authenticated` uses `using (true)` — any authenticated user can read any POC, because POCs must be discoverable. A location profile must NOT copy this; the select policy here must be `using (id = auth.uid())` so a user can only ever read their own row. Copy-pasting the POC policy verbatim would leak every user's home location to every other user.

## Phase 1: Data model & data-access layer

### Overview

Create the `profiles` table with owner-scoped RLS and an `updated_at` trigger, regenerate `database.types.ts`, add the `UserLocation` DTO, and add a small data-access module mirroring `src/lib/pocs.ts`.

### Changes Required:

#### 1. Profiles table migration

**File**: `supabase/migrations/20260815120000_create_profiles.sql`

**Intent**: Store one location row per user, created only once a location has been set (no row = "not set yet").

**Contract**: `create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, latitude numeric(9,6) not null check (latitude between -90 and 90), longitude numeric(9,6) not null check (longitude between -180 and 180), updated_at timestamptz not null default now())`. Enable RLS. Three policies: `profiles_select_own` (select, `using (id = auth.uid())`), `profiles_insert_own` (insert, `with check (id = auth.uid())`), `profiles_update_own` (update, `using (id = auth.uid())` / `with check (id = auth.uid())`). No delete policy (default-deny, matching the `pocs` precedent).

#### 2. Updated-at trigger

**File**: `supabase/migrations/20260815130000_profiles_updated_at_trigger.sql`

**Intent**: Keep `updated_at` accurate across the upsert's update path, reusing the trigger function already defined for `pocs`.

**Contract**: `create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();` — do not redefine `set_updated_at()`; it already exists from the `pocs` migration.

#### 3. Regenerate Supabase types

**File**: `src/lib/database.types.ts`

**Intent**: Pick up the new `profiles` table in the generated `Database` type so the data-access layer is fully typed.

**Contract**: Run `npx supabase gen types typescript --local > src/lib/database.types.ts` (requires `npx supabase start` and the two new migrations applied locally first, e.g. via `npx supabase db reset`). This file is CLI-generated — do not hand-edit it.

#### 4. `UserLocation` DTO

**File**: `src/types.ts`

**Intent**: Add the camelCase shape the app code works with, mirroring the existing `Poc` DTO convention.

**Contract**: `export interface UserLocation { latitude: number; longitude: number; updatedAt: string }`.

#### 5. Data-access module

**File**: `src/lib/profile.ts`

**Intent**: Encapsulate the two Supabase calls this feature needs, following `src/lib/pocs.ts`'s `mapRow()` + typed-client-argument pattern.

**Contract**: `getUserLocation(supabase: SupabaseClient<Database>, userId: string): Promise<UserLocation | null>` — selects by `id = userId`, returns `null` on a not-found result (not an error) rather than throwing. `upsertUserLocation(supabase: SupabaseClient<Database>, userId: string, latitude: number, longitude: number): Promise<UserLocation>` — `.upsert({ id: userId, latitude, longitude }, { onConflict: "id" }).select().single()`, throws on error (matching `pocs.ts`'s convention of letting the caller/route handle failure translation).

### Success Criteria:

#### Automated Verification:

- [ ] Migrations apply cleanly: `npx supabase db reset`
- [ ] Type regeneration succeeds and includes a `profiles` table: `npx supabase gen types typescript --local > src/lib/database.types.ts`
- [ ] Lint passes (strict type-checked, covers `src/types.ts` and `src/lib/profile.ts`): `npm run lint`
- [ ] Build passes: `npm run build`

#### Manual Verification:

- [ ] Via `npx supabase db` / a SQL client against the local instance: insert a row as one user, confirm a second user's session cannot `select` it (RLS `profiles_select_own` enforced) — this is the one guardrail most likely to be silently wrong if copy-pasted from the `pocs` policy.
- [ ] Confirm `updated_at` changes on a manual `update` against the row (trigger fires).

---

## Phase 2: API endpoint

### Overview

A single authenticated, JSON-in/JSON-out endpoint that upserts the caller's own location.

### Changes Required:

#### 1. Location upsert route

**File**: `src/pages/api/profile/location.ts`

**Intent**: Validate and persist a location update for the currently authenticated user only, following the `toggle.ts` JSON-API convention (not the form-POST-redirect convention) since the client saves via `fetch`.

**Contract**: `export const POST: APIRoute`, `export const prerender = false`. Guard order: 401 if `context.locals.user` is absent; parse JSON body (400 on parse failure); validate with `z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })` (plain `z.number()`, not `z.coerce.number()` — see Critical Implementation Details); 400 with the first zod issue message on validation failure; 500 "Supabase is not configured" if `createClient(...)` returns `null`; call `upsertUserLocation(supabase, context.locals.user.id, latitude, longitude)`; return `Response.json({ location })` on success, `Response.json({ error: "Failed to save location" }, { status: 500 })` on an unexpected Supabase error (mirroring `create.ts`'s pattern of not leaking raw Postgrest error text to the client).

### Success Criteria:

#### Automated Verification:

- [ ] Lint passes: `npm run lint`
- [ ] Build passes: `npm run build`

#### Manual Verification:

- [ ] Authenticated `POST /api/profile/location` with valid coordinates while no row exists yet creates one (verify via Supabase Studio or a direct query).
- [ ] A second `POST` with different valid coordinates for the same user updates the same row (no duplicate row, `updated_at` changes).
- [ ] Unauthenticated request returns 401.
- [ ] Out-of-range coordinates (e.g. `latitude: 999`) return 400 and write no row.
- [ ] A `null` or missing `latitude`/`longitude` in the JSON body returns 400 (confirms `z.number()` rejects it rather than coercing to `0`).

---

## Phase 3: UI — inline location card on the dashboard

### Overview

Add a location form to `/dashboard`, fetching the current value server-side and saving via AJAX.

### Changes Required:

#### 1. Location form component

**File**: `src/components/profile/LocationForm.tsx`

**Intent**: Let the user view and edit their location inline, with client-side validation mirroring the server, optimistic-free (no local state to revert since there's only one field pair, unlike the POC list's per-row toggle) success/error feedback, and no page reload.

**Contract**: `export default function LocationForm({ initialLocation }: { initialLocation: UserLocation | null })`. Two shadcn `Input type="number" step="any"` + `Label` fields (latitude, longitude), pre-filled from `initialLocation` or empty. Client `validate()` duplicates the server's ranges (`-90..90`, `-180..180`), matching `PocForm.tsx`'s existing duplication convention. `onSubmit` prevents default, validates, and on success `fetch("/api/profile/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latitude: Number(lat), longitude: Number(lng) }) })`; shows a transient inline success message on `response.ok`, an inline error message otherwise (mirroring `PocList.tsx`'s error-state pattern). When `initialLocation` is `null` and the fields are still empty, render a "Location not set" hint above the form (not a blocking state — the form is usable immediately).

#### 2. Wire into the dashboard page

**File**: `src/pages/dashboard.astro`

**Intent**: Fetch the user's current location server-side and render the form inline, matching the page's existing plain-div card styling (not a shadcn `Card` wrapper, consistent with the rest of `dashboard.astro`).

**Contract**: Import `createClient` and `getUserLocation`; when Supabase is configured, `const location = await getUserLocation(supabase, user.id)` (guard for `user` possibly absent, mirroring `dashboard/pocs.astro`'s existing `user?.id ?? ""` pattern — though this page is already middleware-protected). Render `<LocationForm initialLocation={location} client:load />` inside a new `rounded-2xl border border-white/10 bg-white/10 p-8 text-white backdrop-blur-xl` div, placed between the welcome message and the "Charging points" link.

### Success Criteria:

#### Automated Verification:

- [ ] Lint passes: `npm run lint`
- [ ] Build passes: `npm run build`

#### Manual Verification:

- [ ] Load `/dashboard` as a user who has never set a location: see "Location not set" and an empty, usable form.
- [ ] Enter valid coordinates, click Save: inline success feedback appears, no page reload.
- [ ] Reload `/dashboard`: the saved coordinates are pre-filled (confirms server-side persistence).
- [ ] Edit to a new valid value, Save again: the update persists (still one row, confirmed via reload).
- [ ] Enter an out-of-range or empty value: inline validation error shown, no network request sent (verify via browser dev tools network tab).
- [ ] Simulate a server error (e.g. temporarily break the endpoint or go offline) while saving: inline error shown, the previously-saved value is not lost from the display.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding further.

---

## Testing Strategy

### Unit Tests:

- No test runner is configured in this repo yet (per `CLAUDE.md`); this plan does not introduce one. Follow the same manual-verification approach already used by the `poc-registration-and-listing` slice.

### Integration Tests:

- None — deferred to the repo-wide e2e harness being built separately in roadmap item F-01 (`e2e-primary-flow-harness`), which targets US-01 (the charge-and-log flow), not this slice.

### Manual Testing Steps:

1. As a fresh user with no location set, load `/dashboard` and confirm the empty-state placeholder.
2. Save a valid location, confirm inline success and persistence across reload.
3. Attempt to save an out-of-range value and confirm client-side rejection with no network call.
4. Update an existing location and confirm the row is updated in place, not duplicated.
5. Confirm a second user's session cannot read the first user's location via a direct Supabase query (RLS check).

## Performance Considerations

None beyond what the existing stack already provides — a single-row upsert keyed by primary key is O(1) and needs no new indexing.

## Migration Notes

Purely additive: a new table and two new migrations. No existing data is touched. Rollback, if ever needed, is `drop table public.profiles` (no other table references it).

## References

- Sibling precedent: `context/changes/poc-registration-and-listing/plan.md`, `context/changes/poc-registration-and-listing/reviews/impl-review.md`
- PRD: `context/foundation/prd.md` (FR-003)
- Roadmap: `context/foundation/roadmap.md` (S-04)
- POC migration: `supabase/migrations/20260815100000_create_pocs.sql`
- POC zod pattern: `src/pages/api/pocs/create.ts:6-10`
- JSON-API convention: `src/pages/api/pocs/[id]/toggle.ts`
- Client AJAX convention: `src/components/pocs/PocList.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data model & data-access layer

#### Automated

- [ ] 1.1 Migrations apply cleanly: `npx supabase db reset`
- [ ] 1.2 Type regeneration succeeds and includes a `profiles` table
- [ ] 1.3 Lint passes
- [ ] 1.4 Build passes

#### Manual

- [ ] 1.5 RLS enforced: a second user's session cannot select the first user's row
- [ ] 1.6 `updated_at` changes on update (trigger fires)

### Phase 2: API endpoint

#### Automated

- [ ] 2.1 Lint passes
- [ ] 2.2 Build passes

#### Manual

- [ ] 2.3 First POST creates a row
- [ ] 2.4 Second POST updates the same row (no duplicate)
- [ ] 2.5 Unauthenticated request returns 401
- [ ] 2.6 Out-of-range coordinates return 400, write no row
- [ ] 2.7 Null/missing latitude or longitude returns 400

### Phase 3: UI — inline location card on the dashboard

#### Automated

- [ ] 3.1 Lint passes
- [ ] 3.2 Build passes

#### Manual

- [ ] 3.3 Empty state shows "Location not set" and a usable empty form
- [ ] 3.4 Valid save shows inline success with no page reload
- [ ] 3.5 Saved coordinates persist across a reload
- [ ] 3.6 Updating an existing value persists as an update, not a duplicate
- [ ] 3.7 Invalid input rejected client-side, no network request sent
- [ ] 3.8 Server-error case shows inline error, previous value not lost
