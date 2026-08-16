# POC Contact & Management — Plan Brief

> Full plan: `context/changes/poc-contact-and-management/plan.md`

## What & Why

Closes the roadmap's parked "POC lifecycle + session/discovery UX polish" item, surfaced during `unified-landing-page` manual QA: owner-email visibility on the public POC list, a dedicated "My POCs" management view (update power, remove), a session-logged confirmation banner, and a seeker-email search combobox.

## Starting Point

S-01/S-02/S-03 are all implemented. `Poc.ownerId` is a bare UUID with no email path; `?success=1` is already produced by the session-create redirect but never displayed; no combobox/autocomplete component exists anywhere in the repo; `pocs` has RLS disabled (grants-only access control) and no `delete` grant yet; `charging_sessions.poc_id`'s existing foreign key already rejects deleting a POC with session history.

## Desired End State

Signed-in users browsing `/` see the owner's email and a plain read-only "Available"/"Busy" badge for POCs they don't own (anonymous visitors see neither, including in page source). `/dashboard/pocs` becomes a "My charging points" view: update power, toggle availability, and remove (blocked with a clear message if the POC has logged sessions). Logging a session shows an inline confirmation. The seeker field is a real search-as-you-type combobox that locks in a resolved user id before allowing submit.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Owner-email storage | Denormalize onto `pocs.owner_email` at insert time | Matches the exact precedent `charging_sessions` already uses for `host_email`/`seeker_email` — no new privileged join | Plan (user Q&A) |
| Owner-email visibility | Signed-in viewers only | Limits PII exposure to accountable, logged-in users; mirrors how balance/history already branch on auth state | Plan (user Q&A) |
| Combobox mechanism | New bounded search endpoint (min 3 chars, capped 5 results) + real shadcn Combobox | Actually delivers search-as-you-type; bounds directory-enumeration exposure | Plan (user Q&A) |
| Combobox selection | Locks in the resolved user id, not just fills text | Removes ambiguity at submit time — no re-resolution race | Plan (user Q&A) |
| POC removal w/ history | Reject outright (no soft-delete) | The existing `charging_sessions.poc_id` FK already enforces this with no schema change needed | Plan (user Q&A) |
| My-POCs view shape | Split: `/dashboard/pocs` = create + my-POCs only; `/` keeps the read-only browse-all list | Matches the parked note's exact wording; avoids three near-duplicate POC lists | Plan (user Q&A) |
| Update-power scope | Power rating only, same bounds as creation | Matches the parked note literally; smallest possible surface | Plan (user Q&A) |
| Confirmation UX | Inline banner reading the existing `?success=1` | The redirect contract already exists and is unused — smallest possible fix | Plan (user Q&A) |
| Read-only availability | Plain badge, no `Switch` element for non-owners | Matches "no checkbox" literally; today's disabled-but-visible switch is confusing | Plan (user Q&A) |
| Combobox no-match | Show "No matching user", block submit until a valid id is locked in | Makes it structurally impossible to submit a session for a nonexistent seeker | Plan (user Q&A) |
| Priority if time-short | Combobox (Phase 5) drops first, falling back to today's plain email input | Highest build cost/risk (new UI pattern + new endpoint) for the smallest functional gap | Plan (user Q&A) |
| Testing approach | Manual only, no new e2e | Matches S-01/S-03's precedent; the one required e2e test lives elsewhere | Plan (user Q&A) |

## Scope

**In scope:**
- `pocs.owner_email` column + backfill; `delete` grant on `pocs`
- `setPocPower`, `removePoc`, `listPocsForOwner` lib functions
- `PATCH /api/pocs/:id/power`, `DELETE /api/pocs/:id`
- `PocList` owner-email + read-only-badge treatment; new `MyPocList` component; `dashboard/pocs.astro` restructure
- Session-logged confirmation banner (`sessions.astro` + `LogSessionForm`)
- `search_users_by_email_prefix` RPC, `GET /api/users/search`, `LogSessionForm` combobox rework (shadcn `command`/`popover`)

**Out of scope:**
- Soft-delete/archive state for POCs
- Editing a POC's location (power-only update)
- General user-directory page beyond the bounded combobox search
- Seeker confirmation/dispute of a session's kWh amount (PRD's own tracked Non-Goal)
- New toast/dialog library (native `window.confirm()` for remove; existing query-param banner convention for confirmation)
- CI/e2e wiring

## Architecture / Approach

Bottom-up within each feature group (schema → lib → API → UI), following S-01/S-02's established layering. Phases 1-2 (owner-email + POC management) share the same table and grant changes; Phase 3 is their UI. Phase 4 (confirmation) is a small independent fix. Phase 5 (combobox) is deliberately self-contained end-to-end — schema through UI — so it's the one phase that can be dropped whole without leaving the rest of the plan in a broken state, since Phases 1-4 never touch `logSession`'s existing email-based contract.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data & Access Layer | `owner_email` column + backfill, delete grant, POC lib functions | Backfill must correctly join every existing row before the column goes `not null` |
| 2. API Routes | Power-update and remove endpoints, create route updated | Distinguishing FK-violation (409) from not-owner (403) on delete |
| 3. My-POCs UI + Read-Only Public List | Restructured dashboard page, new `MyPocList`, `PocList` read-only treatment | Anonymous email leakage via `client:load` hydration payload if not explicitly stripped server-side |
| 4. Session-Logged Confirmation | Inline banner reading the existing `?success=1` | None significant — smallest phase |
| 5. Seeker Combobox (droppable) | New search endpoint + real combobox, locked-id submission | New UI pattern (no combobox precedent in repo) and a new privacy-bounded endpoint |

**Prerequisites:** S-01, S-02, S-03 all implemented (confirmed — all shipped).
**Estimated effort:** ~2-3 sessions across 5 phases; Phase 5 can be dropped without affecting the rest.

## Open Risks & Assumptions

- Assumes every existing `pocs` row's `owner_id` resolves to a live `auth.users` row (no orphaned owners) — the Phase 1 backfill would otherwise leave a null `owner_email` and fail the `not null` constraint.
- Assumes this app's "small" target scale makes a 3-character-minimum, 5-result-capped, debounced search endpoint sufficiently cheap with no caching or rate-limiting infrastructure.
- The FK-violation-as-409 mapping in `removePoc` depends on Postgres's default `no action` behavior on `charging_sessions.poc_id` continuing to hold — if a future migration ever adds `on delete cascade` there, this plan's "reject deletion" behavior would silently become "cascade-delete session history" instead.

## Success Criteria (Summary)

- Signed-in users see owner email + a read-only badge for POCs they don't own on `/`; anonymous visitors see no email anywhere, including page source.
- A user can manage only their own POCs (power, availability, removal) from `/dashboard/pocs`, with removal correctly blocked when session history exists.
- Logging a session shows a confirmation, and the seeker can be found via a bounded, search-as-you-type combobox that locks in a real user before submit is allowed.
