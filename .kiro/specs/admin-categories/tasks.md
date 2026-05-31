# Implementation Plan: admin-categories

## Overview

Implement the Categories management section across three layers: API (NestJS/Prisma), API client library (`categories.ts`), and Admin frontend (Next.js). The work follows the same patterns used by the existing Entries and Articles features. The API layer adds a `type` field and filter params; the client library gains a full `adminCategoriesApi` object; the frontend gains three pages, four shared components, and a sidebar link.

---

## Tasks

- [ ] 1. Add `type` field to Prisma schema and generate migration
  - Add `CategoryType` enum (`entry`, `abbreviation`, `article`) to `apps/api/prisma/schema.prisma`
  - Add `type CategoryType` field to the `Category` model with `@@index([type])`
  - Run `pnpm prisma migrate dev --name add_category_type` inside `apps/api`
  - Regenerate the Prisma client (`pnpm prisma generate`)
  - _Requirements: 1.1, 1.2_

- [ ] 2. Update API DTOs and service to support `type` and filter params
  - [ ] 2.1 Add `type` to `CreateCategoryDto` and `UpdateCategoryDto`
    - In `create-category.dto.ts`: add required `@IsIn(['entry','abbreviation','article']) type: string` with `@ApiProperty`
    - In `update-category.dto.ts`: add optional `@IsOptional() @IsIn(['entry','abbreviation','article']) type?: string` with `@ApiPropertyOptional`
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [ ] 2.2 Update `AdminCategoryService` to persist and filter by `type`
    - `findAll`: add `type?: string` and `status?: string` params; extend the Prisma `where` clause to filter by both; include `type` in the mapped response objects
    - `create`: pass `type: dto.type` into `prisma.category.create`
    - `update`: spread `...(dto.type !== undefined && { type: dto.type as never })` into `prisma.category.update`
    - `findOne`: include `type` in the returned category object
    - _Requirements: 1.1, 1.2, 1.4_

  - [ ] 2.3 Update `AdminCategoryController.findAll` to accept `type` and `status` query params
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

- [ ] 3. Checkpoint — API layer complete
  - Ensure all API unit and property tests pass, ask the user if questions arise.

- [ ] 4. Expand `apps/admin/src/lib/api/categories.ts` with `adminCategoriesApi`
  - [ ] 4.1 Add all TypeScript types and interfaces
    - Export `CategoryType`, `CategoryStatus`, `TranslationStatus` union types
    - Export `AdminCategoryTranslation`, `AdminCategory`, `AdminCategoryListParams`, `CreateCategoryPayload`, `UpdateCategoryPayload`, `UpsertTranslationPayload` interfaces matching the API contract in the design
    - Preserve the existing `CategoryNode` interface and `categoriesApi` export unchanged
    - _Requirements: 2.7_

  - [ ] 4.2 Implement the `adminCategoriesApi` object
    - `listCategories(params?)` → `apiGetWithMeta<AdminCategory[]>('/api/v1/admin/categories', params)`
    - `getCategory(id)` → `apiGet<AdminCategory>('/api/v1/admin/categories/:id')`
    - `createCategory(dto)` → `apiPost<AdminCategory>('/api/v1/admin/categories', dto)`
    - `updateCategory(id, dto)` → `apiPut<AdminCategory>('/api/v1/admin/categories/:id', dto)`
    - `deleteCategory(id)` → `apiDelete<void>('/api/v1/admin/categories/:id')`
    - `upsertTranslation(id, locale, dto)` → `apiPut<AdminCategoryTranslation>('/api/v1/admin/categories/:id/translations/:locale', dto)`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_

  - [ ]* 4.3 Write property test — Property 3: API client error propagation
    - **Property 3: API client error propagation**
    - **Validates: Requirements 2.8**
    - Generate: HTTP status codes from `[400, 401, 403, 404, 409, 422, 500, 502, 503]`
    - Assert: each `adminCategoriesApi` function throws `ApiError` with matching `status`
    - Use `jest.spyOn(global, 'fetch')` to mock responses
    - File: `apps/admin/src/__tests__/api/categories-error-propagation.property.spec.ts`

  - [ ]* 4.4 Write property test — Property 4: create-then-fetch round-trip
    - **Property 4: Create-then-fetch round-trip**
    - **Validates: Requirements 2.3, 2.7**
    - Generate: random valid `CreateCategoryPayload` (type from enum, name/slug as non-empty strings)
    - Assert: mocked `createCategory` returns payload fields; mocked `getCategory` returns same fields
    - File: `apps/admin/src/__tests__/api/categories-create-fetch-roundtrip.property.spec.ts`

  - [ ]* 4.5 Write property test — Property 5: translation upsert round-trip
    - **Property 5: Translation upsert round-trip**
    - **Validates: Requirements 2.6**
    - Generate: random locale string and `UpsertTranslationPayload`
    - Assert: after upsert, the category's translations array contains the locale with matching `name`/`slug`
    - File: `apps/admin/src/__tests__/api/categories-translation-roundtrip.property.spec.ts`

