# Task list — European Knitting Encyclopedia

Status legend: `[ ]` not started · `[x]` done · `[-]` in progress · `[~]` deferred

---

## Phase 0 — Monorepo scaffolding

### Repo & tooling
- [x] Initialise Git repo (`knitting`)
- [x] Create root `package.json` (private, no version)
- [x] Create `pnpm-workspace.yaml` listing `apps/*` and `packages/*`
- [x] Install Turborepo as root dev dependency
- [x] Create `turbo.json` with `build`, `dev`, `lint`, `typecheck` pipeline

### Shared packages (stubs)
- [x] Create `packages/config-typescript` with `base.json`, `nextjs.json`, `nestjs.json` presets
- [x] Create `packages/config-eslint` with Next.js + NestJS extends
- [x] Create `packages/config-tailwind` with base design tokens (colours, typography, spacing)
- [x] Create `packages/types` — stub `index.ts`, `package.json`, `tsconfig.json`
- [x] Create `packages/ui` — stub `index.ts`, `package.json`, `tsconfig.json`

### App scaffolding
- [x] Scaffold `apps/knitting` with `create-next-app` (TypeScript, Tailwind, App Router, src dir)
- [x] Scaffold `apps/admin` with `create-next-app` (TypeScript, Tailwind, App Router, src dir)
- [x] Scaffold `apps/api` with NestJS CLI
- [x] Wire `@knitting/types`, `@knitting/ui`, `@knitting/config-tailwind` as workspace deps in both Next.js apps
- [x] Wire `@knitting/types` as workspace dep in `apps/api`
- [x] Each app extends the correct `@knitting/config-typescript` preset

### Local services
- [x] Create `docker-compose.yml` with Postgres 18.4 and Redis 8
- [x] Add `.env.example` for `apps/api`, `apps/knitting`, `apps/admin`
- [x] Add `.gitignore` entries for `.env`, `node_modules`, `.next`, `dist`

### CI/CD
- [x] Create `.github/workflows/ci.yml` — pnpm install, typecheck, lint, build
- [x] Verify `pnpm dev` starts all three apps
- [x] Verify `pnpm typecheck && pnpm lint && pnpm build` passes end-to-end

---

## Phase 1 — Shared types package + database schema

### `packages/types` — i18n module
- [x] Create `src/i18n/segments.ts`
  - [x] `SUPPORTED_LOCALES` constant (`['en', 'pl']` — extend later)
  - [x] `Locale` type
  - [x] `DEFAULT_LOCALE` constant
  - [x] `PATH_SEGMENTS` map (en, pl path segment translations)
  - [x] `SEGMENT_TO_CANONICAL` reverse map (used by middleware)
- [x] Create `src/i18n/localePath.ts`
  - [x] `localePath(locale, page, slug?)` helper
  - [x] Unit tests for all supported locales and pages

### `packages/types` — Zod schemas
- [x] `src/schemas/entry.ts`
  - [x] `SkillLevelEnum` — `beginner | intermediate | advanced | expert`
  - [x] `EntryStatusEnum` — `draft | review | published | deprecated`
  - [x] `ContentBlockSchema` — base shape (`id`, `type`, `order`, `visible`) plus discriminated union for block types: `definition`, `technique`, `media`, `callout`, `related`, `pattern_usage`
  - [x] `EntrySchema` — `id`, `origin_language`, `status`, `metadata`, `content_blocks`
  - [x] `EntryListItemSchema` — flattened shape for list rows (term and abbreviation from active `Translation`)
- [x] `src/schemas/translation.ts`
  - [x] `TranslationStatusEnum` — `draft | reviewed | published`
  - [x] `TranslationMetadataSchema` — `abbreviation?`, `definition_short?`
  - [x] `TranslationSchema` — `id`, `entry_id`, `locale`, `slug`, `term`, `metadata`, `blocks`, `status`
  - [x] Block content shape types per block type: `DefinitionBlockContent` (TipTap JSON), `TechniqueBlockContent` (name, difficulty, steps), `MediaBlockContent` (alt_text, caption), `CalloutBlockContent` (text)
