# Log Session & Balance Ledger Implementation Plan

## Overview

The owner of a POC logs a charging session for another registered user (identified by email) and a fixed kWh amount. The system records a single immutable ledger row that simultaneously debits the seeker and credits the host by the identical amount — balance is *derived* from the ledger, not stored separately, so drift is structurally impossible rather than something to enforce. This is roadmap slice **S-02** — the north-star slice — covering FR-007, FR-008, FR-009, FR-010, and US-01.

## Current State Analysis

- S-01 (`poc-registration-and-listing`) is fully implemented: `pocs` table + RLS (`for select to authenticated`), `src/types.ts` (`Poc`, `CreatePocInput`), `src/lib/pocs.ts` (`listPocs`, `createPoc`, `setPocAvailability`), `src/lib/database.types.ts` (generated), `/dashboard/pocs` page. This plan follows the same layering (migration → types → lib service → API route → UI).
- F-01 (`e2e-primary-flow-harness`) is implemented but narrow: `e2e/global-setup.ts` provisions exactly **one** pre-seeded test user (`E2E_USERNAME`/`E2E_PASSWORD`), and `playwright.config.ts` applies that one `storageState` to every spec by default via a single `setup` project. Its own plan explicitly deferred the real US-01 flow to S-01/S-02/S-03, noting it "isn't buildable until S-02 exists." CLAUDE.md still lists the US-01 e2e test as an outstanding requirement.
- Nothing in the codebase today can resolve an arbitrary user by email — `auth.users` is not exposed through PostgREST/RLS to the `authenticated` or `anon` Postgres roles, and no `profiles`/user-directory table exists. FR-007 requires the host to log a session "for another user," so this plan adds the minimal lookup needed (a `security definer` RPC), not a general-purpose user directory — that avoids creating a `profiles` table that S-04 (`user-location-profile`, roadmap-parallel with this slice) would likely also want to own.
- `src/pages/index.astro` (`/`) is still the starter's placeholder `Welcome` component and is **not** in `src/middleware.ts`'s `PROTECTED_ROUTES` — it's the one genuinely public route in the app today. This plan repurposes it into the real landing page ahead of S-03, rather than waiting: public POC list for every visitor, plus the current user's own balance and transaction history layered in when signed in.
- `src/pages/dashboard.astro` already links to `/dashboard/pocs`; this plan adds a second link to `/dashboard/sessions`.

## Desired End State

A signed-in POC owner visits `/dashboard/sessions`, picks one of their own POCs, types the seeker's registered email, and enters a kWh amount. On submit, a `charging_sessions` row is created; the seeker's balance decreases and the host's balance increases by the identical amount, and both changes are visible immediately on each user's own landing page (`/`). Visiting `/` while signed out shows the public list of all POCs (no login required) with no balance/history section. Visiting `/` while signed in additionally shows the current user's balance and full transaction history (as host and as seeker), each row showing the kWh amount, the counterparty's email, which POC it happened at, and when. A host cannot log a session against a POC they don't own, cannot log a session naming themselves as the seeker, and cannot log zero, negative, or implausibly large (>500) kWh. A Playwright spec drives two real signed-in identities (host + seeker) through the full loop and asserts both balances update by the identical amount.

**Verification**: manually register two test accounts, have account A log a session against its own POC naming account B's email, confirm A's balance goes up and B's balance goes down by the same amount on each account's own landing page, and confirm the automated e2e spec passes the same scenario unattended.

### Key Discoveries:

- `src/lib/supabase.ts:6` — `createClient()` only returns `null` when Supabase env vars are unset; it does not require a signed-in user, so `/` can call it for anonymous visitors exactly as `/dashboard/pocs` does for authenticated ones.
- `supabase/migrations/20260815100000_create_pocs.sql` — `pocs_select_authenticated` grants `select` only `to authenticated`; showing POCs to anonymous visitors on `/` requires a new, additive policy (`to anon`), not editing the existing migration (migrations are append-only per `CLAUDE.md`).
- `src/lib/pocs.ts:21` (`listPocs`) already returns every POC regardless of owner — the sessions form filters this same list client/server-side to the current host's own POCs rather than needing a new query.
- `e2e/auth.setup.ts` and `playwright.config.ts`'s default `dependencies: ["setup"]` project apply one shared `storageState` to all specs — the new two-actor spec needs a second `setup` project and a second saved `storageState` file, opted into per-spec via `test.use({ storageState: ... })`, exactly like the existing round-trip spec opts *out* of the default state.
- `eslint.config.js:73` already ignores `src/lib/database.types.ts` — regenerating it after this phase's migration (`npx supabase gen types typescript --local`) needs no further eslint change.

