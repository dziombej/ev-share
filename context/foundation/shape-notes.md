---
project: "EV Share"
context_type: greenfield
created: 2026-08-14
updated: 2026-08-14
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "coordination overhead — no shared system to track informal power-sharing"
    - topic: "insight"
      decision: "money-free kWh ledger sidesteps the friction (billing/tax/pricing disputes) that kills informal energy-sharing schemes"
    - topic: "primary persona scope"
      decision: "individuals across many households — open P2P network, not tied to one org/building"
    - topic: "role model"
      decision: "flat model — no admin role for MVP; every user can own a POC, host, and seek charging"
    - topic: "mvp timeline"
      decision: "3-week after-hours MVP; committed, no scope-down needed"
    - topic: "secondary goals"
      decision: "straight-line distance between coordinates (no map/routing) for proximity sorting; filter POCs by power level"
    - topic: "guardrail"
      decision: "ledger must always be exactly balanced — every logged session debits one user and credits another by the identical kWh amount"
    - topic: "user location reference"
      decision: "user enters/updates their own location manually — no device geolocation for MVP"
    - topic: "product framing"
      decision: "web-app; small user scale (a handful of users); no hard deadline; after-hours only"
    - topic: "multiple POCs per user"
      decision: "a single user can own/register more than one POC (FR-004 updated)"
    - topic: "non-goals"
      decision: "no money/payments; no map/routing; no device geolocation; no dispute/confirmation flow for logged sessions"
  frs_drafted: 13
  quality_check_status: accepted
---

# EV Share — Shape Notes

## Vision & Problem Statement

EV owners with access to their own charging point (a home 230V socket, garage,
or dedicated charger) have no practical way to share that idle capacity with
other EV owners who need a charge nearby, nor any fair way to track who has
given or received energy — sharing today happens informally, if at all, with
no record of the exchange and no way to discover who nearby has an available
charger.

A pure kWh balance — no money changing hands — sidesteps the friction that
kills informal energy-sharing schemes (billing, tax, pricing disputes): the
app only needs to be a trusted, shared scorekeeper for energy given and
received between EV owners across many households.

## User & Persona

**Primary persona:** EV owner — an individual across many households (not
tied to one org or building) who alternates between two roles:

- **Host** — offers their private charging point (POC) to nearby EV owners
  when it's available.
- **Seeker** — needs a charge away from home and looks for a nearby available
  POC.

The same person is typically both: they own/manage at least one POC and also
drive an EV that sometimes needs off-home charging.

## Access Control

Login: email + password. Registration is self-service; no email confirmation
step is required before the account is usable.

Flat user model — no roles. Every registered user has the same capabilities:
register/manage their own POC(s), mark a POC available or unavailable, log a
charging session (as the POC owner recording usage by another user), and view
their own balance and transaction history. No admin role for MVP.

Unauthenticated users cannot reach any gated route (balance, POC management,
logging a charge) — they're redirected to login/register.

## Success Criteria

### Primary
- The full loop works end-to-end: a user registers, adds a POC, another user
  finds it and charges there, the POC owner logs the session, and both users'
  balances update by the exact same kWh amount — visible on each user's
  landing page.

### Secondary
- Available POCs can be sorted/shown by straight-line distance between
  coordinates (no map or routing engine — simple point-to-point distance).
- Users can filter available POCs by power level.

### Guardrails
- The ledger must always be exactly balanced: every logged charging session
  debits one user's balance and credits another's by the identical kWh
  amount — no drift, no lost or invented energy.

## User Stories

### US-01: Seeker charges at a host's POC, host logs the session