- [x] `src/schemas/category.ts` — `CategorySchema`, `CategoryTreeSchema`
- [x] `src/schemas/article.ts` — `ArticleSchema`, `ArticleListItemSchema`
- [x] `src/schemas/contribution.ts` — `EntrySubmissionSchema`, `TranslationSubmissionSchema`, `CorrectionSchema`
- [x] `src/schemas/learn.ts` — `LearningPathSchema`, `LearningPathDetailSchema`
- [x] `src/schemas/media.ts` — `MediaAssetSchema` (no `alt_text` or `caption` — those live in `Translation.blocks`)
- [x] `src/schemas/user.ts` — `UserSchema`, `RoleEnum`
- [x] `src/schemas/auth.ts` — `LoginSchema`, `TokenSchema`
- [x] `src/store.ts` — `KnittingStore` interface (Zustand shape)
- [x] `src/index.ts` — re-export everything
- [x] Confirm all schemas compile and export correctly

### `apps/api` — Prisma schema
- [x] Install Prisma, initialise with PostgreSQL provider
- [x] Define `schema.prisma`:
  - [x] Enums: `SkillLevel`, `EntryStatus`, `TranslationStatus`, `RelationType`, `MediaType`, `TagType`, `ContributionType`, `UserRole`
  - [x] `Entry` model — `id` (UUID v7), `origin_language` (NOT NULL), `status`, `metadata` (Json), `content_blocks` (Json), timestamps. **No `slug`, `term`, or `search_vector` fields.**
  - [x] `Translation` model — `entry_id` FK, `locale`, `slug`, `term`, `metadata` (Json), `blocks` (Json), `translator_note`, `status`, `search_vector` (Unsupported("tsvector")); unique on `(entry_id, locale)` and `(locale, slug)`
  - [x] `Category` model with self-referential `parent_id`
  - [x] `EntryCategory` join model
  - [x] `Tag` model
  - [x] `EntryTag` join model
  - [x] `RelatedEntry` self-join model with `relation_type` and `direction`
  - [x] `MediaAsset` model — `entry_id`, `type`, `url`, `sort_order`. **No `alt_text` or `caption` — locale-specific; live in `Translation.blocks`.**
  - [x] `PatternUsage` model
  - [x] `BlockTemplate` model — `entry_type` (unique), `blocks` (Json default `[]`), `updated_at`
  - [x] `Article` model
  - [x] `ArticleTag` join model
  - [x] `LearningPath` model
  - [x] `LearningPathEntry` join model (with `sort_order`)
  - [x] `Contribution` model — `type`, `status`, `payload` (Json), `entry_id` nullable FK, `submitter_email`, `reviewer_note`, timestamps
  - [x] `User` model with `role` enum
- [x] Run `prisma migrate dev --name init` successfully
- [x] Add raw SQL to migration: `search_vector` trigger on `Translation` (fires on INSERT/UPDATE; extracts all `text` nodes from `blocks` via `jsonb_path_query`; combines with `term` and `metadata->>'definition_short'`; calls `to_tsvector` with locale-appropriate dictionary)
- [x] Add GIN index on `Translation.search_vector`
- [x] Add GIN index on `Translation.blocks`
- [x] Add GIN index on `Translation.metadata`
- [x] Add GIN index on `Entry.metadata`
- [x] Add index on `Entry.origin_language`
- [x] Create `prisma/seed.ts`:
  - [x] Seed `BlockTemplate` rows for entry types: `stitch`, `technique`, `tool`, `tradition`, `yarn_weight`
  - [~] Seed ~20 `Entry` rows across 5 `origin_language` values (`en`, `pl`, `no`, `de`, `fr`) — 3 minimal entries seeded (`en` + `pl` origin only); expand when needed
  - [x] Each entry: `content_blocks` seeded from matching `BlockTemplate`
  - [x] Each entry: at minimum `en` Translation row with `term`, `slug`, `metadata.definition_short`, and `blocks` content per block ID
  - [x] Each entry: at minimum `pl` Translation row with `term`, `slug`, `metadata.abbreviation`, and `blocks` content
  - [x] Verify `search_vector` is populated on all seeded `Translation` rows
