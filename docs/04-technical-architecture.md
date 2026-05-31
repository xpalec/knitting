# Technical architecture — European Knitting Encyclopedia

## Companion documents
- `01-project-vision.md` — what we are building and why
- `02-features.md` — full feature list with launch priorities
- `03-data-model.md` — database schema and CTI model

---

## Overview

The project is a pnpm monorepo managed by Turborepo containing three applications and a set of shared packages. The public encyclopedia (`knitting`) and editorial dashboard (`admin`) are both Next.js 16.2 apps. All business logic, data access, and API contracts live exclusively in a NestJS backend (`api`). Neither frontend contains business logic.

```
knitting/                        ← GitHub repo root
├── apps/
│   ├── knitting/                ← public encyclopedia (Next.js 16.2)
│   ├── admin/                   ← editorial dashboard (Next.js 16.2)
│   └── api/                     ← NestJS backend (single source of truth)
├── packages/
│   ├── ui/                      ← shared shadcn/ui components
│   ├── types/                   ← shared TypeScript types & Zod schemas
│   ├── config-tailwind/         ← shared Tailwind config
│   ├── config-typescript/       ← shared tsconfig bases
│   └── config-eslint/           ← shared ESLint config
├── package.json                 ← pnpm workspace root
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Monorepo setup

**Package manager:** pnpm with workspaces. All inter-package dependencies use workspace protocol (`"@knitting/types": "workspace:*"`).

**Build orchestrator:** Turborepo. Tasks are defined in `turbo.json` with correct dependency ordering — `api` builds before frontends in CI, dev servers run in parallel locally.

**Turborepo pipeline:**
```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {}
  }
}
```

**Dev command:** `pnpm dev` at root starts all three apps concurrently via Turborepo.

**Ports (local development):**
- `knitting` → `http://localhost:3000`
- `admin` → `http://localhost:3001`
- `api` → `http://localhost:3002`

---

## App 1 — knitting (public encyclopedia)

### Purpose
The public-facing European Knitting Encyclopedia. Desktop-first, SEO-critical, multilingual, fully unauthenticated for readers. Contribution forms are the only interactive submission points.

### Stack
- **Framework:** Next.js 16.2, App Router
- **Styling:** Tailwind CSS + shadcn/ui (from `packages/ui`)
- **Language:** TypeScript

### Rendering strategy
The encyclopedia is a content reference site. Rendering decisions follow a single rule: **if a user reads it, render it on the server. If a user interacts with it, render it on the client.**

| Page / component | Strategy | Reason |
|---|---|---|
| Entry detail (`/[locale]/entry/[slug]`) | SSG + ISR | SEO critical; pre-rendered per locale |
| Entry list (`/[locale]/entries`) | SSR | Locale-aware sorting; filtered by query params |
| Category pages | SSG + ISR | Stable hierarchy; pre-rendered per locale |
| Country landing pages | SSG + ISR | Rarely updated |
| Article pages | SSG + ISR | Long-form editorial content |
| Traditions map | SSR + Client hydration | Static shell SSR; map interaction client-side |
| Learning paths | SSR | Ordered entry lists |
| Search results | SSR | Query-dependent, locale-aware |
| Search box (typeahead) | Client Component | User interaction, real-time |
| Language selector | Client Component | Navigates to new locale prefix |
| Contribution forms | Client Component | Form state, validation feedback |
| Learn path progress | Client Component | localStorage progress tracking |

### State management — knitting
The public encyclopedia has minimal client state. Two lightweight solutions cover everything:

**Zustand** — for global client state that needs to persist across navigation:
- Learn path progress per path ID

Locale is **not** stored in Zustand — it is read directly from the URL prefix (`/en/`, `/pl/`). The language selector navigates to the equivalent path in the new locale. No localStorage needed for locale.

Zustand is the right choice here over Redux (too heavy for this use case) or Context (re-render performance issues at scale).

```ts
// packages/types/src/store.ts (used by knitting app)
interface KnittingStore {
  learnProgress: Record<string, Set<string>>; // pathId → Set<entryId>
  markLearned: (pathId: string, entryId: string) => void;
}
```

**TanStack Query (React Query)** — for all server data fetching in Client Components:
- Search typeahead results
- Contribution form submission
- Any client-side data fetching

Server Components fetch directly from the NestJS API using `fetch()` with Next.js caching — no React Query needed there.

