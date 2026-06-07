# Implementation Plan: admin-categories

## Overview

Implement the Categories management section across three layers: API (NestJS/Prisma), API client library (`categories.ts`), and Admin frontend (Next.js). The work follows the same patterns used by the existing Entries and Articles features. The API layer adds a `type` field and filter params; the client library gains a full `adminCategoriesApi` object; the frontend gains three pages, four shared components, and a sidebar link.

---

## Tasks

- [x] 1. Add `type` field to Prisma schema and generate migration
  - Add `CategoryType` enum (`entry`, `abbreviation`, `article`) to `apps/api/prisma/schema.prisma`
  - Add `type CategoryType` field to the `Category` model with `@@index([type])`
  - Run `pnpm prisma migrate dev --name add_category_type` inside `apps/api`
  - Regenerate the Prisma client (`pnpm prisma generate`)
  - _Requirements: 1.1, 1.2_

- [x] 2. Update API DTOs and service to support `type` and filter params
  - [x] 2.1 Add `type` to `CreateCategoryDto` and `UpdateCategoryDto`
    - In `create-category.dto.ts`: add required `@IsIn(['entry','abbreviation','article']) type: string` with `@ApiProperty`
    - In `update-category.dto.ts`: add optional `@IsOptional() @IsIn(['entry','abbreviation','article']) type?: string` with `@ApiPropertyOptional`
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Update `AdminCategoryService` to persist and filter by `type`
    - `findAll`: add `type?: string` and `status?: string` params; extend the Prisma `where` clause to filter by both; include `type` in the mapped response objects
    - `create`: pass `type: dto.type` into `prisma.category.create`
    - `update`: spread `...(dto.type !== undefined && { type: dto.type as never })` into `prisma.category.update`
    - `findOne`: include `type` in the returned category object
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 2.3 Update `AdminCategoryController.findAll` to accept `type` and `status` query params
    - Add `@Query('type') type?: string` and `@Query('status') status?: string` parameters
    - Add `@ApiQuery` decorators for both new params
    - Forward both to `adminCategoryService.findAll`
    - _Requirements: 1.1_

  - [ ]* 2.4 Write unit tests for DTO validation and service `type` handling
    - Test `CreateCategoryDto` rejects missing `type` (HTTP 400)
    - Test `CreateCategoryDto` rejects invalid `type` values (HTTP 400)
    - Test `AdminCategoryService.create` persists `type` and returns it
    - Test `AdminCategoryService.update` updates `type` field
    - Test `AdminCategoryService.findAll` with `type` filter applies correct Prisma `where` clause
    - Test `AdminCategoryService.findAll` with `status` filter applies correct Prisma `where` clause
    - File: `apps/api/src/admin/category/admin-category.service.spec.ts` (extend existing)
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [ ]* 2.5 Write property test — Property 1: type field round-trip
    - **Property 1: Type field round-trip**
    - **Validates: Requirements 1.1, 1.2, 1.4**
    - Generate: random `CategoryType` value from `['entry', 'abbreviation', 'article']`
    - Assert: `createCategory({ type, ... })` then `getCategory(id)` returns `type === input`
    - Use jest mocks; run ≥100 iterations with fast-check
    - File: `apps/api/src/admin/category/__tests__/category-type-roundtrip.property.spec.ts`

  - [ ]* 2.6 Write property test — Property 2: invalid type values are rejected
    - **Property 2: Invalid type values are rejected**
    - **Validates: Requirements 1.3, 1.5**
    - Generate: arbitrary strings filtered to exclude `'entry'`, `'abbreviation'`, `'article'`
    - Assert: `validate(dto)` from `class-validator` returns errors on the `type` field
    - File: `apps/api/src/admin/category/__tests__/invalid-type-rejection.property.spec.ts`

- [ ] 3. Add `short_description`, `seo_title`, `seo_description` to Prisma `CategoryTranslation` model
  - Add `short_description String?`, `seo_title String?`, `seo_description String?` fields to `CategoryTranslation` in `apps/api/prisma/schema.prisma`
  - Run `pnpm prisma migrate dev --name add_category_translation_seo_fields` inside `apps/api`
  - Regenerate the Prisma client (`pnpm prisma generate`)
  - _Requirements: 9.1_