- [x] Run seed script successfully

---

## Phase 2 — NestJS API

### Infrastructure
- [x] Create `src/prisma/prisma.service.ts` and `PrismaModule` (global)
- [x] Add global `ValidationPipe` (class-validator, whitelist, forbidNonWhitelisted)
- [x] Add global exception filter (maps Prisma errors to HTTP responses)
- [x] Add response transform interceptor (wraps responses in `{ data, meta?, error? }`)
- [x] Add Swagger (`@nestjs/swagger`) at `/api/docs`
- [x] Add `@nestjs/cache-manager` with Redis adapter
- [x] Add `@nestjs/throttler` with Redis store (rate limiting for contribution endpoints)
- [x] Configure CORS for `localhost:3000`, `localhost:3001`, and production domains

### `CategoryModule`
- [x] `GET /api/v1/categories` — full category tree (nested)
- [x] `GET /api/v1/categories/:slug/entries` — paginated entries in category
- [x] Cache category tree with 24h TTL
- [x] Unit tests for `CategoryService`
- [ ] e2e tests for both endpoints

### `EntryModule`
- [x] `GET /api/v1/entries` — paginated, locale-aware alphabetical list
  - [x] Query params: `locale`, `page`, `limit`, `category`, `tag`, `skillLevel`, `sort`
  - [x] Locale-aware collation via ICU or `pg_collation`
  - [x] Each row resolves term and abbreviation from `Translation.term` and `Translation.metadata.abbreviation` for the requested locale; includes translated category and tag names via `CategoryTranslation` and `TagTranslation`
  - [x] Entries missing the requested locale Translation fall back to `en` Translation and are flagged `missing_translation: true`
- [x] `GET /api/v1/entries/:locale/:slug` — full entry detail resolved via `(locale, slug)` on `Translation`
  - [x] Returns assembled response: `Entry` fields + active `Translation` (term, slug, metadata, blocks) + `content_blocks` layout
  - [x] Includes `related_entries` (resolved via `RelatedEntry`; each includes `Translation.term` for active locale)
  - [x] Includes `media_assets` (URL from `MediaAsset`; alt text and caption from `Translation.blocks`)
  - [x] Includes `pattern_usage` rows
  - [x] `Entry.id` never exposed in response — internal identifier only
- [x] Cache entry detail with 1h TTL; invalidate on publish/update
- [x] Unit tests for `EntryService`
- [ ] e2e tests for list and detail endpoints

### `SearchModule`
- [x] `GET /api/v1/search` — query params: `q`, `locale`, `category`, `skillLevel`
- [x] Full-text search against `Translation.search_vector` only — no fallback to `Entry`
- [x] Rank results: active locale matches first, then other locales
- [x] Each result returns: matched `Translation.term`, locale, `Translation.metadata.definition_short`, `Translation.slug`
- [x] Cache search results with 5min TTL
- [ ] e2e tests with multi-locale data

### `ArticleModule`
- [x] `GET /api/v1/articles` — list with filter by tag and country
- [x] `GET /api/v1/articles/:slug` — full article detail
- [ ] e2e tests for both endpoints

### `CountryModule`
- [x] `GET /api/v1/countries/:code` — country landing data
  - [x] Filters entries by `Entry.origin_language = code`
  - [x] Returns: featured entries (with active locale `Translation`), article links
- [x] Cache with 6h TTL

### `LearnModule`
- [x] `GET /api/v1/learn` — list of learning paths with metadata
- [x] `GET /api/v1/learn/:slug` — path detail with ordered entries (each entry includes active locale `Translation.term` and `metadata.definition_short`)
- [ ] Seed at least 4 learning paths at launch

### `ContributionModule`
- [x] `POST /api/v1/contributions/entry` — new entry submission
  - [x] Validate against `EntrySubmissionSchema`
  - [x] Rate limit: 5 per IP per hour
  - [x] Insert into `Contribution` table with `type = 'entry'`, `status = 'pending'`
  - [x] Optionally capture submitter email
