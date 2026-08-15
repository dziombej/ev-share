# Deployment Plan: EV Share on Cloudflare Workers + Pages

Approved plan for the first production deploy, closing the Module 1 chain (`prd.md` → `tech-stack.md` → `infrastructure.md` → deployed app). Tracked here so progress survives across sessions.

## Context

`context/foundation/infrastructure.md` (from `/10x-infra-research`) recommends deploying on Cloudflare Workers + Pages — already the configured adapter in `context/foundation/tech-stack.md` and the scaffolded `wrangler.jsonc`.

Scope: deploy the **current scaffold state** (auth: signup/signin/signout, protected `/dashboard`, starter `Welcome` landing page) to production. The EV Share domain features (POCs, balances, charging sessions) don't exist yet — this establishes the pipeline; feature work continues afterward via `/10x-implement`.

Three things discovered during exploration that this plan accounts for, beyond the "happy path" in `infrastructure.md`'s Getting Started section:

1. **Local Node is v20.11.1; `wrangler` requires v22+.** `npx wrangler whoami` fails immediately with an engine error — nothing wrangler-related works until Node is upgraded. `.nvmrc` already pins `22.14.0`.
2. **`wrangler.jsonc` already has `compatibility_flags: ["nodejs_compat"]`** (compat date `2026-05-08`) — the `@supabase/ssr` Node-shimming risk flagged in `infrastructure.md`'s risk register is *already mitigated* by the starter scaffold. No action needed there beyond verifying it works against a real deploy (local `astro dev` won't catch this class of bug).
3. **`.github/workflows/ci.yml` triggered on `branches: [master]`, but the repo's actual default branch is `main`.** CI had never run on this repo — fixed in Phase 6 below.

No `.env` / `.dev.vars` existed yet, and no Cloudflare/Supabase account connection had been made from this machine — this is a genuine first-time setup, not a re-deploy.

## Plan

Each phase is tagged with who executes it — some steps are OAuth/dashboard-gated and can't be done by an agent.

### Phase 1 — Local prerequisites (Owner: you)
- [x] Switch to Node 22.14.0 — no version manager existed on this machine, so `nvm` was installed (official install script, wired into `~/.zshrc`) and `nvm install 22.14.0 && nvm use 22.14.0` run; now the default alias. Confirmed: `node -v` → `v22.14.0`.
- [x] `npx wrangler login` — done, authenticated as `lukaaaasz@gmail.com`.
- [x] Cloud Supabase project already exists (`srjhogblmtmpxxigtnhy.supabase.co`) — no need to create one.

