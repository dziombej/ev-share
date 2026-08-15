---
change_id: user-location-profile
title: User location profile
status: implementing
created: 2026-08-15
updated: 2026-08-15
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

### Deviation from plan: RLS disabled project-wide (2026-08-15)

User decision during Phase 1: "turn off RLS - it's only POC project." Added migration
`20260815140000_disable_rls.sql` disabling RLS on both `public.profiles` and `public.pocs`
(policies left in place but inert, so re-enabling later is a one-line revert), plus explicit
`select, insert, update` grants to `authenticated` on both tables (needed regardless of RLS —
the local Supabase CLI's default table ACL for the migration role grants neither).

This supersedes the plan's Critical Implementation Details section ("RLS read scope is narrower
than the POC precedent") and Progress item 1.5 ("RLS enforced: a second user's session cannot
select the first user's row") — verified live that a second user's session CAN now read/write the
first user's location row, by design. Progress item 1.5 is intentionally left unchecked (it no
longer describes the system's actual/intended behavior) rather than marked done; item 1.6
(`updated_at` trigger fires) remains valid and was reverified after this change.
