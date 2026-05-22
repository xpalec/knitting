# Knitting Encyclopedia — API

NestJS REST API for the European Knitting Encyclopedia. Runs on port **3002** by default.

## Prerequisites

- Node.js 22+
- pnpm
- Docker (for Postgres and Redis)

## Setup

```bash
# Install dependencies (from monorepo root)
pnpm install

# Copy environment file and fill in values
cp .env.example .env
```

The `.env` file needs at minimum:

```env
DATABASE_URL=postgresql://knitting:knitting@localhost:5432/knitting
REDIS_URL=redis://localhost:6379
JWT_SECRET=<generate with: openssl rand -hex 32>
```

## Start local services

```bash
# From monorepo root
docker compose up -d
```

## Database

```bash
# Run migrations
pnpm prisma migrate dev

# Seed with sample data
pnpm prisma db seed
```

## Run

```bash
# Development (watch mode)
pnpm start:dev

# Production
pnpm build
pnpm start:prod
```

## API docs (Swagger)

Once the server is running, the interactive API documentation is available at:

```
http://localhost:3002/api/docs
```

Swagger UI lists every endpoint grouped by tag, shows request/response schemas, and lets you send requests directly from the browser.

To test authenticated endpoints in Swagger:

1. Call `POST /api/v1/auth/login` with valid credentials — the JWT is set as an HttpOnly cookie automatically.
2. Swagger will include the cookie on all subsequent requests in the same browser session.
3. Use the **Authorize** button (top right) if you need to set the cookie manually.

The raw OpenAPI JSON spec is available at:

```
http://localhost:3002/api/docs-json
```

You can import this URL directly into Postman: **Import → Link → paste the URL**.

## Endpoint overview

| Tag | Base path | Auth required |
|---|---|---|
| auth | `/api/v1/auth` | No (login/logout) |
| entries | `/api/v1/entries` | No |
| categories | `/api/v1/categories` | No |
| search | `/api/v1/search` | No |
| articles | `/api/v1/articles` | No |
| countries | `/api/v1/countries` | No |
| learn | `/api/v1/learn` | No |
| contributions | `/api/v1/contributions` | No (rate-limited) |
| admin/entries | `/api/v1/admin/entries` | editor+ |
| admin/queue | `/api/v1/admin/queue` | editor+ |
| admin/settings | `/api/v1/admin/settings/templates` | admin |
| admin/media | `/api/v1/admin/media` | editor+ |
| admin/users | `/api/v1/admin/users` | admin |

## Tests

```bash
# Unit tests
pnpm test

# Unit tests with coverage
pnpm test:cov

# e2e tests
pnpm test:e2e
```

## Response format

All responses are wrapped in a consistent envelope:

```json
{
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 100 },
  "error": null
}
```

Errors follow the same shape with `data: null` and a populated `error` object.
