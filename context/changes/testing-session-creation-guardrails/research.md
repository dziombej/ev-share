---
date: 2026-08-16T11:06:52+02:00
researcher: Lukasz Dabrowski
git_commit: d3c8fb1e465598be2d727c67714ba6865075a950
branch: main
repository: dziombej/ev-share
topic: "Test risk: a charging session is logged with zero, negative, or non-numeric kWh and is accepted, corrupting the ledger"
tags: [research, codebase, sessions, validation, zod, ledger]
status: complete
last_updated: 2026-08-16
last_updated_by: Lukasz Dabrowski
last_updated_note: "Corrected an Infinity-handling claim after verifying against the actually-installed zod version during /10x-plan"
---

# Research: Zero/negative/non-numeric kWh accepted into the ledger

**Date**: 2026-08-16T11:06:52+02:00
**Researcher**: Lukasz Dabrowski
**Git Commit**: d3c8fb1e465598be2d727c67714ba6865075a950
**Branch**: main
**Repository**: dziombej/ev-share

## Research Question

For test-plan Risk #1 ("A charging session is logged with zero, negative, or non-numeric kWh and is accepted, corrupting the ledger"): where is kWh validated today, is any of it under automated test, and what should a test targeting this risk actually assert?

## Summary

kWh is validated at **three independent layers**, in this order of execution: client-side JS (UX only, trivially bypassable), a `zod` schema in the API route (`z.coerce.number().positive().max(500)`), and a Postgres `CHECK` constraint (`kwh > 0 and kwh <= 500`) on the `charging_sessions` table. The zod check runs *before* any Supabase client is created and before `logSession` is called, so an invalid submission never reaches the database. The DB constraint is the only layer that cannot be bypassed by application code.

**No automated test exercises any of this today.** The one e2e spec covering this flow (`e2e/specs/log-session-flow.spec.ts`) is happy-path only, using a single hardcoded value (`kwh = 7.25`). The invalid-kWh rejection behavior (0, negative, >500) was verified once, manually, during implementation (`context/changes/log-session-and-balance-ledger/plan.md` checklist items), and never turned into a repeatable test. No unit/integration test runner is installed at all — `package.json` has only `@playwright/test`.

There is no "debit/credit drift" failure mode to guard against separately: balance is never stored, only derived by summing `kwh` across `charging_sessions` rows at read time (`computeBalance` in `src/lib/sessions.ts:91-97`). So this risk collapses to a single question — **can a bad numeric value get into the one `INSERT` that `logSession` performs?** — not an atomicity/partial-write question.

The oracle for "what counts as valid" is unambiguous and consistent across three sources: PRD FR-007 acceptance criteria ("A session cannot be logged for zero or negative kWh"), the shipped DB constraint (`kwh > 0 and kwh <= 500`), and the plan's explicit interview decision to bound at 500 as "cheap defense-in-depth against fat-finger entry" (`plan-brief.md:27`).

## Detailed Findings

### Validation layers, in execution order

1. **Client-side (`src/components/sessions/LogSessionForm.tsx:82-100`)** — hand-written `validate()`: `!kwh.trim() || Number.isNaN(amount) || amount <= 0 || amount > 500`. The `<input>` has `type="number" step="any"` but no `min`/`max` HTML attributes, and the `<form>` sets `noValidate`, so even native browser constraint validation is explicitly disabled — this layer is pure custom JS, bypassable by any direct POST to the endpoint.
2. **API route (`src/pages/api/sessions/create.ts:8-13`, applied at line 26)** — `z.coerce.number().positive().max(500)` against the raw `FormData` string (`form.get("kwh")`). Confirmed by direct read of the full 52-line file: validation (`logSessionSchema.safeParse`, lines 26-31) happens *before* `createClient` is called (line 38) and before `logSession` (line 44) — an invalid submission returns early via redirect at lines 33-36 and never touches Supabase.
3. **Service layer (`src/lib/sessions.ts`, `logSession`)** — performs **no independent runtime check** on `kwh`. It trusts the `LogSessionInput` TypeScript type (`kwh: number` in `src/types.ts:35`), which is a compile-time-only guarantee. If any other call site ever invoked `logSession` directly (bypassing the API route), the zod check would not run — only the DB constraint would catch it.
4. **Database (`supabase/migrations/20260815120000_create_charging_sessions.sql:11`)** — `kwh numeric(6, 2) not null check (kwh > 0 and kwh <= 500)`. This is the only layer independent of application code; it fires on every `INSERT` regardless of caller.

