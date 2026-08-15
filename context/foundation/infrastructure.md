---
project: ev-share
researched_at: 2026-08-14T14:52:28Z
recommended_platform: Cloudflare Workers + Pages
runner_up: Render
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 (SSR) + React 19
  runtime: Cloudflare Workers (workerd)
---

## Recommendation

**Deploy on Cloudflare Workers + Pages.**

This is already the configured deployment target in `context/foundation/tech-stack.md` and the scaffolded `wrangler.jsonc`/`@astrojs/cloudflare` adapter — no migration required. It clears all five agent-friendly criteria (GA), stays free at the project's expected scale (a handful of users, well under the 100k requests/day free tier), and matches the developer's stated existing familiarity with Cloudflare. The interview's cost-minimize priority and "single region is fine" answer removed the two factors (budget, edge/global reach) that might have favored a different pick.

## Platform Comparison

| Platform | CLI-first | Managed/serverless | Agent-readable docs | Stable deploy API | MCP/integration | Total Pass |
|---|---|---|---|---|---|---|
| **Cloudflare** | Pass | Pass | Pass | Pass | Pass | 5/5 |
| **Render** | Pass | Pass | Pass | Pass | Pass | 5/5 |
| Railway | Pass | Pass | Pass | Partial | Pass | 4.5/5 |
| Fly.io | Pass | Pass | Pass | Pass | Partial | 4.5/5 |
| Netlify | Partial | Pass | Partial | Partial | Pass | 3/5 |
| Vercel | Partial | Pass | Partial | Pass | Partial | 2.5/5 |

Notes per platform:

- **Cloudflare**: `wrangler deploy`/`wrangler rollback`/`wrangler tail` are all CLI, all deterministic; `wrangler rollback` reverts instantly with no rebuild. Docs publish a GA `llms.txt` plus per-page markdown negotiation — the reference example of "agent-readable docs." MCP servers are live and Claude-connectable. Free tier (100k req/day, 10ms CPU/invocation, 3MiB bundle cap) comfortably covers this MVP's expected volume.
- **Render**: Official Astro SSR template with `@astrojs/node` pre-wired makes migration low-risk if ever needed. CLI deploy/logs are GA, rollback is API-accessible, and an official MCP server has been GA since August 2025. Free tier sleeps after 15 min idle (~1 min cold start); Starter ($7/mo) removes that for an always-on service.
- **Railway**: Strong CLI (`railway up`/`redeploy`/`logs`) and a GA MCP server. Astro deployment requires the `@astrojs/node` adapter plus an explicit `host: '0.0.0.0'` config — a documented gotcha, not a blocker. VM pricing tier is labeled beta as of this research.
- **Fly.io**: True persistent containers, GA WebSocket support, public GitHub docs. No rollback subcommand (workaround: `fly deploy --image <prior-tag>`, still fully CLI-scriptable). No free tier since 2024 — cheapest always-on config runs ~$8–25/mo, the highest baseline cost of the six.
- **Netlify**: GA adapter and GA MCP server (since June 2025), but rollback is dashboard-only with no CLI subcommand found — a real gap against the CLI-first criterion for agent-driven ops. No WebSocket support (not a blocker here; Q1 confirmed no persistent-connection need).
- **Vercel**: GA SSR adapter, but the Hobby (free) tier's Terms of Service forbid commercial use and cap Active-CPU-hours — realistically requires the $20/mo Pro tier, directly conflicting with the stated cost-minimize priority. WebSockets and the official MCP server are both still in beta.

### Shortlisted Platforms

#### 1. Cloudflare Workers + Pages (Recommended)

Already deployed-to in the scaffolded project — zero migration cost. Clears all five criteria at GA. Free at this project's scale. Matches stated platform familiarity (interview Q3). The one real technical risk (`@supabase/ssr` on the Workers runtime) has a documented, known fix.

#### 2. Render

The strongest "if not Cloudflare" alternative: 5/5 GA criteria, an official first-party Astro SSR template (lowest migration risk among the non-Cloudflare options), and a GA MCP server. Costs $0 (with cold starts) or $7/mo (always-on) — close to Cloudflare's cost profile.

#### 3. Railway

Cost-competitive (~$5–15/mo) with GA CLI and MCP support. Held back from the top two spots by a documented Astro-specific host-binding gotcha and its VM pricing tier's current beta label — both manageable but real friction the top two don't carry.

## Anti-Bias Cross-Check: Cloudflare Workers + Pages

### Devil's Advocate — Weaknesses

1. `@supabase/ssr` on Workers has a documented, reproducible failure mode (dynamic `require("stream")`/`ws` errors) — the fix (enabling `nodejs_compat`, marking the package external in Vite SSR config) is a real pre-deploy step, not a hypothetical; skipping it breaks auth entirely.
2. Enabling `nodejs_compat`/`nodejs_compat_v2` for the Supabase fix pushes bundle size toward the 3MiB free-tier cap — a project that adds a few more npm dependencies could get bounced back to a billing-tier decision mid-MVP.
3. Local dev fidelity gap: Workers' `workerd` runtime behaves differently from Node in edge cases (some npm packages assume full Node API surface) — bugs that don't reproduce locally can surface only after deploy.
4. Cloudflare's dashboard "Auto Minify" setting is a known silent SSR-hydration breaker — an easy footgun for anyone who touches dashboard settings without reading the Astro-specific guide first.
5. `wrangler rollback` reverts code/assets instantly but does **not** revert Supabase schema/data — if a future migration ships broken alongside a code rollback, the two are decoupled and can drift.

### Pre-Mortem — How This Could Fail