- [ ] 4. Update `UpsertTranslationDto` to accept and validate new SEO fields
  - Add optional `@IsOptional() @IsString() @MaxLength(60) seo_title?: string` with `@ApiPropertyOptional`
  - Add optional `@IsOptional() @IsString() @MaxLength(160) seo_description?: string` with `@ApiPropertyOptional`
  - Add optional `@IsOptional() @IsString() short_description?: string` with `@ApiPropertyOptional`
  - Ensure `AdminCategoryService.upsertTranslation` passes these fields to `prisma.categoryTranslation.upsert`
  - Ensure all three fields are included in every `CategoryTranslation` response object
  - _Requirements: 9.1, 9.2, 9.5_

  - [ ]* 4.1 Write unit tests for `UpsertTranslationDto` validation
    - Test `seo_title` > 60 chars returns HTTP 400
    - Test `seo_description` > 160 chars returns HTTP 400
    - Test valid payload with all three new fields is persisted and returned
    - File: `apps/api/src/admin/category/admin-category.service.spec.ts` (extend existing)
    - _Requirements: 9.5_

- [x] 5. Checkpoint — API layer complete
  - Ensure all API unit and property tests pass, ask the user if questions arise.

- [x] 6. Expand `apps/admin/src/lib/api/categories.ts` with `adminCategoriesApi`
  - [x] 6.1 Add all TypeScript types and interfaces
    - Export `CategoryType`, `CategoryStatus`, `TranslationStatus` union types
    - Export `AdminCategoryTranslation` (with `short_description`, `seo_title`, `seo_description`), `AdminCategory`, `AdminCategoryListParams`, `CreateCategoryPayload` (no `name_en`/`slug_en`, has `parent_id`), `UpdateCategoryPayload` (has `parent_id`), `UpsertTranslationPayload` (has `short_description`, `seo_title`, `seo_description`) interfaces matching the API contract in the design
    - Preserve the existing `CategoryNode` interface and `categoriesApi` export unchanged
    - _Requirements: 2.7, 2.8_

  - [x] 6.2 Implement the `adminCategoriesApi` object
    - `listCategories(params?)` → `apiGetWithMeta<AdminCategory[]>('/api/v1/admin/categories', params)`
    - `getCategory(id)` → `apiGet<AdminCategory>('/api/v1/admin/categories/:id')`
    - `createCategory(dto)` → `apiPost<AdminCategory>('/api/v1/admin/categories', dto)`
    - `updateCategory(id, dto)` → `apiPut<AdminCategory>('/api/v1/admin/categories/:id', dto)`
    - `deleteCategory(id)` → `apiDelete<void>('/api/v1/admin/categories/:id')`
    - `upsertTranslation(id, locale, dto)` → `apiPut<AdminCategoryTranslation>('/api/v1/admin/categories/:id/translations/:locale', dto)`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_

  - [ ]* 6.3 Write property test — Property 3: API client error propagation
    - **Property 3: API client error propagation**
    - **Validates: Requirements 2.9**
    - Generate: HTTP status codes from `[400, 401, 403, 404, 409, 422, 500, 502, 503]`
    - Assert: each `adminCategoriesApi` function throws `ApiError` with matching `status`
    - Use `jest.spyOn(global, 'fetch')` to mock responses
    - File: `apps/admin/src/__tests__/api/categories-error-propagation.property.spec.ts`

  - [ ]* 6.4 Write property test — Property 4: create-then-fetch round-trip
    - **Property 4: Create-then-fetch round-trip**
    - **Validates: Requirements 2.3, 2.8**
    - Generate: random valid `CreateCategoryPayload` (type from enum, optional parent_id as UUID or null; no `name_en`/`slug_en`)
    - Assert: mocked `createCategory` returns payload fields; mocked `getCategory` returns same language-independent fields
    - File: `apps/admin/src/__tests__/api/categories-create-fetch-roundtrip.property.spec.ts`

  - [ ]* 6.5 Write property test — Property 5: translation upsert round-trip
    - **Property 5: Translation upsert round-trip**
    - **Validates: Requirements 2.6**
    - Generate: random locale string and `UpsertTranslationPayload` including optional `short_description`, `seo_title` (≤60 chars), `seo_description` (≤160 chars)
    - Assert: after upsert, the category's translations array contains the locale with matching `name`, `slug`, `short_description`, `seo_title`, `seo_description`
    - File: `apps/admin/src/__tests__/api/categories-translation-roundtrip.property.spec.ts`

