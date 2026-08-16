# POC Contact & Management Implementation Plan

## Overview

Closes the roadmap's parked "POC lifecycle + session/discovery UX polish" item, surfaced during `unified-landing-page` manual QA. Adds four related pieces on top of the shipped S-01/S-02/S-03 slices: the POC owner's email visible to signed-in viewers (with a read-only, no-checkbox availability treatment for non-owners), a dedicated "My POCs" view with update-power and remove actions, a session-logged confirmation banner, and a bounded seeker-email search combobox on the session form.

## Current State Analysis

- **RLS is disabled** on `pocs` and `profiles` (`supabase/migrations/20260815140000_disable_rls.sql`) — a project-wide POC-stage decision. Table grants are the only access gate now; ownership is enforced in application code (`src/lib/pocs.ts`'s `setPocAvailability` filters `.eq("owner_id", ownerId)`). `charging_sessions` still has RLS enabled and is untouched by this plan.
- **No owner-email path exists.** `Poc.ownerId` (`src/types.ts:2`) is a bare UUID; there's no directory table joining it to an email. `charging_sessions` already solves an equivalent problem by denormalizing `host_email`/`seeker_email` onto the row at insert time (`src/lib/sessions.ts:73-79`) — this plan follows that precedent for `pocs.owner_email` rather than adding a privileged join.
- **`?success=1` is already produced but never consumed.** `src/pages/api/sessions/create.ts:47` redirects to `/dashboard/sessions?success=1` on success, but `src/pages/dashboard/sessions.astro` only reads `?error=` (line 13) and `LogSessionForm.tsx` has no success-rendering path at all.
- **No combobox/autocomplete exists anywhere in the repo.** `src/components/ui/` has only `button`, `input`, `label`, `card`, `switch`, `select`. Seeker lookup today is `get_user_id_by_email` (`supabase/migrations/20260815121000_user_id_by_email_rpc.sql`), an exact-match RPC returning one id or `null` — there's no "search by prefix" capability.
- **`charging_sessions.poc_id references public.pocs(id)`** with no `on delete` clause (`supabase/migrations/20260815120000_create_charging_sessions.sql`) — Postgres's default `no action` already rejects deleting a POC with session history with a `23503` foreign-key-violation error. No new constraint is needed to get "block deletion when history exists" — the existing schema already does this; it only needs to be caught and mapped to a clear response.
- **`pocs` has no `delete` grant** (`supabase/migrations/20260815123000_grant_table_privileges.sql` only grants `select, insert, update`) — since RLS is off, this is the only thing currently stopping any delete at all; a new grant is required before `removePoc` can work.
- **Two established API conventions coexist**: form-POST + redirect for infrequent actions (`api/pocs/create.ts`, `api/sessions/create.ts`) vs. JSON fetch + optimistic update for rapid single-field actions (`api/pocs/[id]/toggle.ts`, called from `PocList.tsx:24-32`). New POC-management endpoints follow the same split by action frequency.
- **`src/pages/dashboard/pocs.astro`** currently renders the registration form plus `PocList` fed by `listPocs(supabase)` — every POC in the system, not just the signed-in user's own. **`src/pages/index.astro`** renders the same unfiltered `listPocs(supabase)` result via the same `PocList` component for both anonymous and signed-in visitors (`index.astro:13,57`).
- **`PocList.tsx`** computes `isOwner = poc.ownerId === currentUserId` (line 56) purely client-side and renders a `Switch` for every card regardless of ownership, just `disabled={!isOwner || pending}` (line 71) — a non-owner sees an inert, unlabeled switch with no owner identity shown at all.

### Key Discoveries:

- `src/pages/index.astro:57` passes the full `pocs` array (including whatever new `ownerEmail` field this plan adds) as a prop into a `client:load` React island — Astro serializes island props into the page's hydration payload, so **omitting `ownerEmail` from the UI render is not enough to keep it from anonymous visitors**; it must be stripped from the array server-side before it reaches the `PocList` prop when `!user`.
- `src/lib/sessions.ts:41-89` (`logSession`) currently resolves the seeker by calling `resolveUserIdByEmail` (the `get_user_id_by_email` RPC) inside the function itself. If the combobox (Phase 5) is dropped for time, nothing else in this plan touches this resolution path — so Phases 1-4 leave `logSession`, `LogSessionInput`, and `POST /api/sessions/create` completely untouched, and only Phase 5 changes their contract (to accept a pre-resolved `seekerId`) together with the UI that produces it. This keeps every phase independently shippable and makes the droppable phase truly droppable without leaving the app in a broken intermediate state.
- `src/components/profile/LocationForm.tsx` already has an inline `status: "idle"|"pending"|"success"|"error"` pattern with a `data-testid="location-success"` message — the closest existing precedent for a success banner, though this plan's Phase 4 reuses the simpler `ServerError`-sibling pattern (query-param-driven, not fetch-driven) since session creation stays a form-POST, not a fetch call.
- `package.json` has no `cmdk` dependency and `radix-ui` (the umbrella package, `^1.6.7`) is already installed — `npx shadcn@latest add command popover` in Phase 5 adds the missing wrapper components and pulls in `cmdk` as a transitive dependency.

## Desired End State

A signed-in user browsing the public POC list on `/` sees, for every POC they don't own, the owner's email and a plain "Available"/"Busy" badge with no switch element at all; for POCs they do own, the existing interactive switch. Anonymous visitors see the same list with no owner email present anywhere in the page, including view-source. In `/dashboard/pocs`, the registration form is followed by a "My charging points" list scoped to just the signed-in user's own POCs, each with its existing availability switch plus an editable power-rating field and a remove action; removing a POC with no logged sessions succeeds immediately, removing one with session history is rejected with a clear message. After logging a session on `/dashboard/sessions`, the host sees an inline "Session logged" confirmation. The seeker-email field on that same form is a real search-as-you-type combobox: typing 3+ characters shows up to 5 matching registered emails (excluding the host's own), selecting one locks in that user's id, and submit stays disabled until a suggestion is actually picked.

