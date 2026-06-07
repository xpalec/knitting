# Design Document: admin-categories

## Overview

The admin-categories feature adds a full Categories management section to the Knitpedia admin app. It touches three layers:

1. **API (NestJS)** — add a `type` field (`entry | abbreviation | article`) to the Category model, expose it through all existing admin endpoints, and add `type`/`status` query filters to `GET /api/v1/admin/categories`.
2. **API client library** — expand `apps/admin/src/lib/api/categories.ts` from a single public-tree helper into a full `adminCategoriesApi` object covering all CRUD operations and translation upsert.
3. **Admin frontend (Next.js)** — three new pages under `(dashboard)/categories/`: a list page with filtering, summary panel, export/import, and per-row actions; a create page; and an edit page with inline tabbed translation management. A sidebar link is added to the CONTENT section.

The feature follows the same patterns already established for Entries and Articles: TanStack Query for data fetching, `sonner` toasts for feedback, shadcn/ui primitives, and `ConfirmDialog` for destructive actions.

---

## Architecture

```mermaid
graph TD
  subgraph Admin Frontend (Next.js)
    LP["/categories — List Page"]
    NP["/categories/new — Create Page"]
    EP["/categories/[id] — Edit Page"]
    SB["Sidebar (layout component)"]
    CF["CategoryForm component (tabbed)"]
    AC["adminCategoriesApi (categories.ts)"]
  end

  subgraph API (NestJS)
    CTRL["AdminCategoryController"]
    SVC["AdminCategoryService"]
    DB["Prisma / PostgreSQL"]
    CACHE["Cache Manager (Redis)"]
  end

  LP --> AC
  NP --> AC
  EP --> AC
  CF --> AC
  AC -->|HTTP| CTRL
  CTRL --> SVC
  SVC --> DB
  SVC --> CACHE
```

The frontend communicates exclusively through `adminCategoriesApi`. The `TranslationDialog` component is removed — translation management is now handled by the tabbed `CategoryForm` directly. The API layer is already wired — the main work is adding the `type` field to DTOs and service logic, then building the frontend.

---

## Components and Interfaces

### API Layer

#### DTOs — changes required

**`CreateCategoryDto`** — add `type` field; does NOT include `name_en` or `slug_en`:
```typescript
@ApiProperty({ enum: ['entry', 'abbreviation', 'article'] })
@IsIn(['entry', 'abbreviation', 'article'])
declare type: string;
```

**`UpdateCategoryDto`** — add optional `type` and `parent_id` fields:
```typescript
@ApiPropertyOptional({ enum: ['entry', 'abbreviation', 'article'] })
@IsOptional()
@IsIn(['entry', 'abbreviation', 'article'])
type?: string;

@ApiPropertyOptional({ type: String, nullable: true })
@IsOptional()
@IsUUID()
@IsNullable()
parent_id?: string | null;
```

**`AdminCategoryService.findAll`** — add `type` and `status` filter params:
```typescript
async findAll(page: number, limit: number, search?: string, type?: string, status?: string)
```

**`AdminCategoryController.findAll`** — add `@Query('type')` and `@Query('status')` params.

The `findAll` response shape must include `type` in each category object. The `create` and `update` service methods must persist the `type` field. The `UpsertTranslationDto` must accept `short_description`, `seo_title` (≤60 chars), and `seo_description` (≤160 chars).

#### Response shape (per category)

```typescript
{
  id: string;
  type: 'entry' | 'abbreviation' | 'article';
  parent_id: string | null;
  icon: string | null;
  sort_order: number;
  status: 'draft' | 'published';
  entry_count: number;
  cover_image_url: string | null;
  translations: Array<{
    locale: string;
    name: string;
    slug: string;
    short_description: string | null;
    description: unknown;   // TipTap JSON or null
    seo_title: string | null;
    seo_description: string | null;
    translator_note?: string;
    status: string;
  }>;
  children_count: number;
  created_at: string;
  updated_at: string;
}
```

---

### API Client Library (`apps/admin/src/lib/api/categories.ts`)

The existing file exports a minimal `categoriesApi` for the public tree. The new `adminCategoriesApi` object is added alongside it (the public helper is preserved for backward compatibility).