- [x] 7. Add Categories nav item to the sidebar
  - In `apps/admin/src/components/layout/sidebar.tsx`:
    - Import `Tag` from `lucide-react` alongside existing icon imports
    - Add `{ label: 'Categories', href: '/categories', icon: Tag }` to the CONTENT section after the Articles item
  - No `adminOnly` flag — visible to all authenticated users
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 7.1 Write property test — Property 6: sidebar active state
    - **Property 6: Sidebar active state**
    - **Validates: Requirements 3.2**
    - Generate: random pathnames starting with `/categories` (e.g. `/categories`, `/categories/new`, `/categories/abc-123`)
    - Assert: Categories nav item has active classes (`bg-blue-50 text-blue-700`, `text-blue-600`); no other item has active classes for those pathnames
    - Use React Testing Library + fast-check; mock `usePathname`
    - File: `apps/admin/src/__tests__/components/sidebar-active-state.property.spec.tsx`

- [x] 8. Create shared category badge components
  - [x] 8.1 Create `apps/admin/src/components/categories/category-type-badge.tsx`
    - Coloured `Badge` variant per type: `entry` → blue, `abbreviation` → amber, `article` → green
    - Props: `type: CategoryType`
    - _Requirements: 4.2_

  - [x] 8.2 Create `apps/admin/src/components/categories/category-status-badge.tsx`
    - Coloured `Badge` variant per status: `draft` → slate outline, `published` → green
    - Props: `status: CategoryStatus`
    - _Requirements: 4.2_