The team deployed Astro SSR on Cloudflare Workers, encouraged by the zero-migration path from the starter and the generous free tier. Early on, `@supabase/ssr` threw opaque "Unexpected Node.js imports" errors in production that didn't reproduce in local `astro dev` (which runs on Node, not `workerd`) — costing a debugging session before finding the `nodejs_compat` fix in a GitHub issue rather than the official docs. Once fixed, the compat flag pulled in enough polyfill weight that a routine dependency addition (an image-processing library) pushed the bundle past the free tier's 3MiB cap, forcing an unplanned move to the $5/mo tier mid-sprint — a small cost, but an unbudgeted surprise during a supposedly free MVP phase. Later, someone enabled Cloudflare's dashboard-level Auto Minify to "optimize" the site, silently breaking client-side hydration on the dashboard page for two days before anyone connected the settings change to the symptom, since Auto Minify isn't mentioned in the project's own `CLAUDE.md`.

### Unknown Unknowns

- `workerd` isn't Node — any dependency (present or future) that assumes full Node API compatibility (native addons, certain crypto/fs usage) can fail only in production, not in local `astro dev`.
- The free tier's real limit at scale isn't request count — it's the 3MiB compressed bundle size and 10ms CPU-time-per-invocation; a compute-heavy handler (e.g., image resizing) can exceed the CPU cap while comfortably fitting the request quota.
- Cloudflare's own dashboard has settings (Auto Minify, certain WAF/caching rules) that can silently break an SSR app in ways that look like application bugs, not infra issues.
- Wrangler's `rollback` only reverts the Worker's code/assets — any Supabase migration that shipped alongside the rolled-back code is *not* reverted, so "rollback" doesn't mean "return to the same overall state" once a DB schema change is involved.
- Cloudflare's MCP server landscape is broad and evolving quickly (many per-product servers); which one is actually relevant for this project's ops (deploy/logs/secrets) versus the many docs/browser-rendering ones takes some upfront sorting.

**Decision**: proceeded with Cloudflare — risks noted and recorded in the risk register below; no swap to Render or Railway.

## Operational Story

- **Preview deploys**: Cloudflare Workers Builds / Pages generates a preview URL per branch/PR automatically when connected to the GitHub repo; preview URLs are public by default — add Cloudflare Access if preview content needs to stay private.
- **Secrets**: `SUPABASE_URL`/`SUPABASE_KEY` are declared via Astro's `env` schema (server-only) and set as Worker secrets with `wrangler secret put <NAME>` (or in the dashboard's Settings → Variables). Secrets are not readable back via CLI once set (write-only) — only the deploying account/CI token can rotate them.
- **Rollback**: `wrangler rollback [<version-id>]` reverts the active deployment instantly with no rebuild. Caveat: this only reverts code/assets — any Supabase schema migration shipped alongside must be rolled back separately and manually.
- **Approval**: routine deploys (`wrangler deploy` on merge to main) can run unattended via CI. A human should approve: enabling/disabling `nodejs_compat`-related bundle-size tier changes (billing impact), any Supabase migration that changes existing columns/tables, and rotating `SUPABASE_KEY` (breaks all active sessions).
- **Logs**: `wrangler tail` streams live production logs read-only from the CLI; for historical/aggregated logs, Cloudflare's Workers Observability dashboard (or the Logpush feature on paid tiers) is the fallback — no CLI history query beyond the live tail.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| `@supabase/ssr` throws "Unexpected Node.js imports" on Workers runtime | Research finding | H | H | Set `compatibility_flags: ["nodejs_compat"]` (compat date ≥ 2024-09-23) in `wrangler.jsonc` before first deploy; verify signin/signup end-to-end against the deployed Worker, not just local `astro dev`. |
| Bundle size creeps toward the 3MiB free-tier cap as dependencies are added | Devil's advocate | M | M | Run `wrangler deploy --dry-run` (or check build output size) after adding any new dependency; budget for the $5/mo paid tier if the cap is hit. |
| Local `astro dev` (Node) behaves differently from deployed `workerd` runtime | Unknown unknowns | M | M | Treat every auth/session change as untested until verified against a real preview deploy, not just local dev. |
| Cloudflare dashboard settings (Auto Minify, WAF/caching rules) can silently break SSR | Devil's advocate | L | M | Document in `CLAUDE.md`/project runbook: do not touch Cloudflare dashboard optimization settings without checking the Astro-Cloudflare deploy guide first. |
| Code rollback via `wrangler rollback` does not revert Supabase schema/data | Devil's advocate | L | H | Treat schema migrations and code deploys as separately-rollback-able; write migrations to be backward-compatible with the previous code version where possible. |
| Cloudflare's MCP server landscape is broad; the relevant one for this project isn't obvious | Unknown unknowns | L | L | Pick the specific deploy/logs/secrets-relevant MCP server explicitly when wiring up agent-driven ops; don't assume "the" Cloudflare MCP server. |

## Getting Started

1. Confirm `wrangler.jsonc` has `compatibility_flags: ["nodejs_compat"]` and a `compatibility_date` ≥ `2024-09-23` (required for `@supabase/ssr` to work on Workers) — verify against the pinned `@astrojs/cloudflare` version in `package.json` before assuming this is already set correctly.
2. Set secrets: `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY` (do this once per environment; local dev instead uses `.dev.vars`, already gitignored).
3. Deploy: `npm run build && npx wrangler deploy` (or connect the GitHub repo to Cloudflare Workers Builds for automatic deploy-on-merge, matching the `auto-deploy-on-merge` CI flow already recorded in `tech-stack.md`).
4. Verify the deployed Worker (not just local dev) end-to-end for sign-up/sign-in — the `@supabase/ssr` Node-shimming issue only reproduces on the real `workerd` runtime.
5. Tail logs during and after first deploy: `npx wrangler tail`.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
