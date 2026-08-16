# EV Share

A peer-to-peer EV charging exchange. Users register their own charging point
(POC — home socket, garage, or dedicated charger), log charging sessions for
other users, and track a pure kWh balance between accounts — no money
involved. Full product spec: [`context/foundation/prd.md`](./context/foundation/prd.md).

**Core invariant**: every logged charging session debits one user and
credits another by the identical kWh amount — no drift.

## Tech Stack

- [Astro](https://astro.build/) v6 - Server-first web framework (SSR, Cloudflare adapter)
- [React](https://react.dev/) v19 - Interactive islands (forms, POC/session UI)
- [TypeScript](https://www.typescriptlang.org/) v5 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Auth + Postgres backend
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone <this-repository-url>
cd ev-share
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

5. Run the development server:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier
- `npm run test:unit` - Run unit tests (Vitest, single run)
- `npm run test:unit:watch` - Run unit tests in watch mode
- `npm run test:e2e` - Run e2e tests (Playwright; requires `npx supabase start`)
- `npm run test:e2e:ui` - Run e2e tests in Playwright's UI mode

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages (dashboard, auth)
│ │ └── api/ # API endpoints (auth, pocs, sessions, profile, users)
│ ├── components/ # UI components (Astro & React), by feature: auth/ pocs/ sessions/ profile/
│ ├── lib/ # Domain logic: pocs.ts, sessions.ts, profile.ts, users.ts, validation/
│ └── types.ts # Shared domain types/DTOs
├── supabase/migrations/ # Postgres schema (pocs, charging_sessions, profiles)
├── e2e/specs/ # Playwright e2e tests
├── context/foundation/ # Product spec, tech-stack decisions, test plan
├── public/ # Public assets
├── wrangler.jsonc # Cloudflare Workers config
```

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication and as
its Postgres database (POCs, charging sessions, profiles). Environment
variables are declared via Astro's `astro:env` schema and are treated as
**server-only secrets** — they are never exposed to the client.

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Start the local stack (applies migrations under `supabase/migrations/`, downloads Docker images on first run):

```bash
npx supabase start
```

3. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

4. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` and `.dev.vars` files:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

Run `npx supabase db push` (or apply the SQL under `supabase/migrations/` manually) to create the schema on a fresh cloud project.

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up without clicking a confirmation link.

### App routes

| Route                 | Description                                                  |
| ---------------------- | -------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                     |
| `/auth/signup`        | Email/password sign-up form                                     |
| `/auth/confirm-email` | Post-signup "check your inbox" page                              |
| `/dashboard`          | Balance summary + transaction history (protected)                |
| `/dashboard/pocs`     | Register/list/toggle/remove your charging points (protected)     |
| `/dashboard/sessions` | Log a charging session and browse available POCs (protected)     |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication.

## Testing

- **Unit** (`src/**/*.test.ts`, Vitest) — hermetic tests for domain/validation logic, e.g. the kWh guardrail in `src/lib/validation/session.test.ts`.
- **E2E** (`e2e/specs/*.spec.ts`, Playwright) — critical user flows: auth round-trip, dashboard session, logging a charging session end-to-end.

Test scope and rationale are tracked in [`context/foundation/test-plan.md`](./context/foundation/test-plan.md), which maps each test suite back to a concrete product risk.

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/).

1. Build the project:

```bash
npm run build
```

2. Deploy with Wrangler:

```bash
npx wrangler deploy
```

Set `SUPABASE_URL` and `SUPABASE_KEY` as secrets in your Cloudflare dashboard or via `npx wrangler secret put`.

## CI

GitHub Actions runs lint + build (and e2e, where configured) on every push and PR to `master`. Configure `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets in GitHub for the build step.

## License

MIT