**Verification**: manually register two accounts (A, B), have A register two POCs, confirm B sees A's email + a read-only badge (no switch) for both on `/` while A sees interactive switches for both on `/dashboard/pocs`; have A edit one POC's power rating and remove the other (no sessions logged against it yet); have A log a session against the remaining POC using the combobox to find B, confirm the success banner appears; confirm A can no longer remove that POC now that it has session history.

## What We're NOT Doing

- No soft-delete or archive flag on `pocs` — removal is either a real `DELETE` (no session history) or a rejected request with a clear error (history exists); there is no third "archived but visible" state.
- No editing of a POC's location — "update power" is the power rating only, per the parked note's literal wording.
- No general user-directory page or endpoint beyond the bounded, combobox-only search (min 3 characters, capped at 5 results).
- No seeker confirmation/dispute flow for a session's kWh amount — that remains the PRD's own tracked Non-Goal/Open Question, unrelated to this plan's host-side "session logged" acknowledgement.
- No new toast/dialog library — the remove action's confirmation uses the browser's native `window.confirm()`, and the session-logged confirmation reuses the existing query-param + inline-banner convention (`ServerError`'s sibling), not a new notification system.
- No changes to `charging_sessions`' schema, RLS, or the `sessions_select_participant`/`sessions_insert_own` policies.
- No CI/e2e wiring for this slice — manual verification only, matching S-01/S-03's precedent; the one required primary-flow e2e test already lives in `log-session-and-balance-ledger`/`e2e-primary-flow-harness`.
- No rate-limiting middleware or CAPTCHA on the new search endpoint beyond its own character-minimum and result-cap — accepted per the PRD's existing trust-over-fraud-proofing stance for this small-scale network.

## Implementation Approach

Bottom-up within each self-contained feature group, matching the established S-01/S-02 layering (schema → lib → API → UI). Phases 1-2 cover owner-email visibility and My-POCs management together since they share the same `pocs` table and grant changes; Phase 3 is their UI. Phase 4 (confirmation banner) is a small, independent fix to an existing gap. Phase 5 (combobox) is deliberately isolated end-to-end — schema, lib, API, and UI all in one phase — specifically so it can be dropped as a whole without leaving Phases 1-4 in a broken state, per the priority decision that the combobox is the first thing to cut if time is short.

## Critical Implementation Details

- **Anonymous email leakage via hydration payload**: as noted above, `index.astro` must map the `pocs` array to blank out `ownerEmail` (e.g. `pocs.map(p => ({ ...p, ownerEmail: "" }))`) before passing it to `<PocList client:load>` when `!user` — conditionally *rendering* the field is not sufficient, since Astro serializes island props into the page regardless of what the component chooses to display.
- **Phase 5 is the only phase that touches `logSession`, `LogSessionInput`, or `POST /api/sessions/create`'s contract.** Phases 1-4 must not reference `seekerId` anywhere — the existing `seekerEmail`-based flow stays byte-for-byte as it is today until Phase 5 lands.
- **The existing `charging_sessions.poc_id` foreign key already blocks deleting a POC with history** (`on delete` was never specified, so Postgres defaults to `no action`) — `removePoc` doesn't need a pre-check query counting sessions; it can attempt the delete directly and catch Postgres error code `23503`, mirroring `setPocAvailability`'s existing `PGRST116`-catching pattern for "not the owner."
- **The search endpoint excludes the caller's own id in application code, not SQL** — `search_users_by_email_prefix` stays a generic prefix search (mirroring `get_user_id_by_email`'s single-purpose minimalism); the API route filters `context.locals.user.id` out of the RPC's result before capping to 5, and over-fetches (limit 6) so a self-match doesn't shrink the visible result count below what a real search would show.
- **The combobox debounces its search call** (~300ms after the last keystroke) before hitting `/api/users/search` — without this, every keystroke would fire a request against a `security definer` RPC.