- [x] `POST /api/v1/contributions/translation` — translation submission
  - [x] `entry_id` resolved from `Translation` lookup on submitted `slug` — never accept raw `entry_id` from public
  - [x] Rate limit: 20 per IP per hour
- [x] `POST /api/v1/contributions/correction` — correction report
  - [x] Rate limit: 10 per IP per hour
- [ ] e2e tests for all three endpoints including rate limit behaviour

### `AuthModule`
- [x] `POST /api/v1/auth/login` — validate credentials, issue JWT in HttpOnly cookie
- [x] `POST /api/v1/auth/refresh` — refresh token
- [x] `POST /api/v1/auth/logout` — clear cookie
- [x] `JwtAuthGuard` — validates cookie on protected routes
- [x] `RolesGuard` — enforces `editor`, `reviewer`, `admin` roles
- [ ] e2e tests for login, protected route, and logout

### `AdminQueueModule`
- [x] `GET /api/v1/admin/queue/entries` — paginated pending `Contribution` rows with `type = 'entry'`
- [x] `PATCH /api/v1/admin/queue/entries/:id` — approve or reject
  - [x] On approve: create `Entry` with `content_blocks` seeded from `BlockTemplate` matching submitted entry type; create `en` `Translation` row from submission payload; set status `draft`
  - [x] On reject: set `status = 'rejected'`, store `reviewer_note`
- [x] `GET /api/v1/admin/queue/translations` — pending translation contributions
- [x] `PATCH /api/v1/admin/queue/translations/:id` — approve (create or update `Translation` row) or reject
- [x] `GET /api/v1/admin/queue/corrections` — flagged corrections
- [x] `PATCH /api/v1/admin/queue/corrections/:id` — acknowledge or dismiss
- [x] All routes protected by `JwtAuthGuard` + `editor` or higher role

### `AdminEntryModule`
- [x] `POST /api/v1/admin/entries` — create entry
  - [x] Seeds `content_blocks` from `BlockTemplate` for given entry type
  - [x] Creates initial `en` `Translation` row (status `draft`)
  - [x] Sets `Entry.status = 'draft'`
- [x] `PUT /api/v1/admin/entries/:id` — update `Entry` fields (`origin_language`, `status`, `metadata`)
- [x] `PUT /api/v1/admin/entries/:id/blocks` — update `Entry.content_blocks` layout (admin role only)
- [x] `PUT /api/v1/admin/entries/:id/translations/:locale` — create or update `Translation` row (term, slug, metadata, blocks content)
- [x] `PATCH /api/v1/admin/entries/:id/status` — status transitions: draft→review→published; deprecate
- [x] `DELETE /api/v1/admin/entries/:id` — soft-delete only: sets `Entry.status = 'deprecated'`
- [x] Invalidate Redis cache on create/update/status change

### `AdminBlockTemplateModule`
- [x] `GET /api/v1/admin/settings/templates` — list all `BlockTemplate` rows
- [x] `PUT /api/v1/admin/settings/templates/:entry_type` — update default `blocks` for an entry type (admin role only)

### `MediaModule`
- [x] `POST /api/v1/admin/media/upload` — multipart upload to R2
  - [x] Validate file type: jpeg, png, webp, svg, mp4
  - [x] Validate file size: ≤ 5MB images, ≤ 50MB video
  - [x] Upload to R2, return CDN URL
  - [x] Insert `MediaAsset` row linking to entry (URL only — no alt text or caption here)
- [x] Note: alt text and caption are set per locale via `Translation.blocks` in `AdminEntryModule`

### `UserModule` (admin role only)
- [x] `GET /api/v1/admin/users` — list users
- [x] `POST /api/v1/admin/users` — create user
- [x] `PATCH /api/v1/admin/users/:id` — update role

---

## Phase 3 — Shared UI package

### Setup
- [ ] Run `shadcn init` inside `packages/ui`
- [ ] Configure Tailwind to extend `@knitting/config-tailwind`
- [ ] Define design tokens in `config-tailwind`: warm neutral palette, serif heading font, body font, spacing scale

