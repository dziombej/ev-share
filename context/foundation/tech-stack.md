---
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
---

## Why this stack

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
