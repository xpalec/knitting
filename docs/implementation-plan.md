# Implementation Plan — European Knitting Encyclopedia

## Overview

This document describes how to set up the codebase and progress through implementation phases. It is companion to `tasks.md`, which contains the full task breakdown.

---

## Repository & tooling

**Repo name:** `knitting`  
**Package manager:** pnpm  
**Build orchestrator:** Turborepo  
**Language:** TypeScript throughout

### Monorepo structure

```
knitting/
├── apps/
│   ├── knitting/        ← public encyclopedia (Next.js 16.2, App Router)
│   ├── admin/           ← editorial dashboard (Next.js 16.2, App Router)
│   └── api/             ← NestJS backend (single source of truth)
├── packages/
│   ├── ui/              ← shared shadcn/ui components
│   ├── types/           ← shared TypeScript types & Zod schemas
│   ├── config-tailwind/ ← shared Tailwind config
│   ├── config-typescript/ ← tsconfig bases (base, nextjs, nestjs)
│   └── config-eslint/   ← shared ESLint rules
├── .github/workflows/   ← CI/CD
├── docker-compose.yml   ← local Postgres + Redis
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

### Port assignments (local dev)

| App | Port |
|---|---|
| `knitting` | 3000 |
| `admin` | 3001 |
| `api` | 4000 |
| Postgres | 5432 |
| Redis | 6379 |

---

## Phase 0 — Monorepo scaffolding

**Goal:** empty repo that builds, lints, and type-checks cleanly. No application code yet.

### Steps

1. **Initialise the repo**
   ```bash
   mkdir knitting && cd knitting
   git init
   pnpm init
   ```

2. **Add pnpm workspace config**
   ```yaml
   # pnpm-workspace.yaml
   packages:
     - "apps/*"
     - "packages/*"
   ```

3. **Add Turborepo**
   ```bash
   pnpm add -D turbo -w
   ```
   Create `turbo.json` with pipeline: `build`, `dev`, `lint`, `typecheck`.

4. **Scaffold shared packages** (all empty at this point)
   - `packages/config-typescript` — three tsconfig presets: `base.json`, `nextjs.json`, `nestjs.json`
   - `packages/config-eslint` — base ESLint config with Next.js and NestJS extends
   - `packages/config-tailwind` — base Tailwind config with design tokens (colours, typography, spacing)
   - `packages/types` — stub `index.ts`, will grow in Phase 1
   - `packages/ui` — stub package, shadcn components added in Phase 2

5. **Scaffold apps**
   ```bash
   # Public encyclopedia
   pnpm create next-app@latest apps/knitting --typescript --tailwind --app --src-dir --no-eslint
   # Admin dashboard
   pnpm create next-app@latest apps/admin --typescript --tailwind --app --src-dir --no-eslint
   # NestJS API
   pnpm dlx @nestjs/cli new apps/api --package-manager pnpm --skip-git
   ```

6. **Wire up workspace dependencies** in each app's `package.json`:
   - All three apps depend on `@knitting/types`
   - Both Next.js apps depend on `@knitting/ui` and `@knitting/config-tailwind`
   - Each app extends the relevant `@knitting/config-typescript` preset

7. **Add Docker Compose** for local services:
   ```yaml
   services:
     postgres:
       image: postgres:16
       environment:
         POSTGRES_DB: knitting
         POSTGRES_USER: knitting
         POSTGRES_PASSWORD: knitting
       ports: ["5432:5432"]
     redis:
       image: redis:7-alpine
       ports: ["6379:6379"]
   ```

8. **Add `.env.example` files** for all three apps.

9. **Add GitHub Actions CI** (`.github/workflows/ci.yml`) — install, typecheck, lint, build.

**Exit criterion:** `pnpm dev` starts all three apps; `pnpm typecheck && pnpm lint && pnpm build` passes in CI.

---

## Phase 1 — Shared types package + database schema

**Goal:** `@knitting/types` exports all Zod schemas, TypeScript types, i18n utilities, and the `localePath` helper. Prisma schema is defined and the first migration runs locally.

### `packages/types` — what to build

- **i18n module** (`src/i18n/`)
  - `segments.ts` — `SUPPORTED_LOCALES`, `PATH_SEGMENTS` map, `SEGMENT_TO_CANONICAL` reverse map
  - `localePath.ts` — `localePath(locale, page, slug?)` helper
- **Zod schemas** (`src/schemas/`)
  - `entry.ts` — `EntrySchema`, `SkillLevelEnum`, `StatusEnum`, `ContentBlockSchema`
  - `translation.ts` — `TranslationSchema`, `TranslationMetadataSchema`, `BlocksSchema`
  - `category.ts` — `CategorySchema`
  - `article.ts` — `ArticleSchema`
  - `contribution.ts` — schemas for public submission forms
  - `learn.ts` — `LearningPathSchema`
  - `media.ts` — `MediaAssetSchema`
- **Store types** (`src/store.ts`) — `KnittingStore` interface (Zustand shape for the public app)
- **Index export** — re-exports everything from a single `index.ts`

### Data model overview (v2.3)

The schema centres on two key design decisions that flow through every phase:

**No `slug` or `term` on `Entry`.** English is just another locale. The `en` `Translation` row holds the English display name and slug. `Entry.id` (UUID v7) is the sole internal identifier — used in admin, API routes, seeds, and inter-entry relations. Public URLs never expose `Entry.id`.

**Block-based content architecture.** `Entry.content_blocks` is a pure layout manifest (admin-controlled): an ordered array of typed block descriptors with stable UUIDs. `Translation.blocks` holds all translated content, keyed by those same block IDs (editor-controlled). A page renders by iterating `content_blocks` and looking up each block's translated content from `Translation.blocks`. No separate `Technique` or `Abbreviation` tables exist — these are block types and locale metadata respectively.

**All search through `Translation.search_vector`.** There is no `search_vector` on `Entry`. Every locale — including English — is indexed in its own `Translation` row using a locale-appropriate PostgreSQL dictionary. The trigger fires on INSERT/UPDATE, extracting text from `term`, `metadata->>'definition_short'`, and all `text` nodes in `blocks`.

**`Entry.origin_language` is a typed column**, not a metadata key. It is constrained to supported BCP-47 locale codes and drives the traditions map, country landing pages, editorial attribution, and translation priority queuing.

### `apps/api` — Prisma schema

Install Prisma and create `schema.prisma` modelling all tables from `03-data-model.md` v2.3:

- `Entry` — `id` (UUID v7), `origin_language` (NOT NULL, constrained), `status`, `metadata` (jsonb), `content_blocks` (jsonb layout manifest), timestamps
- `Translation` — `entry_id`, `locale`, `slug`, `term`, `metadata` (jsonb: `abbreviation`, `definition_short`), `blocks` (jsonb keyed by block ID), `translator_note`, `status`, `search_vector` (tsvector); unique on `(entry_id, locale)` and `(locale, slug)`
- `Category` with self-referential `parent_id`; `EntryCategory` join table
- `Tag`; `EntryTag` join table
- `RelatedEntry` self-join with `relation_type` enum and `direction`
- `MediaAsset` — URL is locale-independent (CDN); alt text and caption live in `Translation.blocks`
- `PatternUsage`
- `BlockTemplate` — default `content_blocks` array per `entry_type`; used when creating new entries
- `Article`; `ArticleTag` join table
- `LearningPath`; `LearningPathEntry` join table (with `sort_order`)
- `Contribution` (pending submissions queue)
- `User` with role enum

**Removed from prior versions:** `Technique` and `TechniqueTranslation` tables (technique content is now a `technique` block in `Translation.blocks`); `Abbreviation` table (covered by `Translation.metadata.abbreviation`).

Run `pnpm --filter=api prisma migrate dev --name init`.

In the migration, add the `search_vector` trigger for `Translation` (raw SQL): fires on INSERT/UPDATE, extracts all `text` nodes from `blocks` via `jsonb_path_query`, combines with `term` and `metadata->>'definition_short'`, calls `to_tsvector` with the locale-appropriate dictionary.

Add a seed script (`prisma/seed.ts`) with ~20 sample entries covering the five supported countries. Each entry needs: `Entry` row, at minimum `en` and `pl` `Translation` rows (with `slug`, `term`, `metadata`, and `blocks` content), at least one block per entry in `content_blocks`. Seed `BlockTemplate` rows for entry types: `stitch`, `technique`, `tool`, `tradition`, `yarn_weight`.

**Exit criterion:** migration runs cleanly; trigger populates `Translation.search_vector` on seed insert; all types export correctly from `@knitting/types`.

---

## Phase 2 — NestJS API (core modules)

**Goal:** the API serves real data. Entry list, entry detail, categories, search, and public contribution endpoints are working and tested.

### Module build order

Build modules in dependency order — each module is a `module.ts` + `controller.ts` + `service.ts` + `dto/` directory.

1. **`PrismaModule`** — global, provides `PrismaService`
2. **`CategoryModule`** — simple CRUD; no dependencies; build first to unblock Entry
3. **`EntryModule`** — core module; paginated list with locale-aware sorting; entry detail assembled from `content_blocks` + `Translation.blocks`
4. **`TranslationModule`** — locale-specific term/slug/blocks lookup; called by EntryService; resolves entries via `(locale, slug)` pair
5. **`SearchModule`** — full-text search exclusively via `Translation.search_vector`; ranks results by active locale; no fallback to `Entry`
6. **`ArticleModule`** — list + detail
7. **`LearnModule`** — learning path list + detail with ordered entries
8. **`ContributionModule`** — public POST endpoints for entry, translation, and correction submissions; rate-limited via Redis; approved entry submissions seed `content_blocks` from `BlockTemplate`
9. **`MediaModule`** — R2 upload endpoint (admin only); returns CDN URL; `MediaAsset` row linked to entry; alt text and caption managed via `Translation.blocks`, not `MediaAsset`
10. **`AuthModule`** — JWT issue, refresh, logout; role guard
11. **`UserModule`** — admin user management (admin role only)
12. **`AdminQueueModule`** — approve/reject queued submissions; calls EntryService and TranslationService to publish

### URL resolution for entry detail

Middleware passes `{ locale, slug }` to the API. The API resolves via `WHERE locale = $1 AND slug = $2` on `Translation`, then joins to `Entry`. `Entry.id` is never in a public URL. The `GET /api/v1/entries/:locale/:slug` endpoint (or equivalent query param shape) is the canonical pattern.

### Block rendering contract

The entry detail endpoint returns the assembled entry in this shape:
```
{
  id: UUID,
  origin_language: string,
  metadata: object,
  content_blocks: ContentBlock[],   // layout manifest from Entry
  translation: {
    locale, slug, term, status,
    metadata: { abbreviation?, definition_short? },
    blocks: Record<blockId, TranslatedBlockContent>
  },
  related_entries: [...],
  media_assets: [...]
}
```

The frontend iterates `content_blocks` in `order` order, looks up each block's content from `translation.blocks[block.id]`, and renders the matching component. `visible: false` blocks are omitted for public readers; returned (but visually indicated) in the admin editor.

### API conventions

- All responses: `{ data, meta?, error? }`
- All routes versioned under `/api/v1/`
- Validation: `ValidationPipe` globally with `class-validator`
- Pagination: cursor-based for public entry lists; offset for admin tables
- Redis caching via `@nestjs/cache-manager`: entry detail (1h TTL), category tree (24h), country data (6h), search (5min)
- Rate limiting via `@nestjs/throttler` backed by Redis: contribution endpoints only

### Testing

Write unit tests (Jest) for service methods. Write e2e tests (supertest) for all public endpoints. Target: every public endpoint covered by at least one happy-path and one error-path test.

**Exit criterion:** all public endpoints return correct data from the seeded database; Swagger UI at `/api/docs` documents every endpoint.

---

## Phase 3 — `packages/ui` shared component library

**Goal:** shadcn/ui components are installed and customised in `packages/ui`. Both Next.js apps can import from `@knitting/ui`.

### Setup

```bash
cd packages/ui
pnpm dlx shadcn@latest init
```

Install the components needed for Phase 4 (public app) first:

- `Button`, `Badge`, `Card`, `Input`, `Select`, `Separator`
- `Breadcrumb`, `Tabs`, `Sheet` (mobile nav)
- `Dialog`, `Form`, `Label`, `Textarea` (contribution forms)
- `Skeleton` (loading states)
- `Table` (admin)
- `DropdownMenu`, `Popover` (admin)

Customise the design tokens in `packages/config-tailwind` to match the encyclopedia's visual identity: warm neutral palette, serif headings (for the "reference book" feel), readable body text sizing.

**Exit criterion:** both apps can import a `Button` from `@knitting/ui` and render it correctly with shared Tailwind tokens.

---

## Phase 4 — Public encyclopedia (`apps/knitting`) — LAUNCH features

**Goal:** all `[LAUNCH]` features from `02-features.md` are implemented in the public encyclopedia.

### Build order within Phase 4

Build pages in order of dependency — shared layout and routing infrastructure first, then data-driven pages.

**4a — Routing infrastructure**
- Middleware (`middleware.ts`) — locale detection, localised-path rewriting to canonical
- Root layout (`[locale]/layout.tsx`) — persistent header, footer, language selector, locale param propagation
- Language selector Client Component — uses `localePath()` to navigate

**4b — Entry list & detail** (the encyclopedia's core)

The entry detail page is the most content-rich page on the site. It receives `content_blocks` (layout) and `translation.blocks` (content) from the API and renders each block with its matching component. Block types at launch: `definition` (TipTap JSON rendered as rich text), `technique` (name, difficulty, step-by-step), `media` (locale-aware alt text and caption), `callout` (tip/warning), `related` (draws from `related_entries`), `pattern_usage` (draws from `PatternUsage` rows).

URL resolution for entry detail: the page lives at `/[locale]/entry/[slug]` where `slug` is the locale-specific `Translation.slug`. The API call passes `{ locale, slug }` — `Entry.id` is never in the URL.

**4c — Category pages**
- Category index — all top-level categories with entry counts
- Category detail — subcategories + entries within, breadcrumb

**4d — Landing page**
- Hero section with search box
- Navigation tile grid (7 tiles)
- Footer

**4e — Country landing pages**
- One page per country: Poland, Norway, Germany/Austria, UK/Ireland, France
- Driven by `origin_language` field on `Entry`; API filters entries by `origin_language`
- Editorial intro + featured entries + links to filtered list and articles

**4f — Search results page**
- Full-text search exclusively via `Translation.search_vector` across all locales
- Results ranked by active locale match first
- Filter bar (locale, category, skill level)
- Search box typeahead (Client Component, TanStack Query)

**4g — Articles**
- Article index — grid of cards with filter by tag and country
- Article detail — rich text, inline entry cards, tags, author credit

**4h — Traditions map**
- SVG map of Europe — clickable zones per country
- Country zones driven by `Entry.origin_language` aggregations
- Hover tooltip, click navigates to country page

**4i — Learn**
- Learning path index — list of paths with metadata
- Learning path detail — ordered step cards, progress indicator (Zustand + localStorage)

**4j — Contribution forms**
- Entry submission form
- Translation contribution form
- Correction report form (lightweight, opened from entry detail)

### Rendering strategy (per page)

| Page | Strategy |
|---|---|
| Entry detail | SSG + ISR (revalidate: 3600) |
| Entry list | SSR |
| Category pages | SSG + ISR |
| Country landing | SSG + ISR |
| Article pages | SSG + ISR |
| Search results | SSR |
| Traditions map | SSR + client hydration |
| Learning paths | SSR |
| Search box (typeahead) | Client Component |
| Language selector | Client Component |
| Contribution forms | Client Component |
| Learn path progress | Client Component |

**Exit criterion:** all `[LAUNCH]` features from `02-features.md` work end-to-end against the real API; all pages are server-rendered or statically generated; Lighthouse score ≥ 90 on performance and accessibility.

---

## Phase 5 — Admin dashboard (`apps/admin`) — LAUNCH features

**Goal:** editorial team can log in, review the submission queue, approve/reject entries and translations, create and edit entries, and upload media.

### Build order within Phase 5

**5a — Auth**
- Login page — email + password form, posts to `/api/v1/auth/login`, stores JWT in HttpOnly cookie
- Middleware — validates session cookie on every admin route; redirects to `/login` if missing
- Zustand auth store — mirrors role for UI conditional rendering

**5b — Layout**
- Authenticated shell — sidebar navigation, user menu, notification area
- Route protection — all routes require auth; role-specific sections hidden/shown per RBAC matrix

**5c — Queue management** (highest editorial priority)
- `/queue/entries` — list of pending submissions; approve/reject/edit each
- `/queue/translations` — pending translation contributions
- `/queue/corrections` — flagged corrections

**5d — Entry management**

The entry editor is the most complex admin screen. It must expose:
- Core `Entry` fields: `origin_language`, `status`, `metadata` (skill level, definition_short, open-ended keys)
- `content_blocks` editor (admin role only): reorder blocks, add block types, set `visible`, configure non-translatable block properties (`variant` on callout, `assetId` on media)
- Translation editor per locale: `term`, `slug`, `metadata.abbreviation`, `metadata.definition_short`, `blocks` content (rich text for definition block, structured fields for technique/callout/media blocks)
- Related entries tab
- Media tab (upload to R2; alt text and caption are entered here and stored in `Translation.blocks` for each locale, not on `MediaAsset`)
- Status management: draft → review → published; deprecate

**5e — Article management**
- `/articles` — article list
- `/articles/new` — create/edit article with rich text editor

**5f — Media library**
- `/media` — grid of uploaded assets; upload new asset (drag-and-drop to R2)

**5g — Block template management** (admin role only)
- `/settings/templates` — view and edit default `content_blocks` arrays per entry type
- Changes apply to newly created entries only; does not retroactively update existing entries

**5h — User management** (admin role only)
- `/users` — list of editorial users, role assignment

**Exit criterion:** an editor can complete the full lifecycle — review a queued submission, approve it, verify it appears on the public site.

---

## Phase 6 — `[SOON]` features

Work through `[SOON]` items from `02-features.md` in priority order:

1. Entry of the day (landing page)
2. Country timeline pages
3. Search typeahead / autocomplete
4. "Did you mean…" suggestions
5. Filter by country/tradition and media availability on entry list
6. Video embedding (add `video` block type — no migration required, just a new renderer component)
7. Open Graph / social sharing metadata
8. RSS feed
9. Bulk approve in editorial queue
10. Submission status tracking via emailed link

---

## Phase 7 — `[LATER]` / post-launch

- Keyset pagination for entry list (replaces OFFSET)
- Export filtered list as CSV/PDF
- Search within articles
- Read-only JSON API for third-party integrations
- Mobile app (iOS/Android)
- Pattern browser
- User-created learning paths (requires full account model)

---

## Key architectural rules (enforce throughout)

- **All business logic in `apps/api`.** Never add data fetching logic, validation, or database queries to Next.js apps.
- **Server Components call the API via `fetch()`.** Client Components use TanStack Query.
- **All types imported from `@knitting/types`.** Never define types locally in app code.
- **All UI components imported from `@knitting/ui`.** Never define shared components locally.
- **Never construct paths manually.** Always use `localePath(locale, page, slug?)`.
- **Never hardcode locale strings.** Always use the `Locale` type and `SUPPORTED_LOCALES`.
- **Locale lives in the URL.** Never store it in Zustand or localStorage.
- **`Entry.id` is never in a public URL.** Public entry URLs are resolved via `Translation.slug` using `(locale, slug)`.
- **English is not a special case.** The `en` Translation row holds the English term and slug like every other locale. Never treat Entry as having a canonical term or slug.
- **All search goes through `Translation.search_vector`.** There is no search fallback on `Entry`.
- **Translated content lives in `Translation.blocks`.** Never store prose, definitions, technique steps, alt text, or captions anywhere else.
- **Layout lives in `Entry.content_blocks`.** Never hardcode block order or block presence in frontend components.
- **`visible: false` instead of block deletion.** Preserves translated content; admin can restore.
- **Never delete entries.** Set `status = 'deprecated'`.
- **All timestamps UTC.** Format for display in the UI layer only.
- **Slugs are immutable.** Display names can change; URLs must not.

---

## Environment variables

### `apps/api/.env`
```
DATABASE_URL=postgresql://knitting:knitting@localhost:5432/knitting
REDIS_URL=redis://localhost:6379
JWT_SECRET=<generate with openssl rand -hex 32>
JWT_EXPIRY=7d
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=knitting-media
R2_PUBLIC_URL=https://media.knitting.example.com
```

### `apps/knitting/.env`
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### `apps/admin/.env`
```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXTAUTH_SECRET=<generate with openssl rand -hex 32>
```

---

## Deployment targets

| App | Platform |
|---|---|
| `knitting` | Vercel — SSG/ISR, edge network |
| `admin` | Vercel — separate project, auth-protected |
| `api` | Railway — managed Postgres + Redis add-ons |
| Media | Cloudflare R2 — S3-compatible object storage |
| DNS / CDN | Cloudflare |

**Domains:**
- `knitting.example.com` → `apps/knitting`
- `admin.knitting.example.com` → `apps/admin`
- `api.knitting.example.com` → `apps/api`

---

*Document version: 2.0 — May 2026*
*Data model: 03-data-model.md v2.3*
*Companion: tasks.md*