### App Router file structure
The App Router uses a `[locale]` dynamic segment at the root. All pages live under this segment — locale is always available as a param in every Server Component.

```
apps/knitting/src/app/
├── [locale]/
│   ├── layout.tsx                  ← root layout, receives locale param
│   ├── page.tsx                    ← landing page
│   ├── entry/
│   │   └── [slug]/page.tsx         ← entry detail (canonical segment)
│   ├── entries/
│   │   ├── page.tsx                ← entry list
│   │   └── category/[slug]/page.tsx
│   ├── country/[code]/page.tsx
│   ├── articles/
│   │   ├── page.tsx
│   │   └── [slug]/page.tsx
│   ├── map/page.tsx
│   ├── learn/
│   │   ├── page.tsx
│   │   └── [slug]/page.tsx
│   ├── contribute/
│   │   ├── page.tsx
│   │   ├── entry/page.tsx
│   │   └── translation/page.tsx
│   └── search/page.tsx
└── middleware.ts
```

### Localised URL routing

URLs use a locale prefix and localised path segments. The slug (entry identifier) is always the canonical English slug — only the surrounding path segments are translated.

**URL structure per locale:**

| Page | English | Polish |
|---|---|---|
| Landing | `/en` | `/pl` |
| Entry detail | `/en/entry/yarn-over` | `/pl/haslo/yarn-over` |
| Entry list | `/en/entries` | `/pl/hasla` |
| Category | `/en/entries/category/stitches` | `/pl/hasla/kategoria/sciegi` |
| Country | `/en/country/no` | `/pl/kraj/no` |
| Articles index | `/en/articles` | `/pl/artykuly` |
| Article detail | `/en/articles/yarn-history` | `/pl/artykuly/yarn-history` |
| Learn index | `/en/learn` | `/pl/nauka` |
| Learn detail | `/en/learn/beginner-terms` | `/pl/nauka/beginner-terms` |
| Search | `/en/search` | `/pl/szukaj` |
| Contribute | `/en/contribute` | `/pl/dodaj` |
| Map | `/en/map` | `/pl/mapa` |

**Key rule:** The slug (`yarn-over`, `beginner-terms`) never changes across locales. Only path segments (`entry` → `haslo`, `entries` → `hasla`) are translated. This means canonical URLs are stable and the API always receives the same slug regardless of locale.

### Path segment translation map

The translation map lives in `packages/types` and is the single source of truth for all localised path segments. Adding a new language means adding one entry here — nothing else changes.

```ts
// packages/types/src/i18n/segments.ts

export const SUPPORTED_LOCALES = ['en', 'pl'] as const
export type Locale = typeof SUPPORTED_LOCALES[number]
export const DEFAULT_LOCALE: Locale = 'en'

export const PATH_SEGMENTS = {
  en: {
    entry:      'entry',
    entries:    'entries',
    category:   'category',
    country:    'country',
    articles:   'articles',
    learn:      'learn',
    search:     'search',
    contribute: 'contribute',
    map:        'map',
  },
  pl: {
    entry:      'haslo',
    entries:    'hasla',
    category:   'kategoria',
    country:    'kraj',
    articles:   'artykuly',
    learn:      'nauka',
    search:     'szukaj',
    contribute: 'dodaj',
    map:        'mapa',
  },
} as const satisfies Record<Locale, Record<string, string>>

// Reverse map: localised segment → canonical segment
// Used by middleware to rewrite incoming paths
export const SEGMENT_TO_CANONICAL: Record<Locale, Record<string, string>> = 
  Object.fromEntries(
    SUPPORTED_LOCALES.map(locale => [
      locale,
      Object.fromEntries(
        Object.entries(PATH_SEGMENTS[locale]).map(([canonical, localised]) => [localised, canonical])
      )
    ])
  )
```

### Middleware — path rewriting

Next.js middleware intercepts every request to the `knitting` app. It has two responsibilities:

1. **Rewrite localised paths to canonical** — `/pl/haslo/yarn-over` → internally resolves as `/pl/entry/yarn-over` so the App Router finds `app/[locale]/entry/[slug]/page.tsx`
2. **Redirect root to default locale** — `/` → `/en` (later: detect `Accept-Language` and redirect to the matched locale)

