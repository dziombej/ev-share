# Session-Creation kWh Guardrails — Implementation Plan

## Overview

Close test-plan.md Risk #1 ("A charging session is logged with zero, negative, or non-numeric kWh and is accepted, corrupting the ledger") with automated, hermetic test coverage. This is also the first unit test in the repo, so this plan additionally stands up Vitest and establishes the extraction pattern future unit tests should follow.

## Current State Analysis

kWh is validated at three layers today (client JS, API-route `zod` schema, DB `CHECK` constraint — see `research.md` §"Detailed Findings"), but **none of it has automated regression coverage**. The one e2e spec covering this flow (`e2e/specs/log-session-flow.spec.ts`) exercises a single hardcoded valid value; invalid-kWh rejection was verified once, manually, during the original implementation and never turned into a repeatable test. No unit-test runner exists in the repo at all (`package.json` has only `@playwright/test`).

The validation schema that needs testing (`logSessionSchema`, `src/pages/api/sessions/create.ts:8-13`) is a private `const`, and the route file that contains it transitively imports `astro:env/server` (via `src/lib/supabase.ts:3`) — a virtual module plain Vitest cannot resolve. Every other zod-using API route in this repo (`pocs/create.ts`, `pocs/[id]/power.ts`, `pocs/[id]/toggle.ts`, `profile/location.ts`) has the same inline-schema shape; there is no existing schema-extraction precedent to follow, so this plan establishes one.

## Desired End State