- [ ] 5. Add Categories nav item to the sidebar
  - In `apps/admin/src/components/layout/sidebar.tsx`:
    - Import `Tag` from `lucide-react` alongside existing icon imports
    - Add `{ label: 'Categories', href: '/categories', icon: Tag }` to the CONTENT section after the Articles item
  - No `adminOnly` flag — visible to all authenticated users
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 5.1 Write property test — Property 6: sidebar active state
    - **Property 6: Sidebar active state**
    - **Validates: Requirements 3.2**
    - Generate: random pathnames starting with `/categories` (e.g. `/categories`, `/categories/new`, `/categories/abc-123`)
    - Assert: Categories nav item has active classes (`bg-blue-50 text-blue-700`, `text-blue-600`); no other item has active classes for those pathnames
    - Use React Testing Library + fast-check; mock `usePathname`
    - File: `apps/admin/src/__tests__/components/sidebar-active-state.property.spec.tsx`

- [ ] 6. Create shared category badge components
  - [ ] 6.1 Create `apps/admin/src/components/categories/category-type-badge.tsx`
    - Coloured `Badge` variant per type: `entry` → blue, `abbreviation` → amber, `article` → green
    - Props: `type: CategoryType`
    - _Requirements: 4.2_

  - [ ] 6.2 Create `apps/admin/src/components/categories/category-status-badge.tsx`
    - Coloured `Badge` variant per status: `draft` → slate outline, `published` → green
    - Props: `status: CategoryStatus`
    - _Requirements: 4.2_

- [ ] 7. Create `CategoryForm` component
  - [ ] 7.1 Implement `apps/admin/src/components/categories/category-form.tsx`
    - Fields: Name (required text), Slug (required text), Type (required select: Entry/Abbreviation/Article), Icon (optional text), Sort Order (optional number, default 0), Cover Image URL (optional text), Status (select: Draft/Published, default Draft)
    - Export `CategoryFormValues` type
    - Submit button disabled when Name is empty or Type has no selection
    - _Requirements: 6.1, 6.4_

  - [ ] 7.2 Add slug auto-generation logic to `CategoryForm`
    - Track `slugManuallyEdited` boolean state (false initially)
    - On Name change: if `!slugManuallyEdited`, set slug to `toSlug(name)` using a pure `toSlug` helper (lowercase, trim, remove non-alphanumeric except spaces, replace whitespace runs with `-`)
    - On Slug field direct edit: set `slugManuallyEdited = true`; stop auto-populating
    - Export `toSlug` helper from the same file for property testing
    - _Requirements: 6.2, 6.3_

  - [ ]* 7.3 Write property test — Property 7: slug auto-generation
    - **Property 7: Slug auto-generation**
    - **Validates: Requirements 6.2**
    - Generate: arbitrary non-empty strings
    - Assert: `toSlug(name)` output is lowercase, contains only `[a-z0-9-]`, does not start or end with a hyphen
    - File: `apps/admin/src/__tests__/components/slug-auto-generation.property.spec.ts`

  - [ ]* 7.4 Write property test — Property 8: submit button disabled invariant
    - **Property 8: Submit button disabled invariant**
    - **Validates: Requirements 6.4**
    - Generate: combinations of (empty | non-empty) Name and (selected | unselected) Type
    - Assert: button disabled iff Name is empty OR Type is unselected
    - Use React Testing Library + fast-check
    - File: `apps/admin/src/__tests__/components/category-form-submit-disabled.property.spec.tsx`