```typescript
// Types
export type CategoryType = 'entry' | 'abbreviation' | 'article';
export type CategoryStatus = 'draft' | 'published';
export type TranslationStatus = 'draft' | 'reviewed' | 'published';

export interface AdminCategoryTranslation {
  locale: string;
  name: string;
  slug: string;
  short_description?: string | null;   // NEW — plain text summary
  description?: unknown;               // TipTap JSON
  seo_title?: string | null;           // NEW — ≤60 chars
  seo_description?: string | null;     // NEW — ≤160 chars
  translator_note?: string;
  status: TranslationStatus;
}

export interface AdminCategory {
  id: string;
  type: CategoryType;
  parent_id: string | null;
  icon: string | null;
  sort_order: number;
  status: CategoryStatus;
  entry_count: number;
  cover_image_url: string | null;
  translations: AdminCategoryTranslation[];
  children_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminCategoryListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: CategoryType;
  status?: CategoryStatus;
}

// Language-independent fields only — no name_en or slug_en
export interface CreateCategoryPayload {
  type: CategoryType;
  parent_id?: string | null;   // NEW
  icon?: string;
  sort_order?: number;
  cover_image_url?: string;
  status?: CategoryStatus;
}

export interface UpdateCategoryPayload {
  type?: CategoryType;
  parent_id?: string | null;   // NEW
  icon?: string;
  sort_order?: number;
  status?: CategoryStatus;
  cover_image_url?: string | null;
}

export interface UpsertTranslationPayload {
  name: string;
  slug: string;
  short_description?: string;   // NEW — plain text
  description?: unknown;        // TipTap JSON
  seo_title?: string;           // NEW — ≤60 chars
  seo_description?: string;     // NEW — ≤160 chars
  translator_note?: string;
  status?: TranslationStatus;
}

// Client object
export const adminCategoriesApi = {
  listCategories: (params?: AdminCategoryListParams): Promise<ApiResponse<AdminCategory[]>> =>
    apiGetWithMeta<AdminCategory[]>('/api/v1/admin/categories', params as Record<string, unknown>),

  getCategory: (id: string): Promise<AdminCategory> =>
    apiGet<AdminCategory>(`/api/v1/admin/categories/${id}`),

  createCategory: (dto: CreateCategoryPayload): Promise<AdminCategory> =>
    apiPost<AdminCategory>('/api/v1/admin/categories', dto),

  updateCategory: (id: string, dto: UpdateCategoryPayload): Promise<AdminCategory> =>
    apiPut<AdminCategory>(`/api/v1/admin/categories/${id}`, dto),

  deleteCategory: (id: string): Promise<void> =>
    apiDelete<void>(`/api/v1/admin/categories/${id}`),

  upsertTranslation: (
    id: string,
    locale: string,
    dto: UpsertTranslationPayload,
  ): Promise<AdminCategoryTranslation> =>
    apiPut<AdminCategoryTranslation>(
      `/api/v1/admin/categories/${id}/translations/${locale}`,
      dto,
    ),
};
```

Error propagation is handled by the underlying `apiGet`/`apiPost`/`apiPut`/`apiDelete` helpers in `client.ts`, which throw `ApiError` on non-2xx responses. No additional wrapping is needed.

---

### Frontend Components

#### Sidebar (`apps/admin/src/components/layout/sidebar.tsx`)

Add a `Tag` icon import from `lucide-react` and insert a new nav item in the CONTENT section after Articles:

```typescript
{ label: 'Categories', href: '/categories', icon: Tag },
```

No `adminOnly` flag — visible to all authenticated users. The existing active-state logic (`pathname.startsWith(item.href)`) handles `/categories` automatically.

#### New pages

| Route | File | Purpose |
|---|---|---|
| `/categories` | `src/app/(dashboard)/categories/page.tsx` | List page |
| `/categories/new` | `src/app/(dashboard)/categories/new/page.tsx` | Create page |
| `/categories/[id]` | `src/app/(dashboard)/categories/[id]/page.tsx` | Edit page |

#### Shared components (`src/components/categories/`)

