# E2E Primary Flow Harness Implementation Plan

## Overview

Stand up a Playwright e2e test harness for `ev-share`, running against a local Astro dev server backed by local Supabase. This is the F-01 foundation item in the roadmap: it doesn't test the full US-01 flow (POC registration, session logging, balances) because none of that domain logic exists yet — it proves the harness itself works against today's auth scaffolding, and establishes the `storageState`-based session-reuse convention that S-01/S-02/S-03 will build their own e2e coverage on top of.

## Current State Analysis

- No test tooling exists in this repo at all: no `@playwright/test` or any other test framework, no test script in `package.json`, no test step in `.github/workflows/ci.yml` (lint + build only).
- The only user-facing flows that exist today are auth scaffolding: `/`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email`, `/dashboard` (protected), and the three form-POST endpoints under `/api/auth/*`. No POC, session, or balance UI/API exists.
- The sibling project `../flats-manager` has a proven Playwright setup (config, custom auth fixture, Page Object Model, global teardown, CI wiring) that this plan draws conventions from, adapted per decisions below.
- Local Supabase is already initialized in this repo (`supabase/config.toml` exists) with `[auth.email] enable_confirmations = false` — a freshly signed-up user can sign in immediately, no real email delivery involved.
- `ev-share`'s sign-in endpoint (`src/pages/api/auth/signin.ts:19`) redirects to `/` on success, not `/dashboard` — this differs from `flats-manager`'s pattern and must be accounted for in any login helper.
- No `data-testid` (or any test-id) attributes exist anywhere in the codebase today.

## Desired End State

A developer can run `npm run test:e2e` locally (with `npx supabase start` already running) and see two passing Playwright specs: a full unauthenticated auth round-trip (signup → confirm-email → signin → dashboard reachable → signout → dashboard now redirects) and an authenticated-session spec proving a saved `storageState` reaches the dashboard directly. `playwright.config.ts` establishes `data-testid` as the project's locator convention. CI wiring (a new job running the same suite against local Supabase in GitHub Actions) exists but is explicitly the lowest-priority phase — verified working, but not blocking this change's completion if time runs out.

### Key Discoveries:

- `supabase/config.toml:209` — `enable_confirmations = false`, confirmed via local grep; signup is immediately usable, matching the PRD's "no email confirmation step required" access-control rule.
- `src/pages/api/auth/signin.ts:19` — success redirects to `/`, not `/dashboard`.
- `src/middleware.ts:4,18-20` — only `/dashboard` (prefix match) is protected; unauthenticated visits redirect to `/auth/signin`.
- `src/components/auth/FormField.tsx:22-34` — inputs already have stable `id`/`name` (`email`, `password`, `confirmPassword` on signup); no `data-testid` yet.
- `flats-manager`'s `playwright.config.ts` uses a non-standard `testIdAttribute: "data-test-id"`; this plan uses Playwright's own default (`data-testid`) instead, since no existing convention constrains this project.

## What We're NOT Doing

- Not writing a test for the actual US-01 flow (POC registration, session logging, balance updates) — that domain logic doesn't exist yet; it's covered by S-01/S-02/S-03's own e2e work.
- Not adding Vitest or any component/unit test runner — this change is e2e-only, per explicit scope decision.
- Not using a shared cloud Supabase test project — tests run against local Supabase (`npx supabase start`), matching the documented local-dev workflow.
- Not doing fresh-signup-per-test-run for every spec — one pre-seeded fixed test user backs the `storageState` session-reuse mechanism; only the round-trip spec itself performs a real signup (with a freshly generated email, since it must exercise that flow).
- Not blocking this change's completion on CI wiring — Phase 4 (CI) is the explicitly lowest-priority phase and can be dropped if time is tight.

## Implementation Approach

Playwright is added as the e2e framework (matching the proven sibling-project choice). A `data-testid` locator convention is established on the existing auth components since none exists yet. Two mechanisms handle authentication in tests: a one-time `global-setup.ts` script that idempotently provisions a pre-seeded test user directly against Supabase (via the service-role key), and a Playwright `setup` project (`e2e/auth.setup.ts`) that logs in through the UI once and saves `storageState` for reuse by other tests — this is Playwright's own recommended pattern (faster than re-doing UI login per test, less custom code than `flats-manager`'s hand-rolled fixture). CI wiring mirrors this locally-run setup inside a GitHub Actions job, starting local Supabase via Docker (already available on `ubuntu-latest` runners).

## Critical Implementation Details

**Auth redirect divergence**: `auth.setup.ts` must wait for the URL to become `/` after submitting the sign-in form, not `/dashboard` — `ev-share`'s sign-in endpoint redirects to `/` on success (unlike `flats-manager`'s pattern of redirecting straight to the protected page).

**Opting out of the default authenticated session**: `playwright.config.ts`'s main project applies `storageState` to every test by default (via `dependencies: ['setup']`). The round-trip spec must start from a clean, logged-out browser context, so it overrides this per-file with `test.use({ storageState: { cookies: [], origins: [] } })` rather than needing a whole second Playwright project.

**Local auto-confirm enables a synthetic signup in the round-trip spec**: because `enable_confirmations = false` locally, the round-trip spec can generate a unique throwaway email at runtime, sign up, and sign in immediately — no real inbox/email-delivery handling is needed, and no cleanup of that throwaway user is required for correctness (local Supabase is disposable dev state).

## Phase 1: Playwright core setup

### Overview

Install Playwright, configure it for this project, and scaffold the npm scripts and env-var documentation needed to run it.

### Changes Required:

#### 1. Dependencies and scripts

**File**: `package.json`

**Intent**: Add Playwright as a dev dependency and expose commands to run the suite.

**Contract**: Add `@playwright/test` under `devDependencies`. Add scripts `"test:e2e": "playwright test"` and `"test:e2e:ui": "playwright test --ui"`.

#### 2. Playwright configuration

**File**: `playwright.config.ts` (new)

**Intent**: Define how and where the suite runs.

**Contract**: `testDir: "./e2e"`; `use.baseURL` from `process.env.E2E_BASE_URL ?? "http://localhost:4321"`; `use.testIdAttribute` left at Playwright's default (`data-testid`) — no override; `webServer` running `npm run dev`, waiting on the baseURL, `reuseExistingServer: !process.env.CI`; `globalSetup: "./e2e/global-setup.ts"`; two `projects`: a `setup` project matching `*.setup.ts`, and a `chromium` project depending on `setup` with `storageState: "playwright/.auth/user.json"`. CI-gated settings (`forbidOnly`, `retries`, `workers: 1`) follow the same `process.env.CI` pattern as `flats-manager`'s config.

#### 3. Ignore generated artifacts and document test env vars

**File**: `.gitignore`

**Intent**: Keep Playwright's generated output and local test env file out of version control.

**Contract**: Add entries for `/playwright-report/`, `/test-results/`, `/playwright/.auth/`, and `.env.test`.

**File**: `.env.test.example` (new)

**Intent**: Document the env vars a developer or CI needs to run the suite.

**Contract**: List `E2E_BASE_URL`, `E2E_USERNAME`, `E2E_PASSWORD`, `SUPABASE_URL` (local instance URL), and `SUPABASE_SERVICE_ROLE_KEY` (used only by `global-setup.ts` for admin user provisioning — not part of Astro's existing `SUPABASE_URL`/`SUPABASE_KEY` env schema in `astro.config.mjs`).

### Success Criteria:

#### Automated Verification:

- `npx playwright test --list` runs without a config error
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- `npm run test:e2e:ui` opens the Playwright UI locally against the dev server

---

## Phase 2: Selector convention on auth components

### Overview

Add `data-testid` attributes to the existing auth components and the dashboard, establishing the project-wide selector convention future slices will follow.

### Changes Required:

#### 1. Shared form field

**File**: `src/components/auth/FormField.tsx`

**Intent**: Give every form input a stable test selector derived from its existing `id`, without requiring each call site to pass one explicitly.

**Contract**: The rendered `<input>` gets `data-testid={id}` (reusing the `id` prop already required by this component).

#### 2. Submit button, password toggle, server error

**File**: `src/components/auth/SubmitButton.tsx`

**Intent**: Make the submit action selectable independent of its button text (which changes with pending state).

**Contract**: Add `data-testid="submit-button"` to the rendered `<button>`.

**File**: `src/components/auth/PasswordToggle.tsx`

**Intent**: Add a test selector alongside the existing `aria-label`, for consistency with the new project-wide convention.

**Contract**: Add `data-testid="password-toggle"` to the rendered `<button>`.

**File**: `src/components/auth/ServerError.tsx`

**Intent**: Let tests assert on the server-side error message without matching CSS classes or literal text.

**Contract**: Add `data-testid="server-error"` to the element wrapping the error text.

#### 3. Dashboard

**File**: `src/pages/dashboard.astro`

**Intent**: Give the two dashboard elements tests need to check a stable selector.

**Contract**: Add `data-testid="dashboard-welcome"` to the welcome-message element and `data-testid="signout-button"` to the sign-out `<button>`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Sign-in, sign-up, and dashboard pages render with no visual regression
- Password-visibility toggle still works by hand

---

## Phase 3: Auth fixtures + specs

### Overview

Provision the pre-seeded test user, implement the login-once/reuse-session mechanism, and write the two specs that exercise it.

### Changes Required:

#### 1. Test-user provisioning

**File**: `e2e/global-setup.ts` (new)

**Intent**: Ensure the pre-seeded test user (`E2E_USERNAME`/`E2E_PASSWORD`) exists in local Supabase before any test runs, without failing on repeat runs.

**Contract**: Runs once per `playwright test` invocation (wired via `playwright.config.ts`'s `globalSetup`). Uses `@supabase/supabase-js`'s admin client (service-role key) to call `createUser` for the configured test account; treats an "already registered" error as success (idempotent).

#### 2. Login-once session fixture

**File**: `e2e/auth.setup.ts` (new)

**Intent**: Log in through the real UI once and persist the session for reuse by other tests.

**Contract**: Matched by the `setup` Playwright project. Navigates to `/auth/signin`, fills the `email`/`password` fields (via `data-testid` locators from Phase 2), submits, waits for the URL to become `/` (see Critical Implementation Details), then writes `playwright/.auth/user.json` via `page.context().storageState()`.

#### 3. Unauthenticated round-trip spec

**File**: `e2e/specs/auth-round-trip.spec.ts` (new)

**Intent**: Prove the full auth journey that exists today, end to end, using a freshly generated throwaway account.

**Contract**: Opts out of the project's default `storageState` (see Critical Implementation Details). Steps: generate a unique email; sign up; assert redirect to `/auth/confirm-email` showing the dev-mode "Registration successful" message; sign in with the same credentials; assert landing on `/` and that navigating to `/dashboard` renders (does not redirect); sign out; assert `/dashboard` now redirects to `/auth/signin`.

#### 4. Authenticated-session spec

**File**: `e2e/specs/dashboard-session.spec.ts` (new)

**Intent**: Prove the `storageState` session-reuse mechanism works, since this is the convention future slices will depend on.

**Contract**: Runs under the default `chromium` project (authenticated via the saved `storageState`). Navigates directly to `/dashboard`; asserts the welcome message (`data-testid="dashboard-welcome"`) shows the pre-seeded test user's email.

### Success Criteria:

#### Automated Verification:

- `npm run test:e2e` passes locally with `npx supabase start` already running
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Playwright's HTML report shows both specs passing
- Supabase Studio (local, `http://127.0.0.1:54323`) shows the round-trip spec's throwaway user was actually created

---

## Phase 4: CI wiring (fast-follow, lowest priority)

### Overview

Run the same suite in GitHub Actions against local Supabase. Explicitly the lowest-priority phase — cut first under time pressure; the change is still complete without it as long as Phases 1–3 pass locally.

### Changes Required:

#### 1. New CI job

**File**: `.github/workflows/ci.yml`

**Intent**: Add e2e coverage to CI without disturbing the existing lint/build job.

**Contract**: Add a new job (e.g. `e2e-test`) alongside the existing job. Steps: checkout, setup Node 22, `npm ci`, `npx supabase start` (Docker is available on `ubuntu-latest`), derive `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_KEY` from `npx supabase status -o env` output, provision `E2E_USERNAME`/`E2E_PASSWORD` as repo secrets (or fixed values, since this is local-only test data), `npx playwright install --with-deps chromium`, `npm run test:e2e`, then upload the `playwright-report` artifact (always, or on failure).

### Success Criteria:

#### Automated Verification:

- The `e2e-test` job passes on a pushed branch/PR

#### Manual Verification:

- Reviewed the Actions run's summary and (if failed) the uploaded `playwright-report` artifact

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None — this change is e2e-only by explicit scope decision.

### Integration Tests:

- N/A — covered by the e2e specs themselves (Phase 3).

### Manual Testing Steps:

1. Run `npx supabase start`, then `npm run test:e2e` and confirm both specs pass.
2. Open the HTML report (`npx playwright show-report`) and confirm no unexpected retries/flakes.
3. Manually sign in as the pre-seeded test user in a browser and confirm the credentials match what `global-setup.ts` provisioned.

## Performance Considerations

Local Supabase startup (`npx supabase start`) adds real wall-clock time (Docker containers) before the suite can run; this is expected and matches the sibling project's tradeoff for isolation over speed.

## Migration Notes

N/A — no existing data or systems to migrate; this is new tooling only.

## References

- Sibling project's Playwright setup: `../flats-manager/playwright.config.ts`, `../flats-manager/e2e/`
- Roadmap item: `context/foundation/roadmap.md` § F-01

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Playwright core setup

#### Automated

- [x] 1.1 `npx playwright test --list` runs without a config error
- [x] 1.2 `npm run lint` passes
- [x] 1.3 `npm run build` passes

#### Manual

- [x] 1.4 `npm run test:e2e:ui` opens the Playwright UI locally against the dev server

### Phase 2: Selector convention on auth components

#### Automated

- [ ] 2.1 `npm run lint` passes
- [ ] 2.2 `npm run build` passes

#### Manual

- [ ] 2.3 Sign-in, sign-up, and dashboard pages render with no visual regression
- [ ] 2.4 Password-visibility toggle still works by hand

### Phase 3: Auth fixtures + specs

#### Automated

- [ ] 3.1 `npm run test:e2e` passes locally with `npx supabase start` already running
- [ ] 3.2 `npm run lint` passes
- [ ] 3.3 `npm run build` passes

#### Manual

- [ ] 3.4 Playwright's HTML report shows both specs passing
- [ ] 3.5 Supabase Studio shows the round-trip spec's throwaway user was actually created

### Phase 4: CI wiring (fast-follow, lowest priority)

#### Automated

- [ ] 4.1 The `e2e-test` job passes on a pushed branch/PR

#### Manual

- [ ] 4.2 Reviewed the Actions run's summary and (if failed) the uploaded `playwright-report` artifact
