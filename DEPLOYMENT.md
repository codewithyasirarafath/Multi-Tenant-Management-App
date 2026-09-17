# Deployment Configuration

This document describes the configuration required to deploy the Multi-Tenant Delivery Management API.

## Runtime Requirements

- **Node.js**: >= 20.x (ES Modules support)
- **PostgreSQL**: >= 13.x with `pgcrypto` extension enabled
- **Port**: 3000 (configurable via `PORT` env var)
- **NPM**: >= 9.x (for dependency management)

## Production Build & Start

```bash
# Install dependencies
npm install

# Run database migrations
npx pgx migrate up  # or use your preferred migration tool

# Start in production mode
npm run start
# or: node main.js

# For development with auto-reload:
npm run dev
# or: node --watch main.js
```

## PostgreSQL Configuration

### Required Extensions
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Required Tables & Migrations
The following migration files must be applied in order:

1. `migrations/001_auth_refactor.sql` - Schema refactor: global users, memberships, 3-digit codes
2. `migrations/002_password_reset_refresh_tokens.sql` - Password reset, refresh tokens, permissions, audit log, webhooks

### Default Roles (seeded in `001_auth_refactor.sql`)
- `org_admin` (org_id IS NULL) - Full access
- `ent_manager` (org_id IS NULL) - Entity management
- `staff` (org_id IS NULL) - Basic operational access
- `delivery_agent` (org_id IS NULL) - Delivery handling

### Required Indexes
All indexes are created automatically by the migration files, but verify:
- `idx_entities_org_id` on entities(org_id)
- `idx_users_org_id` on users(org_id)
- `idx_users_ent_id` on users(ent_id)
- `idx_deliveries_org_id` on deliveries(org_id)
- `idx_deliveries_ent_id` on deliveries(ent_id)
- `idx_deliveries_status` on deliveries(status)
- `idx_roles_org_id` on roles(org_id)
- `idx_user_roles_user_id` on user_roles(user_id)
- `idx_user_roles_role_id` on user_roles(role_id)
- `idx_user_roles_org_id` on user_roles(org_id)
- `idx_user_roles_ent_id` on user_roles(ent_id)
- `idx_audit_logs_user_id`, `idx_audit_logs_org_id`, `idx_audit_logs_resource`, `idx_audit_logs_created_at`, `idx_audit_logs_action`
- `idx_webhook_subscriptions_org_id`
- `idx_webhook_deliveries_subscription`, `idx_webhook_deliveries_retry`

## Environment Variables

Create a `.env` file in the project root. **Do not commit secret values.**

### Required Variables
```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=delivery_management
CORS_ORIGIN=http://localhost:3000  # or your frontend domain
NODE_ENV=production  # or "development"
JWT_SECRET=change-this-to-a-secure-random-string
```

### Optional Variables
```
CORS_ORIGIN=*  # Allow all origins (not recommended for production)
```

### Environment Variable Names Reference
| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | Server port | 3000 |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | (required) |
| `DB_NAME` | Database name | delivery_management |
| `CORS_ORIGIN` | Allowed CORS origin | http://localhost:3000 |
| `NODE_ENV` | Environment mode | development |
| `JWT_SECRET` | JWT token signing key | (required, random string) |

## Docker Deployment (example)

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Run migrations at container start (optional)
# You can add a migration script to your package.json scripts

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "main.js"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DB_HOST=db
      - DB_PORT=5432
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_NAME=delivery_management
      - JWT_SECRET=change-this
      - CORS_ORIGIN=http://localhost:3000
    depends_on:
      - db

  db:
    image: postgres:13-alpine
    environment:
      POSTGRES_DB: delivery_management
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"

volumes:
  pg_data:
```

## Kubernetes Deployment (example)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: delivery-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: delivery-api
  template:
    metadata:
      labels:
        app: delivery-api
    spec:
      containers:
        - name: api
          image: your-registry/delivery-api:latest
          ports:
            - containerPort: 3000
          env:
            - name: DB_HOST
              value: "delivery-db"
            - name: DB_PORT
              value: "5432"
            - name: DB_USER
              value: "postgres"
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: password
            - name: DB_NAME
              value: "delivery_management"
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: jwt-credentials
                  key: secret
            - name: NODE_ENV
              value: "production"
            - name: CORS_ORIGIN
              value: "https://your-domain.com"
          resources:
            limits:
              memory: "512Mi"
              cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: delivery-api
spec:
  selector:
    app: delivery-api
  type: LoadBalancer
  ports:
    - port: 80
    targetPort: 3000
---
apiVersion: apps/v1
kind: Ingress
metadata:
  name: delivery-api-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
    - host: api.your-domain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              serviceName: delivery-api
              servicePort: 80
```

## Health Checks

The application provides a health endpoint:
```
GET /health
```
Returns: `{ status: "ok", dbTime: "2026-01-01T00:00:00.000Z" }`

## Deployment Checklist

- [ ] PostgreSQL running with `pgcrypto` extension
- [ ] Migration files applied (`001_auth_refactor.sql`, `002_password_reset_refresh_tokens.sql`)
- [ ] `.env` file created with all required variables
- [ ] `JWT_SECRET` set to a secure random string
- [ ] `CORS_ORIGIN` set to your frontend domain (or `*` for development)
- [ ] Firewall allows inbound traffic on port 3000 (or your configured port)
- [ ] SSL/TLS configured for production HTTPS
- [ ] Backup strategy for PostgreSQL data
- [ ] Monitoring/health checks configured
- [ ] Rate limiting configured (default: 200 requests/15min global, 10/auth, 60/api)
- [ ] Swagger docs available at `/api-docs` endpoint
- [ ] Bruno collection (`bruno/delivery-management.bruno.json`) for API testing

## Common Issues

1. **Connection refused to PostgreSQL**: Verify `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in `.env`
2. **JWT verification fails**: Verify `JWT_SECRET` is consistent across restarts
3. **CORS errors**: Set `CORS_ORIGIN` to match your frontend domain
4. **Unique constraint violations**: Ensure org_code (100-999) and ent_code (1-999) are unique per org
5. **Token expired quickly**: Verify `JWT_EXPIRES_IN` env var (default: 24h)
6. **Refresh token rotation issues**: Ensure `rotateRefreshToken` is called properly
7. **Password reset tokens invalid**: Verify `password_reset_tokens` table is populated correctly
8. **Webhooks not triggering**: Verify `webhook_subscriptions` table and URL accessibility
9. **Audit logs not recording**: Verify `audit_logs` table and `auditMiddleware` is used on routes
10. **Entity not found errors**: Verify `ent_code` is set 1-999 and unique per org