# Log Session & Balance Ledger — Plan Brief

> Full plan: `context/changes/log-session-and-balance-ledger/plan.md`

## What & Why

The POC owner (host) logs a charging session for another registered user (seeker), specifying kWh used. The system debits the seeker and credits the host by the identical amount, and both changes are visible on each user's own landing page. This is roadmap slice S-02 — the "north star" — the smallest end-to-end slice that proves the core hypothesis: a symmetric kWh ledger can replace informal, undocumented energy sharing.

## Starting Point

S-01 (POC registration) is fully implemented and is the pattern this plan follows (migration → types → lib service → API route → UI). F-01 (e2e harness) exists but only provisions one test identity. Nothing today can resolve an arbitrary user by email, and `/` (`index.astro`) is still the starter's placeholder and the only genuinely public route.

## Desired End State

A host picks one of their own POCs, types the seeker's email, enters a kWh amount, and submits. Both users immediately see their updated balance and full transaction history on `/` — the seeker's balance down, the host's up, by the same number. `/` also works for anonymous visitors, showing just the public POC list.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Seeker identification | Type the seeker's email; resolve server-side via a single-purpose RPC | No new UI surface, and avoids building a `profiles`/user-directory table that S-04 would also want to own | Plan (user Q&A) |
| Balance representation | Derived from an immutable one-row-per-session ledger (`SUM as host − SUM as seeker`), never stored | Makes the "no drift" guardrail true by construction, not something to enforce | Plan |
| S-02 UI scope | Dedicated `/dashboard/sessions` form (log-only) + `index.astro` repurposed now as the real landing page | Roadmap assigns FR-009/010 to S-02 itself; PRD's own primary success criterion says balance is "visible on each user's landing page" | Plan (user Q&A) |
| `/` access | Stays public; POC list visible to everyone, balance/history layered in only when signed in | PRD's Access Control section gates balance, POC management, and session logging — not POC *viewing* | Plan (user correction) |
| Session visibility | Private to host + seeker only (not public like `pocs`) | Charging activity between two people isn't the same kind of data as a discoverable POC listing | Plan (user Q&A) |
| Self-charging | Rejected before insert, plus a DB check constraint as defense-in-depth | Closes a trivial, risk-free way to fabricate balance | Plan (user Q&A) |
| kWh bound | Capped at 500 per session | Cheap defense-in-depth against fat-finger entry, mirrors `pocs`' own check-constraint pattern | Plan (user Q&A) |
| e2e scope | Full UI-driven US-01 spec built now, as the explicitly droppable Phase 4 | S-02 is the first point the outstanding CLAUDE.md e2e requirement becomes buildable; droppable if the 3-week budget is tight | Plan (user Q&A) |

## Scope

**In scope:** `charging_sessions` schema + RLS, email→id lookup RPC, anon read policy on `pocs`, log-session API route, `/dashboard/sessions` form page, `index.astro` rewrite (public POC list + conditional balance/history), second e2e test identity + full US-01 spec.

**Out of scope:** seeker confirmation/dispute flow, editing/backdating sessions, history pagination, a general user directory, distance-sorting/power filtering, CI wiring for the new e2e spec.

## Architecture / Approach

`charging_sessions` is a single immutable table: one row per session (`poc_id`, `host_id`/`host_email`, `seeker_id`/`seeker_email`, `kwh`, `created_at`). Balance is always computed by reducing a user's own rows (never stored), so there's no second write path to drift. Emails are denormalized onto the row at insert time (the host's from their session, the seeker's from the typed input), so history display never needs a reverse id→email lookup. `/` branches in-page on `Astro.locals.user` — the one route in the app with two distinct views instead of a middleware gate.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data Layer | `charging_sessions` table + RLS, email-lookup RPC, anon POC-read policy, types, `lib/sessions.ts` | RPC's `security definer` scope must stay minimal (returns only a uuid) |
| 2. API Routes | `POST /api/sessions/create` with full validation (ownership, self-charge, bounds) | Redirect-based error messages must stay specific enough to be actionable |
| 3. UI | `/dashboard/sessions` form + `index.astro` rewrite + dashboard nav link | `index.astro`'s in-page auth branching is the one non-middleware auth check in the app |
| 4. E2E (droppable) | Second test identity + full UI-driven US-01 spec | Two-`storageState`, two-`page` test pattern is new to this harness |

**Prerequisites:** S-01 implemented (done), F-01 implemented (done).
**Estimated effort:** ~3-4 sessions across 4 phases; Phase 4 can slip past the MVP deadline without blocking the slice.

## Open Risks & Assumptions

- Assumes Supabase Auth's `auth.users.email` is reliably unique and case-normalizable — the lookup RPC compares `lower(email)`.
- Assumes a "small" number of sessions per user makes on-the-fly balance aggregation cheap enough with no caching — matches the PRD's stated target scale.
- `index.astro`'s public POC list is a scope decision made mid-planning (not originally in the roadmap's FR-006/S-01 description) — worth a quick sanity check against the PRD's Access Control wording before merge, though the plan already grounds it there.

## Success Criteria (Summary)

- A host can log a session against their own POC for another real user by email, and cannot for a nonexistent user, themselves, or an unowned POC.
- Both host and seeker see their balance and history update by the identical kWh amount on their own landing page, immediately.
- An automated e2e spec proves the full loop unattended (or is explicitly deferred, per the priority decision).
