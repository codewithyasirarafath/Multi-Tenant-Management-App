# Project Context — Multi-Tenant Delivery Management App

> Any AI assistant (Claude, Claude Code, etc.) reading this file should understand
> the full architecture without needing it re-explained. Keep this updated as the
> project grows — treat it as the single source of truth for "how this app works."

## What this is

A multi-tenant Node.js + Express + PostgreSQL backend. Multiple organizations
(companies) use the same app instance, each with isolated data. Started as a
learning project, evolving into a real architecture.

## Tech stack

- Node.js + Express (ES Modules — `"type": "module"` in package.json, all imports
  use `.js` extensions on relative paths)
- PostgreSQL via the `pg` package (raw SQL, no ORM)
- Config via `dotenv` (`.env` — never committed)
- **Auth**: JWT (stateless), `jsonwebtoken` + `bcryptjs` for password hashing
- **Validation**: `zod` schemas per route
- **Rate limiting**: `express-rate-limit` (global, auth, API, org-scoped)
- **Logging**: `morgan` + request ID middleware
- **Security**: `helmet`, `cors`

## Multi-tenancy model

- **organizations** = top-level tenant (a company), has 3-digit `org_code` (100-999)
- **entities** = sub-unit within an org (branch/warehouse/department — flat, not nested), has 3-digit `ent_code` (1-999, unique per org)
- **users** = global (email unique across all orgs), no org_id/ent_id on user table
- **user_memberships** = join table linking user → org → optional entity → role; a user can have multiple memberships across different orgs/entities
- **roles** = system-wide defaults (`org_id IS NULL`: org_admin, ent_manager, staff, delivery_agent) or custom per-org roles
- **deliveries** = the actual business data module; scoped to org, optionally to an entity, tracks which user created it (`created_by`)

**Golden rule: every query is scoped by `org_id`.** No model function fetches a
record by `id` alone — always `id AND org_id`. This is what prevents one tenant
from ever seeing another tenant's data. Auth layer extracts `orgId` from verified JWT token via user's memberships.

**6-Digit Membership Code**: Each user membership = `org_code * 1000 + ent_code` (000 if no entity). Example: user in org 123 (no entity) and org 124 entity 789 → `[123000, 124789]`. Returned on login/register and via `POST /api/v1/auth/membership-codes`.

## Folder structure (feature-based architecture)

Every module owns its full vertical slice under `src/<module>/`. Shared
cross-cutting concerns live in `src/shared/`. `app.js` at the repo root builds
the fully-wired Express app (no port binding — supertest drives it directly);
`main.js` only imports `app.js` and calls `listen()`.