### Phase 2 — Environment wiring (Owner: you, with commands from me)
- [x] `.dev.vars` written (agent) with `SUPABASE_URL`/`SUPABASE_KEY` from the existing cloud project.
- [x] `.env` — created by you (`cp .env.example .env` + filled in).
- [x] Supabase dashboard: Authentication → Providers → Email → "Confirm email" turned off (location moved since `infrastructure.md` was written — now nested inside the Email provider's own settings, not a standalone page).
- [x] Cloudflare Worker secrets set: `SUPABASE_URL` and `SUPABASE_KEY` uploaded via piped `wrangler secret put` (non-interactive, no shell-history exposure). This also auto-created the `ev-share` Worker shell (no code deployed yet).

### Phase 3 — Cosmetic fix before first deploy (Owner: me) — ✅ done
- [x] Renamed `wrangler.jsonc`'s `name` field from `10x-astro-starter` to `ev-share` — the starter scaffold left its own name in place; deploying under that name risked confusion with the upstream template on the Cloudflare account.

### Phase 4 — First manual deploy + verification (Owner: you, commands from me) — ✅ done
- [x] `npm run build && npx wrangler deploy` — deployed live at **https://ev-share.lukaaaasz.workers.dev** (Version ID `b949c113-15b8-4b28-8ea9-854018856593`). Also auto-provisioned the `SESSION` KV namespace (`@astrojs/cloudflare` session binding, first-deploy-only step).
- [x] Manually tested signup → signin against the deployed URL — account created, signed in successfully. No `@supabase/ssr`/`workerd` runtime mismatch surfaced.
- [x] Ran `npx wrangler tail` during the test — all requests logged `Ok`, no runtime exceptions.

### Phase 5 — Platform-native auto-deploy, not GitHub Actions (Owner: you, dashboard step) — ✅ done
- [x] Cloudflare dashboard: ev-share Worker → Settings → Builds → Connect, GitHub App authorized, repo `dziombej/ev-share` branch `main` connected.
- [x] Build command `npm run build`, deploy command `npx wrangler deploy` — **first attempt only set the deploy command and left build command blank**, so the build ran straight to `wrangler deploy` without ever running `astro build`, failing with `The entry-point file at "@astrojs/cloudflare/entrypoints/server" was not found`. Fixed by explicitly setting the build command in Settings → Builds → Configuration.
- [x] Added `SUPABASE_URL`/`SUPABASE_KEY` in Settings → Variables and Secrets — **first attempt had a bad/placeholder value for `SUPABASE_URL`**, which shadowed the working CLI-set secret on the next auto-deploy and broke the live site (`500`, `Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL` — Astro's server-only env schema reads from the Worker's runtime bindings, and dashboard-set vars/secrets take precedence over ones set via `wrangler secret put` once a Git-connected build redeploys). Corrected directly in the dashboard; took effect immediately without a redeploy.
- [x] Verified end-to-end: committed pending repo changes, pushed to `main`, confirmed via `wrangler deployments list` and `wrangler tail` that Workers Builds auto-built and deployed without a manual `wrangler deploy`. After the two fixes above, `/`, `/auth/signin`, `/auth/signup` return `200` and `/dashboard` returns `302` (unauthenticated redirect) on the live URL.
- [x] Result: **Cloudflare Workers Builds owns auto-deploy-on-merge to `main`** — matching `tech-stack.md`'s `ci_default_flow: auto-deploy-on-merge`. GitHub Actions stays scoped to lint + build only (a PR quality gate), with no deploy step — avoiding two competing deploy pipelines.

### Phase 6 — Fix the CI branch mismatch (Owner: me) — ✅ done
- [x] `.github/workflows/ci.yml`: changed `branches: [master]` → `branches: [main]` on both `push` and `pull_request` triggers, so the lint+build gate actually runs (it previously never fired on this repo).

### Phase 7 — Runbook + store the plan (Owner: me) — ✅ done
- [x] Confirmed `infrastructure.md`'s Operational Story already documents the actual commands used: `wrangler deploy`, `wrangler rollback [<version-id>]`, `wrangler tail` — no duplication added.
- [x] Saved this approved plan here, at `context/changes/deployment/deployment-plan.md`.

## What I can execute unattended vs. what needs you

**Agent-executable (Phases 3, 4, 6, 7 — done, plus the Phase 5 verification push):** file edits, `npm run build && npx wrangler deploy`, piped (non-interactive) `wrangler secret put`, committing and pushing to `main` to trigger/verify the Workers Build.

**Requires you (Phases 1, 2, 5):** Node/nvm install (a system-level change, confirmed with you first since no version manager existed on this machine), `wrangler login` (OAuth), `.env` creation (blocked for me by local permission settings on writing `.env` files), the Supabase dashboard "Confirm email" toggle, and the Cloudflare dashboard GitHub-connection + Builds/Variables configuration (dashboard-only, no CLI path). Both dashboard-config steps in Phase 5 were initially set up wrong (see above) — fixed after live verification caught them.

## Verification

- `npx wrangler tail` shows clean request logs (no `Unexpected Node.js imports` errors) while exercising signup/signin against the deployed URL — confirmed on the first manual deploy (Phase 4).
- A push to `main` (after Phase 5) triggers a Cloudflare Workers Build automatically, without any GitHub Actions deploy step running — confirmed via an empty verification commit; `wrangler deployments list` showed the new version appear without a local `wrangler deploy`.
- GitHub Actions' `CI` check now appears on PRs against `main` (previously silently skipped due to the branch-name mismatch).
- Live routes after the Phase 5 fixes: `/` → 200, `/auth/signin` → 200, `/auth/signup` → 200, `/dashboard` → 302 (unauthenticated redirect, per `PROTECTED_ROUTES` middleware).