- [x] 9. Create `RichTextEditor` component
  - Created `src/components/ui/rich-text-editor.tsx`
  - TipTap-based rich text editor with toolbar: Bold, Italic, Paragraph, Heading 2, Heading 3
  - Accepts and emits TipTap JSON (`unknown`); emits `null` for empty documents
  - Packages installed: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-heading`, `@tiptap/extension-placeholder`
  - _Requirements: 10.1, 10.2, 10.5_

- [x] 10. Create `CategoryForm` component (tabbed, with per-locale translation management)
  - [x] 10.1 Implement `apps/admin/src/components/categories/category-form.tsx`
    - Language-independent top section: Type (required), Parent Category (dropdown), Status, Icon, Sort Order, Cover Image URL
    - Tabbed per-locale section: EN / PL / FR / DE / NO tabs
    - Each tab: Name, Slug (auto-gen), Short Description, Description (TipTap), SEO Title (≤60 with counter), SEO Description (≤160 with counter), Translation Status
    - Export `CategoryFormValues`, `LocaleTabState`, `SupportedLocale`, `SUPPORTED_LOCALES`, `toSlug`
    - `TranslationDialog` is NOT used — translation management is fully inline in the tabs
    - _Requirements: 6.1, 6.2, 6.3, 7.4, 7.5, 7.6, 9.3, 9.4, 9.6, 10.1, 10.2_

  - [x] 10.2 Slug auto-generation logic per locale tab
    - Track `slugManuallyEdited` boolean per locale (false initially)
    - On Name change: if `!slugManuallyEdited`, set slug to `toSlug(name)` for that locale
    - On Slug field direct edit: set `slugManuallyEdited = true` for that locale; stop auto-populating
    - `toSlug` helper: lowercase, trim, remove non-alphanumeric except spaces, replace whitespace runs with `-`, strip leading/trailing hyphens
    - _Requirements: 6.4, 6.5_

  - [x] 10.3 Submit button disabled invariant
    - Button disabled while EN Name field is empty OR Type has no selection
    - _Requirements: 6.6_

  - [ ]* 10.4 Write property test — Property 7: slug auto-generation
    - **Property 7: Slug auto-generation**
    - **Validates: Requirements 6.4**
    - Generate: arbitrary non-empty strings
    - Assert: `toSlug(name)` output is lowercase, contains only `[a-z0-9-]`, does not start or end with a hyphen
    - File: `apps/admin/src/__tests__/components/slug-auto-generation.property.spec.ts`

  - [ ]* 10.5 Write property test — Property 8: submit button disabled invariant
    - **Property 8: Submit button disabled invariant**
    - **Validates: Requirements 6.6**
    - Generate: combinations of (empty | non-empty) EN Name and (selected | unselected) Type
    - Assert: button disabled iff EN Name is empty OR Type is unselected
    - Use React Testing Library + fast-check
    - File: `apps/admin/src/__tests__/components/category-form-submit-disabled.property.spec.tsx`

- [x] 11. Create the Category List page
  - [x] 11.1 Create `apps/admin/src/app/(dashboard)/categories/page.tsx` with table and filters
    - Page header: "Categories" title, "+ Add Category" button (→ `/categories/new`), Export button, Import button
    - Filter bar: Search input (300 ms debounce, resets page to 1), Type select (All/Entry/Abbreviation/Article), Status select (All/Draft/Published)
    - Table columns: Name (with icon if non-null), Type (`CategoryTypeBadge`), Entry Count, Status (`CategoryStatusBadge`), Updated date, Actions menu
    - Pagination: 20 items/page, Prev/Next buttons, "Page X of Y" label
    - Loading state: 5 `SkeletonRows`; empty state when zero results and not loading
    - Total count display above table
    - Row click navigates to `/categories/[id]`; actions menu has Edit and Delete items
    - Delete: `ConfirmDialog` → `adminCategoriesApi.deleteCategory`; 400 → specific toast; other errors → generic toast
    - Use `useQuery(['categories', params])` for the filtered list
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 4.15, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 11.2 Add summary panel to the Category List page
    - Four stat cards: Entry count, Abbreviation count, Article count, Total
    - Separate `useQuery(['categories-summary'])` call with `limit=1000` to derive counts via a `computeSummary` helper
    - Skeleton placeholders while loading; dashes + toast error on failure
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 11.3 Add Export and Import functionality to the Category List page
    - Export: fetch all categories matching current filters, build CSV string, trigger `<a download="categories.csv">` click
    - Import: hidden `<input type="file" accept=".csv">` triggered by Import button; validate file size ≤ 5 MB and `.csv` extension before sending; toast error and abort if invalid
    - _Requirements: 4.13, 4.14_

  - [ ]* 11.4 Write property test — Property 12: summary counts correctness
    - **Property 12: Summary counts correctness**
    - **Validates: Requirements 11.1**
    - Generate: random arrays of `AdminCategory` with random type distributions
    - Assert: `computeSummary(categories)` returns counts matching the actual distribution (entry, abbreviation, article, total)
    - File: `apps/admin/src/__tests__/components/summary-counts.property.spec.ts`

  - [ ]* 11.5 Write unit tests for the Category List page
    - Loading state renders 5 skeleton rows
    - Empty state shown when API returns zero results (not while loading)
    - Clicking a row navigates to `/categories/[id]`
    - Delete confirmation dialog shows category name
    - 400 on delete shows specific toast; 500 shows generic toast
    - Summary panel shows dashes when summary fetch fails
    - File: `apps/admin/src/__tests__/pages/categories-list.spec.tsx`

- [x] 12. Checkpoint — List page complete
  - Ensure all list page tests pass, ask the user if questions arise.

- [x] 13. Create the Category Create page
  - Created `apps/admin/src/app/(dashboard)/categories/new/page.tsx`
  - Back link → `/categories`; page title "New Category"
  - Fetches parent categories (`listCategories limit=1000`); passes as prop to `CategoryForm`
  - On submit: POST language-independent fields, then parallel `upsertTranslation` for each locale with non-empty Name
  - On 409: toast error indicating a slug conflict; keep form open
  - On other non-2xx: toast error; keep form open
  - On success: navigate to `/categories/[id]`
  - Cancel button → `/categories`
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 8.1, 8.2, 8.3_

  - [ ]* 13.1 Write unit test for Create page 409 handling
    - 409 on submit shows toast error about slug conflict; form stays open
    - File: `apps/admin/src/__tests__/pages/categories-create.spec.tsx`

- [x] 14. Create the Category Edit page
  - [x] 14.1 Created `apps/admin/src/app/(dashboard)/categories/[id]/page.tsx` with form pre-population
    - `useQuery(['category', id])` → `adminCategoriesApi.getCategory(id)`
    - Skeleton placeholders while loading
    - 404 response → "Category not found" message with back link to `/categories`
    - Fetches parent categories (`listCategories limit=1000`); excludes self from dropdown
    - Pre-populates all `CategoryForm` locale tabs from `category.translations` (Name, Slug, Short Description, Description, SEO Title, SEO Description, Translation Status)
    - On save: PUT language-independent fields + parallel `upsertTranslation` for all locale tabs with non-empty Name
    - On 409: toast error indicating slug conflict; on other non-2xx: toast error
    - On success: toast success + `invalidateQueries(['category', id])`
    - Delete button → `ConfirmDialog` → `adminCategoriesApi.deleteCategory`; on 2xx navigate to `/categories`; on 400 show specific toast
    - Separate translations table section is REMOVED — translation management is fully in the tabbed form
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 8.4, 8.5_

  - [ ]* 14.2 Write property test — Property 9: edit page pre-population
    - **Property 9: Edit page pre-population**
    - **Validates: Requirements 7.1, 7.5**
    - Generate: random `AdminCategory` objects with varied field values and translation arrays (0–5 locales)
    - Assert: rendered language-independent fields match the category's `type`, `parent_id`, `icon`, `sort_order`, `status`, `cover_image_url`; each locale tab's Name, Slug, Short Description, SEO Title, SEO Description, and Translation Status match the corresponding translation, or are empty when no translation exists for that locale
    - Use React Testing Library + fast-check; mock `adminCategoriesApi.getCategory`
    - File: `apps/admin/src/__tests__/pages/categories-edit-prepopulation.property.spec.tsx`

  - [ ]* 14.3 Write unit tests for the Edit page
    - 404 on load shows "Category not found" with back link
    - All locale tabs pre-populated when translations exist
    - Locale tab shows empty fields when no translation exists for that locale
    - 400 on delete shows specific toast
    - File: `apps/admin/src/__tests__/pages/categories-edit.spec.tsx`

- [x] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass across API and frontend layers, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use [fast-check](https://fast-check.io/) and run ≥100 iterations
- The `toSlug` helper and `computeSummary` function are pure, exported utilities to make property testing straightforward
- The existing `categoriesApi` export in `categories.ts` must remain untouched for backward compatibility
- The Prisma migration for SEO fields (task 3) must be run before any API tests that touch translations
- `TranslationDialog` is deprecated and removed — translation management is handled entirely through the tabbed `CategoryForm`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5", "2.6", "3"] },
    { "id": 4, "tasks": ["4", "6.1"] },
    { "id": 5, "tasks": ["4.1", "6.2"] },
    { "id": 6, "tasks": ["6.3", "6.4", "6.5", "7", "8.1", "8.2"] },
    { "id": 7, "tasks": ["7.1", "9"] },
    { "id": 8, "tasks": ["10.1"] },
    { "id": 9, "tasks": ["10.2", "10.3", "11.1"] },
    { "id": 10, "tasks": ["10.4", "10.5", "11.2", "11.3"] },
    { "id": 11, "tasks": ["11.4", "11.5", "13"] },
    { "id": 12, "tasks": ["13.1", "14.1"] },
    { "id": 13, "tasks": ["14.2", "14.3"] }
  ]
}
```