```ts
// apps/knitting/src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  SEGMENT_TO_CANONICAL,
  type Locale,
} from '@knitting/types'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Redirect bare root to default locale
  if (pathname === '/') {
    return NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}`, request.url))
  }

  // Extract locale from first path segment
  const segments = pathname.split('/').filter(Boolean) // ['pl', 'haslo', 'yarn-over']
  const maybeLocale = segments[0] as Locale

  if (!SUPPORTED_LOCALES.includes(maybeLocale)) {
    // No recognised locale prefix — redirect to default
    return NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}${pathname}`, request.url))
  }

  // Rewrite localised segments to canonical
  const reverseMap = SEGMENT_TO_CANONICAL[maybeLocale]
  const rewritten = segments.map((seg, i) =>
    i === 0 ? seg : (reverseMap[seg] ?? seg) // keep locale prefix, rewrite the rest
  )

  const canonicalPath = '/' + rewritten.join('/')

  if (canonicalPath !== pathname) {
    const url = request.nextUrl.clone()
    url.pathname = canonicalPath
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

### Locale-aware link helper

A `localePath()` helper in `packages/types` builds correct localised URLs throughout the app. Server Components and Client Components both use this — never construct paths manually.

```ts
// packages/types/src/i18n/localePath.ts
import { PATH_SEGMENTS, type Locale } from './segments'

export function localePath(locale: Locale, page: keyof typeof PATH_SEGMENTS['en'], slug?: string): string {
  const segment = PATH_SEGMENTS[locale][page]
  return slug ? `/${locale}/${segment}/${slug}` : `/${locale}/${segment}`
}

// Usage
localePath('en', 'entry', 'yarn-over')   // → '/en/entry/yarn-over'
localePath('pl', 'entry', 'yarn-over')   // → '/pl/haslo/yarn-over'
localePath('pl', 'articles')             // → '/pl/artykuly'
```

### Language selector behaviour

The language selector is a Client Component that navigates to the current page's equivalent in the new locale. It uses `localePath()` and the current route params to construct the target URL — no page reload, no localStorage write.

```ts
// Switching from /en/entry/yarn-over to Polish:
// → localePath('pl', 'entry', 'yarn-over') → '/pl/haslo/yarn-over'
router.push(localePath(newLocale, currentPage, currentSlug))
```

### Auto-detection (future feature)

When ready to add language auto-detection, the middleware change is minimal — one additional block before the locale redirect:

```ts
// Future addition in middleware.ts
if (pathname === '/') {
  const acceptLanguage = request.headers.get('accept-language') ?? ''
  const detected = parseAcceptLanguage(acceptLanguage, SUPPORTED_LOCALES) ?? DEFAULT_LOCALE
  return NextResponse.redirect(new URL(`/${detected}`, request.url))
}
```

No routing, no component, no store changes required. The feature is designed in from day one.

---

## App 2 — admin (editorial dashboard)

### Purpose
Internal tool for the editorial team. Manages the entry submission queue, translation review, media uploads, user roles, and content publishing. Never indexed by search engines. Requires authentication for all routes.

### Stack
- **Framework:** Next.js 16.2, App Router
- **Styling:** Tailwind CSS + shadcn/ui (from `packages/ui`)
- **Language:** TypeScript

### Rendering strategy
The admin panel is fully authenticated and never SEO-relevant. Almost everything is a Client Component. Server Components are used only for the initial authenticated shell (middleware validates the session cookie before the page renders).

| Page / component | Strategy | Reason |
|---|---|---|
| Auth (login page) | Server Component | Static shell |
| Dashboard layout | Server Component | Auth check in middleware |
| All data tables | Client Component | Sorting, filtering, pagination |
| All forms | Client Component | Form state, validation, optimistic updates |
| Entry editor | Client Component | Rich interactions |
| Queue management | Client Component | Real-time feel, bulk actions |
| Media uploader | Client Component | File input, progress tracking |

### State management — admin
The admin panel is interaction-heavy — data tables, approval queues, multi-step forms, bulk actions. It needs more robust state management than the public site.

**Zustand** — for global admin state:
- Authenticated user and role
- UI state (sidebar open/closed, active filters, selected rows for bulk actions)
- Notification/toast queue

**TanStack Query** — for all server data:
- Entry submission queue (paginated, real-time refetch)
- Translation queue
- Entry CRUD operations
- Media upload state

TanStack Query's `useMutation` with optimistic updates gives the admin panel a fast, responsive feel without complex manual cache management. Invalidate queries on mutation success to keep tables fresh.

### Authentication
- **Method:** JWT tokens issued by the NestJS API
- **Storage:** HttpOnly cookie (set by NestJS, read by Next.js middleware)
- **Session check:** Next.js middleware validates the cookie on every admin route — unauthenticated requests redirect to `/login`
- **Roles:** `editor` · `reviewer` · `admin` — enforced server-side in NestJS, mirrored in the Zustand auth store for UI conditional rendering

### Key routes
```
/login                     authentication
/dashboard                 overview stats
/queue/entries             new entry submissions
/queue/translations        translation contributions
/queue/corrections         correction reports
/entries                   all published entries (searchable)
/entries/[id]              entry detail + edit
/entries/new               create entry
/articles                  article management
/articles/new              create article
/media                     media asset library
/users                     user management (admin role only)
/settings                  site settings
```

---

## App 3 — api (NestJS backend)

### Purpose
Single source of truth for all data, business logic, and validation. Both frontend apps call this API. No business logic lives in the Next.js apps — ever.

### Stack
- **Framework:** NestJS
- **Language:** TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Caching:** Redis
- **Media storage:** Cloudflare R2 (S3-compatible)

### Module structure
```
src/
├── app.module.ts
├── main.ts
├── modules/
│   ├── entry/              ← core encyclopedia entries (CTI base)
│   │   ├── entry.module.ts
│   │   ├── entry.controller.ts
│   │   ├── entry.service.ts
│   │   └── dto/
│   ├── entry-detail/       ← CTI detail tables (technique, stitch, tool, etc.)
│   ├── translation/        ← locale-specific terms and definitions
│   ├── category/           ← hierarchical taxonomy
│   ├── tag/
│   ├── media/              ← media asset management + R2 upload
│   ├── article/            ← long-form editorial content
│   ├── search/             ← full-text search across entries + translations
│   ├── contribution/       ← public submission queue
│   ├── pattern-usage/
│   ├── learn/              ← learning path management
│   ├── auth/               ← JWT auth, role management
│   └── user/               ← admin user management
├── common/
│   ├── guards/             ← JwtAuthGuard, RolesGuard
│   ├── decorators/
│   ├── filters/            ← global exception filter
│   ├── interceptors/       ← response transform, logging
│   └── pipes/              ← validation pipe (class-validator)
└── prisma/
    └── prisma.service.ts