- [ ] 8. Create `TranslationDialog` component
  - Create `apps/admin/src/components/categories/translation-dialog.tsx`
  - Props: `open`, `onOpenChange`, `locale`, `initialValues?` (pre-populated for edit), `onSubmit(payload: UpsertTranslationPayload)`, `isSubmitting`
  - Fields: Name (text), Slug (text), Translator Note (optional text), Status (select: draft/reviewed/published)
  - On submit: call `onSubmit`; keep dialog open on error (caller handles toast)
  - _Requirements: 7.5, 7.6, 7.7, 7.8_

- [ ] 9. Create the Category List page
  - [ ] 9.1 Create `apps/admin/src/app/(dashboard)/categories/page.tsx` with table and filters
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

  - [ ] 9.2 Add summary panel to the Category List page
    - Four stat cards: Entry count, Abbreviation count, Article count, Total
    - Separate `useQuery(['categories-summary'])` call with `limit=1000` to derive counts via a `computeSummary` helper
    - Skeleton placeholders while loading; dashes + toast error on failure
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 9.3 Add Export and Import functionality to the Category List page
    - Export: fetch all categories matching current filters, build CSV string, trigger `<a download="categories.csv">` click
    - Import: hidden `<input type="file" accept=".csv">` triggered by Import button; validate file size ≤ 5 MB and `.csv` extension before sending; toast error and abort if invalid
    - _Requirements: 4.13, 4.14_

  - [ ]* 9.4 Write property test — Property 11: summary counts correctness
    - **Property 11: Summary counts correctness**
    - **Validates: Requirements 8.1**
    - Generate: random arrays of `AdminCategory` with random type distributions
    - Assert: `computeSummary(categories)` returns counts matching the actual distribution (entry, abbreviation, article, total)
    - File: `apps/admin/src/__tests__/components/summary-counts.property.spec.ts`

  - [ ]* 9.5 Write unit tests for the Category List page
    - Loading state renders 5 skeleton rows
    - Empty state shown when API returns zero results (not while loading)
    - Clicking a row navigates to `/categories/[id]`
    - Delete confirmation dialog shows category name
    - 400 on delete shows specific toast; 500 shows generic toast
    - Summary panel shows dashes when summary fetch fails
    - File: `apps/admin/src/__tests__/pages/categories-list.spec.tsx`

- [ ] 10. Checkpoint — List page complete
  - Ensure all list page tests pass, ask the user if questions arise.

- [ ] 11. Create the Category Create page
  - Create `apps/admin/src/app/(dashboard)/categories/new/page.tsx`
  - Back link → `/categories`; page title "New Category"
  - Render `CategoryForm` with `submitLabel="Create Category"`
  - On submit: call `adminCategoriesApi.createCategory`; on 2xx navigate to `/categories/[id]`
  - On 409: set inline slug error "This slug is already taken"; keep form open
  - On other non-2xx: toast error; keep form open
  - Cancel button → `/categories`
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ]* 11.1 Write unit test for Create page 409 handling
    - 409 on submit shows inline slug error; form stays open
    - File: `apps/admin/src/__tests__/pages/categories-create.spec.tsx`