- **Given** a logged-in user (the seeker) who has traveled to another user's
  (the host's) available POC
- **When** the host logs a charging session for the seeker, specifying the
  kWh used
- **Then** the seeker's balance decreases by that kWh amount, the host's
  balance increases by the same amount, and both changes appear in each
  user's transaction history

#### Acceptance Criteria
- The debit and credit are always equal in magnitude — no drift.
- Only the owner of a POC can log a session for that POC.
- The logged session appears immediately in both users' transaction history.
- A session cannot be logged for zero or negative kWh.

## Functional Requirements

### Authentication
- FR-001: User can register with email and password. Priority: must-have
  > Socrates: Counter-argument considered: "no email verification invites
  > fake accounts / junk listings." Resolution: kept as-is; this is a small
  > trust-based network, not a public marketplace — fraud-proofing is out of
  > MVP scope. Tracked as an accepted limitation.
- FR-002: User can log in with email and password. Priority: must-have
  > Socrates: Counter-argument considered: "no account recovery permanently
  > locks out a user who loses their password." Resolution: kept as-is for
  > MVP; tracked in Open Questions as a v2 candidate (password reset flow).

### Profile & location
- FR-003: User can set/update their own location (manual entry, no device
  geolocation). Priority: must-have
  > Socrates: Counter-argument considered: "manual location goes stale and
  > misleads distance-sorting." Resolution: kept as-is; distance-sorting
  > (FR-012) is nice-to-have, so staleness there is an accepted limitation,
  > not a must-have risk.

### POC management
- FR-004: User can register one or more of their own POCs, each with
  location, power rating, and availability status. Priority: must-have
  > Socrates: Counter-argument considered: "self-reported POC data could be
  > fake or wrong." Resolution: kept as-is; no verification mechanism for
  > MVP — accepted limitation of a trust-based P2P network.
- FR-005: User can mark their own POC as available or unavailable. Priority:
  must-have
  > Socrates: Counter-argument considered: "no auto-timeout risks stale
  > 'available' listings." Resolution: kept as-is; manual toggling only for
  > MVP, accepted limitation.
- FR-006: User can view all POCs and their current availability and details
  (location, power). Priority: must-have
  > Socrates: Counter-argument considered: "exposing exact home locations is
  > a privacy/safety risk." Resolution: kept as-is — full location is
  > necessary for the product to work — but tracked in Open Questions as a
  > candidate for approximate-location display in a later version.

### Charging & balance
- FR-007: POC owner can log a charging session for another user, recording
  how many kWh were used. Priority: must-have
  > Socrates: Counter-argument considered: "one-sided entry invites disputed
  > or erroneous amounts; the seeker can't confirm or contest." Resolution:
  > kept as-is for MVP (simplest workable mechanism); tracked in Open
  > Questions as a v2 candidate (seeker confirmation/dispute flow).
- FR-008: System automatically debits the charged user's balance and credits
  the POC owner's balance by the same kWh amount when a session is logged.
  Priority: must-have
  > Socrates: Counter-argument considered: "inherits FR-007's single point of
  > failure — enforces balance, not correctness of the source number."
  > Resolution: kept as-is; exact balancing (the guardrail) is about ledger
  > consistency, not source-data correctness — the latter is FR-007's open
  > question, not a new one here.
- FR-009: User can view their own current account balance. Priority:
  must-have
  > Socrates: Counter-argument considered: "a bare number with no context can
  > confuse users." Resolution: kept as-is; balance is shown alongside
  > transaction history on the same landing page (FR-011), which supplies
  > the context.
- FR-010: User can view their own transaction history. Priority: must-have
  > Socrates: Counter-argument considered: "unbounded history could get
  > unwieldy over time." Resolution: kept as-is; a scale concern beyond MVP,
  > accepted limitation.

### Landing page
- FR-011: Landing page shows the user's own balance, transaction history,
  and list of available POCs. Priority: must-have
  > Socrates: Counter-argument considered: "combining three views
  > front-loads complexity on the first screen." Resolution: kept as-is; a
  > single combined landing page matches the source notes and keeps
  > navigation minimal for MVP.

### Discovery
- FR-012: User can see POCs sorted by straight-line distance from their own
  location. Priority: nice-to-have
  > Socrates: Counter-argument considered: "unreliable manual location makes
  > this more misleading than helpful." Resolution: kept as nice-to-have;
  > already the lowest-priority tier, so the caveat is accepted rather than
  > dropping it outright.
- FR-013: User can filter POCs by power level. Priority: nice-to-have
  > Socrates: Counter-argument considered: "marginal benefit for the UI
  > complexity it adds." Resolution: kept as nice-to-have; small addition on
  > top of FR-006's POC list, deprioritized below must-haves.

## Business Logic

When a POC owner logs a charging session, the system converts a real-world
energy transfer into a symmetric kWh ledger entry that debits the charged
user and credits the host by the identical amount.

The rule consumes two user-facing inputs: which user was charged, and how
many kWh were used. Its output is a pair of balance changes — one debit, one
credit, always equal in magnitude — plus a transaction record visible to
both parties. The user encounters this rule the moment a charging session is
logged: the seeker sees their balance drop and a new entry appear in their
history, and the host sees the mirror image, both surfaced on each person's
own landing page.

## Non-Functional Requirements

- A user sees acknowledgement of any action (login, marking a POC
  available/unavailable, logging a charging session) within roughly one
  second.

## Non-Goals

- No money, payments, or pricing — the product is a pure kWh balance, never
  currency, billing, or pricing of any kind.
- No map or routing integration — "distance" is a simple straight-line
  calculation between two sets of coordinates, not real-world travel
  distance or turn-by-turn directions.
- No device geolocation — location (for both users and POCs) is always
  manually entered, never read from GPS or browser location APIs.
- No dispute or confirmation flow for logged sessions — the POC owner's
  logged kWh amount is final for MVP; the seeker cannot contest it (tracked
  as an Open Question for a later version).

## Open Questions

1. **Should there be an account-recovery (password reset) flow?** — Not
   captured in MVP scope (FR-002). Owner: user. By: before v2 planning.
2. **Should POC location be shown precisely or approximately?** — FR-006
   currently shows exact location; a privacy/safety concern was raised for
   home addresses. Owner: user. By: before wider rollout beyond a handful of
   users.
3. **Should a seeker be able to confirm or dispute a logged session's kWh
   amount?** — Currently the POC owner's entry is final (see Non-Goals).
   Owner: user. By: v2 candidate.

## Forward: tech-stack

- Reuse the same tech stack as the sibling project `../flats-manager` — the
  user pointed at that project's stack as the baseline for this one. Not a
  PRD concern; for the downstream tech-stack-selection step to read.
- Business logic may optionally integrate AI (e.g. via OpenRouter) but this
  is not required — the core ledger rule (FR-007/FR-008) needs no AI. Any AI
  integration is a downstream stack/implementation choice, not a product
  requirement.

## Forward: technical-roadmap

- The project requires context documents beyond the PRD (e.g.
  `infrastructure.md`, `roadmap.md`) — downstream of `/10x-prd`.
- The project requires at least one automated end-to-end (e2e) test
  verifying the primary flow (US-01) from a user's perspective — a testing
  concern for implementation planning, not the PRD itself.
