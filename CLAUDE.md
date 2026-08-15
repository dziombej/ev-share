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

## 10xDevs AI Toolkit - Module 2, Lesson 1

Move from sprint-zero setup to project orchestration with the **roadmap chain**:

```
(Module 1 foundation docs) -> /10x-roadmap -> backlog-ready roadmap items
```

`/10x-roadmap` is the lesson focus. `/10x-new` is intentionally introduced in Module 2, Lesson 2, when a selected roadmap item becomes an implementation change folder.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Roadmap (lesson focus)** | |
| `/10x-roadmap` | You have `context/foundation/prd.md` and a scaffolded project baseline, and you need a vertical-first MVP roadmap. The skill reads the PRD, inspects the code baseline, uses available foundation docs such as `tech-stack.md`, `infrastructure.md`, and `deploy-plan.md`, then writes `context/foundation/roadmap.md`. Use it BEFORE creating per-change folders or implementation plans. |
| **Re-run upstream if needed** | |
| `/10x-shape` / `/10x-prd` / `/10x-tech-stack-selector` / `/10x-bootstrapper` / `/10x-agents-md` / `/10x-infra-research` | Bundled from Module 1 so foundation contracts can be fixed before roadmap sequencing. If roadmap generation exposes a PRD gap, repair the PRD before pretending the backlog is ready. |

### How the chain hands off

- `/10x-roadmap` bridges product and implementation. It does not choose frameworks, design schemas, or write a per-change implementation plan.
- The output is `context/foundation/roadmap.md`: ordered milestones, vertical slices, bounded foundations, dependencies, unknowns, risk, and backlog handoff fields.
- Roadmap items should receive stable human-readable identifiers in backlog tools. The actual `context/changes/<change-id>/` folder is created in Lesson 2 with `/10x-new`.

### Roadmap boundaries

- Default to vertical slices: user-visible outcomes that cross UI, data, business logic, and integrations.
- Horizontal work is allowed only as a bounded enabler that names the downstream vertical milestone it unlocks.
- Avoid orphan horizontal work such as "build the whole database", "build all API endpoints", or "design the whole UI" before the first user-visible flow.
- Roadmap is not a calendar estimate. Do not invent dates, story points, or sprint velocity unless the user explicitly asks for a separate planning artifact.

### Foundation paths used by this lesson

- `context/foundation/prd.md` - input
- `context/foundation/tech-stack.md` - optional input
- `context/foundation/infrastructure.md` - optional input
- `context/deployment/deploy-plan.md` - optional input
- `context/foundation/roadmap.md` - output
- `context/foundation/lessons.md` - recurring rules and pitfalls
- `docs/reference/contract-surfaces.md` - load-bearing names registry

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