## Phase 1: Data & Access Layer — Owner Email and POC Management

### Overview

Adds the schema and data-access functions for owner-email denormalization, power updates, and POC removal. No API or UI changes yet.

### Changes Required:

#### 1. Owner-email column + backfill

**File**: `supabase/migrations/20260815150000_add_poc_owner_email.sql` (new)

**Intent**: Denormalize the owner's email onto `pocs` at write time, mirroring `charging_sessions.host_email`/`seeker_email`, so listing POCs never needs a privileged join against `auth.users`.

**Contract**: Add `owner_email text` (nullable), backfill every existing row from `auth.users` by `owner_id`, then set the column `not null`:

```sql
alter table public.pocs add column owner_email text;

update public.pocs p
set owner_email = u.email
from auth.users u
where u.id = p.owner_id;

alter table public.pocs alter column owner_email set not null;
```

#### 2. Delete grant

**File**: `supabase/migrations/20260815151000_pocs_delete_grant.sql` (new)

**Intent**: RLS is disabled on `pocs`, so the plain table grant is the only remaining gate on delete — without this, every `DELETE` attempt fails before `removePoc`'s own owner/FK logic is even reached.

**Contract**: `grant delete on public.pocs to authenticated;`

#### 3. Shared types

**File**: `src/types.ts` (modified)

**Intent**: Expose the new column to the app.

**Contract**: Add `ownerEmail: string` to `Poc`.

#### 4. POC data-access functions

**File**: `src/lib/pocs.ts` (modified)

**Intent**: Extend `mapRow`/`createPoc` for the new column, and add the three functions the "My POCs" view needs.

