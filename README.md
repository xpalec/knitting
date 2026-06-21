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

## Copying data between environments

Use `pg_dump` and `pg_restore` to move database content between production, staging, and local environments. Migrations (schema) travel via git — only the data needs to be dumped.

### Full database copy (production → local)

```sh
# 1. Dump the production database
pg_dump $PROD_DATABASE_URL --no-owner --no-acl -F c -f backup.dump

# 2. Apply any pending schema migrations to the target first
pnpm --filter=api prisma migrate deploy

# 3. Restore the dump into the local database
pg_restore --no-owner --no-acl -d $LOCAL_DATABASE_URL --clean --if-exists backup.dump
```

`-F c` uses the custom binary format (smaller, faster than plain SQL).  
`--clean --if-exists` drops existing objects before recreating them so the restore is idempotent.

### Partial copy — specific tables only

Useful when you only want to sync content (categories, entries, translations) without touching users or settings:

```sh
# Dump selected tables
pg_dump $PROD_DATABASE_URL \
  -t category -t category_translation \
  -t entry -t translation \
  -t tag -t tag_translation -t entry_tag \
  --no-owner --no-acl -F c -f content.dump

# Restore into local (use --data-only if schema already matches)
pg_restore --no-owner --no-acl --data-only -d $LOCAL_DATABASE_URL content.dump
```

### Shortcuts with connection strings

If your environment variables are already set, you can reference them directly:

```sh
# Example: local Docker setup from the default .env
LOCAL_DATABASE_URL="postgresql://knitting:knitting@localhost:5432/knitting"

pg_dump "$PROD_DATABASE_URL" --no-owner --no-acl -F c -f backup.dump
pg_restore --no-owner --no-acl -d "$LOCAL_DATABASE_URL" --clean --if-exists backup.dump
```

### Notes

- **Schema first** — always run `pnpm --filter=api prisma migrate deploy` on the target before restoring data to ensure the tables exist and match.
- **UUIDs are preserved** — `pg_restore` keeps the original IDs, so relationships between entries, categories, and tags stay intact.
- **Seed vs. dump** — use the seed (`pnpm --filter=api prisma db seed`) for a clean blank-slate bootstrap; use `pg_dump`/`pg_restore` when you want to carry over real content you've built up.