### Install shadcn components
- [ ] `Button`
- [ ] `Badge`
- [ ] `Card`
- [ ] `Input`
- [ ] `Select`
- [ ] `Separator`
- [ ] `Breadcrumb`
- [ ] `Tabs`
- [ ] `Sheet` (mobile slide-out nav)
- [ ] `Dialog`
- [ ] `Form`
- [ ] `Label`
- [ ] `Textarea`
- [ ] `Skeleton`
- [ ] `Table`
- [ ] `DropdownMenu`
- [ ] `Popover`
- [ ] `Toast` / `Sonner`

### Custom components
- [ ] `EntryCard` — term, short definition (from `Translation.metadata.definition_short`), skill badge, origin badge, link
- [ ] `LocaleBadge` — flag + locale code
- [ ] `InlineEntryCard` — mini card for embedding in articles (rendered from `entry_link` TipTap node)
- [ ] Block renderer components (used in entry detail):
  - [ ] `DefinitionBlock` — renders TipTap JSON; handles `entry_link` inline node → `InlineEntryCard`
  - [ ] `MediaBlock` — image/diagram with locale-aware alt text and caption from `Translation.blocks`
  - [ ] `CalloutBlock` — tip/warning variant box
  - [ ] `RelatedBlock` — labelled link cards for synonym/antonym/prerequisite/variant relationships
  - [ ] `PatternUsageBlock` — pattern list with context note and frequency bar
  - [ ] `BlockRenderer` — iterates `content_blocks`, filters `visible: false`, dispatches to correct component per `type`

### Verify
- [ ] Both Next.js apps can import from `@knitting/ui` with no errors
- [ ] Tailwind tokens render consistently in both apps

---

## Phase 4 — Public encyclopedia (`apps/knitting`) — LAUNCH

### 4a — Routing infrastructure
- [ ] Create `middleware.ts`
  - [ ] Redirect `/` to `/{defaultLocale}`
  - [ ] Rewrite localised path segments to canonical using `SEGMENT_TO_CANONICAL`
  - [ ] Redirect unrecognised locale prefixes to default
- [ ] Create `app/[locale]/layout.tsx`
  - [ ] Persistent header with site name, search box, language selector, main nav links
  - [ ] Footer with About, Editorial policy, Contribute, Contact links and project description
  - [ ] Pass `locale` param to all child components
- [ ] Language selector Client Component
  - [ ] Uses `localePath()` to navigate to equivalent page in new locale
  - [ ] For entry detail pages: builds new URL using the target locale's `Translation.slug` (fetched from API)
  - [ ] Reads current route params to preserve page context
- [ ] Set up Zustand store for learn path progress
- [ ] Set up TanStack Query provider

### 4b — Entry list & detail
- [ ] Entry list page (`/[locale]/entries`)
  - [ ] SSR; fetches from `/api/v1/entries?locale=&page=&...`
  - [ ] Paginated list (20 per page), locale-aware alphabetical sort
  - [ ] Alphabetical dividers by first letter in active locale
  - [ ] Each row: term (from `Translation.term`), abbreviation (from `Translation.metadata.abbreviation`), definition preview (from `Translation.metadata.definition_short`), skill badge, category badge, tag badges
  - [ ] Entries without active-locale Translation shown in muted style with "no [language] translation" label
  - [ ] Filter bar: free-text search, skill level, category
  - [ ] Sort toggle: A→Z / by skill level
- [ ] Category index page (`/[locale]/entries/category`)
  - [ ] SSG + ISR; lists all top-level categories with entry counts
- [ ] Category detail page (`/[locale]/entries/category/[slug]`)
  - [ ] SSG + ISR; subcategories + entries, breadcrumb