## What We're NOT Doing

- No general-purpose user directory or `profiles` table — email-based lookup via a single-purpose RPC is enough for FR-007, and avoids pre-empting S-04's own data model.
- No seeker confirmation or dispute flow for a logged session — the host's entry is final for MVP, per the PRD's explicit Non-Goal. `charging_sessions` has no update or delete RLS policy: once logged, a session is immutable.
- No editing or backdating a session's timestamp — `created_at` is always "now" at insert time.
- No pagination or filtering of transaction history — an accepted PRD limitation at this MVP's scale.
- No distance-sorting or power-level filtering on the public POC list (FR-012/FR-013) — both nice-to-have and parked in the roadmap; this plan only extends *who* can see the existing list, not its features.
- No changes to `pocs`' `insert`/`update` policies or to `src/lib/pocs.ts`'s existing functions — only a new additive `select`-for-`anon` policy.
- CI wiring for the new e2e spec — it runs locally via the same `npm run test:e2e` F-01 already wired up; no `.github/workflows/ci.yml` change is needed since that job doesn't yet run the e2e suite at all (a gap that predates this change and isn't this slice's to close).

## Implementation Approach

Bottom-up, matching S-01: schema + RLS first, then the one API route, then UI, then e2e coverage. The ledger's "no drift" guardrail is satisfied by construction: `charging_sessions` has exactly one row per session (`host_id`, `seeker_id`, `kwh`), and balance is always *derived* — `SUM(kwh) as host − SUM(kwh) as seeker` — so there is no second write path that could ever fall out of sync with the first. Per the priority decision, the data layer, API route, and UI are all must-ship (the guardrail isn't meaningfully "done" until it's visible on the landing page); the e2e phase is the one explicitly droppable fast-follow if time runs short, mirroring F-01's own CI-wiring phase.

## Critical Implementation Details