```

### API design
- **Style:** REST with consistent resource naming
- **Versioning:** URL prefix `/api/v1/`
- **Validation:** class-validator + class-transformer on all DTOs
- **Response envelope:** all responses wrapped in `{ data, meta?, error? }`
- **Pagination:** cursor-based for entry lists (keyset), offset for admin tables

**Key endpoints:**

```
# Public (no auth)
GET    /api/v1/entries                    paginated list, locale-aware
GET    /api/v1/entries/:slug              entry detail with translations
GET    /api/v1/entries/search?q=&locale=  full-text search
GET    /api/v1/categories                 category tree (locale param required; resolves names via CategoryTranslation)
GET    /api/v1/categories/:slug/entries   entries in category (slug is locale-specific; resolved via CategoryTranslation)
GET    /api/v1/articles                   article list
GET    /api/v1/articles/:slug             article detail
GET    /api/v1/countries/:code            country landing data
GET    /api/v1/learn                      learning paths
GET    /api/v1/learn/:slug                learning path with entries
POST   /api/v1/contributions/entry        submit new entry (public)
POST   /api/v1/contributions/translation  submit translation (public)
POST   /api/v1/contributions/correction   report correction (public)

# Admin (JWT required)
GET    /api/v1/admin/queue/entries        pending entry submissions
PATCH  /api/v1/admin/queue/entries/:id    approve / reject
GET    /api/v1/admin/queue/translations   pending translations
PATCH  /api/v1/admin/queue/translations/:id
POST   /api/v1/admin/entries              create entry
PUT    /api/v1/admin/entries/:id          update entry
DELETE /api/v1/admin/entries/:id          soft delete (sets status=deprecated)
POST   /api/v1/admin/media/upload         upload to R2, return asset URL
GET    /api/v1/admin/users                user list
POST   /api/v1/auth/login                 issue JWT
POST   /api/v1/auth/refresh               refresh JWT
POST   /api/v1/auth/logout
```

### Database — PostgreSQL + Prisma

**Prisma schema mirrors the CTI data model** from `03-data-model.md`. Key points:

- `entry` is the base table with `entry_type` enum
- Detail tables (`entry_technique`, `entry_stitch`, `entry_yarn_weight`, `entry_yarn_fiber`, `entry_tool`, `entry_person`, `entry_tradition`) each have a 1:1 FK to `entry.id`
- `translation` has a unique constraint on `(entry_id, locale)`
- `search_vector` is a generated `tsvector` column on both `entry` and `translation`
- All timestamps in UTC
- UUID v7 for all primary keys

**Migrations:** Prisma Migrate for all schema changes. Never edit the database directly. Migration files committed to the repo.

### Caching — Redis

Redis is used for two purposes:

1. **API response caching** — frequently requested, rarely changing data:
   - Entry detail pages: TTL 1 hour, invalidated on publish/update
   - Category tree: TTL 24 hours
   - Country landing data: TTL 6 hours
   - Search results: TTL 5 minutes

2. **Rate limiting** — public contribution endpoints:
   - Entry submissions: 5 per IP per hour
   - Translation submissions: 20 per IP per hour
   - Correction reports: 10 per IP per hour

### Media storage — Cloudflare R2

All binary assets (entry images, diagrams, video clips) are stored in R2, never in PostgreSQL.

- NestJS receives the file, validates type and size, uploads to R2
- Returns the CDN URL, which is stored in `media_asset.url`
- Allowed types: `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml`, `video/mp4`
- Max file size: 50MB for video, 5MB for images

### Full-text search

PostgreSQL native full-text search via `tsvector`. No external search service needed at launch.

- `entry.search_vector` indexes `term + abbreviation + definition` in English
- `translation.search_vector` indexes `term + definition` using the locale's PostgreSQL dictionary (`polish`, `german`, `norwegian`, `french`, `english`)
- Search query hits `translation` first (locale-ranked), falls back to `entry`
- Upgrade path: Meilisearch can be added later without data model changes — just sync from Postgres

---

## Shared packages

### `packages/ui`
Shared shadcn/ui components consumed by both `knitting` and `admin`. Components are copied into this package using the shadcn CLI then customised. Both apps import from `@knitting/ui`.

```ts
// Usage in either app
import { Button, Card, Badge } from '@knitting/ui'
```

Tailwind config in each app extends `packages/config-tailwind` to ensure consistent design tokens.

### `packages/types`
Shared TypeScript types and Zod validation schemas used by all three apps. This is the contract between frontend and backend.

```ts
// Zod schema defined once, used everywhere
export const EntrySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  term: z.string(),
  definition: z.string(),
  entryType: EntryTypeEnum,
  skillLevel: SkillLevelEnum,
  status: StatusEnum,
  // ...
})