`logSessionSchema` is a **module-private `const`, not exported** from `create.ts` — a unit test cannot import it directly today without either exporting it or driving the full `POST` handler.

### What each layer does and doesn't catch

| Input | Client JS | API zod | DB constraint |
|---|---|---|---|
| `0` | rejected (`amount <= 0`) | rejected (`.positive()`) | rejected (`kwh > 0`) |
| negative | rejected | rejected | rejected |
| non-numeric string (`"abc"`) | rejected (`Number.isNaN`) | rejected — `Number("abc")` → `NaN`, fails zod's base number check | would error at the Postgres driver level (invalid input syntax for `numeric`) |
| missing/blank | rejected (`!kwh.trim()`) | rejected *indirectly* — `form.get("kwh")` → `null` → `z.coerce.number()` → `Number(null)` → `0` → fails `.positive()` | `not null` |
| `> 500` | rejected | rejected (`.max(500)`) | rejected (`kwh <= 500`) |
| `"Infinity"` | not explicitly checked, but `amount > 500` catches it | passes the base `number`/`.positive()` checks (Infinity is not NaN and is `> 0`), **caught only by `.max(500)`** | would error on insert (numeric overflow) |

~~The `"Infinity"` row is the one case where rejection depends specifically on the `.max()` bound rather than a `.finite()`-style guard~~ — **corrected below, see Follow-up Research**: this was true for zod v3 but not for the v4.4.3 actually installed in this repo.

### Ledger-corruption framing (why atomicity isn't a separate risk)

`charging_sessions` stores one immutable row per session; balance is derived (`computeBalance`, `src/lib/sessions.ts:91-97`) by summing `+kwh` where the user is host and `-kwh` where the user is seeker. There is exactly one `INSERT` (`src/lib/sessions.ts:56-67`) — no second write path for balance to drift from. This was an explicit design decision (`plan.md:5,41`; `plan-brief.md:22`): "drift is structurally impossible rather than something to enforce." Confirms Risk #1 (bad value in) and Risk #4 (drift on edge-case amounts, per test-plan.md) are actually the same underlying single-insert path, just probing different value ranges.

### Current test coverage — none for this risk

- `e2e/specs/log-session-flow.spec.ts` — single test, single hardcoded valid value (`kwh = 7.25`, line 41). No variant tests zero/negative/non-numeric/oversized kWh.
- `package.json` — only `@playwright/test` installed; no `vitest`/`jest`; no `*.test.ts`/`*.spec.ts` files exist outside `e2e/`.
- `context/changes/log-session-and-balance-ledger/plan.md` — invalid-kWh rejection was checked off as done via **manual** verification during implementation (checklist items at `plan.md:339`, `plan.md:356`, referencing commits `901730c`/`d4de67b`), and manual QA steps at `plan.md:156,226,291`. None of this became an automated regression test.
- `context/changes/log-session-and-balance-ledger/reviews/impl-review.md:109` — the implementation review confirms the zod/DB dual-layer validation is sound as *implemented*, but explicitly notes "No unit test runner is configured in this repo" and that the only automated coverage is the Phase 4 e2e happy-path spec.

## Code References

- `src/pages/api/sessions/create.ts:8-13` — zod schema, `kwh: z.coerce.number().positive().max(500)`
- `src/pages/api/sessions/create.ts:25-36` — validation runs before Supabase client creation; early-return redirect on failure
- `src/pages/api/sessions/create.ts:38,44` — Supabase client creation and `logSession` call, both *after* validation
- `src/lib/sessions.ts:31-36` — `logSession` signature; no independent kwh re-validation in this function
- `src/lib/sessions.ts:48-54` — ownership and self-charge checks (not kwh-related, but same function)
- `src/lib/sessions.ts:56-67` — the single `INSERT` into `charging_sessions`
- `src/lib/sessions.ts:91-97` — `computeBalance`, pure derivation, no stored balance
- `src/components/sessions/LogSessionForm.tsx:82-100` — client-side `validate()`
- `src/components/sessions/LogSessionForm.tsx:139` — `<form noValidate>`, native constraint validation disabled
- `src/types.ts:35` — `LogSessionInput.kwh: number` (compile-time only)
- `supabase/migrations/20260815120000_create_charging_sessions.sql:11` — DB check constraint `kwh > 0 and kwh <= 500`
- `e2e/specs/log-session-flow.spec.ts:41` — the only kWh value ever exercised by an automated test (`7.25`)
- `context/changes/log-session-and-balance-ledger/plan.md:65,141,156,226,291,339,356`
- `context/changes/log-session-and-balance-ledger/plan-brief.md:27` — "kWh bound capped at 500... cheap defense-in-depth against fat-finger entry"
- `context/changes/log-session-and-balance-ledger/reviews/impl-review.md:109`

