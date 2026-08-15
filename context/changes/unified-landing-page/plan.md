# Unified Landing Page Implementation Plan

## Overview

Polish layer on top of S-02's (`log-session-and-balance-ledger`) landing-page data wiring: establishes the visual hierarchy (balance → history → POC list), gives transaction history rows a signed/colored credit-vs-debit treatment, adds a friendly empty state for a brand-new user's history, and lightly styles the anonymous sign-in/sign-up prompt. This is roadmap slice **S-03**, covering FR-011 and US-01's "visible on each user's landing page" clause.

## Current State Analysis

- S-01 (`poc-registration-and-listing`) is fully implemented (`impl_reviewed`): `pocs` schema/RLS, `Poc` type, `listPocs`, `PocList.tsx` (a React island — it's interactive, with availability toggles).
- S-02 (`log-session-and-balance-ledger`) has a written plan but is **not yet implemented** (status `planned`, all Progress checkboxes unchecked). Its plan already:
  - Adds `ChargingSession` to `src/types.ts` and `computeBalance(sessions, userId): number` to `src/lib/sessions.ts`.
  - Rewrites `src/pages/index.astro` (currently still the starter's placeholder `Welcome` component) into a page that, when signed in, shows a balance + history section above the public POC list, and when signed out, shows just the POC list plus a sign-in/sign-up prompt.
  - Plans a droppable Phase 4 (full e2e US-01 spec) that asserts on `data-testid` attributes it expects its own Phase 3 to have added to "the balance/history elements."
- Given that overlap, this plan is scoped as **polish only**: it assumes S-02's Phase 1 (types) and Phase 3 (initial `index.astro` wiring) have already landed, and layers hierarchy/visual treatment on top — it does not re-specify or duplicate S-02's data wiring, API, or schema work.
- Existing UI conventions this plan follows: `Card`/`CardContent` (shadcn, "new-york" variant), a "cosmic" glass theme (`bg-cosmic`, `bg-white/10`, `backdrop-blur-xl`, gradient-text headings — see `src/pages/dashboard.astro`, `src/pages/dashboard/pocs.astro`), an established empty-state pattern (`PocList.tsx`'s "No POCs registered yet." with `data-testid="poc-list-empty"`), and an established error-color triad (`text-red-300` / `border-red-500/30` / `bg-red-900/30`, see `ServerError.tsx`) that this plan mirrors with an `emerald` equivalent for credits.
- Per `CLAUDE.md`'s architecture split — "Astro components for layout/structure, React islands for interactive pieces" — the two new presentational pieces this plan adds have no client-side state or handlers, so they're built as plain `.astro` components, not React islands.

## Desired End State

A signed-in user visiting `/` sees, top to bottom: a prominent balance card showing their current kWh balance, a transaction history section listing every session they're party to (newest first) with a signed, colored amount (`+X kWh` in emerald when they were the host, `-X kWh` in red when they were the seeker), the counterparty's email, the POC involved, and a timestamp — or, if they have no sessions yet, a friendly empty-state message linking to `/dashboard/pocs`. Below that, the existing public POC list. A signed-out visitor sees a styled sign-in/sign-up prompt card above the same public POC list. All sections use the existing cosmic glass-card styling and the `max-w-2xl mx-auto` centered container already established in `dashboard/pocs.astro`, so the layout stacks cleanly on mobile with no new breakpoints.

**Verification**: manually check `/` in three states — signed out, signed in with zero sessions, and signed in with existing sessions (as both host and seeker) — confirming section order, empty-state copy/links, and correct sign/color per row.

### Key Discoveries:

- `context/changes/log-session-and-balance-ledger/plan.md` Phase 1 §4 — `ChargingSession` shape: `id`, `pocId`, `hostId`, `hostEmail`, `seekerId`, `seekerEmail`, `kwh`, `createdAt`, embedded `poc: Pick<Poc, "id" | "latitude" | "longitude" | "powerRatingKw">`.
- `context/changes/log-session-and-balance-ledger/plan.md` Phase 4 §3 — its own (still-pending) e2e spec plans to assert against `data-testid` attributes it expects on "the balance/history elements" added in its Phase 3 — this plan must land on stable, compatible test-id names rather than inventing its own scheme.
- `src/components/pocs/PocList.tsx:45-51` — the empty-state pattern to mirror: a plain `<p data-testid="...-empty">` message, no card wrapper.
- `src/pages/dashboard/pocs.astro:20` — the `max-w-2xl mx-auto space-y-6` container convention this plan reuses rather than introducing new responsive breakpoints.

## What We're NOT Doing

- No changes to data, schema, API routes, or `src/lib/sessions.ts`/`src/lib/pocs.ts` — all owned by S-01/S-02.
- No new marketing/value-prop copy for anonymous visitors — light styling of the sign-in/sign-up prompt only, per the agreed scope.
- No distance-sorting or power-level filtering (FR-012/FR-013) — parked in the roadmap.
- No changes to `/dashboard/pocs` or `/dashboard/sessions` pages.
- No automated visual-regression or component tests — none exist in this repo; verification is manual.
- No implementation before S-02's Phase 1 and Phase 3 have landed — there's nothing to layer polish onto until then.

## Implementation Approach

Two small, non-interactive `.astro` components (`BalanceSummary`, `TransactionHistoryList`) slot into `index.astro` in place of whatever minimal markup S-02's Phase 3 produces for the balance/history section, applying the agreed hierarchy and empty/color treatment. The POC list section and anonymous-view branching structure S-02 establishes are preserved as-is; only the balance/history presentation and the anonymous prompt's styling change.

## Critical Implementation Details

- **Presentational, not interactive — stay Astro, not React**: `BalanceSummary` and `TransactionHistoryList` only read server-provided props and render markup; no `client:*` directive, unlike `PocList.tsx` (which needs React for its availability-toggle state). Shipping these as `.astro` avoids unnecessary client JS for what is otherwise a read-only summary.
- **Preserve S-02 Phase 4's planned e2e hooks**: S-02's own (still-pending) Phase 4 plans to assert on `data-testid` attributes for "the balance/history elements." This plan must keep `data-testid="history-list"` and add a stable `data-testid="balance-amount"` on the rendered number, so that spec — whenever it's implemented, before or after this plan — has a consistent hook to assert against rather than a naming mismatch.
- **Implementation is blocked on S-02**: this plan cannot be type-checked or built until S-02's Phase 1 (`ChargingSession`, `computeBalance`) and Phase 3 (`index.astro`'s initial data wiring) exist in the codebase.

## Phase 1: Landing Page Presentation Layer

### Overview

Adds the two presentational components and applies the hierarchy/styling to `index.astro` for both the signed-in and anonymous views.

### Changes Required:

#### 1. Balance summary component

**File**: `src/components/landing/BalanceSummary.astro` (new)

**Intent**: Presents the signed-in user's derived balance as a prominent card at the top of the landing page.

**Contract**: Props `{ balanceKwh: number }`. Renders inside the existing cosmic glass-card treatment (`rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl`, gradient-text heading) with the formatted balance (`balanceKwh.toFixed(2)` + " kWh") as the visually dominant element. Container `data-testid="balance-summary"`; the number element `data-testid="balance-amount"`.

#### 2. Transaction history component

**File**: `src/components/landing/TransactionHistoryList.astro` (new)

**Intent**: Renders the signed-in user's own sessions (newest first) with a signed, colored amount distinguishing host (credit) from seeker (debit) roles, and an empty state when there are none yet.

**Contract**: Props `{ sessions: ChargingSession[]; currentUserId: string }`. Per session: direction is credit when `session.hostId === currentUserId`, debit otherwise; render `+{kwh} kWh` in an emerald tone (`text-emerald-300`, mirroring the existing `text-red-300` error convention) for credit, `-{kwh} kWh` in `text-red-300` for debit; counterparty email is the other party's `hostEmail`/`seekerEmail`; POC context follows `PocList`'s coordinate display convention (`{latitude}, {longitude} · {powerRatingKw} kW`); timestamp via `toLocaleString()`. Root `data-testid="history-list"`; each row `data-testid="history-row-{session.id}"`. When `sessions.length === 0`, render `data-testid="history-empty"` with the message "No sessions yet — register a charging point to start hosting." linking to `/dashboard/pocs`, mirroring `PocList`'s bare-message empty-state pattern (no card wrapper).

#### 3. Landing page hierarchy and anonymous-view styling

**File**: `src/pages/index.astro` (modified — assumes S-02's Phase 1 + Phase 3 have already landed)

**Intent**: Apply the agreed visual order and styling on top of S-02's existing branching (`Astro.locals.user` present vs. absent).

**Contract**: When `user` is present, render in order — each in its own cosmic-styled card, inside the existing `max-w-2xl mx-auto space-y-6` container convention from `dashboard/pocs.astro` — `<BalanceSummary balanceKwh={computeBalance(sessions, user.id)} />`, `<TransactionHistoryList sessions={sessions} currentUserId={user.id} />`, then the existing POC list card (`<PocList client:load />` as S-02 wires it, unchanged). When `user` is absent, render a styled sign-in/sign-up prompt card (same glass-card treatment, gradient-text heading, links to `/auth/signin` and `/auth/signup`, no new marketing copy) above the POC list card.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Type-check passes: `npx astro check`

#### Manual Verification:

- Signed out, visiting `/`: the styled sign-in/sign-up prompt card renders above the public POC list; both links navigate correctly.
- Signed in with zero sessions: balance shows "0.00 kWh"; history section shows the empty state with a working link to `/dashboard/pocs`.
- Signed in with existing sessions (as both host and seeker across different sessions): balance hero shows the correct derived number; history rows show the correct sign/color, counterparty email, POC, and timestamp per row, newest first.
- Section order (balance → history → POC list) holds at both a desktop-width and a narrow mobile-width viewport, with no horizontal scrolling or overlap.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Manual Testing Steps:

1. Sign out and visit `/`: confirm the styled prompt card and POC list below it.
2. Register a brand-new account with no sessions, visit `/`: confirm "0.00 kWh" and the history empty state.
3. As an existing host (from S-02's manual testing), visit `/`: confirm the balance and an emerald `+X kWh` row for a session where this user hosted.
4. As the seeker in that same session, visit `/`: confirm a red `-X kWh` row and the balance decreased by the identical amount.
5. Resize the browser to a mobile width and re-check all three states for layout integrity.

## Performance Considerations

Both new components are non-interactive `.astro` components with no `client:*` directive — no additional client-side JS is shipped beyond what S-02's `PocList` island already sends.

## Migration Notes

No schema or data changes. Purely presentational; no rollback concerns beyond a normal code revert.

## References

- Roadmap slice: `context/foundation/roadmap.md` § S-03
- PRD requirement: `context/foundation/prd.md` § FR-011, § US-01
- Prerequisite plan (must land first): `context/changes/log-session-and-balance-ledger/plan.md`
- Empty-state pattern: `src/components/pocs/PocList.tsx:45-51`
- Container/card convention: `src/pages/dashboard/pocs.astro`
- Error-color convention mirrored for credits: `src/components/auth/ServerError.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Landing Page Presentation Layer

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — 82df5fe
- [x] 1.2 Build passes: `npm run build` — 82df5fe
- [x] 1.3 Type-check passes: `npx astro check` — 82df5fe

#### Manual

- [x] 1.4 Signed-out `/` shows the styled prompt card above the POC list, links work — 82df5fe
- [x] 1.5 Zero-session signed-in user sees "0.00 kWh" and the history empty state with a working link — 82df5fe
- [x] 1.6 Populated signed-in user sees correct balance and correctly signed/colored history rows, newest first — 82df5fe
- [x] 1.7 Section order holds at desktop and mobile widths with no layout issues — 82df5fe