```
src/
  <module>/                 → one folder per feature (see modules below)
    routes.js               → maps HTTP verb+path to controller, uses validation middleware
    controller.js           → req/res handling, calls models, uses asyncHandler
    model.js                → raw SQL queries only, no req/res knowledge
  auth/                     → register/login/me/membership-codes/password reset/refresh rotation
  organizations/            → org CRUD (creator auto-becomes org_admin)
  entities/                 → entity CRUD within an org (ent_code auto-assigned from ent_code_seq)
  users/                    → user CRUD
  roles/                    → role CRUD
  memberships/              → user → org → entity → role assignments
  permissions/              → permission checks + role_permissions
  deliveries/               → the core business data module
  inventory/                → products + stock levels + inventory movements
  customers/                → customer records
  invoicing/                → invoices + payments
  notifications/            → user notifications + org-level alerts
  webhooks/                 → webhook subscriptions + delivery log
  api-keys/                 → API key management (controller lives in routes.js)
  ai-chat/                  → AI assistant (rule-based service.js, no external API)
  audit/                    → audit logging (middleware.js + model.js)
  shared/
    middleware/
      auth.js               → JWT verify, membership loading, access control helpers
      validation.js         → zod schemas + validate() middleware (all modules' schemas)
      rateLimit.js          → express-rate-limit configs (limits env-overridable: AUTH_RATE_LIMIT etc.)
      errorHandler.js       → global error handler + asyncHandler
      logger.js             → morgan + request ID
      index.js              → barrel re-export
    config/
      db.js                 → single shared pg Pool, imported everywhere
      swagger.js            → OpenAPI spec (scans ./src/**/*.js)
    utils/
      errors.js             → custom error classes + Postgres error code mapping
      sanitize.js           → XSS sanitization (mutates req.query/params in place — Express 5 getters)
app.js                      → builds the wired Express app (exported for supertest; no listen)
main.js                     → imports app.js, binds PORT
migrations/                 → SQL migration files, tracked in schema_migrations (`npm run migrate`)
multitenant-schema.sql      → BASE schema (pre-refactor "before" state, applied by migrate.js on empty DBs)
tests/                      → vitest + supertest suites (test DB: delivery_test, auto-created)
  helpers.js                → app instance, registerAndLogin/bootstrapUser factories
  auth.test.js              → register/login/me/refresh rotation/logout
  organizations.test.js     → org CRUD + creator-membership + auto org_code
  deliveries.test.js        → create/list/track/status transitions/pagination
  tenancy.test.js           → THE golden-rule suite (12 cross-org probes, all must 403/404)
  rate-limit.test.js        → 429 after limit (low-limit app via dynamic import)
  global-setup.mjs          → creates delivery_test DB + migrates it
  setup-env.mjs             → forces DB_NAME=delivery_test + test env before app import
scripts/
  migrate.js                → tracked migrations (schema_migrations) + base-schema bootstrap
  seed.js                   → idempotent sample data for every table (`npm run seed`)
  check-imports.mjs         → verifies every relative import resolves (`npm run check:imports`)
  check-org-scope.mjs       → enforces org_id scoping on tenant-table SQL (`npm run check:org-scope`,
                              add `--selftest` to verify the checker itself; inline suppression via
                              `// org-scope: ignore <reason>`; documented gaps live in its ALLOWLIST)
  check-all.mjs             → runs all checks (`npm run check`)
  wait-for-db.mjs           → polls Postgres until reachable (used by db:up / setup)
  bruno-env.mjs             → copies bruno env example before test:api
  setup.mjs                 → one-command onboarding (`npm run setup`)
bruno/                      → API test collection (38 requests, 45 tests) — run with `npm run test:api`
  environments/Local.bru    → gitignored runtime state; auto-created from Local.example.bru
frontend/                   → React + Vite + TypeScript SPA (see Frontend section)
```

## Current route map (all prefixed with `/api/v1`)

```
POST   /auth/register
POST   /auth/login
GET    /auth/me
POST   /auth/membership-codes     → returns 6-digit codes for email

GET/POST           /organizations
GET/PUT/DELETE      /organizations/:id

GET/POST            /organizations/:orgId/entities
GET/PUT/DELETE      /organizations/:orgId/entities/:id

GET/POST            /organizations/:orgId/users
GET/PUT/DELETE      /organizations/:orgId/users/:id

GET/POST            /organizations/:orgId/roles

GET/POST            /organizations/:orgId/users/:userId/memberships
PUT/DELETE          /organizations/:orgId/users/:userId/memberships/:membershipId
POST                /organizations/:orgId/users/:userId/memberships/codes  → 6-digit codes for email

GET/POST            /organizations/:orgId/deliveries
GET                 /organizations/:orgId/deliveries/track/:trackingNumber
GET/PUT/DELETE      /organizations/:orgId/deliveries/:id
PATCH               /organizations/:orgId/deliveries/:id/status

GET/POST/PUT/DELETE /organizations/:orgId/inventory   → products + stock
GET/POST/PUT/DELETE /organizations/:orgId/customers   → customer records
GET/POST/PUT        /organizations/:orgId/invoicing   → invoices (+ payments per invoice)
GET                 /organizations/:orgId/notifications
PATCH               /organizations/:orgId/notifications/mark-read
GET                 /organizations/:orgId/notifications/alerts
GET/POST            /organizations/:orgId/permissions
GET/POST/DELETE     /organizations/:orgId/webhooks    → webhook subscriptions (+ revoke)
GET/POST/DELETE     /organizations/:orgId/api-keys    → API key management (org-scoped mount)

