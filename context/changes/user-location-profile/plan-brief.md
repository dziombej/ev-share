# User Location Profile — Plan Brief

> Full plan: `context/changes/user-location-profile/plan.md`

## What & Why

Let a logged-in user manually set and update their own location (latitude/longitude, no device geolocation) so that a future distance-sorting feature could eventually use it — per PRD FR-003. This is roadmap slice S-04, the smallest slice in the roadmap, with no current dependents.

## Starting Point

Nothing exists yet: no `profiles` table, no location-related type, no form. The sibling slice `poc-registration-and-listing` (status `impl_reviewed`) already solved the closely related sub-problem of capturing and validating a manually-entered lat/lng pair for a charging point, so this plan reuses its DB column shape, RLS approach, and validation pattern — adapted for two differences: this data is private (owner-only read) and upserted (one row per user, not append-only).

## Desired End State

A user opens `/dashboard` and sees a location card. If they've never set a location, it shows a "Location not set" placeholder next to an empty, ready-to-fill form. Entering valid coordinates and saving persists them instantly (no page reload) with inline success feedback; the value is still there on the next page load. Invalid input is rejected before any request is sent.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| UI placement | Inline card on existing `/dashboard` | User chose this over a new dedicated page — one less route to navigate to. | Plan |
| Table scope | Minimal `profiles(id, latitude, longitude, updated_at)` | Matches FR-003 exactly; no speculative fields for a hypothetical future profile. | Plan |
| Save semantics | Single upsert endpoint | "Set/update" is one user action; client never needs to know if a row already exists. | Plan |
| Empty state | Placeholder + optional form, never forced | The only consumer of this data (distance-sorting, FR-012) is Parked — no reason to force onboarding friction. | Plan |
| Feedback UX | AJAX save, no page reload | User chose responsiveness over reusing the form-POST-redirect convention; a JSON AJAX convention already exists in this codebase (`toggle.ts`), so this isn't a new pattern. | Plan |
| RLS read scope | Owner-only (`id = auth.uid()`), unlike POC's authenticated-read-all | A user's own location is private; POCs are meant to be discoverable, locations are not. | Plan |
| Validation on JSON body | Plain `z.number().min().max()`, not `z.coerce.number()` | The POC slice's coercion trick was for form-data strings; on a JSON body, coercion would reintroduce the same "missing field silently becomes a valid `(0,0)`" bug the POC impl-review caught. | Plan |

## Scope

**In scope:**
- `profiles` table migration, RLS, `updated_at` trigger
- Upsert API endpoint (`POST /api/profile/location`)
- Inline dashboard form with client + server validation, empty-state placeholder, AJAX save

**Out of scope:**
- Consuming this location anywhere (distance-sorting is Parked)
- Device geolocation, maps, address lookup
- A dedicated profile/settings page
- Forced onboarding step
- Other users viewing this location
- Any general profile concept beyond location (name, avatar, etc.)

## Architecture / Approach

Mirrors the already-implemented POC slice's shape end to end: migration → typed data-access module → API route → React form — but as a private, single-row-per-user upsert instead of an append-only, publicly-readable list.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data model & data-access layer | `profiles` table, RLS, trigger, regenerated types, `UserLocation` DTO, `src/lib/profile.ts` | Copy-pasting the POC's `using (true)` select policy would leak every user's location to every other user |
| 2. API endpoint | `POST /api/profile/location`, JSON-in/JSON-out, auth-gated, zod-validated upsert | Using `z.coerce.number()` on the JSON body would reintroduce the POC slice's (0,0)-on-missing-field bug |
| 3. UI — inline location card | Location form on `/dashboard`, empty-state placeholder, AJAX save with inline feedback | Getting the upsert conflict target wrong (`profiles.id` is the FK to `auth.users`, not an auto-generated PK) would insert duplicates instead of updating |

**Prerequisites:** none — this slice has no upstream dependencies in the roadmap.
**Estimated effort:** small, ~1 session across 3 phases (mirrors the already-completed POC slice's scope).

## Open Risks & Assumptions

- Assumes local Supabase (`npx supabase start`) is available for applying migrations and regenerating types during implementation.
- No automated test coverage exists for this repo yet (no test runner configured); verification is manual, same as the POC slice.

## Success Criteria (Summary)

- A user can set their location for the first time and see it persist across a reload.
- A user can update an existing location and see the new value persist (not a duplicate row).
- A user's location is never readable by another user's session.
