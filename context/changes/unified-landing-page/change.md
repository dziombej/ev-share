---
change_id: unified-landing-page
title: Unified landing page
status: implementing
created: 2026-08-15
updated: 2026-08-15
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- **Deviation from plan.md's testid contract**: the plan assumed S-02 Phase 4's e2e spec was "still-pending" and specified `data-testid="balance-amount"`/`data-testid="balance-summary"` for `BalanceSummary.astro`. In reality, `e2e-primary-flow-harness` (F-01) was already implemented and `e2e/specs/log-session-flow.spec.ts` asserts against `getByTestId("balance")` directly. Implemented with `data-testid="balance"` on the number (matching the real, CI-enforced e2e contract) instead of the plan's `balance-amount`; kept `data-testid="balance-summary"` on the wrapping card since nothing depends on that name either way.
- **Scope additions beyond the plan, approved inline during manual verification**:
  - Wired the previously-unused `Topbar.astro` component into `/`, `/dashboard/pocs`, `/dashboard/sessions`, and replaced `/dashboard`'s bespoke nav buttons with it too — landing page had no sign-out/nav affordance at all. Topbar now carries Home / Dashboard / Charging points / Log a session / Sign out as one consistent menu bar across all four pages.
  - Added a Home link on `/dashboard` (now via Topbar) and compacted `/dashboard`'s "Your location" block into a small view/edit toggle (`LocationForm.tsx`) instead of an always-expanded form.
- **Deferred to a future slice** (parked in `context/foundation/roadmap.md` under Parked): session-logged confirmation UX, seeker-email search/combobox, owner email + read-only Available/Busy display for non-owners on the public POC list, and a separate "my POCs" view with update-power/remove-POC actions (no such API exists yet).
