# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Hard rules

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead." (Full rationale in the 10x-cli lesson block below.)

## Project

EV Share is a peer-to-peer EV charging exchange: users register their own charging point (POC), log charging sessions for other users, and track a pure kWh balance (no money involved) between accounts. The product spec lives in `context/foundation/prd.md`; the stack decision record is `context/foundation/tech-stack.md`; the discovery notes behind both are `context/foundation/shape-notes.md`. The one domain invariant to preserve everywhere balances are touched (`prd.md` § Business Logic): every logged charging session must debit one user and credit another by the identical kWh amount — no drift.

## Commands

- `npm run dev` — start the dev server (Cloudflare `workerd` runtime via `wrangler`)
- `npm run build` — production build
- `npm run preview` — preview the production build locally
- `npm run lint` / `npm run lint:fix` — ESLint (flat config, strict type-checked)
- `npm run format` — Prettier

Pre-commit hook (husky + lint-staged) runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

No test runner is configured yet. `prd.md` § Forward: technical-roadmap requires at least one e2e test verifying the primary user flow (US-01) — this still needs to be added.

Requires Node v22.14.0 (`.nvmrc`). Local Supabase: `npx supabase start` (needs Docker) — copy `.env.example` to `.env` (Node) and `.dev.vars` (Cloudflare local dev via `wrangler`). Deploy with `npx wrangler deploy`. CI (`.github/workflows/ci.yml`) runs lint + build on push/PR to `master` and needs `SUPABASE_URL`/`SUPABASE_KEY` as repo secrets.

## Architecture

- **Astro 6, SSR (`output: "server"`), Cloudflare adapter** (`astro.config.mjs`) — pages render server-side per-request on Cloudflare Workers, not statically generated.
- **Auth**: Supabase via `@supabase/ssr`'s cookie-based server client (`src/lib/supabase.ts`). `SUPABASE_URL`/`SUPABASE_KEY` are declared through Astro's `env` schema as server-only secrets, never exposed to the client.
- **Route protection**: `src/middleware.ts` resolves the current user on every request and gates paths listed in its `PROTECTED_ROUTES` array (currently just `/dashboard`), redirecting unauthenticated requests to `/auth/signin`. Add new protected routes there, not per-page.
- **Auth API routes** (`src/pages/api/auth/{signup,signin,signout}.ts`) are form-POST endpoints, not JSON APIs — they redirect back to the originating page with `?error=<message>` on failure; errors are read from the query string (`src/components/auth/ServerError.tsx`), not thrown/caught client-side.
- **Degraded mode without Supabase**: `SUPABASE_URL`/`SUPABASE_KEY` are optional env fields. If unset, `src/lib/supabase.ts`'s `createClient` returns `null` instead of throwing, and `src/lib/config-status.ts` flags Supabase as unconfigured — auth routes and middleware both check for `null` and no-op/redirect accordingly rather than crashing.
- **Path alias**: `@/*` → `src/*` (`tsconfig.json`).
- **UI**: Astro components for layout/structure, React islands for interactive pieces (forms under `src/components/auth/`), Tailwind 4 + shadcn-style primitives (`src/components/ui/`, `components.json`, "new-york" variant — add new ones with `npx shadcn@latest add <name>`). Merge/condition Tailwind classes through the `cn()` helper in `src/lib/utils.ts`, not manual string concatenation.
- **API routes**: export uppercase HTTP-verb handlers (`GET`, `POST`, ...) and `const prerender = false`; validate input with zod.
- **Supabase migrations** (once added) go in `supabase/migrations/` named `YYYYMMDDHHmmss_short_description.sql`, with RLS enabled and granular per-operation/per-role policies on every new table.
- **Code placement**: shared types/entities/DTOs in `src/types.ts`; services/business logic in `src/lib/` (or `src/lib/services/` once it grows); extracted React hooks in `src/components/hooks/`.

## Current state

This is a freshly bootstrapped starter (scaffold log: `context/changes/bootstrap-verification/verification.md`). `src/pages/index.astro` still renders the starter's own `Welcome` component, not EV Share's actual landing page (balance, transaction history, available-POC list per the PRD). None of the EV Share domain logic — POCs, balances, charging sessions — exists yet; only the starter's auth scaffolding does.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 2, Lesson 2

Turn one roadmap item into the first implementation cycle with the **change planning chain**:

```
/10x-roadmap -> /10x-new -> /10x-plan -> /10x-plan-review -> /10x-implement
```

`/10x-new`, `/10x-plan`, `/10x-plan-review`, and `/10x-implement` are the lesson focus. `/10x-frame` and `/10x-research` are not required rituals here; they are escalation paths introduced in the next lesson.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Change setup (lesson focus)** | |
| `/10x-new <change-id>` | You selected a roadmap item and need a stable change folder. Creates `context/changes/<change-id>/change.md` so planning, implementation, progress, commits, and later review all share one identity. Use AFTER roadmap selection, BEFORE `/10x-plan`. |
| **Planning (lesson focus)** | |
| `/10x-plan <change-id>` | You have a change folder and need a reviewable implementation plan. Reads roadmap context, foundation docs, codebase evidence, and any existing change notes; writes `plan.md` and `plan-brief.md` with phases, file contracts, success criteria, and `## Progress`. |
| **Plan readiness (lesson focus)** | |
| `/10x-plan-review <change-id>` | You have `plan.md` and need a light pre-code readiness check. Use it to catch missing end state, weak contracts, malformed progress, scope drift, or blind spots before code changes begin. |
| **Implementation (lesson focus)** | |
| `/10x-implement <change-id> phase <n>` | You have an approved plan and want to execute one phase with verification, manual gate, commit ritual, and SHA write-back to `## Progress`. |
| **Lifecycle closure** | |
| `/10x-archive <change-id>` | A change is merged or intentionally closed. Move it out of active `context/changes/` into archive state. |

### How the chain hands off

- `/10x-new` creates the durable change identity.
- `/10x-plan` turns that identity into an implementation contract.
- `/10x-plan-review` checks the plan before the agent mutates code.
- `/10x-implement` executes one planned phase, verifies, asks for manual confirmation when needed, commits, and records progress.

### Lesson boundaries

- Plan is the default router after roadmap selection. Start with `/10x-plan` unless the problem is unclear or external evidence is blocking.
- Do not run `/10x-frame + /10x-research` as ceremony for every change.
- Do not turn this lesson into a full end-to-end product build. A checkpoint with a planned and partially or fully implemented stream is valid.
- Code review of the implemented diff belongs to Lesson 3 via `/10x-impl-review`.
- Lifecycle closure via `/10x-archive` after a change is merged or intentionally closed.

### Paths used by this lesson

- `context/foundation/roadmap.md` - upstream roadmap
- `context/changes/<change-id>/change.md` - change identity
- `context/changes/<change-id>/plan.md` - implementation contract
- `context/changes/<change-id>/plan-brief.md` - compressed handoff
- `context/foundation/lessons.md` - recurring rules and pitfalls
- `docs/reference/contract-surfaces.md` - load-bearing names registry

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
