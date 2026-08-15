# Unified Landing Page — Plan Brief

> Full plan: `context/changes/unified-landing-page/plan.md`

## What & Why

Polish layer on top of S-02's landing-page data wiring: visual hierarchy (balance → history → POC list), signed/colored transaction rows, empty states, and a lightly styled anonymous prompt. This is roadmap slice S-03, covering FR-011 and US-01's "visible on each user's landing page" clause.

## Starting Point

S-01 is fully implemented. S-02 (`log-session-and-balance-ledger`) has a written plan but is **not yet implemented** — and its own plan already rewrites `index.astro` into a page with balance/history (signed in) and a public POC list + sign-in prompt (signed out). Because of that overlap, this plan is scoped as pure UI polish on top of S-02's data wiring, not a re-build of it.

## Desired End State

A signed-in user sees, top to bottom: a prominent balance card, a transaction history list (signed `+`/`-` amounts, colored emerald/red, counterparty + POC + timestamp, newest first, with a friendly empty state for brand-new users), then the public POC list. A signed-out visitor sees a styled sign-in/sign-up prompt above the same POC list.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Relationship to S-02 | Polish-only, deferred until S-02 ships | S-02's own plan already builds the full data wiring for FR-011; avoids duplicated/contradictory work | Plan (user Q&A) |
| Section hierarchy | Balance hero → history → POC list | Matches FR-011's priority order and the PRD's framing of balance as the core number | Plan (user Q&A) |
| Transaction row treatment | Signed amount + color (`+kWh` emerald / `-kWh` red) | Immediately scannable, a familiar ledger convention | Plan (user Q&A) |
| Empty states | Friendly message + link to the action that fills it | Guides new users to their next step, reuses `PocList`'s existing pattern | Plan (user Q&A) |
| Anonymous view scope | Light polish of the existing prompt only, no new marketing copy | Keeps scope tight and consistent with "polish, not new features" | Plan (user Q&A) |
| Verification approach | Manual browser walkthrough per state (signed-out, zero-data, populated) | No visual-regression tooling exists in this repo | Plan (user Q&A) |
| Component technology | Plain `.astro` components, not React islands | Both pieces are non-interactive; avoids shipping unnecessary client JS per `CLAUDE.md`'s Astro/React split | Plan |

## Scope

**In scope:** `BalanceSummary.astro`, `TransactionHistoryList.astro`, `index.astro` layout/hierarchy + anonymous-prompt styling.

**Out of scope:** any data/schema/API work (owned by S-01/S-02), new marketing copy, distance-sorting/power filtering (parked), automated visual-regression tests.

## Architecture / Approach

Two small, non-interactive `.astro` components slot into `index.astro` in place of S-02's minimal balance/history markup, preserving S-02's existing branching (`Astro.locals.user` present vs. absent) and its planned `data-testid` hooks for a future e2e spec.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Landing Page Presentation Layer | Balance hero, colored history rows + empty state, POC list reuse, styled anonymous prompt | Cannot be built/type-checked until S-02's Phase 1 + Phase 3 land — nothing to layer polish onto until then |

**Prerequisites:** S-02 (`log-session-and-balance-ledger`) Phase 1 (types) and Phase 3 (`index.astro` wiring) must be implemented first. S-01 is already done.
**Estimated effort:** ~1 session, single phase — small, UI-only scope.

## Open Risks & Assumptions

- Assumes S-02 lands roughly as currently planned (its `ChargingSession` shape, `computeBalance` signature, and the presence of a sign-in/sign-up prompt on the anonymous view). If S-02's implementation diverges from its own plan, this plan's Phase 1 contract may need light adjustment.
- Assumes S-02's still-pending Phase 4 e2e spec (if ever implemented) will look for `data-testid="history-list"` and a stable balance-amount hook — this plan introduces `data-testid="balance-amount"` to match that expectation, but the exact name wasn't fixed in S-02's own plan text, only implied.

## Success Criteria (Summary)

- Balance, history, and POC list render in the agreed order with correct empty states for a brand-new user.
- Transaction rows are correctly signed and colored per host/seeker role, for both parties in a session.
- The anonymous view shows a styled sign-in/sign-up prompt with no functional or data changes.
