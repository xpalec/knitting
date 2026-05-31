# Design Document: admin-categories

## Overview

The admin-categories feature adds a full Categories management section to the Knitpedia admin app. It touches three layers:

1. **API (NestJS)** — add a `type` field (`entry | abbreviation | article`) to the Category model, expose it through all existing admin endpoints, and add `type`/`status` query filters to `GET /api/v1/admin/categories`.
2. **API client library** — expand `apps/admin/src/lib/api/categories.ts` from a single public-tree helper into a full `adminCategoriesApi` object covering all CRUD operations and translation upsert.
3. **Admin frontend (Next.js)** — three new pages under `(dashboard)/categories/`: a list page with filtering, summary panel, export/import, and per-row actions; a create page; and an edit page with inline translation management. A sidebar link is added to the CONTENT section.

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
    CF["CategoryForm component"]
    TD["TranslationDialog component"]
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
  TD --> AC
  AC -->|HTTP| CTRL
  CTRL --> SVC
  SVC --> DB
  SVC --> CACHE
```

The frontend communicates exclusively through `adminCategoriesApi`. The API layer is already wired — the main work is adding the `type` field to DTOs and service logic, then building the frontend.

---

## Components and Interfaces

### API Layer

#### DTOs — changes required

**`CreateCategoryDto`** — add `type` field:
```typescript
@ApiProperty({ enum: ['entry', 'abbreviation', 'article'] })
@IsIn(['entry', 'abbreviation', 'article'])
declare type: string;
```

**`UpdateCategoryDto`** — add optional `type` field:
```typescript
@ApiPropertyOptional({ enum: ['entry', 'abbreviation', 'article'] })
@IsOptional()
@IsIn(['entry', 'abbreviation', 'article'])
type?: string;
```

**`AdminCategoryService.findAll`** — add `type` and `status` filter params:
```typescript
async findAll(page: number, limit: number, search?: string, type?: string, status?: string)
```

**`AdminCategoryController.findAll`** — add `@Query('type')` and `@Query('status')` params.

The `findAll` response shape must include `type` in each category object. The `create` and `update` service methods must persist the `type` field.

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
  translations: Array<{ locale: string; name: string; slug: string; status: string }>;
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
  description?: unknown;       // TipTap JSON
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

export interface CreateCategoryPayload {
  type: CategoryType;
  name_en: string;
  slug_en: string;
  icon?: string;
  sort_order?: number;
  cover_image_url?: string;
  status?: CategoryStatus;
}

export interface UpdateCategoryPayload {
  type?: CategoryType;
  icon?: string;
  sort_order?: number;
  status?: CategoryStatus;
  cover_image_url?: string | null;
}

export interface UpsertTranslationPayload {
  name: string;
  slug: string;
  description?: unknown;
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
| `category-form.tsx` | Controlled form for create/edit (Name, Slug, Type, Icon, Sort Order, Cover Image URL, Status) |
| `translation-dialog.tsx` | Dialog for adding/editing a single locale translation |
| `category-type-badge.tsx` | Coloured badge for `entry` / `abbreviation` / `article` |
| `category-status-badge.tsx` | Coloured badge for `draft` / `published` |

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

#### Edit page structure

```
CategoryEditPage
├── Back link + page title
├── CategoryForm (pre-populated, Save button)
├── Translations section
│   ├── Translation rows (locale | name | slug | status | Edit button)
│   └── "Add Translation" buttons (one per missing locale)
├── "Delete Category" button → ConfirmDialog
└── TranslationDialog (shared for add/edit)
```

---

## Data Models

### Prisma schema changes

The `Category` model needs a `type` field. The existing schema does not include it, so a migration is required:

```prisma
model Category {
  id              String    @id @default(uuid())
  type            CategoryType  // NEW
  parent_id       String?
  icon            String?
  sort_order      Int       @default(0)
  status          CategoryStatus @default(draft)
  entry_count     Int       @default(0)
  cover_image_url String?
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

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

The `CategoryTranslation` model is unchanged.

### TypeScript types (frontend)

Defined in `categories.ts` as shown in the API client section above. The key addition is `type: CategoryType` on `AdminCategory` and `CreateCategoryPayload`.

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

**Validates: Requirements 2.8**

---

### Property 4: Create-then-fetch round-trip

*For any* valid `CreateCategoryPayload`, calling `adminCategoriesApi.createCategory` followed by `adminCategoriesApi.getCategory` with the returned id should yield a category whose `type`, `name` (English translation), `slug` (English translation), and `status` match the submitted payload.

**Validates: Requirements 2.3, 2.7**

---

### Property 5: Translation upsert round-trip

*For any* valid `UpsertTranslationPayload` and any supported locale, calling `adminCategoriesApi.upsertTranslation` followed by `adminCategoriesApi.getCategory` should yield a category whose translations array contains an entry for that locale with `name` and `slug` matching the submitted payload.

**Validates: Requirements 2.6**

---

### Property 6: Sidebar active state

*For any* pathname that starts with `/categories`, the Categories nav item in the sidebar should have the active CSS classes (`bg-blue-50 text-blue-700` on the link, `text-blue-600` on the icon), and no other nav item should be marked active for that pathname.

**Validates: Requirements 3.2**

---

### Property 7: Slug auto-generation

*For any* non-empty name string entered into the Name field (when the Slug field has not been manually edited), the Slug field value should equal the lowercase kebab-case transformation of that name — specifically: lowercased, trimmed, non-alphanumeric characters removed, whitespace runs replaced with single hyphens.

**Validates: Requirements 6.2**

---

### Property 8: Submit button disabled invariant

*For any* form state where the Name field is empty or the Type field has no selection, the submit button should be disabled. Conversely, when both Name is non-empty and Type is selected, the submit button should be enabled.

**Validates: Requirements 6.4**

---

### Property 9: Edit page pre-population

*For any* existing category returned by `GET /api/v1/admin/categories/:id`, rendering the edit page should display form fields whose values match the category's `type`, `icon`, `sort_order`, `status`, `cover_image_url`, and the English translation's `name` and `slug`.

**Validates: Requirements 7.1**

---

### Property 10: Translations list completeness

*For any* category that has N translations, the Translations section on the edit page should render exactly N translation rows, each showing the correct `locale`, `name`, `slug`, and `status` for that translation.

**Validates: Requirements 7.4**

---

### Property 11: Summary counts correctness

*For any* collection of categories with a known distribution of types, the summary panel should display counts where: the Entry count equals the number of categories with `type === 'entry'`, the Abbreviation count equals the number with `type === 'abbreviation'`, the Article count equals the number with `type === 'article'`, and the Total equals the sum of all three.

**Validates: Requirements 8.1**

---

## Error Handling

### API layer

| Scenario | HTTP status | Behaviour |
|---|---|---|
| `type` missing or invalid on POST | 400 | `BadRequestException` from class-validator |
| `type` invalid on PUT | 400 | `BadRequestException` from class-validator |
| Category not found | 404 | `NotFoundException` |
| English slug already taken (create) | 409 | `ConflictException` |
| Slug taken by another category (translation upsert) | 409 | `ConflictException` |
| Delete with assigned entries | 400 | `BadRequestException` with descriptive message |
| Delete with child categories | 400 | `BadRequestException` with descriptive message |

### Frontend layer

| Scenario | UI response |
|---|---|
| List fetch fails | Toast error; empty table body (no skeletons) |
| Create returns 409 | Inline error on Slug field; form stays open |
| Create returns other non-2xx | Toast error; form stays open |
| Update returns 409 | Inline error on Slug field |
| Update returns other non-2xx | Toast error |
| Delete returns 400 | Toast: "Cannot delete — category has entries assigned" |
| Delete returns other non-2xx | Generic toast error |
| Translation upsert fails | Toast error; dialog stays open |
| Summary fetch fails | Dashes in summary panel; toast error |
| Import file > 5 MB or not CSV | Toast error; no request sent |
| 401 from any call | `client.ts` redirects to `/login` (existing behaviour) |

---

## Testing Strategy

### Unit tests (Jest — API layer)

The existing `admin-category.service.spec.ts` covers the core service. New tests needed:

- `create` with `type` field — verify it is persisted and returned
- `update` with `type` field — verify it is updated
- `findAll` with `type` filter — verify Prisma `where` clause includes type
- `findAll` with `status` filter — verify Prisma `where` clause includes status
- `create` without `type` — verify class-validator rejects the DTO (controller-level test)
- `create` with invalid `type` — verify HTTP 400

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

**Property 4 — Create-then-fetch round-trip**
```
Tag: Feature: admin-categories, Property 4: create-then-fetch round-trip
```
Generate: random valid `CreateCategoryPayload` (type from enum, name/slug as non-empty strings).
Assert: mocked create returns the payload fields; mocked getCategory returns the same fields.

**Property 5 — Translation upsert round-trip**
```
Tag: Feature: admin-categories, Property 5: translation upsert round-trip
```
Generate: random locale string and `UpsertTranslationPayload`.
Assert: after upsert, the category's translations array contains the locale with matching name/slug.

**Property 6 — Sidebar active state** (React Testing Library + fast-check)
```
Tag: Feature: admin-categories, Property 6: sidebar active state
```
Generate: random pathnames starting with `/categories` (e.g. `/categories`, `/categories/new`, `/categories/abc-123`).
Assert: Categories nav item has active classes; no other item has active classes.

**Property 7 — Slug auto-generation** (pure function test)
```
Tag: Feature: admin-categories, Property 7: slug auto-generation
```
Generate: arbitrary non-empty strings.
Assert: `toSlug(name)` output is lowercase, contains only `[a-z0-9-]`, and does not start or end with a hyphen.

**Property 8 — Submit button disabled invariant** (React Testing Library + fast-check)
```
Tag: Feature: admin-categories, Property 8: submit button disabled invariant
```
Generate: combinations of (empty | non-empty) Name and (selected | unselected) Type.
Assert: button disabled iff Name is empty OR Type is unselected.

**Property 9 — Edit page pre-population** (React Testing Library + fast-check)
```
Tag: Feature: admin-categories, Property 9: edit page pre-population
```
Generate: random `AdminCategory` objects.
Assert: rendered form fields match the category's data.

**Property 10 — Translations list completeness** (React Testing Library + fast-check)
```
Tag: Feature: admin-categories, Property 10: translations list completeness
```
Generate: random arrays of `AdminCategoryTranslation` (0–10 items).
Assert: rendered translation rows count equals array length; each row shows correct locale/name/slug/status.

**Property 11 — Summary counts correctness** (pure function test)
```
Tag: Feature: admin-categories, Property 11: summary counts correctness
```
Generate: random arrays of `AdminCategory` with random type distributions.
Assert: `computeSummary(categories)` returns counts matching the actual distribution.

### Integration tests

- `GET /api/v1/admin/categories?type=entry` returns only entry-type categories (against a test database or Prisma mock)
- `GET /api/v1/admin/categories?status=published` returns only published categories
- Full create → update → delete lifecycle via the controller (NestJS `supertest`)

### Example-based unit tests (frontend)

- List page: loading state shows 5 skeleton rows
- List page: empty state shown when API returns zero results (not while loading)
- List page: clicking a row navigates to `/categories/[id]`
- List page: delete confirmation dialog shows category name
- List page: 400 on delete shows specific toast; 500 shows generic toast
- Create page: 409 on submit shows inline slug error
- Edit page: 404 on load shows "Category not found" with back link
- Edit page: translation dialog opens pre-populated on Edit click
- Sidebar: Categories item visible for both editor and admin roles
- Sidebar: collapsed state renders icon-only with tooltip