- **Email resolution happens once, at insert time, and is denormalized**: the form already collects the seeker's typed email, and the host's email is already on `context.locals.user.email` — both are stored directly on the `charging_sessions` row (`host_email`, `seeker_email`) alongside the resolved `host_id`/`seeker_id`. This means history display never needs a second "resolve id back to email" lookup, only the one email→id RPC used to validate the seeker exists and to populate `seeker_id` for the balance aggregate.
- **Self-charge and ownership checks happen before insert, not just via constraint**: `logSession` must reject a resolved `seekerId === hostId` and a `pocId` not owned by `hostId` with a clear message *before* attempting the insert, so the API route's `?error=` redirect carries a specific reason. The DB-level `host_id <> seeker_id` check constraint and the insert RLS policy's ownership `exists (...)` clause are defense-in-depth behind that, not a substitute for it (same belt-and-suspenders pattern as S-01's `setPocAvailability`).
- **`index.astro` branches on `Astro.locals.user` rather than being gated by middleware**: `/` stays off `PROTECTED_ROUTES`; the page itself decides whether to render the balance/history section, following the "not every route protection has to be middleware-level" allowance already implicit in how `/dashboard/pocs` vs `/dashboard` differ only by prefix match, not by branching — this is the one place in the codebase that *does* need in-page branching, since it's intentionally the only route with two different authenticated/anonymous views.

## Phase 1: Data Layer

### Overview

Creates the `charging_sessions` table with RLS, the email→user-id lookup RPC, a new anon-read policy on `pocs`, the shared domain types, and the session data-access service.

### Changes Required:

#### 1. Charging-sessions migration

**File**: `supabase/migrations/20260815120000_create_charging_sessions.sql`

**Intent**: One immutable row per logged session; balance for any user is always derived from this table, never stored.

**Contract**:
- Columns: `id uuid primary key default gen_random_uuid()`, `poc_id uuid not null references pocs(id)`, `host_id uuid not null references auth.users(id) on delete cascade`, `host_email text not null`, `seeker_id uuid not null references auth.users(id) on delete cascade`, `seeker_email text not null`, `kwh numeric(6,2) not null`, `created_at timestamptz not null default now()`.
- Check constraints: `kwh > 0 and kwh <= 500`; `host_id <> seeker_id`.
- `alter table charging_sessions enable row level security;`
- Policy `sessions_select_participant`: `for select to authenticated using (host_id = auth.uid() or seeker_id = auth.uid())` — private to the two participants, unlike `pocs`' public read.
- Policy `sessions_insert_own`: `for insert to authenticated with check (host_id = auth.uid() and exists (select 1 from pocs where pocs.id = poc_id and pocs.owner_id = auth.uid()))`.
- No update or delete policy — immutable ledger, matching "What We're NOT Doing."

#### 2. Email lookup RPC

**File**: `supabase/migrations/20260815121000_user_id_by_email_rpc.sql`

**Intent**: The minimal, single-purpose lookup FR-007's "for another user" needs — resolves a typed email to a user id without exposing any other `auth.users` data or standing up a general directory.

**Contract**: `create function get_user_id_by_email(p_email text) returns uuid language sql security definer set search_path = public, auth as $$ select id from auth.users where lower(email) = lower(p_email) limit 1 $$;` then `grant execute on function get_user_id_by_email(text) to authenticated;`. Returns `null` (not an error) when no match — callers treat `null` as "no such user."

#### 3. Public POC read policy

**File**: `supabase/migrations/20260815122000_pocs_select_anon.sql`

**Intent**: Lets anonymous visitors to `/` see the POC list, per the product decision that POC visibility (unlike balance/POC-management/session-logging) isn't a gated action.

**Contract**: `create policy pocs_select_anon on pocs for select to anon using (true);` — additive only; does not touch `pocs_select_authenticated` or any insert/update policy from the original migration.

#### 4. Shared domain types

**File**: `src/types.ts` (modified)

**Intent**: Types the API route, session service, and UI share.

**Contract**: Export `ChargingSession` (`id`, `pocId`, `hostId`, `hostEmail`, `seekerId`, `seekerEmail`, `kwh`, `createdAt`, plus an embedded `poc: Pick<Poc, "id" | "latitude" | "longitude" | "powerRatingKw">` for the history view's POC context) and `LogSessionInput` (`pocId`, `seekerEmail`, `kwh`).

#### 5. Session data-access service

**File**: `src/lib/sessions.ts` (new)

**Intent**: Wraps the RPC lookup, the insert (with pre-insert self-charge/ownership validation), and the per-user session query behind typed functions, mirroring `src/lib/pocs.ts`'s shape.

**Contract**: Export `resolveUserIdByEmail(supabase, email): Promise<string | null>` (calls the RPC from #2); `logSession(supabase, hostId, hostEmail, input: LogSessionInput): Promise<ChargingSession>` (resolves `seekerId`, throws a descriptive `Error` if not found or if `seekerId === hostId`, then inserts with the embedded POC select); `listSessionsForUser(supabase, userId): Promise<ChargingSession[]>` (rows where `host_id = userId or seeker_id = userId`, ordered `created_at desc`, embedding `poc:pocs(id, latitude, longitude, power_rating_kw)`); `computeBalance(sessions: ChargingSession[], userId: string): number` (pure function: sum of `kwh` where `hostId === userId`, minus sum where `seekerId === userId` — no DB round-trip, reuses whatever list was already fetched for history).

#### Addendum (expected, mirrors S-01)

**File**: `src/lib/database.types.ts` (regenerated)

**Why**: New table + new RPC require `npx supabase gen types typescript --local` to keep strict-typed ESLint passing on `.from("charging_sessions")` / `.rpc("get_user_id_by_email")` calls, exactly as S-01's addendum did for `pocs`.

### Success Criteria:

#### Automated Verification:

- Migrations apply cleanly against local Supabase: `npx supabase migration up`
- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Type-check passes: `npx astro check`

#### Manual Verification:

- Local Supabase Studio shows `charging_sessions` with RLS enabled and the two policies listed above, and `pocs` now also has the `pocs_select_anon` policy.
- Calling `select get_user_id_by_email('e2e-test@example.com')` in the SQL editor returns that user's `auth.users.id`; calling it with a nonexistent email returns `null`, not an error.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: API Routes

### Overview

Exposes the one server endpoint the UI needs: logging a new charging session.

### Changes Required:

#### 1. Log-session route

**File**: `src/pages/api/sessions/create.ts` (new)

**Intent**: Accept a form-POST logging a new session, following the same convention as `src/pages/api/pocs/create.ts` (an infrequent action, not a rapid-fire toggle, so full-page redirect is appropriate).

**Contract**: `export const POST: APIRoute`. First statement: `if (!context.locals.user) return context.redirect('/auth/signin')` — `/api/sessions/*` isn't covered by `PROTECTED_ROUTES`'s `/dashboard` prefix match, same reasoning as the existing POC routes. Reads `pocId`, `seekerEmail`, `kwh` from `context.request.formData()`; validates with a zod schema (`pocId` as UUID string, `seekerEmail` as email string, `kwh` via `z.coerce.number()` bounded `0 < kwh <= 500`, matching Phase 1's check constraint). Calls `logSession(supabase, context.locals.user.id, context.locals.user.email, input)`. On zod validation failure or any thrown error from `logSession` (seeker not found, self-charge, not the POC's owner, Supabase insert error), `context.redirect('/dashboard/sessions?error=' + encodeURIComponent(message))`. On success, `context.redirect('/dashboard/sessions?success=1')`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Type-check passes: `npx astro check`

#### Manual Verification:

- As user A (owns a POC), POST to `/api/sessions/create` with user B's email and a valid kWh creates a row visible in Supabase Studio, with `host_id`/`host_email` matching A and `seeker_id`/`seeker_email` matching B.
- The same POST naming a `pocId` A doesn't own redirects with an `?error=` message and creates no row.
- The same POST naming A's own email as the seeker redirects with an `?error=` message and creates no row.
- The same POST with a nonexistent seeker email, or with `kwh` of 0, negative, or over 500, redirects with an `?error=` message and creates no row.
- Unauthenticated POST to `/api/sessions/create` redirects cleanly to `/auth/signin` (no 500).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: UI

### Overview

Adds the log-session form page and rewrites `index.astro` into the real (public + conditional-authenticated) landing page.

### Changes Required:

#### 1. Add missing shadcn primitive

**File**: `src/components/ui/select.tsx` (new, generated)

**Intent**: Needed for the "which of your own POCs" picker in the log-session form.

**Contract**: `npx shadcn@latest add select`.

#### 2. Log-session form

**File**: `src/components/sessions/LogSessionForm.tsx` (new)

**Intent**: A React island mirroring `PocForm.tsx`'s structural pattern (controlled inputs, `serverError` prop via `ServerError.tsx`, native form POST, `useFormStatus()` pending state).

**Contract**: `export default function LogSessionForm({ ownPocs, serverError }: { ownPocs: Poc[]; serverError?: string | null })`. `<form method="POST" action="/api/sessions/create">` with a `Select` bound to `name="pocId"` listing `ownPocs` (label each option by coordinates + power rating, since POCs have no separate display name), a labeled email input (`name="seekerEmail"`), a labeled numeric input (`name="kwh"`), and a submit button. If `ownPocs` is empty, render a message directing the user to `/dashboard/pocs` to register a POC first, instead of the form.

#### 3. Sessions page

**File**: `src/pages/dashboard/sessions.astro` (new)

**Intent**: Server-renders the current user's own POCs (filtered from `listPocs`) and hosts the form.

**Contract**: Reads `Astro.locals.user`, calls `createClient(...)` then `listPocs(supabase)`, filters to `pocs.filter(p => p.ownerId === user.id)`, passes the filtered list and `Astro.url.searchParams.get("error")` into `<LogSessionForm client:load>`. Wrapped in `Layout`, matching `dashboard/pocs.astro`'s structure.

#### 4. Landing page rewrite

**File**: `src/pages/index.astro` (modified — replaces the starter `Welcome` component)

**Intent**: The real public + conditional-authenticated landing page: FR-006 (POC list, now public), FR-009 (own balance), FR-010 (own history), fronting most of FR-011 ahead of S-03.

**Contract**: Reads `Astro.locals.user` (may be `null` — `/` is not in `PROTECTED_ROUTES`). Calls `createClient(...)` then `listPocs(supabase)` unconditionally (works for anonymous visitors via the new `pocs_select_anon` policy). If `user` is present, also calls `listSessionsForUser(supabase, user.id)` and `computeBalance(sessions, user.id)`, and renders a balance summary plus a history list (each row: kWh, counterparty email, POC coordinates/power, timestamp) above the POC list. If `user` is absent, renders only the POC list plus a sign-in/sign-up prompt in place of the balance/history section.

#### 5. Dashboard nav link

**File**: `src/pages/dashboard.astro` (modified)

**Intent**: Reachability from the existing dashboard, alongside the existing `/dashboard/pocs` link.

**Contract**: Add a second `<a href="/dashboard/sessions">` link near the existing "Charging points" link.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Type-check passes: `npx astro check`

#### Manual Verification:

- Signed out, visiting `/`: the public POC list renders (including POCs owned by other users), no balance/history section, a sign-in/sign-up prompt is visible.
- Signed in as user A with at least one POC: `/` shows A's balance and full history (as host and as seeker) alongside the POC list.
- User A visits `/dashboard/sessions`, selects one of their own POCs, enters user B's email and a valid kWh, submits: redirected back with no error, and `/` now shows the updated balance and a new history row.
- User B (the seeker in that session) visits `/`: sees their own balance decreased by the identical amount and the same session in their own history.
- A's `/dashboard/sessions` form, if A owns zero POCs, shows the "register a POC first" message instead of the form.
- Submitting invalid input (nonexistent email, A's own email, zero/negative/over-500 kWh, or a `pocId` A doesn't own) shows an inline `?error=` message and creates no row.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: E2E — full US-01 flow (fast-follow if time is short)

### Overview

Extends the e2e harness with a second authenticated identity and adds the Playwright spec CLAUDE.md has flagged as outstanding since before F-01 existed: the full register→charge→log→balance loop, driven through the real UI. Per the priority decision, this phase is the one that can be dropped/deferred if the 3-week budget runs out — the other three phases are must-ship regardless.

### Changes Required:

#### 1. Second pre-seeded test identity

**File**: `e2e/global-setup.ts` (modified), `.env.test.example` (modified)

**Intent**: The current global setup provisions one user (`E2E_USERNAME`/`E2E_PASSWORD`, the "host" going forward); a second is needed for the "seeker" role.

**Contract**: Add `E2E_SEEKER_USERNAME`/`E2E_SEEKER_PASSWORD` env vars and a second idempotent `adminClient.auth.admin.createUser(...)` call in `global-setup.ts`, reusing the existing `alreadyExists` handling.

#### 2. Second setup project and storageState

**File**: `e2e/auth.setup.ts` (modified or split), `playwright.config.ts` (modified)

**Intent**: Produce a second saved session so a single spec can drive two real signed-in browser contexts at once, without changing the default `storageState` every other existing spec relies on.

**Contract**: A second Playwright `setup` project (e.g. `"authenticate-seeker"`) logging in as `E2E_SEEKER_USERNAME`/`E2E_SEEKER_PASSWORD` and saving to `playwright/.auth/seeker.json`. The default project's `storageState` (host identity) and its `dependencies: ["setup"]` are unchanged; only the new spec below opts into the second file.

#### 3. Primary-flow spec

**File**: `e2e/specs/log-session-flow.spec.ts` (new)

**Intent**: The US-01 acceptance criteria as an automated check: host logs a session for seeker; both balances/history update by the identical amount.

**Contract**: A `test` using two `browser.newContext({ storageState: ... })` calls (one per saved file) to get a host `page` and a seeker `page` in the same test. The host `page` needs at least one POC to log against — the test creates one via the existing `/dashboard/pocs` form (or an equivalent direct insert, whichever keeps the spec fast) before logging the session. The host `page` navigates to `/dashboard/sessions`, fills the form (own POC, seeker's email, a fixed kWh), submits; asserts redirect with no `error` param. Both `page`s then navigate to `/` and assert (via `data-testid` attributes added to the balance/history elements in Phase 3) that the host's balance increased and the seeker's balance decreased by the identical kWh amount, and that both `data-testid="history-list"` sections show the new session.

### Success Criteria:

#### Automated Verification:

- `npm run test:e2e` passes locally (with `npx supabase start` running), including the new spec.
- Lint passes: `npm run lint`

#### Manual Verification:

- Deleting `playwright/.auth/*.json` and re-running `npm run test:e2e` re-provisions both identities from scratch without manual intervention.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful. This phase may be explicitly deferred as a fast-follow per the priority decision — if deferred, mark it as such in `## Progress` rather than checking it off.

---

## Testing Strategy

No unit test runner is configured in this repo (`CLAUDE.md`); this slice's only automated coverage beyond lint/build/type-check is the Phase 4 Playwright spec. Phases 1–3 are verified manually per their own Manual Verification sections; Phase 4 automates the same scenario end-to-end.

### Manual Testing Steps:

1. Register two accounts (A and B) if not already present; A registers a POC via `/dashboard/pocs`.
2. As A, visit `/dashboard/sessions`, select the POC, enter B's email and a valid kWh, submit.
3. As A, visit `/`: confirm balance increased by that kWh and the new session appears in history with B's email, the POC, and a timestamp.
4. As B, visit `/`: confirm balance decreased by the identical kWh and the same session appears in B's history.
5. Attempt to log a session naming A's own email as the seeker: confirm rejection with a clear error.
6. Attempt to log a session with an email that isn't a registered user: confirm rejection.
7. Attempt to log a session with 0, negative, or 600 kWh: confirm rejection.
8. Sign out and visit `/`: confirm the public POC list still renders, with no balance/history section.

## Performance Considerations

`computeBalance` and history rendering operate on a single user's own sessions, fetched once per page load — no aggregation query beyond a normal indexed `select ... where host_id = ? or seeker_id = ?`, well within the PRD's "small" target scale and ~1-second NFR.

## Migration Notes

Three net-new, additive migrations (new table, new RPC, new policy on an existing table) — no existing data to migrate, no edits to S-01's original migration. Per `context/foundation/infrastructure.md`'s risk register, rolling any of these back after deploy requires an explicit new Supabase migration (e.g. `drop table charging_sessions`), not `wrangler rollback`.

## References

- Roadmap slice: `context/foundation/roadmap.md` § S-02
- PRD requirements: `context/foundation/prd.md` § Functional Requirements (FR-007–FR-010), § US-01, § Business Logic
- Prior art for data layer / RLS pattern: `supabase/migrations/20260815100000_create_pocs.sql`, `src/lib/pocs.ts`
- Prior art for form-POST API route: `src/pages/api/pocs/create.ts`
- Prior art for e2e session-reuse convention: `context/changes/e2e-primary-flow-harness/plan.md`, `e2e/auth.setup.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data Layer

#### Automated

- [x] 1.1 Migrations apply cleanly against local Supabase: `npx supabase migration up` — 14fbead
- [x] 1.2 Lint passes: `npm run lint` — 14fbead
- [x] 1.3 Build passes: `npm run build` — 14fbead
- [x] 1.4 Type-check passes: `npx astro check` — 14fbead

#### Manual

- [x] 1.5 Local Supabase Studio shows `charging_sessions` with RLS + the two policies, and `pocs` now also has `pocs_select_anon` — 14fbead
- [x] 1.6 `get_user_id_by_email` returns the right id for a known email and `null` for an unknown one — 14fbead

### Phase 2: API Routes

#### Automated

- [ ] 2.1 Lint passes: `npm run lint`
- [ ] 2.2 Build passes: `npm run build`
- [ ] 2.3 Type-check passes: `npx astro check`

#### Manual

- [ ] 2.4 Valid POST creates a row with correct host/seeker ids and emails
- [ ] 2.5 Not-owned pocId, self-charge, unknown seeker email, and out-of-range kWh all redirect with `?error=` and create no row
- [ ] 2.6 Unauthenticated POST redirects to `/auth/signin` (no 500)

### Phase 3: UI

#### Automated

- [ ] 3.1 Lint passes: `npm run lint`
- [ ] 3.2 Build passes: `npm run build`
- [ ] 3.3 Type-check passes: `npx astro check`

#### Manual

- [ ] 3.4 Signed-out `/` shows the public POC list, no balance/history, sign-in/sign-up prompt
- [ ] 3.5 Signed-in `/` shows the user's own balance and history alongside the POC list
- [ ] 3.6 Logging a session as A for B updates both A's and B's `/` view by the identical amount
- [ ] 3.7 Zero-POC host sees the "register a POC first" message instead of the form
- [ ] 3.8 All invalid-input cases show an inline error and create no row

### Phase 4: E2E — full US-01 flow

#### Automated

- [ ] 4.1 `npm run test:e2e` passes locally, including the new spec
- [ ] 4.2 Lint passes: `npm run lint`

#### Manual

- [ ] 4.3 Deleting saved auth state and re-running the suite re-provisions both identities automatically