- [ ] Entry detail page (`/[locale]/entry/[slug]`)
  - [ ] SSG + ISR; fetches via `GET /api/v1/entries/:locale/:slug` (slug is `Translation.slug` for active locale)
  - [ ] Term display from `Translation.term` for active locale
  - [ ] Abbreviation from `Translation.metadata.abbreviation` for active locale
  - [ ] Skill badge from `Entry.metadata.skill_level`
  - [ ] Origin badge from `Entry.origin_language`
  - [ ] Category breadcrumb
  - [ ] Language switcher — links to other locales' slugs (returned by API in translation list)
  - [ ] Full block rendering via `BlockRenderer` — iterates `content_blocks`, renders each visible block using content from `Translation.blocks`
  - [ ] Related entries section (from `RelatedBlock`)
  - [ ] "Suggest a correction" link — opens correction Dialog pre-filled with entry slug

### 4c — Landing page
- [ ] Hero section (`/[locale]`)
  - [ ] Full-width hero with project name, one-line description, search box
  - [ ] Search box: live search across all locales, active locale results first
- [ ] Navigation tile grid (7 tiles)
  - [ ] Explore by country/language
  - [ ] Entry dictionary
  - [ ] Articles & editorial
  - [ ] Traditions map
  - [ ] Learn
  - [ ] Community contributions
  - [ ] Patterns placeholder (disabled at launch)
- [ ] Footer

### 4d — Country landing pages
- [ ] `/[locale]/country/[code]` — SSG + ISR
- [ ] Pages for: Poland (`pl`), Norway (`no`), Germany/Austria (`de`), UK/Ireland (`gb`), France (`fr`)
- [ ] `code` maps to `Entry.origin_language` — API filters by this field
- [ ] Editorial intro paragraph(s) per country
- [ ] Featured entry cards (term from `Translation.term`, short definition from `Translation.metadata.definition_short`, skill badge)
- [ ] Links to filtered entry list (`?origin_language=code`) and country-tagged articles

### 4e — Search
- [ ] Search results page (`/[locale]/search`)
  - [ ] SSR; fetches from `/api/v1/search?q=&locale=`
  - [ ] Results: matched `Translation.term`, locale badge, `Translation.metadata.definition_short`, link to `/[locale]/entry/[Translation.slug]`
  - [ ] Filter bar: locale, category, skill level
- [ ] Search box typeahead Client Component
  - [ ] TanStack Query, debounced, shows top 5 matches
  - [ ] Used in persistent header and landing page hero

### 4f — Articles
- [ ] Article index (`/[locale]/articles`)
  - [ ] SSR; grid of cards with filter by tag and country
- [ ] Article detail (`/[locale]/articles/[slug]`)
  - [ ] SSG + ISR; rich text, inline entry cards (rendered from `entry_card` TipTap nodes — frontend fetches `Translation` for active locale at render time by `entryId`), tags, author credit

### 4g — Traditions map
- [ ] Map page (`/[locale]/map`)
  - [ ] SVG map of Europe; each country is a clickable zone
  - [ ] Country zone data aggregated by `Entry.origin_language` (entry count per language code)
  - [ ] Hover tooltip: country name, entry count, featured entry term
  - [ ] Click navigates to country landing page

### 4h — Learn
- [ ] Learning path index (`/[locale]/learn`)
  - [ ] SSR; list of paths with title, skill range, time estimate, entry count
- [ ] Learning path detail (`/[locale]/learn/[slug]`)
  - [ ] SSR; ordered step cards (term from `Translation.term`, short definition from `Translation.metadata.definition_short`, skill badge, link to entry detail)
  - [ ] Progress indicator (Zustand store reading from memory; [SOON] localStorage)

### 4i — Contribution forms
- [ ] Entry submission form (`/[locale]/contribute/entry`)
  - [ ] Fields: term, definition, category, skill level, origin country, abbreviation (optional), email (optional)
  - [ ] Client Component; posts to `POST /api/v1/contributions/entry`
- [ ] Translation contribution form (`/[locale]/contribute/translation`)
  - [ ] Pre-filled with entry `Translation.slug` if opened from entry detail page
  - [ ] Fields: locale, translated term, translated definition, abbreviation
  - [ ] Posts to `POST /api/v1/contributions/translation`
- [ ] Correction form (Dialog on entry detail page)
  - [ ] Pre-filled with entry slug and field selector
  - [ ] Fields: field being corrected, current value, suggested value, optional note
  - [ ] Posts to `POST /api/v1/contributions/correction`