| Component | Purpose |
|---|---|
| `category-form.tsx` | Tabbed form — language-independent fields at top, locale tabs (EN/PL/FR/DE/NO) below |
| `category-type-badge.tsx` | Coloured badge for `entry` / `abbreviation` / `article` |
| `category-status-badge.tsx` | Coloured badge for `draft` / `published` |

`translation-dialog.tsx` is **removed** — translations are now managed directly in the tabbed `CategoryForm`.

#### Tabbed `CategoryForm` component design

The redesigned `category-form.tsx` replaces both the old form and the `TranslationDialog`. It is used on both the create and edit pages.

**Top section — language-independent fields:**

| Field | Control | Notes |
|---|---|---|
| Type | `Select` (required) | `entry` / `abbreviation` / `article` |
| Parent Category | `Select` (optional) | Populated from `listCategories`; first option is "None — top-level category" → `parent_id: null`; each option displays the English name from translations, fallback to ID |
| Icon | `Input` (optional) | Icon key or SVG path |
| Sort Order | `Input[type=number]` (optional, default 0) | |
| Cover Image URL | `Input` (optional) | |
| Status | `Select` | `draft` / `published`; default `draft` |

**Per-locale translation tabs (EN / PL / FR / DE / NO):**

Each tab contains:

| Field | Control | Notes |
|---|---|---|
| Name | `Input` (required for EN, optional for others) | Triggers slug auto-generation if slug not manually edited |
| Slug | `Input` | Auto-generated from Name via `toSlug()`; stops auto-generating once manually edited |
| Short Description | `Input` | Plain text, single line |
| Description | TipTap editor (shared) | Permitted nodes: `paragraph`, `heading` (h2, h3), `bold`, `italic`, `hard_break`, `entry_link`; outputs/accepts TipTap JSON |
| SEO Title | `Input` (≤60 chars) | Char counter shown: e.g. `12/60` |
| SEO Description | `Textarea` (≤160 chars) | Char counter shown: e.g. `45/160` |
| Translation Status | `Select` | `draft` / `reviewed` / `published`; default `draft` |

**Submit guard:** button disabled while EN Name is empty or Type is unselected.

**Component interface sketch:**

```typescript
export interface LocaleTabState {
  name: string;
  slug: string;
  slugManuallyEdited: boolean;
  short_description: string;
  description: unknown;        // TipTap JSON or null
  seo_title: string;
  seo_description: string;
  status: TranslationStatus;
}

export interface CategoryFormValues {
  // Language-independent
  type: CategoryType | '';
  parent_id: string | null;
  icon: string;
  sort_order: number;
  cover_image_url: string;
  status: CategoryStatus;
  // Per-locale
  locales: Record<SupportedLocale, LocaleTabState>;
}

interface CategoryFormProps {
  defaultValues?: Partial<CategoryFormValues>;
  parentCategories: AdminCategory[];          // pre-fetched for dropdown
  isLoadingParents?: boolean;
  onSubmit: (values: CategoryFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
  slugErrors?: Partial<Record<SupportedLocale, string>>;  // inline errors per locale
  onCancel?: () => void;
}
```

#### Parent category selector

The parent category dropdown is populated by calling `listCategories({ limit: 1000 })` on the create/edit page (not inside the form component itself — passed as `parentCategories` prop). Each option is rendered as the category's English name from its `translations` array; if no `en` translation exists, the option falls back to the category's `id`.

```typescript
// Option rendering logic
function getCategoryDisplayName(cat: AdminCategory): string {
  const en = cat.translations.find((t) => t.locale === 'en');
  return en?.name ?? cat.id;
}
```

On the edit page, the dropdown pre-selects based on the loaded category's `parent_id`. If `parent_id` is `null`, "None — top-level category" is selected.

#### TipTap editor

Reuse the shared TipTap editor component used elsewhere in the admin app. If no shared component exists yet, create `src/components/ui/rich-text-editor.tsx` implementing TipTap with the following permitted nodes for `CategoryTranslation.description`:

- `paragraph`
- `heading` (h2, h3 only)
- `bold` (mark)
- `italic` (mark)
- `hard_break`
- `entry_link` (custom inline node: `{ entryId: string, term: string }`)

