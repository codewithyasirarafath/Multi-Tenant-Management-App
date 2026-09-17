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

## Folder structure (MVC-ish, applies to every module)

```
config/db.js              → single shared pg Pool, imported everywhere
middleware/               → cross-cutting concerns
  auth.js                 → JWT verify, membership loading, access control helpers
  validation.js           → zod schemas + validate() middleware
  rateLimit.js            → express-rate-limit configs
  errorHandler.js         → global error handler + asyncHandler
  logger.js               → morgan + request ID
models/*.js               → raw SQL queries only, no req/res knowledge
controllers/*.js          → req/res handling, calls models, uses asyncHandler
routes/*.js               → maps HTTP verb+path to controller, uses validation middleware
main.js                   → wires everything together, mounts routes in hierarchy order
utils/errors.js           → custom error classes + Postgres error code mapping
services/                 → business logic (AI chat, etc.)
migrations/               → SQL migration files
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

POST                /organizations/:orgId/ai-chat/ask
```

## Database

- Schema file: `multitenant-schema.sql` + `migrations/001_auth_refactor.sql`
- Key tables: `organizations`, `entities`, `users`, `roles`, `user_memberships`, `deliveries`
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

**How it works (`services/aiChatService.js`):**

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
or entirely novel won't. If you outgrow this, `services/aiChatService.js`
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
- Packages that only do `module.exports = {...}` (like `pg`) need
  `import pkg from 'pg'; const { Pool } = pkg;` rather than named imports
- Postgres error code `23505` = unique violation, `23503` = FK violation —
  every controller maps these to clean 409/400 responses instead of a raw 500
- All controllers wrapped in `asyncHandler` — no try/catch boilerplate
- All routes use `validate(schema)` middleware — request validation is centralized
- Pagination: all list endpoints accept `limit` (default 50, max 100) and `offset` (default 0)

## Roadmap / known gaps

- [ ] Password reset flow
- [ ] Refresh token rotation
- [ ] Permissions table (`role_permissions`) if role-name checks in controllers become insufficient
- [ ] API versioning strategy for breaking changes (currently v1 only)
- [ ] OpenAPI/Swagger documentation
- [ ] AI Conversation history persistence (conversations/messages tables)
- [ ] Webhook support for delivery status updates
- [ ] Audit logging for sensitive operations