**Contract**:
- `mapRow` includes `ownerEmail: row.owner_email`.
- `createPoc(supabase, ownerId, ownerEmail, input)` — signature gains an `ownerEmail: string` parameter, inserted as `owner_email: ownerEmail` alongside the existing columns.
- `listPocsForOwner(supabase, ownerId): Promise<Poc[]>` — same as `listPocs` but `.eq("owner_id", ownerId)`, used by the My-POCs view instead of the full unfiltered list.
- `setPocPower(supabase, pocId, ownerId, powerRatingKw): Promise<Poc>` — same shape as `setPocAvailability`, updating `power_rating_kw` instead of `is_available`, same `.eq("id", pocId).eq("owner_id", ownerId).select().single()` owner-scoping and `PGRST116`-as-403 convention.
- `removePoc(supabase, pocId, ownerId): Promise<void>` — `delete().eq("id", pocId).eq("owner_id", ownerId).select()`. Three outcomes: Postgres error with `code === "23503"` (foreign-key violation — session history exists) is re-thrown as-is so the API route can distinguish it; any other error is re-thrown; an empty returned row array (not the owner, or doesn't exist) is signaled by returning normally with zero rows, which the caller treats as "not found" (mirroring `isNoRowsError`'s zero-rows convention, but via an empty array rather than a `.single()` `PGRST116` error since `.delete()` doesn't error on zero matched rows the way `.update().single()` does).

### Success Criteria:

#### Automated Verification:

- Migrations apply cleanly against local Supabase: `npx supabase migration up`
- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Type-check passes: `npx astro check`

#### Manual Verification:

- Local Supabase Studio shows every existing `pocs` row with a non-null `owner_email` matching its `owner_id`'s `auth.users.email`.
- `authenticated` role can now issue a `delete` against `pocs` (confirmed via SQL editor or the Phase 2 route once built).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: API Routes — POC Management

### Overview

Exposes update-power and remove as HTTP endpoints, and updates POC creation to populate the new column.

### Changes Required:

#### 1. Create route

**File**: `src/pages/api/pocs/create.ts` (modified)

**Intent**: Pass the host's email into `createPoc` so new POCs get `owner_email` populated at insert time (existing rows were backfilled in Phase 1).

**Contract**: Read `context.locals.user.email`; if missing, redirect with `?error=` (mirroring `api/sessions/create.ts:17-20`'s existing `hostEmail` guard). Pass it as `createPoc`'s new `ownerEmail` argument.

#### 2. Update-power route

**File**: `src/pages/api/pocs/[id]/power.ts` (new)

**Intent**: A rapid, single-field update — same JSON-fetch convention as the existing toggle route, for the same NFR reason (instant feedback in a list).

**Contract**: `PATCH`, mirrors `toggle.ts` exactly except the zod schema is `{ powerRatingKw: z.coerce.number().positive().max(350) }` (matching `pocs`' existing check constraint and `createPocSchema`'s bound) and it calls `setPocPower`. Same status codes: 401 unauthenticated, 400 invalid id/body, 403 on `PGRST116`, 200 with `{ poc }` on success.

#### 3. Remove route

**File**: `src/pages/api/pocs/[id].ts` (new)

**Intent**: A one-shot, infrequent action — JSON response (not a redirect, since it's called from a fetch-based confirm-and-delete UI, not a full-page form).

**Contract**: `DELETE`. Same auth guard (401) and `z.uuid()` validation of `context.params.id` (400) as the other `pocs/[id]/*` routes. Calls `removePoc(supabase, id, context.locals.user.id)`. Maps outcomes: FK-violation error (`code === "23503"`) → `Response.json({ error: "This charging point has logged sessions and can't be removed" }, { status: 409 })`; zero rows returned (not owner / not found) → `Response.json({ error: "Not found" }, { status: 403 })`; any other error → 500; success → `Response.json({ success: true })` (200).

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Type-check passes: `npx astro check`

#### Manual Verification:

- Registering a new POC as user A produces a row with `owner_email` already set to A's email (no backfill needed for new rows).
- `PATCH /api/pocs/:id/power` as the owner updates the power rating and returns it; as a non-owner, returns 403 and leaves the row unchanged.
- `DELETE /api/pocs/:id` as the owner on a POC with zero sessions removes it (confirmed gone from Supabase Studio); the same call on a POC with at least one logged session returns 409 and the row still exists; as a non-owner, returns 403.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: My-POCs Management UI + Public List Read-Only Treatment

### Overview

Splits "browse everyone's POCs" (now read-only for non-owned entries, owner email shown to signed-in viewers) from "manage my own POCs" (update power, remove) into two separate surfaces: `/` keeps the former, `/dashboard/pocs` becomes the latter.

### Changes Required:

#### 1. Public/shared POC list — owner email + read-only treatment

**File**: `src/components/pocs/PocList.tsx` (modified)

**Intent**: Show the owner's email to signed-in viewers only, and replace the interactive-but-disabled switch on non-owned cards with a plain, non-interactive badge.

**Contract**: For each card, when `isOwner` is `false`: render `poc.ownerEmail` (only when it's non-empty — see Phase 3's `index.astro` change for why anonymous viewers always receive an empty string here) and a plain "Available"/"Busy" text badge with **no** `Switch` element in the DOM at all. When `isOwner` is `true`: unchanged — the existing interactive `Switch`. `currentUserId` continues to gate `isOwner` exactly as today.

#### 2. Public landing page — strip owner email for anonymous visitors

**File**: `src/pages/index.astro` (modified)

**Intent**: Enforce "signed-in viewers only" for owner-email visibility at the data layer, not just the UI — required because `PocList` is a `client:load` island whose props are serialized into the page regardless of render logic (see Critical Implementation Details).

**Contract**: When `!user`, map the fetched `pocs` array to blank out `ownerEmail` (e.g. `pocs.map((p) => ({ ...p, ownerEmail: "" }))`) before passing it to `<PocList>`. When `user` is present, pass `pocs` through unchanged.

#### 3. My-POCs list component

**File**: `src/components/pocs/MyPocList.tsx` (new)

**Intent**: A separate component from `PocList` — every row here is already owned by the viewer (no `isOwner` branching needed), and it needs two actions `PocList` doesn't have.

**Contract**: `export default function MyPocList({ pocs: initialPocs }: { pocs: Poc[] })`. Per card: the existing availability switch (same fetch-to-toggle pattern as `PocList`, always enabled since every row is owned); an inline power-rating field that `PATCH`es `/api/pocs/:id/power` on blur/submit with the same optimistic-update-and-revert-on-failure pattern as the toggle; a "Remove" button that calls `window.confirm(...)` before issuing `DELETE /api/pocs/:id`, removing the card from local state on success and showing the per-row error message (e.g. "This charging point has logged sessions and can't be removed") on a 409/403/500 response, mirroring `PocList`'s per-row `errors` map.

#### 4. Dashboard POC page

**File**: `src/pages/dashboard/pocs.astro` (modified)

**Intent**: Replace the unfiltered "All charging points" list with the owner-scoped My-POCs view.

**Contract**: Replace the `listPocs(supabase)` call and `<PocList pocs={pocs} currentUserId={currentUserId} client:load>` block with `listPocsForOwner(supabase, currentUserId)` and `<MyPocList pocs={pocs} client:load>`. Update the section heading from "All charging points" to "My charging points".

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Type-check passes: `npx astro check`

#### Manual Verification:

- Signed in as B, viewing `/`: A's POCs show A's email and a plain "Available"/"Busy" badge with no switch; B's own POCs (if any) still show an interactive switch.
- Signed out, viewing `/`: no email appears for any POC anywhere in the rendered page, and viewing page source confirms no email string is present in the hydration payload.
- Signed in as A, visiting `/dashboard/pocs`: sees only A's own POCs, can edit power rating (persists on refresh) and toggle availability as before.
- A removes a POC with zero sessions: it disappears from the list and from Supabase Studio.
- A attempts to remove a POC with at least one logged session: sees the "can't be removed" message, and the POC remains in the list.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Session-Logged Confirmation

### Overview

Closes the standing gap where `?success=1` is produced by the redirect but never displayed.

### Changes Required:

#### 1. Sessions page

**File**: `src/pages/dashboard/sessions.astro` (modified)

**Intent**: Read the existing success signal alongside the existing error one.

**Contract**: Add `const success = Astro.url.searchParams.get("success") === "1";` and pass `success={success}` into `<LogSessionForm>`.

#### 2. Log-session form

**File**: `src/components/sessions/LogSessionForm.tsx` (modified)

**Intent**: Show a positive inline acknowledgement, the same visual family as `ServerError` but styled as success.

**Contract**: Add a `success?: boolean` prop. When `true`, render a small banner above the form (e.g. `data-testid="session-success"`, styled with the app's existing emerald accent already used for credit amounts) reading "Session logged successfully." No new shared component — this is the only caller, so the markup stays inline in `LogSessionForm.tsx` rather than extracting a new file.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Type-check passes: `npx astro check`

#### Manual Verification:

- Logging a valid session redirects to `/dashboard/sessions?success=1` and the page shows the confirmation banner.
- Visiting `/dashboard/sessions` directly (no query param) shows neither the success nor the error banner.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Seeker Combobox (drop first if time is short)

### Overview

Replaces the plain seeker-email text input with a real search-as-you-type combobox backed by a new bounded search endpoint. Self-contained end to end (schema → lib → API → UI) so it can be dropped as a whole without affecting Phases 1-4, per the priority decision.

### Changes Required:

#### 1. Search RPC

**File**: `supabase/migrations/20260815152000_search_users_by_email_rpc.sql` (new)

**Intent**: A bounded, authenticated-only prefix search — deliberately narrow (email only, capped result count) to limit directory enumeration, matching `get_user_id_by_email`'s single-purpose precedent.

**Contract**:

```sql
create or replace function public.search_users_by_email_prefix(p_prefix text, p_limit int default 5)
returns table(id uuid, email text)
language sql
security definer
set search_path = public, auth
as $$
  select id, email
  from auth.users
  where lower(email) like lower(p_prefix) || '%'
  order by email asc
  limit greatest(least(p_limit, 20), 1)
$$;

grant execute on function public.search_users_by_email_prefix(text, int) to authenticated;
```

The `greatest(least(p_limit, 20), 1)` clamp is defense-in-depth inside the function itself, independent of whatever cap the API route passes.

#### 2. User search types + data access

**File**: `src/types.ts` (modified), `src/lib/users.ts` (new)

**Intent**: A small, separate module — this is a user-directory search, not a charging-session concern, so it doesn't belong in `sessions.ts`.

**Contract**: `types.ts` adds `UserSearchResult { id: string; email: string }` and changes `LogSessionInput` to `{ pocId: string; seekerId: string; seekerEmail: string; kwh: number }` (replacing the bare `seekerEmail`). `users.ts` exports `searchUsersByEmailPrefix(supabase, prefix, excludeUserId): Promise<UserSearchResult[]>` — calls the RPC with `p_limit: 6` (one extra, to absorb a potential self-match), filters out `excludeUserId`, and returns at most 5.

#### 3. Session logging — accept a pre-resolved seeker id

**File**: `src/lib/sessions.ts` (modified), `src/pages/api/sessions/create.ts` (modified)

**Intent**: The combobox already resolved the seeker server-side (via the search endpoint); `logSession` no longer needs to re-resolve by email.

**Contract**: `logSession` drops its internal `resolveUserIdByEmail` call and the now-unused `resolveUserIdByEmail` export is removed from `sessions.ts`; it uses `input.seekerId` directly for the self-charge check (`input.seekerId === hostId`) and the insert's `seeker_id`/`seeker_email` columns. `logSessionSchema` in `api/sessions/create.ts` changes to `{ pocId: z.uuid(), seekerId: z.uuid(), seekerEmail: z.email(), kwh: ... }`, reading `seekerId` from the submitted form data alongside the existing fields.

#### 4. Search endpoint

**File**: `src/pages/api/users/search.ts` (new)

**Intent**: Backs the combobox's search-as-you-type.

**Contract**: `GET`. 401 if unauthenticated. Reads `q` from `context.url.searchParams`; if `q.trim().length < 3`, returns `Response.json({ users: [] })` (200 — a too-short query is an expected typing-in-progress state, not a client error). Otherwise calls `searchUsersByEmailPrefix(supabase, q, context.locals.user.id)` and returns `Response.json({ users })`.

#### 5. Combobox primitives

**File**: `src/components/ui/command.tsx`, `src/components/ui/popover.tsx` (new, generated)

**Intent**: This repo has no combobox-capable primitive yet.

**Contract**: `npx shadcn@latest add command popover`.

#### 6. Log-session form — combobox rework

**File**: `src/components/sessions/LogSessionForm.tsx` (modified)

**Intent**: Replace the plain email `<Input>` with a real search-as-you-type picker that locks in a resolved id.

**Contract**: The seeker field becomes a `Popover` + `Command` combobox. As the host types (debounced ~300ms), it calls `GET /api/users/search?q=...` and lists up to 5 matching emails, or a "No matching user" row when the search returns none. Selecting a suggestion stores `{ seekerId, seekerEmail }` in component state and closes the popover; editing the text afterward clears the locked `seekerId`, requiring a fresh selection. Two hidden inputs (`name="seekerId"`, `name="seekerEmail"`) carry the locked values into the existing native form-POST. The submit button is disabled whenever `seekerId` is empty, in addition to the existing field-level validation.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase migration up`
- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Type-check passes: `npx astro check`

#### Manual Verification:

- Typing 1-2 characters in the seeker field shows no results (no request fired, or an empty list); typing 3+ characters shows up to 5 matching registered emails, excluding the host's own.
- Typing a prefix matching no registered user shows "No matching user" and the submit button stays disabled.
- Selecting a suggestion locks it in; submit succeeds and the resulting `charging_sessions` row has the selected user's id and email.
- Editing the text after selecting a suggestion clears the lock; submit is disabled again until a new suggestion is picked.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful. This phase may be explicitly deferred as a fast-follow per the priority decision — if deferred, mark it as such in `## Progress` rather than checking it off.

---

## Testing Strategy

No unit test runner is configured in this repo (`CLAUDE.md`); every phase above is verified manually, matching S-01/S-03's precedent. The one required primary-flow e2e test already lives in `log-session-and-balance-ledger`/`e2e-primary-flow-harness` and isn't extended by this slice.

### Manual Testing Steps:

1. Register two accounts (A, B) if not already present.
2. As A, register two POCs via `/dashboard/pocs`.
3. As B, visit `/`: confirm A's two POCs show A's email and a read-only "Available"/"Busy" badge (no switch).
4. Sign out, visit `/`: confirm no email is visible anywhere, including view-source.
5. As A, visit `/dashboard/pocs`: confirm only A's own POCs appear, edit one's power rating, toggle its availability.
6. As A, remove the POC with no sessions logged against it: confirm it disappears.
7. As A, visit `/dashboard/sessions`, use the combobox to find B by typing part of B's email, select B, enter a valid kWh, submit: confirm the success banner appears.
8. As A, attempt to remove the POC just used in step 7: confirm it's rejected with a clear message since it now has session history.
9. As A, attempt to search the combobox for a nonexistent email: confirm "No matching user" and a disabled submit.

## Performance Considerations

The search endpoint's 3-character minimum, 300ms debounce, and 5-result cap keep query volume and payload size small at this app's stated "small" target scale. `listPocsForOwner` is a simple indexed `owner_id` filter, no heavier than the existing `listPocs`.

## Migration Notes

Three net-new, additive migrations (a new column + backfill, a new grant, a new RPC) — no edits to any existing migration file. Per `context/foundation/infrastructure.md`'s risk register, reverting any of these after deploy requires a new forward migration (e.g. dropping the column or revoking the grant), not `wrangler rollback`.

## References

- Roadmap parked item: `context/foundation/roadmap.md` § Parked — "POC lifecycle + session/discovery UX polish"
- Prior art for denormalized email: `supabase/migrations/20260815120000_create_charging_sessions.sql`, `src/lib/sessions.ts:71-89`
- Prior art for owner-scoped update + `PGRST116`-as-403: `src/lib/pocs.ts:55-74`, `src/pages/api/pocs/[id]/toggle.ts`
- Prior art for a single-purpose `security definer` RPC: `supabase/migrations/20260815121000_user_id_by_email_rpc.sql`
- Prior art for an inline success state machine: `src/components/profile/LocationForm.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data & Access Layer — Owner Email and POC Management

#### Automated

- [x] 1.1 Migrations apply cleanly against local Supabase: `npx supabase migration up` — b5835ad
- [x] 1.2 Lint passes: `npm run lint` — b5835ad
- [x] 1.3 Build passes: `npm run build` — b5835ad
- [x] 1.4 Type-check passes: `npx astro check` — b5835ad

#### Manual

- [ ] 1.5 Every existing `pocs` row has a non-null `owner_email` matching its owner's `auth.users.email`
- [ ] 1.6 `authenticated` role can issue a `delete` against `pocs`

### Phase 2: API Routes — POC Management

#### Automated

- [x] 2.1 Lint passes: `npm run lint` — 52105ab
- [x] 2.2 Build passes: `npm run build` — 52105ab
- [x] 2.3 Type-check passes: `npx astro check` — 52105ab

#### Manual

- [x] 2.4 New POCs are created with `owner_email` already populated — 52105ab
- [x] 2.5 `PATCH /api/pocs/:id/power` updates as owner, 403s as non-owner — 52105ab
- [x] 2.6 `DELETE /api/pocs/:id` succeeds with no history, 409s with history, 403s as non-owner — 52105ab

### Phase 3: My-POCs Management UI + Public List Read-Only Treatment

#### Automated

- [x] 3.1 Lint passes: `npm run lint` — 296794c
- [x] 3.2 Build passes: `npm run build` — 296794c
- [x] 3.3 Type-check passes: `npx astro check` — 296794c

#### Manual

- [x] 3.4 Non-owned POCs on `/` show owner email (signed-in) and a read-only badge, no switch — 296794c
- [x] 3.5 Anonymous visitors to `/` see no email anywhere, including page source — 296794c
- [x] 3.6 `/dashboard/pocs` shows only the signed-in user's own POCs with working power-edit and remove — 296794c
- [x] 3.7 Removing a POC with sessions is rejected with a clear message; without sessions, it disappears — 296794c

### Phase 4: Session-Logged Confirmation

#### Automated

- [x] 4.1 Lint passes: `npm run lint` — a4257e6
- [x] 4.2 Build passes: `npm run build` — a4257e6
- [x] 4.3 Type-check passes: `npx astro check` — a4257e6

#### Manual

- [x] 4.4 Successful session log shows the confirmation banner — a4257e6
- [x] 4.5 Visiting the page directly (no query param) shows neither banner — a4257e6

### Phase 5: Seeker Combobox

#### Automated

- [x] 5.1 Migration applies cleanly: `npx supabase migration up`
- [x] 5.2 Lint passes: `npm run lint`
- [x] 5.3 Build passes: `npm run build`
- [x] 5.4 Type-check passes: `npx astro check`

#### Manual

- [x] 5.5 3+ character search returns up to 5 matches excluding the host's own email
- [x] 5.6 No-match search shows "No matching user" and disables submit
- [x] 5.7 Selecting a suggestion locks the id; submit creates a session with the correct seeker
- [x] 5.8 Editing text after selection clears the lock and disables submit again