The editor accepts and outputs TipTap JSON (`unknown` typed in the payload). An empty document is represented as `null` in the translation payload (omit the field).

#### List page structure

```
CategoryListPage
├── Page header (title + "+ Add Category" button + Export button + Import button)
├── Summary panel (4 stat cards: Entry / Abbreviation / Article / Total)
├── Filter bar (Search input + Type select + Status select)
├── Table (Name | Type | Entry Count | Status | Updated | Actions)
│   ├── SkeletonRows (loading state)
│   ├── EmptyState (zero results, not loading)
│   └── CategoryRow × N (with DropdownMenu actions)
├── Pagination (Prev / "Page X of Y" / Next)
└── ConfirmDialog (delete confirmation)
```

Two TanStack Query calls run in parallel:
- `['categories', params]` — filtered list for the table
- `['categories-summary']` — `limit=1000` call to derive type counts

#### Create page flow

```
/categories/new
├── Fetch parentCategories (listCategories limit=1000)
├── CategoryForm (empty defaults)
│   ├── Top section: language-independent fields (Type, Parent, Icon, etc.)
│   └── Locale tabs: EN / PL / FR / DE / NO
└── On submit:
    1. POST /api/v1/admin/categories  (language-independent only)
    2. For each locale tab with non-empty Name:
       PUT /api/v1/admin/categories/:id/translations/:locale
       (all locale upserts run in parallel via Promise.all)
    3. On completion: navigate to /categories/:id
```

#### Edit page structure

```
/categories/[id]
├── Fetch category (getCategory)
├── Fetch parentCategories (listCategories limit=1000, exclude self)
├── CategoryForm (pre-populated from category data)
│   ├── Top section: language-independent fields
│   └── Locale tabs: each pre-populated from translations array
├── Delete Category button → ConfirmDialog
└── On submit:
    1. PUT /api/v1/admin/categories/:id  (language-independent fields)
    2. For each locale tab with non-empty Name:
       PUT /api/v1/admin/categories/:id/translations/:locale
       (all run in parallel)
    3. On completion: toast success + invalidate cache
```

The separate Translations table section (with Edit buttons and Add Translation buttons) from the old design is removed — translation management is now fully handled through the tabbed form.

---

## Data Models

### Prisma schema changes

The `Category` model needs a `type` field. The existing schema does not include it, so a migration is required:

```prisma
model Category {
  id              String         @id @default(uuid())
  type            CategoryType   // NEW
  parent_id       String?
  icon            String?
  sort_order      Int            @default(0)
  status          CategoryStatus @default(draft)
  entry_count     Int            @default(0)
  cover_image_url String?
  created_at      DateTime       @default(now())
  updated_at      DateTime       @updatedAt

  parent       Category?   @relation("CategoryChildren", fields: [parent_id], references: [id])
  children     Category[]  @relation("CategoryChildren")
  translations CategoryTranslation[]
  entries      EntryCategory[]

  @@index([type])
  @@index([status])
}

enum CategoryType {
  entry
  abbreviation
  article
}
```

The `CategoryTranslation` model gains three new fields to match the data model document:

```prisma
model CategoryTranslation {
  id               String   @id @default(uuid())
  category_id      String
  locale           String
  slug             String
  name             String
  description      Json?    // TipTap JSON — nullable
  short_description String? // NEW — plain text summary; nullable
  seo_title        String?  // NEW — ≤60 chars; nullable
  seo_description  String?  // NEW — ≤160 chars; nullable
  status           TranslationStatus @default(draft)
  translator_note  String?
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  category Category @relation(fields: [category_id], references: [id])

  @@unique([category_id, locale])
  @@unique([locale, slug])
}
```

### TypeScript types (frontend)

Defined in `categories.ts` as shown in the API client section above. Key changes from the previous version:
- `AdminCategoryTranslation` gains `short_description`, `seo_title`, `seo_description`
- `CreateCategoryPayload` removes `name_en` and `slug_en`, adds optional `parent_id`
- `UpdateCategoryPayload` adds optional `parent_id`
- `UpsertTranslationPayload` adds `short_description`, `seo_title`, `seo_description`

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Type field round-trip

*For any* valid category type value (`entry`, `abbreviation`, `article`), creating a category with that type and then fetching it should return a category whose `type` field equals the value that was submitted.

