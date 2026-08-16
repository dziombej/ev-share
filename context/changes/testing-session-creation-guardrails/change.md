---
change_id: testing-session-creation-guardrails
title: Session-creation guardrails — kWh validation and ownership checks
status: implementing
created: 2026-08-16
updated: 2026-08-16
archived_at: null
---

## Notes

Rollout Phase 1 from `context/foundation/test-plan.md` §3, covering Risk #1
(invalid kWh accepted) and Risk #2 (non-owner session logging). This research
pass covers Risk #1 only, per the invoking research query.

### Phase 2 manual verification caveat (2026-08-16)

`log-session-flow.spec.ts` currently fails deterministically (3/3 attempts)
at the POC-selection dropdown step, **unrelated to this plan's schema
extraction**. Confirmed via a stash A/B test: stashing Phase 2's uncommitted
changes (`src/lib/validation/session.ts`, the `create.ts` import swap) and
re-running against the pre-refactor baseline reproduces the exact same
failure — proving the refactor didn't change behavior, even though the spec
itself can't currently pass.

**Root cause found** (not fixed, out of scope for this plan): at failure
time, the `pocId` dropdown lists 5 POCs from earlier test runs but never the
one the current run just created. `listPocsForOwner` (`src/lib/pocs.ts:32-44`)
has no `.limit()` and orders by `created_at desc`; `LogSessionForm.tsx`
renders the full list with no slicing either — so the freshly-created POC is
either committing after the page's SSR read, or `created_at` timestamp ties
from rapid successive inserts (this exact e2e spec has now been run many
times in a row against the same seeded host account) are sorting it out of
place. This is a genuine app-level bug (read-after-write consistency or
timestamp-ordering), not a Playwright/Radix flakiness issue as the spec's own
inline comment assumes.

Phase 2's manual-verification item (2.4) is recorded as satisfied via this
equivalence evidence, not a passing spec run. **Follow-up needed**: root-cause
and fix the POC-listing bug (candidate next step: check `created_at` column
precision/type in `supabase/migrations/20260815100000_create_pocs.sql` and
whether Supabase's read replica/PostgREST layer has any read-after-write
lag), then get `log-session-flow.spec.ts` passing again — tracked here since
it surfaced during this change, but it belongs to a different concern than
Risk #1 kWh validation.
