# European Knitting Encyclopedia

Monorepo for the European Knitting Encyclopedia — a multilingual reference for knitting terms, techniques, and traditions.

## Apps

| App | Port | Description |
|---|---|---|
| `apps/knitting` | 3000 | Public encyclopedia (Next.js) |
| `apps/admin` | 3001 | Editorial dashboard (Next.js) |
| `apps/api` | 3002 | NestJS backend API |

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Getting started

### 1. Install dependencies

```sh
pnpm install
```

### 2. Set up environment variables

Copy the example env files for each app:

```sh
copy apps\api\.env.example apps\api\.env
copy apps\knitting\.env.example apps\knitting\.env
copy apps\admin\.env.example apps\admin\.env
```

### 3. Start local services (Postgres + Redis)

```sh
docker compose up -d
```

This starts:
- **Postgres 18** on `localhost:5432` — database `knitting`, user `knitting`, password `knitting`
- **Redis 8** on `localhost:6379`

To stop services:

```sh
docker compose down
```

### 4. Run database migrations

```sh
pnpm --filter=api prisma migrate deploy
```

### 5. Seed the database

```sh
pnpm --filter=api prisma db seed
```

Seeds 5 block templates and 3 sample entries (Yarn Over, K2tog, Brioche Stitch) with English and Polish translations.

Also seeds 2 editorial users for the admin dashboard:

| Email | Password | Role |
|---|---|---|
| `admin@knitting.local` | `admin123` | admin |
| `editor@knitting.local` | `editor123` | editor |

### 6. Start all apps

```sh
pnpm dev
```

Or start a single app:

```sh
pnpm --filter=knitting dev   # public encyclopedia → http://localhost:3000
pnpm --filter=admin dev      # admin dashboard    → http://localhost:3001
pnpm --filter=api dev        # API                → http://localhost:3002
```

## Database access (pgAdmin)

If you have pgAdmin running, add a new server with these connection details:

| Field | Value |
|---|---|
| Host | `host.docker.internal` |
| Port | `5432` |
| Database | `knitting` |
| Username | `knitting` |
| Password | `knitting` |

## Other commands

```sh
# Type-check all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Build all packages
pnpm build

# Generate Prisma client after schema changes
pnpm --filter=api prisma generate

# Open Prisma Studio (visual DB browser)
pnpm --filter=api prisma studio
```

## Docs

- [`docs/implementation-plan.md`](docs/implementation-plan.md) — phase-by-phase build plan
- [`docs/tasks.md`](docs/tasks.md) — full task checklist
- [`docs/03-data-model.md`](docs/03-data-model.md) — database schema reference (v2.3)