**Validates: Requirements 1.1, 1.2, 1.4**

---

### Property 2: Invalid type values are rejected

*For any* string that is not one of `entry`, `abbreviation`, or `article`, submitting it as the `type` field in a `POST /api/v1/admin/categories` or `PUT /api/v1/admin/categories/:id` request should result in an HTTP 400 response, and the category should not be created or modified.

**Validates: Requirements 1.3, 1.5**

---

### Property 3: API client error propagation

*For any* `adminCategoriesApi` function and any non-2xx HTTP status code returned by the server, the function should throw an `ApiError` whose `status` property equals the HTTP status code received.

**Validates: Requirements 2.9**

---

### Property 4: Create-then-fetch round-trip (language-independent fields)

*For any* valid `CreateCategoryPayload` (containing `type`, optionally `parent_id`, `icon`, `sort_order`, `cover_image_url`, `status` — but no `name_en` or `slug_en`), calling `adminCategoriesApi.createCategory` followed by `adminCategoriesApi.getCategory` with the returned id should yield a category whose `type`, `parent_id`, and `status` match the submitted payload.

**Validates: Requirements 2.3, 2.8**

---

### Property 5: Translation upsert round-trip

*For any* valid `UpsertTranslationPayload` and any supported locale, calling `adminCategoriesApi.upsertTranslation` followed by `adminCategoriesApi.getCategory` should yield a category whose translations array contains an entry for that locale with `name`, `slug`, `short_description`, `seo_title`, and `seo_description` matching the submitted payload.

**Validates: Requirements 2.6, 9.1, 9.2**

---

### Property 6: Sidebar active state

*For any* pathname that starts with `/categories`, the Categories nav item in the sidebar should have the active CSS classes (`bg-blue-50 text-blue-700` on the link, `text-blue-600` on the icon), and no other nav item should be marked active for that pathname.

**Validates: Requirements 3.2**

---

### Property 7: Slug auto-generation per locale

*For any* non-empty name string entered into a locale tab's Name field (when that locale's Slug field has not been manually edited), the Slug field value for that locale should equal the lowercase kebab-case transformation of that name — specifically: lowercased, trimmed, non-alphanumeric characters removed, whitespace runs replaced with single hyphens, leading/trailing hyphens stripped.

**Validates: Requirements 6.4**

---

### Property 8: Submit button disabled invariant

*For any* form state where the EN Name field is empty or the Type field has no selection, the submit button should be disabled. Conversely, when both EN Name is non-empty and Type is selected, the submit button should be enabled.

**Validates: Requirements 6.6**

---

### Property 9: Edit page pre-population

*For any* existing category returned by `GET /api/v1/admin/categories/:id`, rendering the edit page should display language-independent form fields (`type`, `parent_id`, `icon`, `sort_order`, `status`, `cover_image_url`) matching the category's values, and each locale tab should be pre-populated with the corresponding translation's `name`, `slug`, `short_description`, `seo_title`, `seo_description`, and `status` — or empty if no translation exists for that locale.

**Validates: Requirements 7.1, 7.5**

---

### Property 10: SEO field character limits enforced

*For any* `seo_title` value exceeding 60 characters or `seo_description` value exceeding 160 characters submitted to `PUT /api/v1/admin/categories/:id/translations/:locale`, the API should return HTTP 400, and the translation should not be persisted.

*For any* `seo_title` value with length L ≤ 60, the character counter in the form should display `L/60`. *For any* `seo_description` value with length L ≤ 160, the counter should display `L/160`.

**Validates: Requirements 9.3, 9.4, 9.5**

---

### Property 11: Parent ID round-trip

*For any* valid category `id` used as `parent_id` in a `CreateCategoryPayload` or `UpdateCategoryPayload`, fetching the resulting category should return `parent_id` equal to the submitted value. Submitting `parent_id: null` should return `parent_id: null`.

**Validates: Requirements 8.1, 8.3, 8.4**

---

### Property 12: Summary counts correctness

*For any* collection of categories with a known distribution of types, the summary panel should display counts where: the Entry count equals the number of categories with `type === 'entry'`, the Abbreviation count equals the number with `type === 'abbreviation'`, the Article count equals the number with `type === 'article'`, and the Total equals the sum of all three.

