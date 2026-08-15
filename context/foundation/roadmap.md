---
project: "EV Share"
version: 1
status: draft
created: 2026-08-15
updated: 2026-08-15
prd_version: 1
main_goal: low-complexity
top_blocker: time
updated: 2026-08-15
---

# Roadmap: EV Share

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

EV owners with a private charger have no practical way to share idle capacity with
nearby EV owners who need a charge, and no fair way to track who gave or received
energy — sharing today happens informally, with no record and no discovery. A pure
kWh balance (no money involved) sidesteps the billing/pricing friction that kills
informal sharing schemes: the app only needs to be a trusted, shared scorekeeper for
energy given and received across many households.

## North star

**S-02: A logged charging session updates both users' balances by the identical kWh amount, and each user can see their own updated balance and history** — this is the smallest end-to-end slice whose successful delivery would prove the core hypothesis (the belief this roadmap is built to test first: that a symmetric kWh ledger can actually replace informal, undocumented energy sharing between EV owners). It is also, verbatim, the PRD's Primary Success Criterion.

> A reader-facing note on what "north star" means here: the smallest end-to-end
> slice whose successful delivery would prove the core product hypothesis —
> sequenced as early as its prerequisites allow, because everything else in this
> roadmap only matters if this works.

## At a glance

| ID   | Change ID                          | Outcome (user can …)                                                         | Prerequisites | PRD refs                   | Status   |
| ---- | ----------------------------------- | ----------------------------------------------------------------------------- | -------------- | --------------------------- | -------- |
| F-01 | `e2e-primary-flow-harness`          | (foundation) an automated e2e test can verify the primary flow                | —              | —                            | in-progress |
| S-04 | `user-location-profile`             | user can set/update their own location                                       | —              | FR-003                      | planning |
| S-01 | `poc-registration-and-listing`      | user can register a POC, toggle its availability, and see all POCs           | —              | FR-004, FR-005, FR-006, US-01 | in-progress |
| S-02 | `log-session-and-balance-ledger`    | user can log a charging session and see both balances update, with history   | S-01, F-01     | FR-007, FR-008, FR-009, FR-010, US-01 | planning |
| S-03 | `unified-landing-page`              | user's landing page shows balance, history, and available POCs together      | S-01, S-02     | FR-011, US-01                | planning |

## Baseline

What's already in place in the codebase as of `2026-08-15` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 SSR + React islands, Tailwind 4, shadcn-style primitives (`src/components/`, `components.json`).
- **Backend / API:** partial — only auth routes exist (`src/pages/api/auth/{signin,signup,signout}.ts`); no domain API routes yet.
- **Data:** absent — no `supabase/migrations/` directory, no schema, no `src/types.ts`; the cloud Supabase project exists but has no domain tables.
- **Auth:** present — Supabase email/password via `@supabase/ssr`, route-protection middleware (`src/middleware.ts`). This already satisfies **FR-001** (register) and **FR-002** (login), verified live in production — no roadmap slice re-plans this work.
- **Deploy / infra:** present — deployed live on Cloudflare Workers, auto-deploy-on-merge via Workers Builds, CI (lint + build) running on `main` (`context/changes/deployment/deployment-plan.md`).
- **Observability:** absent — no logging/error-tracking library; only ad-hoc `wrangler tail`. No PRD requirement forces investment here at this scale, so no foundation is proposed for it.

## Foundations

### F-01: E2E test harness for the primary flow