export type Entry = z.infer<typeof EntrySchema>
```

NestJS DTOs extend these schemas. Next.js Server Components use them to type API responses. This eliminates an entire class of frontend/backend type mismatch bugs.

### `packages/config-tailwind`
Base Tailwind config with shared design tokens (colours, typography, spacing). Both Next.js apps extend this:

```js
// apps/knitting/tailwind.config.ts
import baseConfig from '@knitting/config-tailwind'
export default { ...baseConfig, content: ['./src/**/*.{ts,tsx}'] }
```

### `packages/config-typescript`
Base `tsconfig.json` presets. Three variants: `base.json`, `nextjs.json`, `nestjs.json`. All apps extend the relevant preset.

### `packages/config-eslint`
Shared ESLint config. Enforces consistent rules across all apps. Extends Next.js, NestJS, and base presets.

---

## Infrastructure

### Local development
```bash
# Install all dependencies
pnpm install

# Start all apps
pnpm dev

# Start individual app
pnpm dev --filter=knitting
pnpm dev --filter=admin
pnpm dev --filter=api

# Run migrations
pnpm --filter=api prisma migrate dev

# Type check all
pnpm typecheck

# Lint all
pnpm lint
```

**Local services (Docker Compose):**
```yaml
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

### Deployment

| App | Platform | Notes |
|---|---|---|
| `knitting` | Vercel | SSG/ISR, edge network, automatic deploys from `main` |
| `admin` | Vercel | Separate Vercel project, protected by auth |
| `api` | Railway | NestJS + managed PostgreSQL + Redis add-ons |
| Media | Cloudflare R2 | S3-compatible object storage |
| DNS | Cloudflare | CDN + DDoS protection |