- [ ] 12. Create the Category Edit page
  - [ ] 12.1 Create `apps/admin/src/app/(dashboard)/categories/[id]/page.tsx` with form pre-population
    - `useQuery(['category', id])` → `adminCategoriesApi.getCategory(id)`
    - Skeleton placeholders while loading
    - 404 response → "Category not found" message with back link to `/categories`
    - Pre-populate `CategoryForm` with `type`, `icon`, `sort_order`, `status`, `cover_image_url`, and English translation `name`/`slug`
    - On save: call `adminCategoriesApi.updateCategory`; on 2xx show success toast; on 409 show inline slug error; on other non-2xx show toast error
    - Delete button → `ConfirmDialog` → `adminCategoriesApi.deleteCategory`; on 2xx navigate to `/categories`; on 400 show specific toast
    - _Requirements: 7.1, 7.2, 7.3, 7.9, 7.10, 7.11, 7.12, 7.13_

  - [ ] 12.2 Add Translations section to the Edit page
    - List all existing translations (locale, name, slug, status) with Edit button per row
    - "Add Translation" buttons for each locale not yet present (en, pl, de, no, fr)
    - Edit click: open `TranslationDialog` pre-populated with current values
    - Add click: open `TranslationDialog` with empty fields, status defaulting to "draft"
    - On dialog submit: call `adminCategoriesApi.upsertTranslation`; on 2xx close dialog and `invalidateQueries(['category', id])`; on error show toast and keep dialog open
    - _Requirements: 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ]* 12.3 Write property test — Property 9: edit page pre-population
    - **Property 9: Edit page pre-population**
    - **Validates: Requirements 7.1**
    - Generate: random `AdminCategory` objects with varied field values
    - Assert: rendered form fields match the category's `type`, `icon`, `sort_order`, `status`, `cover_image_url`, and English translation `name`/`slug`
    - Use React Testing Library + fast-check; mock `adminCategoriesApi.getCategory`
    - File: `apps/admin/src/__tests__/pages/categories-edit-prepopulation.property.spec.tsx`

  - [ ]* 12.4 Write property test — Property 10: translations list completeness
    - **Property 10: Translations list completeness**
    - **Validates: Requirements 7.4**
    - Generate: random arrays of `AdminCategoryTranslation` (0–10 items)
    - Assert: rendered translation rows count equals array length; each row shows correct `locale`, `name`, `slug`, `status`
    - Use React Testing Library + fast-check
    - File: `apps/admin/src/__tests__/pages/categories-translations-completeness.property.spec.tsx`

  - [ ]* 12.5 Write unit tests for the Edit page
    - 404 on load shows "Category not found" with back link
    - Translation dialog opens pre-populated on Edit click
    - Translation dialog opens empty on Add click
    - 400 on delete shows specific toast
    - File: `apps/admin/src/__tests__/pages/categories-edit.spec.tsx`

- [ ] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass across API and frontend layers, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use [fast-check](https://fast-check.io/) and run ≥100 iterations
- The `toSlug` helper and `computeSummary` function should be pure, exported utilities to make property testing straightforward
- The existing `categoriesApi` export in `categories.ts` must remain untouched for backward compatibility
- The Prisma migration must be run before any API tests that touch the database
- Integration tests (controller-level with `supertest`) are covered by the existing `admin-category.service.spec.ts` extension in task 2.4

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5", "2.6", "4.1"] },
    { "id": 4, "tasks": ["4.2"] },
    { "id": 5, "tasks": ["4.3", "4.4", "4.5", "5", "6.1", "6.2"] },
    { "id": 6, "tasks": ["5.1", "7.1"] },
    { "id": 7, "tasks": ["7.2", "8"] },
    { "id": 8, "tasks": ["7.3", "7.4", "9.1"] },
    { "id": 9, "tasks": ["9.2", "9.3", "11"] },
    { "id": 10, "tasks": ["9.4", "9.5", "11.1", "12.1"] },
    { "id": 11, "tasks": ["12.2"] },
    { "id": 12, "tasks": ["12.3", "12.4", "12.5"] }
  ]
}
```
