---
change_id: poc-contact-and-management
title: POC owner contact visibility and my-POCs management
status: impl_reviewed
created: 2026-08-15
updated: 2026-08-16
archived_at: null
---

## Notes

Parked topic: session-logged confirmation, seeker-email search/combobox, owner email + read-only Available/Busy (no checkbox) for non-owners on the public POC list, and a separate "my POCs" view with update-power/remove-POC actions. No such API exists yet — this is a new slice.

### Implementation review (2026-08-16)

Full-plan review found and fixed one critical security bug plus three warnings; see `reviews/impl-review.md` for the complete findings and triage record. Summary of follow-up migrations added after the plan's own 5 phases:

- `20260816100000_fix_search_users_by_email_prefix_escaping.sql` — the seeker-search RPC's LIKE pattern didn't escape `%`/`_`, so a `___` query (passes the app's 3-char minimum) matched almost every registered email. Now escaped.
- `20260816101000_pocs_delete_own_policy.sql` — added a dormant `pocs_delete_own` RLS policy, symmetric with the existing update/insert policies (delete previously had no scoping mechanism at all, not even inert).
- `20260816102000_search_users_by_email_prefix_min_length.sql` — the 3-char minimum was only enforced in the API route, not the RPC itself; added inside the function too.
- Added `export const prerender = false;` to the 5 new API routes from this plan, matching the project's stated convention.

One observation accepted without a code change: `MyPocList`'s power-rating field uses an explicit Save button rather than the plan's literal "blur + optimistic-revert" wording — functionally equivalent, no fix needed.
