# POC Registration & Listing — Plan Brief

> Full plan: `context/changes/poc-registration-and-listing/plan.md`

## What & Why

Users can register their own EV charging points (POCs) with a location (lat/lng), power rating (kW), and availability flag; toggle availability instantly from a list; and see every registered POC with its current availability. This is roadmap slice S-01 — the first domain feature in the codebase, and the prerequisite S-02 (session logging + balances) needs at least one real POC to log a session against.

## Starting Point

Nothing domain-specific exists yet: no `supabase/migrations/`, no `src/types.ts`, no POC-related API routes or pages. Only auth scaffolding (Supabase email/password, `/dashboard` route protection) and one shadcn primitive (`button`) are in place. This change is the first to create schema, RLS policies, and domain UI from scratch.

## Desired End State

A signed-in user visits `/dashboard/pocs`, sees a form to register a new POC and a list of all POCs (their own and others'), and can flip their own POCs' availability with an instant, no-reload switch that persists. Unauthenticated visitors are redirected to sign-in (existing middleware, no new code).

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Location format | Numeric lat/lng fields | Matches the future straight-line-distance FR-012 and shape-notes' "coordinates" framing — no conversion needed later. | Plan |
| Power rating format | Free numeric kW input | Covers any real-world charger wattage without maintaining an enum. | Plan |
| Post-creation editing | Create + toggle only, no edit/delete | Matches FR-004/FR-005 exactly; avoids solving "delete a POC with session history" before S-02 exists. | Plan |
| Availability toggle UX | Client-side fetch (JSON API), no page reload | Meets the PRD's ~1-second acknowledgement NFR for a list of many POCs; first JSON API route in the repo. | Plan |
| Page structure | One page: form + list combined | Matches FR-006's "register and view" framing as one screen; fewer routes to protect/test. | Plan |
| List scope | All POCs (own + others'), availability shown | Matches FR-006's literal wording; filtering to available-only is nice-to-have (FR-013) and parked. | Plan |
| e2e test coverage | None in this slice — manual verification only | Existing e2e specs cover only auth/dashboard-welcome, not POC flows; the one required primary-flow e2e test needs S-02 (balance updates) to be meaningful, so it belongs there. | Plan |
| Input validation | Range + required-field checks (zod) only | Matches `CLAUDE.md`'s zod mandate; duplicate-POC detection isn't required since self-reported/unverified POC data is an accepted PRD limitation. | Plan |
| Scope cuts if time-short | None — all three FRs are must-have; fallback is form-POST instead of fetch-based toggle | Keeps S-02's prerequisite (a real, toggleable POC) intact; the toggle's UX pattern is the only piece with a pre-agreed simpler fallback. | Plan |

## Scope

**In scope:**
- `pocs` table + RLS policies (select: all authenticated; insert/update: owner-only)
- `src/types.ts` (first domain types) and `src/lib/pocs.ts` (data-access service)
- `POST /api/pocs/create` (form-POST + redirect, zod-validated)
- `PATCH /api/pocs/[id]/toggle` (JSON API, first of its kind in the repo)
- `/dashboard/pocs` page: registration form + full POC list with availability switches
- New shadcn primitives: `input`, `label`, `switch`, `card`

**Out of scope:**
- Editing/deleting a POC after creation
- Address-based location or any geocoding
- Distance-sorting (FR-012) and power-level filtering (FR-013) — both parked
- Any Playwright/e2e coverage (deferred to S-02/S-03's full-flow test)
- Duplicate-POC detection

## Architecture / Approach

Bottom-up: schema + RLS (Phase 1) → API routes that depend on it (Phase 2) → UI that calls those routes (Phase 3). The toggle is the one place this change introduces a new convention (JSON fetch instead of form-POST+redirect), justified by the NFR on perceived responsiveness for a switch inside a list.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data Layer | `pocs` table, RLS policies, shared types + service | First-ever migration/RLS in this repo — no prior pattern to copy exactly |
| 2. API Routes | Create + toggle endpoints | Toggle route is the first JSON API convention in the codebase |
| 3. UI | Form, list, page, nav link, new shadcn primitives | Client-side switch state must reconcile correctly with server response on failure |

**Prerequisites:** None (roadmap lists S-01 with no prerequisites).
**Estimated effort:** ~1 session across 3 phases, within the 3-week/after-hours-only MVP budget.

## Open Risks & Assumptions

- Assumes two test user accounts are available for the cross-user manual verification (user A can't toggle user B's POC).
- `wrangler rollback` cannot revert this migration if deployed and later needs reverting — a follow-up `drop table` migration would be required instead.
- The single required primary-flow e2e test (per `CLAUDE.md`) is deferred to S-02/S-03; if those slip significantly, this slice ships with manual-only verification for longer than ideal.

## Success Criteria (Summary)

- A user can register a POC and see it appear in a list alongside other users' POCs, each showing current availability.
- The registering user can toggle their own POC's availability instantly (no reload), and it persists across a refresh.
- A user cannot toggle another user's POC's availability (enforced by RLS, verified manually).