### 4j — Cross-cutting concerns (public app)
- [ ] All pages have correct `<title>` and `<meta description>` using `Translation.term` and `Translation.metadata.definition_short`
- [ ] Semantic HTML and ARIA attributes throughout
- [ ] Alt text on all images (sourced from `Translation.blocks` for active locale)
- [ ] Keyboard navigation works for all interactive elements
- [ ] All pages indexable by search engines (SSR or SSG confirmed via `robots.txt` and sitemap)
- [ ] Sitemap generation for entry pages (using `Translation.slug` per locale) and article pages

---

## Phase 5 — Admin dashboard (`apps/admin`) — LAUNCH

### 5a — Auth
- [ ] Login page (`/login`) — email + password, posts to API, stores JWT cookie
- [ ] Middleware — validates session cookie; redirects unauthenticated requests to `/login`
- [ ] Zustand auth store — `currentUser`, `role`, `logout()`

### 5b — Layout
- [ ] Authenticated shell — sidebar with navigation links, top bar with user menu
- [ ] Role-conditional nav items:
  - [ ] Block template management — admin only
  - [ ] User management — admin only
  - [ ] Block reordering in entry editor — admin only
- [ ] Toast notification area

### 5c — Queue management
- [ ] `/queue/entries` — table of pending entry submissions
  - [ ] Columns: submitted term, definition preview, category, origin country, submitted at, submitter email
  - [ ] Approve action: creates `Entry` (with `BlockTemplate`-seeded `content_blocks`) + `en` `Translation`
  - [ ] Reject action: archives with reviewer note
  - [ ] Edit-before-approve inline panel
- [ ] `/queue/translations` — pending translation submissions
  - [ ] Columns: entry term (from `en` Translation), locale, translated term, definition preview, submitted at
  - [ ] Approve: creates or updates `Translation` row
  - [ ] Reject action
- [ ] `/queue/corrections` — flagged corrections
  - [ ] Columns: entry term, field, current value, suggested value, note, submitted at
  - [ ] Acknowledge / dismiss actions

### 5d — Entry management
- [ ] `/entries` — searchable, filterable table of all entries (any status)
  - [ ] Columns: term (from `en` Translation), `origin_language`, skill level, status, category, created at
  - [ ] Click row to open entry editor
- [ ] `/entries/new` — create entry form
  - [ ] Fields: entry type (seeds `BlockTemplate`), `origin_language`, `metadata.skill_level`, `metadata.definition_short`
  - [ ] On save: creates `Entry` + `en` `Translation` stub; redirects to entry editor
- [ ] `/entries/[id]` — entry editor (tabbed interface)
  - [ ] **Core tab** — edit `Entry.origin_language`, `Entry.metadata` (skill level, definition_short, open-ended keys), status management
  - [ ] **Blocks tab** (admin only) — reorder blocks (`content_blocks`), add block type, hide/show blocks (`visible` toggle), configure non-translatable block config (callout variant, media assetId)
  - [ ] **Translations tab** — list of `Translation` rows by locale; click to edit
    - [ ] Per locale: `term`, `slug` (editable; warn if changing), `metadata.abbreviation`, `metadata.definition_short`, `status`
    - [ ] Per block (for each block in `content_blocks`): locale-appropriate content editor
      - [ ] `definition` block: TipTap rich text editor (paragraph, bold, italic, entry_link)
      - [ ] `technique` block: name field, difficulty select, ordered step list (add/remove/reorder steps)
      - [ ] `media` block: alt text field, caption field (URL shown read-only from `MediaAsset`)
      - [ ] `callout` block: text field
      - [ ] `related` / `pattern_usage` blocks: no content to edit (data comes from related tables)
  - [ ] **Related entries tab** — add/remove `RelatedEntry` rows; select relation type; view linked entry's `en` term
  - [ ] **Media tab** — list of `MediaAsset` rows; upload new asset (drag-and-drop to R2); reorder; link asset to a `media` block in `content_blocks`
  - [ ] **Status panel** — promote draft→review→published; deprecate; "View on site" link using `en` Translation slug