- **Outcome:** (foundation) a minimal automated end-to-end test runner is wired up, capable of driving and verifying the primary flow (US-01) against a real deployed or local instance.
- **Change ID:** `e2e-primary-flow-harness`
- **PRD refs:** — (sourced from `shape-notes.md`'s `Forward: technical-roadmap` note, echoed in `CLAUDE.md`: "at least one e2e test verifying the primary user flow (US-01) — this still needs to be added.")
- **Unlocks:** the verification path required by S-02 (north star) — without it, the one invariant the whole product exists to protect (balances always net to zero drift) ships with no automated check.
- **Prerequisites:** —
- **Parallel with:** S-01, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** No test runner exists yet in this repo; sequencing this first (rather than after S-02 ships) means the core ledger invariant gets an automated safety net from day one instead of being verified by hand only.
- **Status:** in-progress

## Slices

### S-04: User sets their own location

- **Outcome:** user can set and update their own location via manual entry.
- **Change ID:** `user-location-profile`
- **PRD refs:** FR-003
- **Prerequisites:** —
- **Parallel with:** F-01, S-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Smallest slice in the roadmap and has no dependents in this MVP scope (distance-sorting, the FR that would consume it, is Parked) — sequenced early only because it's free to get out of the way, not because anything downstream is blocked on it.
- **Status:** planning

### S-01: User registers and manages a POC

- **Outcome:** user can register one or more of their own POCs (location, power rating, availability), toggle each POC's availability, and view all POCs and their details.
- **Change ID:** `poc-registration-and-listing`
- **PRD refs:** FR-004, FR-005, FR-006, US-01
- **Prerequisites:** —
- **Parallel with:** F-01, S-04
- **Blockers:** —
- **Unknowns:**
  - Should POC location be shown precisely or approximately? (PRD Open Question) — Owner: user. Block: no — accepted as exact-location-for-now per PRD, revisit before wider rollout.
- **Risk:** POC data is entirely self-reported with no verification mechanism (an accepted PRD limitation) — sequenced before S-02 since the ledger has nothing to log a session against until at least one POC exists.
- **Status:** in-progress

### S-02: Log a charging session and update balances

- **Outcome:** the POC owner can log a charging session for another user (kWh amount), the system debits the charged user and credits the owner by the identical amount, and each user can view their own current balance and transaction history.
- **Change ID:** `log-session-and-balance-ledger`
- **PRD refs:** FR-007, FR-008, FR-009, FR-010, US-01
- **Prerequisites:** S-01 (a POC must exist to log a session against), F-01 (verification path for this invariant)
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:**
  - Should a seeker be able to confirm or dispute a logged session's kWh amount? (PRD Open Question) — Owner: user. Block: no — the owner's entry is final for MVP per PRD Non-Goals; tracked as a v2 candidate.
- **Risk:** This is the one domain invariant the whole product exists to protect (PRD guardrail: debit and credit always equal, no drift) — sequenced as early as S-01 allows since every other slice's value depends on this being provably correct first.
- **Status:** planning

### S-03: Unified landing page

- **Outcome:** user's landing page shows their own balance, transaction history, and the list of available POCs together on one screen.
- **Change ID:** `unified-landing-page`
- **PRD refs:** FR-011, US-01
- **Prerequisites:** S-01, S-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Purely a consolidation of data S-01 and S-02 already expose (no new logic of its own) — sequenced last since it has nothing to prove on its own, only to assemble.
- **Status:** planning

## Backlog Handoff

| Roadmap ID | Change ID                          | Suggested issue title                                         | Ready for `/10x-plan` | Notes                                   |
| ---------- | ------------------------------------ | -------------------------------------------------------------- | ---------------------- | ---------------------------------------- |
| F-01       | `e2e-primary-flow-harness`           | Set up e2e test harness for the primary charge-and-log flow    | yes                     | Run `/10x-plan e2e-primary-flow-harness` |
| S-04       | `user-location-profile`              | User can set/update their own location                         | yes                     | Run `/10x-plan user-location-profile`    |
| S-01       | `poc-registration-and-listing`       | User can register, toggle, and view charging points (POCs)     | yes                     | Run `/10x-plan poc-registration-and-listing` |
| S-02       | `log-session-and-balance-ledger`     | Log a charging session and update both users' kWh balances     | no                      | Needs S-01 + F-01 done first             |
| S-03       | `unified-landing-page`               | Combine balance, history, and POC list on one landing page     | no                      | Needs S-01 + S-02 done first             |

## Open Roadmap Questions

1. **Should there be an account-recovery (password reset) flow?** — Owner: user. Block: roadmap-wide (non-blocking; FR-002/login is already shipped via baseline, this is a v2 candidate, not gating any current slice).

## Parked

- **No money, payments, or pricing** — Why parked: PRD Non-Goal; the product is a pure kWh balance by design, never currency or billing.
- **Map or routing integration** — Why parked: PRD Non-Goal; "distance" is a simple straight-line calculation, not real-world travel distance.
- **Device geolocation** — Why parked: PRD Non-Goal; location (user and POC) is always manually entered.
- **Dispute or confirmation flow for logged sessions** — Why parked: PRD Non-Goal; the POC owner's logged amount is final for MVP.
- **Distance-sorting and power-level filtering (FR-012, FR-013)** — Why parked: both are nice-to-have priority in the PRD, not must-have; with a fixed, non-negotiable MVP timeline, the roadmap prioritizes finishing the full must-have loop (S-01 → S-02 → S-03) before adding discovery polish.

## Done