**Validates: Requirements 11.1**

---

## Error Handling

### API layer

| Scenario | HTTP status | Behaviour |
|---|---|---|
| `type` missing or invalid on POST | 400 | `BadRequestException` from class-validator |
| `type` invalid on PUT | 400 | `BadRequestException` from class-validator |
| `seo_title` > 60 chars on translation upsert | 400 | `BadRequestException` from class-validator |
| `seo_description` > 160 chars on translation upsert | 400 | `BadRequestException` from class-validator |
| Category not found | 404 | `NotFoundException` |
| Slug already taken (translation upsert) | 409 | `ConflictException` |
| Delete with assigned entries | 400 | `BadRequestException` with descriptive message |
| Delete with child categories | 400 | `BadRequestException` with descriptive message |

### Frontend layer

| Scenario | UI response |
|---|---|
| List fetch fails | Toast error; empty table body (no skeletons) |
| Parent categories fetch fails | Toast error; Parent Category field rendered disabled |
| Create returns 409 | Inline error on Slug field of affected locale tab; form stays open |
| Create returns other non-2xx | Toast error; form stays open |
| Update returns 409 | Inline error on Slug field of affected locale tab |
| Update returns other non-2xx | Toast error |
| Delete returns 400 | Toast: "Cannot delete — category has entries assigned" |
| Delete returns other non-2xx | Generic toast error |
| Translation upsert fails | Toast error; form stays open |
| Summary fetch fails | Dashes in summary panel; toast error |
| Import file > 5 MB or not CSV | Toast error; no request sent |
| 401 from any call | `client.ts` redirects to `/login` (existing behaviour) |

---

## Testing Strategy

### Unit tests (Jest — API layer)

The existing `admin-category.service.spec.ts` covers the core service. New tests needed:

- `create` with `type` field — verify it is persisted and returned
- `update` with `type` field — verify it is updated
- `update` with `parent_id` — verify it is persisted and returned
- `findAll` with `type` filter — verify Prisma `where` clause includes type
- `findAll` with `status` filter — verify Prisma `where` clause includes status
- `create` without `type` — verify class-validator rejects the DTO (controller-level test)
- `create` with invalid `type` — verify HTTP 400
- `upsertTranslation` with `seo_title` > 60 chars — verify HTTP 400
- `upsertTranslation` with `seo_description` > 160 chars — verify HTTP 400
- `create` does not accept `name_en` or `slug_en` fields

### Property-based tests (fast-check — API client)