### 5e — Article management
- [ ] `/articles` — article list table
- [ ] `/articles/new` — create article (title, content via rich text editor supporting `entry_card` node, tags, country, author, cover image)
- [ ] `/articles/[id]` — edit article

### 5f — Media library
- [ ] `/media` — grid view of all media assets
  - [ ] Filter by type (image, diagram, video)
  - [ ] Upload new asset (drag-and-drop; validates type and size before upload)
  - [ ] Asset detail: CDN URL copy, linked entry, link to edit alt text via entry editor

### 5g — Block template management (admin only)
- [ ] `/settings/templates` — list of `BlockTemplate` rows by entry type
- [ ] Edit default `content_blocks` array per entry type (block type selector, order, visibility defaults)
- [ ] Changes apply to newly created entries only — warning displayed

### 5h — User management (admin role only)
- [ ] `/users` — table of editorial users (name, email, role, created at)
- [ ] Create user form
- [ ] Change role action

### 5i — Dashboard
- [ ] `/dashboard` — overview stats
  - [ ] Total published entries, pending submissions, Translation coverage by locale
  - [ ] Recent approvals and activity log

---

## Phase 6 — `[SOON]` features

- [ ] "Entry of the day" highlight on landing page (API endpoint + cron to rotate daily)
- [ ] Country timeline pages (editorial content per country)
- [ ] Search autocomplete / typeahead (upgrade existing typeahead with debounce tuning and keyboard navigation)
- [ ] "Did you mean…" suggestions on zero-result search pages
- [ ] Filter by `origin_language` / tradition on entry list
- [ ] Filter by media availability (entries with image blocks, entries with video blocks) on entry list
- [ ] Featured article spotlight on country landing pages
- [ ] Video clip embedding — add `video` block renderer (no schema migration; new block type handled by adding renderer component and a `case` in `BlockRenderer`)
- [ ] Open Graph / social sharing metadata on entry and article pages (use `Translation.metadata.definition_short` per locale)
- [ ] RSS feed for new articles and newly published entries
- [ ] "Also known as" comparison table on entry detail — all locales' `Translation.term` and `Translation.metadata.abbreviation` in one view
- [ ] Last reviewed date and editorial status indicator on entry detail (from `Translation.status` and `updated_at`)
- [ ] Bulk approve in editorial queue (TanStack Query batch mutation)
- [ ] Submission status tracking — emailed link lets contributor view pending status
- [ ] Duplicate detection on entry submission form (checks `Translation.term` across all locales)
- [ ] "Contribute translation" button pre-fills locale form from entry detail page (passes `Translation.slug`)
- [ ] "Mark as learned" per entry in learning paths (localStorage, no account required)
- [ ] Path completion indicator on learning path detail
- [ ] Category page editorial introductions ("About lace knitting")
- [ ] Regional granularity on traditions map (Shetland, Podhale, etc.)
- [ ] Country statistics on country landing pages (entries by `origin_language`, Translation coverage, contributors)

---

## Phase 7 — `[LATER]` / post-launch

- [ ] Keyset pagination for entry list (replaces OFFSET-based)
- [ ] Export filtered entry list as CSV or PDF
- [ ] Search within articles (extend `SearchModule`)
- [ ] Search analytics in admin (most searched terms, zero-result queries)
- [ ] Change history / version log on entry detail (visible to contributors)
- [ ] Contributor accounts with submission history and notification preferences
- [ ] Read-only JSON API for third-party integrations
- [ ] Article translations (same editorial workflow as entry translations)
- [ ] "Tradition spread" layer on traditions map (shows how techniques travelled across borders)
- [ ] User-created learning paths (requires contributor accounts)
- [ ] Learning paths in multiple languages
- [ ] Pattern browser (full feature set deferred from launch)
  - [ ] Pattern index with filters
  - [ ] Pattern detail with linked entries
  - [ ] Pattern submission form
- [ ] Mobile app (iOS / Android) — built against the read-only JSON API

---

*Document version: 2.0 — May 2026*
*Data model: 03-data-model.md v2.3*
*Companion: implementation-plan.md*