---
bootstrapped_at: 2026-08-14T10:53:57Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: ev-share
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: ev-share
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

### Why this stack

EV Share is a solo, after-hours, 3-week MVP with email/password auth and no
payments, realtime, or background jobs — a small, low-ops web-app profile
that favors a battle-tested, batteries-included starter over assembling
pieces by hand. 10x-astro-starter is the recommended default for `(web, js)`
and clears all four agent-friendly gates; it also mirrors the stack already
proven in the sibling `../flats-manager` project (Astro + React + TypeScript
+ Tailwind + Supabase + Cloudflare), so conventions, auth, and deploy carry
over directly. Deployment defaults to Cloudflare Pages per the starter's own
default; CI runs on GitHub Actions with auto-deploy-on-merge, matching a
solo/small-team cadence.

## Pre-scaffold verification

| Signal      | Value                                       | Severity | Notes                                                        |
| ----------- | -------------------------------------------- | -------- | ------------------------------------------------------------ |
| npm package | not run                                       | n/a      | `cmd_template` starts with `git clone`; no npm CLI to check   |
| GitHub repo | przeprogramowani/10x-astro-starter last pushed 2026-05-17 | fresh    | from card `docs_url`                                          |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 20 top-level entries (astro.config.mjs, CLAUDE.md→CLAUDE.md.scaffold, components.json, eslint.config.js, node_modules/, package-lock.json, package.json, public/, README.md, src/, supabase/, tsconfig.json, wrangler.jsonc, .env.example, .github/, .gitignore, .husky/, .nvmrc, .prettierrc.json, .vscode/)
**Conflicts (.scaffold siblings)**: CLAUDE.md.scaffold (existing project CLAUDE.md was kept)
**.gitignore handling**: moved silently (cwd had no pre-existing `.gitignore`)
**.bootstrap-scaffold cleanup**: deleted (including the cloned `.git/`, removed before move-up)

## Post-scaffold audit

**Tool**: npm audit --json
**Summary**: 1 CRITICAL, 13 HIGH, 7 MODERATE, 2 LOW
**Direct vs transitive**: 0/1/2/0 direct of total 1/13/7/2

#### CRITICAL findings

- **tar** (transitive, via `via` chain) — range `<=7.5.20`. GHSA-23hp-3jrh-7fpw: "node-tar: Decompression/parse DoS via unlimited input" (CVSS 7.5, but npm tiers this advisory chain as critical overall). Fix available via `npm audit fix`.

#### HIGH findings

- **astro** (direct) — range `<=7.0.9`. Multiple XSS advisories (GHSA-jrpj-wcv7-9fh9, GHSA-f48w-9m4c-m7f5) via unescaped spread/transition attribute values. Fix available.
- **brace-expansion** (transitive) — range `<=1.1.17 || 3.0.0-5.0.8`. DoS via exponential-time expansion (GHSA-3jxr-9vmj-r5cp, GHSA-mh99-v99m-4gvg). Fix available.
- **devalue** (transitive) — range `5.6.3-5.8.0`. DoS via sparse array deserialization (GHSA-77vg-94rm-hx3p). Fix available.
- **fast-uri** (transitive) — range `3.0.0-3.1.4`. Host confusion via backslash/IDN authority handling (GHSA-v2hh-gcrm-f6hx, GHSA-7p8r-x3mc-p8w7, GHSA-4c8g-83qw-93j6). Fix available.
- **js-yaml** (transitive) — range `4.0.0-4.3.0`. Quadratic-complexity DoS via merge-key/omap handling (GHSA-52cp-r559-cp3m, GHSA-5p4m-2wfm-xmqj). Fix available.
- **miniflare** (transitive, via sharp/undici/ws) — range `<=0.0.0-fff677e35 || 3.20250204.0-5.20260801.0-alpha`. Inherits findings from its dependencies. Fix available.
- **nanoid** (transitive) — range `<=3.3.17`. Infinite loop on negative/zero size (GHSA-28wg-ghj8-5hjv, GHSA-2v37-7h3g-55p8). Fix available.
- **postcss** (transitive) — range `<=8.5.22`. Path traversal via sourceMappingURL auto-loading (GHSA-r28c-9q8g-f849). Fix available.
- **sharp** (transitive) — range `<0.35.0`. Inherited libvips CVEs (GHSA-f88m-g3jw-g9cj). Fix available.
- **svgo** (transitive) — range `4.0.0-4.0.1`. `removeScripts` plugin leaves executable scripts intact (GHSA-2p49-hgcm-8545, CVSS 8.2). Fix available.
- **undici** (transitive) — range `7.0.0-7.28.0`. TLS cert-validation bypass in SOCKS5 proxy, WebSocket DoS (GHSA-vmh5-mc38-953g, GHSA-vxpw-j846-p89q). Fix available.
- **vite** (transitive) — range `7.0.0-7.3.3`. `server.fs.deny` bypass on Windows alt paths (GHSA-fx2h-pf6j-xcff). Fix available.
- **ws** (transitive) — range `8.0.0-8.20.1`. Memory-exhaustion DoS via tiny fragments (GHSA-96hv-2xvq-fx4p). Fix available.

#### MODERATE findings

7 findings, all with fixes available: additional advisories on `astro` (spread-prop XSS), `js-yaml` (merge-key DoS), `postcss` (sourceMappingURL path disclosure), `undici` (Set-Cookie header injection), `vite` (launch-editor NTLMv2 hash disclosure), `ws` (uninitialized memory disclosure), plus one more moderate-tier entry bundled under the same packages above. Full raw JSON was not persisted to this log; re-run `npm audit` in the project root for the live list.

#### LOW / INFO findings

2 findings: a low-severity `astro` XSS variant (GHSA-7pw4-f3q4-r2p2) and one other low-tier entry surfaced by the same audit run.

## Hints recorded but not acted on

| Hint                     | Value           |
| ------------------------ | ---------------- |
| bootstrapper_confidence  | first-class      |
| quality_override         | false            |
| path_taken               | standard         |
| self_check_answers       | null             |
| team_size                | solo             |
| deployment_target        | cloudflare-pages |
| ci_provider              | github-actions   |
| ci_default_flow          | auto-deploy-on-merge |
| has_auth                 | true             |
| has_payments             | false            |
| has_realtime             | false            |
| has_ai                   | false            |
| has_background_jobs      | false            |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history — this repo already has one; the scaffold's own `.git/` was discarded so no upstream history leaked in.
- Review `CLAUDE.md.scaffold` against your existing `CLAUDE.md` and decide which content to merge.
- Address audit findings per your project's risk tolerance — run `npm audit` (or `npm audit fix`) in the project root; the critical `tar` finding and the direct `astro` finding are the highest-priority ones to look at first.