**Domains:**
- `knitting.example.com` → `apps/knitting` on Vercel
- `admin.knitting.example.com` → `apps/admin` on Vercel
- `api.knitting.example.com` → `apps/api` on Railway

### CI/CD — GitHub Actions

Three workflows, one per app. Turborepo's `--filter` ensures only the affected app rebuilds on each push.

```yaml
# .github/workflows/ci.yml (simplified)
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo typecheck lint build
```

**Branch strategy:**
- `main` → production deploys (all three apps)
- `develop` → staging deploys
- `feature/*` → preview deploys (Vercel preview URLs for frontends)

---

## Environment variables

Each app has its own `.env` file. Shared structure:

**`apps/api/.env`**
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
JWT_EXPIRY=7d
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=knitting-media
R2_PUBLIC_URL=https://media.knitting.example.com
```

**`apps/knitting/.env`**
```
NEXT_PUBLIC_API_URL=https://api.knitting.example.com
```

**`apps/admin/.env`**
```
NEXT_PUBLIC_API_URL=https://api.knitting.example.com
NEXTAUTH_SECRET=...
```

---

## Key architectural decisions

| Decision | Choice | Rationale |
|---|---|---|
| Monorepo tool | Turborepo | Task caching, parallel dev, per-app CI filtering |
| Package manager | pnpm | Disk-efficient, strict dependency resolution, workspace support |
| Backend | NestJS as single API | One source of truth; no business logic duplication across frontends |
| ORM | Prisma | Type-safe queries, migration tooling, excellent NestJS integration |
| State management | Zustand + TanStack Query | Zustand for global UI state; TanStack Query for server data |
| Rendering (knitting) | SSG/ISR + SSR + selective CSR | SEO-critical content static; interactive components client-side |
| Rendering (admin) | CSR with authenticated shell | No SEO requirement; interaction-heavy; simpler mental model |
| Auth | JWT in HttpOnly cookie | Secure, works across Next.js middleware and NestJS guards |
| Search | PostgreSQL tsvector | Sufficient for launch; locale-aware; no extra infrastructure |
| Media | Cloudflare R2 | S3-compatible, cheap egress, integrates with Cloudflare CDN |
| Locale in URL | Yes — `[locale]` prefix + localised path segments | SEO benefit per language; stable canonical slugs; auto-detect ready |
| Path segment translation | Middleware rewrite to canonical | App Router file system stays in English; one map in `packages/types` |
| New language additions | Add entry to `PATH_SEGMENTS` map | Zero routing, component, or store changes needed |
| Shared types | `packages/types` with Zod | Single schema definition used by API DTOs and frontend types |

---

## Constraints and notes for AI assistants

When generating code for this project:

- All business logic belongs in `apps/api` (NestJS). Never add data fetching logic, validation, or database queries to the Next.js apps.
- `apps/knitting` Next.js Server Components call the NestJS API via `fetch()`. Client Components use TanStack Query.
- `apps/admin` is almost entirely Client Components. Use TanStack Query for all data fetching and mutations.
- Shared TypeScript types and Zod schemas live in `packages/types`. Import from `@knitting/types` in all apps.
- Shared UI components live in `packages/ui`. Import from `@knitting/ui`.
- The database schema follows the CTI (Concrete Table Inheritance) pattern described in `03-data-model.md`. The `entry` table is the base; detail tables (`entry_technique`, `entry_stitch`, etc.) hold type-specific fields.
- All entry URLs are slug-based. Slugs are canonical English identifiers and never change across locales.
- All routes in `apps/knitting` are prefixed with `[locale]`. The App Router file system uses canonical English path segments (`entry`, `entries`, `articles`). Middleware rewrites localised segments to canonical before routing resolves.
- Never construct paths manually in components. Always use `localePath(locale, page, slug?)` from `@knitting/types`.
- Never hardcode locale strings — always use the `Locale` type and `SUPPORTED_LOCALES` from `@knitting/types`.
- Locale is read from the URL param (`params.locale`) in Server Components and from `useParams()` in Client Components. It is never stored in Zustand or localStorage.
- Adding a new language requires only adding an entry to `PATH_SEGMENTS` in `packages/types/src/i18n/segments.ts`. No other files change.
- Entry status lifecycle: `draft` → `review` → `published`. Use `deprecated` instead of deleting entries.
- All timestamps are UTC. Format for display in the UI layer only.

---

*Document version: 1.0 — May 2026*
*Repo name: knitting*