POST                /organizations/:orgId/ai-chat/ask
```

## Local development workflow

- `npm run setup` — one-command onboarding: node version check, `.env` (from `.env.example`),
  required env keys, `npm install`, docker compose Postgres, migrations
- `npm run db:up` / `db:down` / `db:reset` — Postgres via `docker-compose.yml` (16-alpine,
  pgcrypto auto-enabled on first start; `db:reset` wipes the data volume)
- `npm run check` — static checks before commit/push: `check:imports` + `check:org-scope`
- `npm run check:org-scope` — the tenant-isolation golden-rule enforcer. Known, currently
  accepted gaps are documented (with reasons) in its `ALLOWLIST`; shrink it over time.
- Config template lives in `.env.example` (never commit `.env`)

## Database

- Schema file: `multitenant-schema.sql` + `migrations/` (run with `npm run migrate`)
- Key tables: `organizations`, `entities`, `users`, `roles`, `user_memberships`, `deliveries`, `products`, `inventory`, `inventory_movements`, `customers`, `invoices`, `payments`, `notifications`, `alerts`, `permissions`, `role_permissions`, `audit_logs`, `webhook_subscriptions`, `webhook_deliveries`, `api_keys`, `ai_conversations`, `ai_messages`, `password_reset_tokens`, `refresh_tokens`
- Deliveries `status` constrained in app to: `pending`, `in_transit`, `out_for_delivery`, `delivered`, `cancelled`
- All primary keys are UUIDs (`gen_random_uuid()`, needs `pgcrypto` extension)
- Uniqueness scoped per-org: `org_code` (global), `ent_code` (per org), `email` (global), `mobile` (global), tracking_number (per org)

## Auth & Authorization

- **JWT** in `Authorization: Bearer <token>` header
- Token payload: `{ userId, email }`
- On each request: `authMiddleware` verifies token → loads user's active memberships → attaches to `req.auth`
- `req.auth` contains: `userId`, `email`, `memberships[]`, `membershipCodes[]`
- **Access control helpers**:
  - `requireOrgAccess` — checks user has membership in `:orgId`
  - `requireEntityAccess` — checks user has membership in `:orgId` + `:entId`
  - `requireRole(...roles)` — checks global roles across all memberships
  - `requireOrgRole(...roles)` — checks roles within current org

## AI Chat Assistant (`/api/v1/organizations/:orgId/ai-chat`)

A conversational assistant that answers questions about delivery data and
basic questions about the app itself - implemented with **rule-based keyword
matching, no external API, no cost, no internet dependency.**

**How it works (`src/ai-chat/service.js`):**

1. The latest user message is lowercased and scanned for known patterns:
   - status keywords (pending, in transit, delivered, etc.)
   - count-vs-list keywords ("how many" → count, otherwise → list)
   - a trailing "to <place>" pattern for destination filtering
   - meta-question keywords (table/schema/route/endpoint) answered from a
     small hardcoded summary instead of querying data
2. Matched filters are turned into a **parameterized** SQL query
   (`org_id = $1 AND status = $2 ...`) - values are always bound as
   parameters, never string-concatenated, so there's no injection risk
   even though there's no LLM in the loop to misbehave.
3. Results are turned into an answer via plain string templates.

**Trade-off, stated honestly:** this only understands the phrasings we've
explicitly coded for. "how many are pending" works; something oddly phrased
or entirely novel won't. If you outgrow this, `src/ai-chat/service.js`
is the only file to swap out - the controller, routes, and conversation
history model don't change - and you could plug in Claude, a local model
via Ollama, or anything else that can produce a `runChatTurn(orgId, history)`
response.

**Endpoints:**

```
POST /api/v1/organizations/:orgId/ai-chat/ask
```

## Conventions / gotchas

- ESM relative imports need `.js` — `import x from './file.js'`, not `'./file'`
- Packages that only do `module.exports = {...}` (like `pg` and `xss`) need
  `import pkg from 'x'; const { Thing } = pkg;` rather than named imports —
  `xss` specifically: default export is a factory, the class is `FilterXSS`
  (use `.process()`, do NOT `new` the default export)
- Postgres error code `23505` = unique violation, `23503` = FK violation —
  every controller maps these to clean 409/400 responses instead of a raw 500
- All controllers wrapped in `asyncHandler` — no try/catch boilerplate
- All routes use `validate(schema)` middleware — request validation is centralized
- Pagination: all list endpoints accept `limit` (default 50, max 100) and `offset` (default 0)
- JWT response shape: `{ user, memberships, membershipCodes, accessToken, refreshToken }`
- Fresh users have zero memberships — `authMiddleware` allows this (they must
  be able to call `/auth/me` and create their first org); org-scoped access is
  rejected by `requireOrgAccess`, not by the auth middleware
- Login response tokens: `accessToken` (not `token`) + `refreshToken`

## Testing

- `npm run test:api` — Bruno collection (38 requests / 45 tests) against the
  running server; covers the full product lifecycle incl. negative tests and
  cross-org isolation. Env state (tokens, captured ids) is written back to
  `bruno/environments/Local.bru` (gitignored); `runTag` regenerates per run so
  the collection is rerunnable.
- `npm test` — vitest + supertest suites against an isolated `delivery_test`
  database (auto-created + migrated by `tests/global-setup.mjs`). The dev
  database is never touched.
- `npm run check` — static checks (imports + org-scope golden rule)

## Roadmap / known gaps

- [ ] Password reset flow (schemas + tokens table exist, email delivery missing;
      reset-request returns `devToken` only when NODE_ENV=development)
- [x] Refresh token rotation (single-use, revoked+replaced in one transaction)
- [x] Permissions table (`role_permissions`) — seeded with per-role permissions
- [ ] API versioning strategy for breaking changes (v1 deprecated with Sunset header, v2 active)
- [x] OpenAPI/Swagger documentation (`/api-docs`, spec scans `./src/**/*.js`)
- [x] AI Conversation history persistence (`ai_conversations`/`ai_messages` tables + model)
- [x] Webhook support for delivery status updates (subscriptions + delivery log + retry)
- [x] Audit logging for sensitive operations (`audit_logs` table + middleware)
- [x] Frontend (`frontend/` — React + Vite + TypeScript + Tailwind v4; feature-based modules:
      auth, dashboard, deliveries, inventory, customers, invoicing, notifications, webhooks,
      AI chat, API keys, admin; theme (dark/light) + language switching (en/hi/es) built in)

## Frontend (`frontend/`)

- **Stack**: Vite + React 19 + TypeScript, Tailwind CSS v4 (token-based theming),
  React Router v7, TanStack Query, no component library — lean shadcn-style
  primitives in `src/shared/components/ui.tsx`.
- **Structure** (feature-based):
  ```
  src/
    app/            → providers.tsx (theme/i18n/query/auth/org), router.tsx
    features/<m>/   → one folder per module; page component owns its data calls
    shared/
      api/          → (lib/) api.ts fetch client: bearer token attach, 401 →
                      /auth/token/refresh rotation retry, ApiError, auth:logout event
      context/      → AuthContext (session + refresh), OrgContext (org switcher,
                      persisted org selection)
      i18n/         → custom lightweight provider + en/hi/es dictionaries, t(key)
      theme/        → ThemeProvider (dark/light via .dark class on <html>),
                      Toggles.tsx (theme + language switchers)
      layout/       → Layout (gradient sidebar, org switcher with 6-digit codes),
                      ProtectedRoute
      components/   → ui.tsx primitives (Button, Input, Card, Table, Badge, ...)
      types.ts      → API response types mirroring backend shapes
  ```
- **Dev**: `npm run dev` inside `frontend/` (port 5173); `/api`, `/health`,
  `/api-docs` are proxied to the Express backend on :3000 — no CORS needed.
- **Design language**: token-based dark/light themes (oklch), gradient brand
  accents, hover-lift tiles, status pipeline bar on the dashboard, chat bubbles
  for the AI assistant.