## Architecture Insights

- This codebase follows the same "form-POST + `?error=` redirect" convention CLAUDE.md documents for auth routes — the sessions API route is not a JSON API either, which shapes how a route-level test must invoke it (construct a fake `APIContext`, read the redirect URL, not a JSON body).
- Defense-in-depth is a deliberate, named pattern here (self-charge/ownership checks are described the same way in `plan.md:46`) — kWh bounds follow the identical shape: app-level zod check backed by a DB check constraint, both treated as authoritative, not one primary + one decorative.
- Because validation precedes any DB/Supabase interaction in the route handler, a hermetic unit test of the rejection path needs **no Supabase stub at all** — it only needs a fake `APIContext` (locals.user, request.formData(), redirect, cookies) and can assert the redirect happened before reaching `createClient`/`logSession`.

## Historical Context (from prior changes)

- `context/changes/log-session-and-balance-ledger/plan.md` is the origin of every current validation rule (kwh bound, self-charge, ownership) — all shipped exactly as planned per `change.md`'s impl-review summary.
- `context/changes/poc-contact-and-management/plan.md:329` shows the zod schema being touched later (seeker email → combobox/`seekerId` rework) but the `kwh` rule was left untouched — confirms no drift in the validation rule itself since it first shipped.
- No prior change or review anywhere discusses `z.coerce.number()`'s behavior on non-numeric strings, `Infinity`, or scientific-notation strings explicitly — this is a genuine gap, not a re-tread of already-covered ground.

## Related Research

None yet under `context/changes/**/research.md` or `context/archive/**/research.md` — this is the first research artifact for this risk/phase.

## Open Questions

1. ~~Should `logSession` (`src/lib/sessions.ts`) gain its own defensive kwh check~~ — resolved during `/10x-plan`: out of scope, this rollout only adds tests for existing behavior.
2. ~~`logSessionSchema` is not exported from `create.ts`~~ — resolved during `/10x-plan`: extract the schema into a new pure module (`src/lib/validation/session.ts`) with no Astro/Supabase imports, rather than exporting it in place or driving tests through the full `POST` handler.
3. No test runner is installed (`vitest`/`jest` absent) — `/10x-plan`'s Phase 1 will need an environment-setup step before any assertion-writing phase, consistent with test-plan.md §4's "none yet — see Phase 1" row. Confirmed during `/10x-plan`: the route file transitively imports `astro:env/server` (via `src/lib/supabase.ts:3` and `src/lib/config-status.ts:1`), an Astro virtual module plain Vitest cannot resolve — this is exactly why the schema needs to move to a pure module rather than being tested in place.

## Follow-up Research 2026-08-16 (during `/10x-plan`)

**Correction**: the "Infinity" row in the validation-layers table above was wrong about zod's behavior in this specific installation. Traced directly against the resolved `zod@4.4.3` source (not v3, which this repo does not use):

- `node_modules/zod/v4/core/schemas.js:487-516`, the shared base check used by both `z.number()` and `z.coerce.number()` (via `_coercedNumber` in `node_modules/zod/v4/classic/coerce.js:6-7`):
  ```js
  if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
    return payload;
  }
  ```
- **zod v4 rejects `Infinity`/`-Infinity` unconditionally in the base number check** — finite-by-default, no `.finite()` needed. (v3's base check allowed Infinity through and only `.finite()` caught it — the original table row described v3 behavior, not what's actually installed.)
- Corrected row: `"Infinity"` → rejected by the **base zod check itself** (v4's implicit finite constraint), not by `.max(500)`. The `.max(500)` bound is now redundant for this specific case, though still the operative bound for large-but-finite values like `600`.

This changes what a test should assert: don't assert "Infinity is rejected because it exceeds 500" (implies a numeric comparison) — assert "Infinity is rejected by schema validation" without asserting *which* internal rule caught it, since that's zod-version-dependent and not a stable contract to pin a test to.

**Confirmed greenfield for Vitest**: no `getViteConfig` usage anywhere in the repo (`astro.config.mjs` uses plain `defineConfig`); `src/lib/` is flat with no `validation/`/`schemas/` subfolder precedent yet; every existing API route (`pocs/create.ts`, `sessions/create.ts`, `pocs/[id]/power.ts`, `pocs/[id]/toggle.ts`, `profile/location.ts`) defines its zod schema inline — none extracted to `src/lib/` today, so this plan's extraction is a new, first-of-its-kind pattern, not a deviation from an existing one.