- Vitest is installed and runnable via `npm run test:unit`.
- The kWh (and sibling-field) validation schema for logging a session lives in a pure module with zero Astro/Supabase imports, importable by a plain Vitest test with no virtual-module resolution needed.
- A parameterized unit-test suite proves: a valid kWh value is accepted (and coerced correctly), and zero, negative, non-numeric, missing, over-500, and non-finite (`Infinity`) values are all rejected.
- `test-plan.md` §6.1/§6.4 document the pattern so the next contributor adding a unit test (or extracting another route's schema) doesn't have to rediscover any of this.

**Verification**: `npm run test:unit` exits 0 and its output lists each kWh case individually (not one aggregate assertion); `npm run lint` and the existing `npm run test:e2e` (`log-session-flow.spec.ts`) still pass after the route refactor.

### Key Discoveries:

- `src/pages/api/sessions/create.ts:25-36` — validation runs _before_ `createClient`/`logSession` are called, so the rejection path never touches Supabase — confirmed no DB stub is needed for these tests.
- `node_modules/zod/v4/core/schemas.js:487-516` — the `zod@4.4.3` actually installed in this repo rejects `Infinity`/`-Infinity` unconditionally in its base number check (finite-by-default). This is a v4 behavior, not v3's — see `research.md`'s Follow-up Research section. Tests must assert generic rejection for `Infinity`, not "rejected via `.max(500)`".
- `src/lib/` (`config-status.ts`, `database.types.ts`, `pocs.ts`, `profile.ts`, `sessions.ts`, `supabase.ts`, `users.ts`, `utils.ts`) is flat — no `validation/`/`schemas/` subfolder exists yet.
- `tsconfig.json:9-11` — the `@/*` → `./src/*` path alias is not automatically understood by Vitest; it needs an explicit `resolve.alias` (or equivalent) in `vitest.config.ts`.

## What We're NOT Doing

- **Risk #2 (ownership/authorization)** — test-plan.md's Phase 1 names this alongside Risk #1, but it wasn't researched this pass and needs its own research before it can be planned; tracked as a follow-up, not folded into this plan.
- **Defensive kwh re-validation inside `logSession()`** (`src/lib/sessions.ts`) — the service layer currently trusts the API route validated first; this plan only adds tests for existing behavior, not new production guardrails.
- **A route-level wiring/integration test** — the extracted schema's unit tests already give full signal on the validation rule itself; a redirect-and-assert-`?error=` test on the full `POST` handler would mostly protect against a wiring typo, which `astro check`/TypeScript already catches via the schema-shape contract between `create.ts` and the new module.
- **Risk #4 (decimal/large-value drift at the boundary)** — explicitly test-plan.md Phase 2 scope, not Phase 1.

## Implementation Approach

Add Vitest with a minimal, plain (non-Astro) config. Extract `logSessionSchema` verbatim into `src/lib/validation/session.ts` so it has no Astro/Supabase imports and is trivially importable by Vitest. Refactor `create.ts` to import it (no behavior change). Write one parameterized (`it.each`) test file next to the new module. Update the test-plan cookbook so this pattern is documented before a second unit test ever needs to reinvent it.

## Critical Implementation Details

- **Path alias resolution**: Vitest does not read `tsconfig.json`'s `paths` automatically. `vitest.config.ts` needs an explicit `resolve.alias` mapping `@` → `<repo-root>/src`, even though the Phase 2/3 module itself only imports `zod` — future unit tests under `src/lib/` will need the same alias to import sibling modules (e.g. `@/lib/database.types`), so set it up correctly now rather than only for the immediate need.
- **zod v4 Infinity semantics**: don't assert _which_ internal rule rejects `Infinity` (base check vs. `.max()`) — that's zod-version-dependent (see Key Discoveries). Assert only that `.safeParse(...).success` is `false`.

## Phase 1: Vitest environment setup

### Overview

Install Vitest, wire a minimal config (path alias, node environment), add npm scripts, and prove the harness works with one small smoke test before any real validation logic is touched.

### Changes Required:

#### 1. Add Vitest dependency and scripts

**File**: `package.json`

**Intent**: Add the project's first unit-test runner, at a version compatible with the `vite` `^7.3.2` override already pinned in this repo, and expose it via scripts that mirror the existing `test:e2e`/`test:e2e:ui` naming.

**Contract**: add `"vitest": "^4.1.10"` to `devDependencies`; add `"test:unit": "vitest run"` and `"test:unit:watch": "vitest"` to `scripts`.

#### 2. Vitest configuration

**File**: `vitest.config.ts` (new, repo root)

**Intent**: Minimal, plain Vite config (no Astro integration needed — the modules under test in this plan have zero Astro imports) that resolves the `@/*` alias and runs in a `node` environment.

**Contract**:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: { environment: "node" },
});
```

#### 3. Smoke test

**File**: `src/lib/utils.test.ts` (new)

**Intent**: Prove the harness (runner, path alias, TypeScript transform) works end-to-end before Phase 2/3 build the real coverage on top of it, using an existing pure function (`cn()`) so nothing is invented just to be thrown away.

**Contract**: import `cn` from `@/lib/utils`; assert it merges/dedupes a couple of Tailwind class-name inputs the way `tailwind-merge` is documented to (e.g. a later conflicting class wins over an earlier one).

### Success Criteria:

#### Automated Verification:

- `npm run test:unit` exits 0 and runs the smoke test
- `npm run lint` passes
- `npx astro check` (or `npm run build`) passes — confirms `vitest.config.ts`'s types don't break the project's TypeScript config

#### Manual Verification:

- Skim the Vitest terminal output once to confirm it reports the smoke test by name, not just a bare pass/fail count

---

## Phase 2: Extract the session-validation schema

### Overview

Move `logSessionSchema` out of the API route into a pure module with zero Astro/Supabase imports, with no behavior change, so it becomes directly unit-testable.

### Changes Required:

#### 1. New validation module

**File**: `src/lib/validation/session.ts` (new)

**Intent**: Single source of truth for the "log a charging session" request shape, decoupled from the Astro route so it can be imported by a plain Vitest test.

**Contract**: exports `logSessionSchema`, the exact same zod object currently at `src/pages/api/sessions/create.ts:8-13` (`pocId: z.uuid()`, `seekerId: z.uuid()`, `seekerEmail: z.email()`, `kwh: z.coerce.number().positive().max(500)`) — copied verbatim, no rule changes.

#### 2. Route uses the extracted schema

**File**: `src/pages/api/sessions/create.ts`

**Intent**: Consume the schema from its new home instead of defining it locally; no behavior change.

**Contract**: remove the inline `const logSessionSchema = z.object({...})` (current lines 8-13); add `import { logSessionSchema } from "@/lib/validation/session";`. The `logSessionSchema.safeParse(...)` call site (current line 26) and everything else in the file is unchanged.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npx astro check` (or `npm run build`) passes
- `npm run test:unit` still passes (Phase 1's smoke test)

#### Manual Verification:

- Run `npm run test:e2e` (requires `npx supabase start`) and confirm `log-session-flow.spec.ts` still passes — proves the extraction didn't change the route's real behavior

---

## Phase 3: kWh guardrail unit tests

### Overview

Write the parameterized test suite that actually closes Risk #1 — the first automated proof that invalid kWh values are rejected before any balance mutation.

### Changes Required:

#### 1. Unit tests for the extracted schema

**File**: `src/lib/validation/session.test.ts` (new)

**Intent**: Prove, for a fixed valid baseline of the non-kwh fields, that `logSessionSchema.safeParse(...)` accepts a valid kWh value (with correct numeric coercion) and rejects zero, negative, non-numeric, missing, over-500, and non-finite kWh — the exact set test-plan.md Risk #1 names, plus the `Infinity` edge case this plan's research surfaced.

**Contract**: one `it.each` table over `[label, kwhValue, expectSuccess]` tuples run against a shared valid baseline object (valid UUIDs for `pocId`/`seekerId`, valid `seekerEmail`) with only `kwh` varied per case: `"7.25"` (valid — assert `success: true` and `data.kwh === 7.25`), `"0"`, `"-5"`, `"abc"`, `undefined`/missing, `"600"`, `Infinity` (all — assert `success: false`, without asserting which internal zod rule fired, per the Critical Implementation Details note above).

### Success Criteria:

#### Automated Verification:

- `npm run test:unit` passes, including every case in the new `it.each` table individually named in the output
- `npm run lint` passes

#### Manual Verification:

- Review the Vitest output once and confirm each case's label makes the specific regression it guards against legible without opening the test file (e.g. failing on the `Infinity` case reads as "the kwh guardrail against non-finite input broke," not just "test #6 failed")

---

## Phase 4: Cookbook and change sync

### Overview

Document the pattern this plan established so the next unit test (or the next route-schema extraction) doesn't have to rediscover it, and close out this change's planning record.

### Changes Required:

#### 1. Fill in the unit-test cookbook entry

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the "TBD — see §3 Phase 1" placeholder in §6.1 with the actual pattern (Vitest, co-located `*.test.ts`, `it.each` for input-boundary cases, no Astro/Supabase imports required for pure validation logic).

**Contract**: §6.1 ("Adding a unit test") documents: location (`src/lib/**/*.test.ts`, co-located with the module under test), runner command (`npm run test:unit`), and the boundary-case `it.each` pattern used in Phase 3. §6.4 ("Adding a test for a new API endpoint") gets a short addendum: extract the route's zod schema into `src/lib/validation/<name>.ts` and unit-test the schema directly, rather than driving the full `POST` handler through a fake `APIContext` — this repo's routes commonly import `astro:env/server` transitively, which plain Vitest cannot resolve.

### Success Criteria:

#### Automated Verification:

- `npm run format` (prettier) reports no changes needed on the edited markdown

#### Manual Verification:

- Re-read the updated §6.1/§6.4 text as a contributor who has never seen this plan and confirm it's actionable on its own

---

## Testing Strategy

### Unit Tests:

- `src/lib/utils.test.ts` — harness smoke test (Phase 1)
- `src/lib/validation/session.test.ts` — kWh guardrail boundary cases (Phase 3)

### Integration Tests:

- None added by this plan — Risk #1's failure mode is fully covered by the schema unit tests (see "What We're NOT Doing").

### Manual Testing Steps:

1. After Phase 2, run the existing `log-session-flow.spec.ts` e2e spec against local Supabase and confirm the happy path still logs a session correctly.
2. After Phase 3, read the Vitest output once for output legibility (per that phase's Manual Verification).

## Performance Considerations

None — this plan adds a test harness and pure validation logic; no runtime code path changes for end users.

## Migration Notes

None — no data model or schema changes.

## References

- Related research: `context/changes/testing-session-creation-guardrails/research.md`
- Risk source: `context/foundation/test-plan.md` §2 Risk #1, §3 Phase 1
- Existing validation shipped by: `context/changes/log-session-and-balance-ledger/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Vitest environment setup

#### Automated

- [x] 1.1 `npm run test:unit` exits 0 and runs the smoke test — b8ce880
- [x] 1.2 `npm run lint` passes — b8ce880
- [x] 1.3 `npx astro check` (or `npm run build`) passes — b8ce880

#### Manual

- [x] 1.4 Vitest terminal output reports the smoke test by name — b8ce880

### Phase 2: Extract the session-validation schema

#### Automated

- [x] 2.1 `npm run lint` passes — d41bd54
- [x] 2.2 `npx astro check` (or `npm run build`) passes — d41bd54
- [x] 2.3 `npm run test:unit` still passes — d41bd54

#### Manual

- [x] 2.4 `npm run test:e2e` — `log-session-flow.spec.ts` still passes (satisfied via equivalence evidence, not a passing run — see change.md notes) — d41bd54

### Phase 3: kWh guardrail unit tests

#### Automated

- [x] 3.1 `npm run test:unit` passes, every `it.each` case individually named — bca0d57
- [x] 3.2 `npm run lint` passes — bca0d57

#### Manual

- [x] 3.3 Vitest output reviewed for per-case legibility — bca0d57

### Phase 4: Cookbook and change sync

#### Automated

- [x] 4.1 `npm run format` reports no changes needed

#### Manual

- [x] 4.2 §6.1/§6.4 re-read for actionability by a fresh contributor