Use [fast-check](https://fast-check.io/) (TypeScript-native PBT library). Each property test runs a minimum of 100 iterations.

**Property 1 — Type field round-trip**
```
Tag: Feature: admin-categories, Property 1: type field round-trip
```
Generate: random `CategoryType` value from the enum.
Assert: `createCategory({ type, ... })` then `getCategory(id)` returns `type === input`.
Use MSW or jest mocks to avoid real HTTP calls.

**Property 2 — Invalid type values are rejected**
```
Tag: Feature: admin-categories, Property 2: invalid type values are rejected
```
Generate: arbitrary strings filtered to exclude `entry`, `abbreviation`, `article`.
Assert: the DTO validation (`validate(dto)` from `class-validator`) returns errors for the `type` field.

**Property 3 — API client error propagation**
```
Tag: Feature: admin-categories, Property 3: API client error propagation
```
Generate: HTTP status codes from `[400, 401, 403, 404, 409, 422, 500, 502, 503]`.
Assert: each `adminCategoriesApi` function throws `ApiError` with matching `status`.
Use `jest.spyOn(global, 'fetch')` to mock responses.

**Property 4 — Create-then-fetch round-trip (language-independent)**
```
Tag: Feature: admin-categories, Property 4: create-then-fetch round-trip
```
Generate: random valid `CreateCategoryPayload` (type from enum, optional parent_id as UUID or null). Note: no `name_en` or `slug_en` in the payload.
Assert: mocked create returns the payload fields; mocked getCategory returns the same language-independent fields.

**Property 5 — Translation upsert round-trip**
```
Tag: Feature: admin-categories, Property 5: translation upsert round-trip
```
Generate: random locale string and `UpsertTranslationPayload` including `name`, `slug`, optional `short_description`, optional `seo_title` (≤60 chars), optional `seo_description` (≤160 chars).
Assert: after upsert, the category's translations array contains the locale with matching `name`, `slug`, `short_description`, `seo_title`, `seo_description`.

**Property 6 — Sidebar active state** (React Testing Library + fast-check)
```
Tag: Feature: admin-categories, Property 6: sidebar active state
```
Generate: random pathnames starting with `/categories` (e.g. `/categories`, `/categories/new`, `/categories/abc-123`).
Assert: Categories nav item has active classes; no other item has active classes.

**Property 7 — Slug auto-generation per locale** (pure function test)
```
Tag: Feature: admin-categories, Property 7: slug auto-generation
```
Generate: arbitrary non-empty strings.
Assert: `toSlug(name)` output is lowercase, contains only `[a-z0-9-]`, and does not start or end with a hyphen.

**Property 8 — Submit button disabled invariant** (React Testing Library + fast-check)
```
Tag: Feature: admin-categories, Property 8: submit button disabled invariant
```
Generate: combinations of (empty | non-empty) EN Name and (selected | unselected) Type.
Assert: button disabled iff EN Name is empty OR Type is unselected.

**Property 9 — Edit page pre-population** (React Testing Library + fast-check)
```
Tag: Feature: admin-categories, Property 9: edit page pre-population
```
Generate: random `AdminCategory` objects with various translations arrays.
Assert: rendered language-independent fields match the category's values; each locale tab's Name, Slug, Short Description, SEO Title, SEO Description, and Status match the corresponding translation, or are empty when no translation exists for that locale.

**Property 10 — SEO field character limits** (pure function + React Testing Library)
```
Tag: Feature: admin-categories, Property 10: SEO field character limits
```
Generate: strings of varying lengths.
Assert: `seo_title` strings with length L display `L/60` counter; `seo_description` strings with length L display `L/160` counter. Strings with L > 60 or L > 160 respectively trigger the API to return HTTP 400 (mocked).

**Property 11 — Parent ID round-trip** (fast-check)
```
Tag: Feature: admin-categories, Property 11: parent ID round-trip
```
Generate: random UUID strings and `null`.
Assert: submitting `parent_id` in `CreateCategoryPayload` or `UpdateCategoryPayload` results in the same value returned by `getCategory`. `null` maps to `null`.

**Property 12 — Summary counts correctness** (pure function test)
```
Tag: Feature: admin-categories, Property 12: summary counts correctness
```
Generate: random arrays of `AdminCategory` with random type distributions.
Assert: `computeSummary(categories)` returns counts matching the actual distribution.

### Integration tests

- `GET /api/v1/admin/categories?type=entry` returns only entry-type categories
- `GET /api/v1/admin/categories?status=published` returns only published categories
- `POST /api/v1/admin/categories` without `name_en`/`slug_en` succeeds; translations are created separately
- `PUT .../translations/:locale` with `seo_title` > 60 chars returns HTTP 400
- `PUT .../translations/:locale` with `seo_description` > 160 chars returns HTTP 400
- Full create → translate → update → delete lifecycle via the controller (NestJS `supertest`)

### Example-based unit tests (frontend)

- List page: loading state shows 5 skeleton rows
- List page: empty state shown when API returns zero results (not while loading)
- List page: clicking a row navigates to `/categories/[id]`
- List page: delete confirmation dialog shows category name
- List page: 400 on delete shows specific toast; 500 shows generic toast
- Create page: form submits language-independent fields first, then locale translations in parallel
- Create page: 409 on translation upsert shows inline slug error on the affected locale tab
- Edit page: 404 on load shows "Category not found" with back link
- Edit page: locale tabs pre-populated from translations array; missing-locale tabs show empty fields
- Edit page: Parent Category dropdown pre-selects category's current parent_id
- Edit page: selecting "None — top-level category" sends `parent_id: null`
- Sidebar: Categories item visible for both editor and admin roles
- Sidebar: collapsed state renders icon-only with tooltip
