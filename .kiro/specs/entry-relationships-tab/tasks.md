# Implementation Plan: Entry Relationships Tab

## Overview

Implement the Relationships tab in the entry editor sidebar. This involves three parallel tracks:
1. **Backend** — Prisma model, NestJS module/controller/service, migration
2. **API client** — typed `entryRelationshipsApi` module in the admin app
3. **Frontend** — `useRelationships` hook, `RelationshipsPanel` component, tab wiring in `entry-form.tsx`

---

## Tasks

- [x] 1. Add Prisma model and generate migration
  - [x] 1.1 Add `EntryRelationshipType` enum and `EntryRelationship` model to `apps/api/prisma/schema.prisma`
    - Add the enum with all 8 values: `PREREQUISITE`, `VARIANT_OF`, `ALTERNATIVE_TO`, `COMMONLY_CONFUSED_WITH`, `USED_IN`, `PART_OF`, `COUNTERPART_OF`, `RELATED_TO`
    - Add the `EntryRelationship` model with fields: `id`, `source_entry_id`, `target_entry_id`, `type`, `note`, `created_at`
    - Add `@@unique([source_entry_id, target_entry_id, type])` and `@@index([source_entry_id])`
    - Add `relationship_sources` and `relationship_targets` relations to the existing `Entry` model
    - _Requirements: 6.5_

  - [x] 1.2 Generate and apply the Prisma migration
    - Run `pnpm prisma migrate dev --name add_entry_relationship` from `apps/api`
    - Verify the generated SQL creates the `entry_relationship` table with the correct columns, constraints, and indexes
    - _Requirements: 6.5_

- [x] 2. Implement backend NestJS module
  - [x] 2.1 Create DTOs in `apps/api/src/admin/entry-relationship/dto/`
    - Create `create-entry-relationship.dto.ts` with `CreateEntryRelationshipDto`: `sourceEntryId`, `targetEntryId`, `type: EntryRelationshipType`, `note?: string`
    - Add `class-validator` decorators matching the Prisma constraints (e.g. `@IsUUID()`, `@IsEnum()`, `@IsString()`, `@MaxLength(500)`, `@IsOptional()`)
    - _Requirements: 6.3_

  - [x] 2.2 Create `AdminEntryRelationshipService` in `apps/api/src/admin/entry-relationship/admin-entry-relationship.service.ts`
    - Implement `listRelationships(sourceEntryId: string)`: query `entryRelationship.findMany` filtered by `source_entry_id`, include `target_entry` with its `translations`
    - Implement `createRelationship(dto: CreateEntryRelationshipDto)`: validate `sourceEntryId !== targetEntryId` (throw `BadRequestException`), call `entryRelationship.create`, catch unique constraint violation and throw `ConflictException`
    - Implement `deleteRelationship(id: string)`: call `entryRelationship.delete`, catch not-found and throw `NotFoundException`
    - _Requirements: 6.2, 6.3, 6.4_

  - [ ]* 2.3 Write unit tests for `AdminEntryRelationshipService`
    - Test `listRelationships` returns only relationships for the specified `sourceEntryId`
    - Test `createRelationship` throws `BadRequestException` when `sourceEntryId === targetEntryId`
    - Test `createRelationship` throws `ConflictException` on duplicate `(source, target, type)`
    - Test `deleteRelationship` throws `NotFoundException` when ID does not exist
    - Test `deleteRelationship` succeeds and removes the record
    - _Requirements: 6.2, 6.3, 6.4_

  - [x] 2.4 Create `AdminEntryRelationshipController` in `apps/api/src/admin/entry-relationship/admin-entry-relationship.controller.ts`
    - Base route: `api/v1/admin/entry-relationships`
    - `GET /` — accepts `?sourceEntryId=<uuid>` query param, calls `listRelationships`, returns `{ data: [...] }`
    - `POST /` — body `CreateEntryRelationshipDto`, calls `createRelationship`
    - `DELETE /:id` — calls `deleteRelationship`
    - Apply `JwtAuthGuard` and `RolesGuard` with `@Roles('editor')` matching `AdminEntryController`
    - _Requirements: 6.2, 6.3, 6.4_

  - [x] 2.5 Create `AdminEntryRelationshipModule` and register it in `app.module.ts`
    - Create `apps/api/src/admin/entry-relationship/admin-entry-relationship.module.ts` importing `PrismaModule` and declaring the controller and service
    - Import `AdminEntryRelationshipModule` in `apps/api/src/app.module.ts`
    - _Requirements: 6.2, 6.3, 6.4_

- [x] 3. Checkpoint — backend compiles and tests pass
  - Run `pnpm typecheck` in `apps/api` and ensure no TypeScript errors
  - Run backend tests to confirm service specs pass
  - Ask the user if questions arise.

- [x] 4. Implement frontend API client module
  - [x] 4.1 Create `apps/admin/src/lib/api/entry-relationships.ts`
    - Export `EntryRelationshipType` enum with all 8 values in declaration order
    - Export `EntryRelationship` interface: `id`, `sourceEntryId`, `targetEntryId`, `type`, `note?`, `createdAt`
    - Export `CreateRelationshipPayload` interface
    - Implement `entryRelationshipsApi.listRelationships(sourceEntryId)` using `apiGet` — map snake_case response fields to camelCase
    - Implement `entryRelationshipsApi.createRelationship(payload)` using `apiPost`
    - Implement `entryRelationshipsApi.deleteRelationship(id)` using `apiDelete`
    - Follow the same pattern as `entriesApi`, `tagsApi`, and `abbreviationsApi` in the same directory
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 4.2 Write unit tests for `entryRelationshipsApi`
    - `listRelationships` makes GET to correct URL with `sourceEntryId` query param
    - `createRelationship` makes POST with correct body (trimmed note, note omitted when empty)
    - `deleteRelationship` makes DELETE to correct URL
    - Each function throws `ApiError` with the correct status on 4xx/5xx responses
    - File: `apps/admin/src/lib/api/__tests__/entry-relationships.test.ts`
    - _Requirements: 6.2, 6.3, 6.4, 6.6_

  - [ ]* 4.3 Write property test: API errors throw `ApiError` with matching status (Property 15)
    - **Property 15: API errors throw `ApiError` with matching status**
    - Generate HTTP status codes 400–599; mock fetch; assert `ApiError.status === mockStatus` for all three functions
    - File: `apps/admin/src/lib/api/__tests__/entry-relationships.property.test.ts`
    - Tag: `// Feature: entry-relationships-tab, Property 15: API error status`
    - **Validates: Requirements 6.6**

- [x] 5. Implement `useRelationships` custom hook
  - [x] 5.1 Create `apps/admin/src/components/entries/use-relationships.ts`
    - Implement state machine with `isFetching`, `pendingRefetch`, `relationships`, `isLoading`, `isError`
    - `fetchRelationships()` calls `entryRelationshipsApi.listRelationships(entryId)`, sets state
    - `notifyMutated()`: if `!isFetching` call `fetchRelationships()` immediately; if `isFetching` set `pendingRefetch = true`
    - On fetch completion: if `pendingRefetch === true`, clear flag and call `fetchRelationships()` once
    - `retry()` re-issues the fetch for the current `entryId`
    - `useEffect` triggers initial fetch when `entryId` changes and is defined
    - Export `UseRelationshipsResult` interface
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 6. Implement `RelationshipsPanel` component
  - [x] 6.1 Create `apps/admin/src/components/entries/relationships-panel.tsx` — scaffold and unsaved state
    - Define `RelationshipsPanelProps`: `entryId: string | undefined`, `activeLocale: string`, `readOnly?: boolean`
    - When `entryId` is `undefined`, render a message explaining relationships can be added after the entry is saved; render nothing else
    - When `entryId` is present, render the add controls section and the list section (as stubs for now)
    - Import and call `useRelationships(entryId)` to drive list state
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 6.2 Implement the entry search combobox in `RelationshipsPanel`
    - Add `searchInput`, `searchResults`, `isSearching`, `targetEntry` state
    - Implement 300 ms debounce via `useEffect` + `setTimeout` (same pattern as `AbbreviationsPanel`)
    - When `searchInput.length >= 1`, call `entriesApi.search` and store up to 10 results
    - When `searchInput.length < 1`, clear `searchResults`
    - Filter out the source entry (`entryId`) from displayed results
    - When a `selectedType` is set, also filter out entries already linked under that type
    - _Requirements: 2.2, 2.3, 2.10, 2.11_

  - [ ]* 6.3 Write property test: search results cap (Property 2)
    - **Property 2: Search results cap**
    - Generate arrays of `Entry` objects (length 0–50); pass through the results-capping filter function; assert output length ≤ 10
    - File: `apps/admin/src/components/entries/__tests__/relationships-panel.property.test.ts`
    - Tag: `// Feature: entry-relationships-tab, Property 2: search results cap`
    - **Validates: Requirements 2.2**

  - [ ]* 6.4 Write property test: source entry excluded from search results (Property 6)
    - **Property 6: Source entry excluded from search results**
    - Generate search results arrays that may include the source entry ID; assert it never appears in rendered/filtered options
    - Tag: `// Feature: entry-relationships-tab, Property 6: source entry excluded`
    - **Validates: Requirements 2.10**

  - [ ]* 6.5 Write property test: already-linked entries excluded under selected type (Property 7)
    - **Property 7: Already-linked entries excluded from search results under selected type**
    - Generate existing relationships + search results; assert filtered results exclude already-linked entries under selected type
    - Tag: `// Feature: entry-relationships-tab, Property 7: already-linked entries excluded`
    - **Validates: Requirements 2.11**

  - [x] 6.6 Implement relationship type selector and note input in `RelationshipsPanel`
    - Add `selectedType: EntryRelationshipType | null` and `note: string` state
    - Render a `<Select>` containing all 8 `EntryRelationshipType` values with human-readable labels from `RELATIONSHIP_TYPE_LABELS`
    - Render an optional note `<Input>` with `maxLength={500}`
    - _Requirements: 2.1, 4.1_

  - [ ]* 6.7 Write property test: type selector completeness (Property 1)
    - **Property 1: Type selector completeness**
    - Generate arbitrary `entryId`; render panel with mocked hook; assert all 8 enum values present in selector options with no duplicates
    - Tag: `// Feature: entry-relationships-tab, Property 1: type selector completeness`
    - **Validates: Requirements 2.1**

  - [x] 6.8 Implement the Add button and create mutation in `RelationshipsPanel`
    - Add `useMutation` for `entryRelationshipsApi.createRelationship`
    - Add button is enabled iff `targetEntry !== null && selectedType !== null && !isCreating`
    - While creating, show loading indicator on button and disable it
    - On success: clear `targetEntry`, `selectedType`, `note`; call `notifyMutated()`
    - On error: show `toast.error(...)` via `sonner`; retain current field values
    - Build payload: include `note: note.trim()` only when `note.trim().length > 0`
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 4.2, 4.3, 4.4_

  - [ ]* 6.9 Write property test: Add button enable predicate (Property 3)
    - **Property 3: Add button enable predicate**
    - Generate all combinations of `(targetEntry | null, selectedType | null, isCreating bool)`; assert button disabled state matches `targetEntry !== null && selectedType !== null && !isCreating`
    - Tag: `// Feature: entry-relationships-tab, Property 3: Add button enable predicate`
    - **Validates: Requirements 2.4, 2.5, 2.6, 2.7**

  - [ ]* 6.10 Write property test: form fields cleared after successful create (Property 4)
    - **Property 4: Form fields cleared after successful create**
    - Generate valid `(targetEntry, selectedType, note)` triples; mock successful API; assert all three fields empty after mutation settles
    - Tag: `// Feature: entry-relationships-tab, Property 4: form cleared on success`
    - **Validates: Requirements 2.8, 4.4**

  - [ ]* 6.11 Write property test: form fields preserved after failed create (Property 5)
    - **Property 5: Form fields preserved after failed create**
    - Generate `(targetEntry, selectedType, note)` triples; mock error API; assert all three fields unchanged after mutation settles
    - Tag: `// Feature: entry-relationships-tab, Property 5: form preserved on failure`
    - **Validates: Requirements 2.9**

  - [ ]* 6.12 Write property test: note serialization (Property 10)
    - **Property 10: Note serialization**
    - Generate arbitrary strings `s`; assert that if `s.trim().length > 0` payload includes `note: s.trim()`; if `s.trim().length === 0` payload has no `note` key
    - Tag: `// Feature: entry-relationships-tab, Property 10: note serialization`
    - **Validates: Requirements 4.2, 4.3**

  - [x] 6.13 Implement `RelationshipCard` sub-component and relationships list in `RelationshipsPanel`
    - Define `RelationshipCardProps`: `relationship`, `displayName`, `isDeleting`, `readOnly`, `onRemove`
    - Render target entry display name, relationship type label (from `RELATIONSHIP_TYPE_LABELS`), optional note, and remove button
    - Remove button is disabled when `isDeleting || readOnly`
    - Resolve display names using `resolveTranslation` utility with three-tier locale fallback (activeLocale → "en" → entry.id)
    - Define `RELATIONSHIP_TYPE_LABELS` and `RELATIONSHIP_TYPE_ORDER` constants
    - Group relationships by type, render group headers in `RELATIONSHIP_TYPE_ORDER`, skip types with no members
    - Show "No relationships added yet." when list is empty
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.5, 4.6_

  - [ ]* 6.14 Write property test: all relationships rendered in list (Property 8)
    - **Property 8: All relationships rendered in list**
    - Generate relationship arrays of varying length; render panel with mocked hook; assert count of rendered cards equals array length
    - Tag: `// Feature: entry-relationships-tab, Property 8: all relationships rendered`
    - **Validates: Requirements 3.1**

  - [ ]* 6.15 Write property test: grouping correctness — count, order, and labels (Property 9)
    - **Property 9: Grouping correctness — count, order, and labels**
    - Generate relationship arrays with varying type distributions; assert group count equals distinct types present, groups appear in canonical enum order, each header has the exact human-readable label
    - Tag: `// Feature: entry-relationships-tab, Property 9: grouping correctness`
    - **Validates: Requirements 3.2, 3.3, 3.4**

  - [ ]* 6.16 Write property test: card note display (Property 11)
    - **Property 11: Card note display**
    - Generate `EntryRelationship` objects with arbitrary `note` field (including null/undefined/whitespace); assert note section present iff `note` is a non-empty, non-whitespace string
    - Tag: `// Feature: entry-relationships-tab, Property 11: card note display`
    - **Validates: Requirements 4.5, 4.6**

  - [ ]* 6.17 Write property test: entry display name follows three-tier locale fallback (Property 16)
    - **Property 16: Entry display name follows three-tier locale fallback**
    - Generate `EntryRelationship` objects with arbitrary translation arrays and active locale strings; assert resolved display name follows fallback chain (activeLocale → "en" → entry.id)
    - Tag: `// Feature: entry-relationships-tab, Property 16: display name fallback`
    - **Validates: Requirements 3.6**

  - [x] 6.18 Implement the delete mutation and confirmation dialog in `RelationshipsPanel`
    - Add `deletingId: string | null` and `confirmDeleteTarget: EntryRelationship | null` state
    - Clicking remove sets `confirmDeleteTarget` to show `ConfirmDialog`; no API call is made
    - On cancel: clear `confirmDeleteTarget`, leave card intact
    - On confirm: set `deletingId`, call `entryRelationshipsApi.deleteRelationship(id)` via `useMutation`
    - On success: call `notifyMutated()`, clear `deletingId`
    - On error: show `toast.error(...)`, clear `deletingId`, keep card visible
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 6.19 Write property test: remove control disabled state (Property 14)
    - **Property 14: Remove control disabled state**
    - Generate relationship arrays and `(readOnly, deletingId)` pairs; assert each remove button's disabled state matches: all disabled if `readOnly`, only `deletingId` card disabled otherwise, all enabled if no delete in progress
    - Tag: `// Feature: entry-relationships-tab, Property 14: remove control disabled state`
    - **Validates: Requirements 5.5, 5.6, 5.7**

  - [ ]* 6.20 Write property test: successful delete removes the card (Property 12)
    - **Property 12: Successful delete removes the card**
    - Generate relationship arrays; mock delete success for one relationship; assert that relationship no longer appears in the rendered list after deletion settles
    - Tag: `// Feature: entry-relationships-tab, Property 12: successful delete removes card`
    - **Validates: Requirements 5.3**

  - [ ]* 6.21 Write property test: failed delete preserves the card (Property 13)
    - **Property 13: Failed delete preserves the card**
    - Generate relationship arrays; mock delete error for one relationship; assert that relationship's card remains visible after mutation settles
    - Tag: `// Feature: entry-relationships-tab, Property 13: failed delete preserves card`
    - **Validates: Requirements 5.4**

  - [x] 6.22 Implement loading and error states in `RelationshipsPanel`
    - While `isLoading` is true, render `<Skeleton>` placeholder in place of the relationships list
    - While `isError` is true, render an error message and a "Retry" button that calls `retry()`
    - _Requirements: 7.3, 7.7_

- [x] 7. Checkpoint — frontend compiles and all tests pass
  - Run `pnpm typecheck` in `apps/admin` and ensure no TypeScript errors
  - Run `pnpm vitest --run` in `apps/admin` and ensure all unit and property tests pass
  - Ask the user if questions arise.

- [x] 8. Write frontend unit tests
  - [x] 8.1 Write unit tests for `RelationshipsPanel`
    - Render with no `entryId` → placeholder message shown, add controls absent
    - Render with `entryId` → add controls and list section present
    - Loading state renders skeleton
    - Error state renders error message and retry button
    - Confirmation dialog shown on remove click; no API call before confirm
    - Cancelling confirmation leaves card intact
    - `toast.error` called on create failure
    - `toast.error` called on delete failure
    - File: `apps/admin/src/components/entries/__tests__/relationships-panel.test.tsx`
    - _Requirements: 1.3, 1.4, 2.7, 2.9, 5.1, 5.2, 5.4, 7.3, 7.7_

- [x] 9. Wire Relationships tab into `entry-form.tsx`
  - [x] 9.1 Add the "Relationships" tab trigger and content to `apps/admin/src/components/entries/entry-form.tsx`
    - Insert `<TabsTrigger variant="line" value="relationships">Relationships</TabsTrigger>` between `images` and `seo` triggers
    - Insert `<TabsContent value="relationships" className="mt-0 pt-4">` with `<RelationshipsPanel entryId={entryId} activeLocale={activeLocale} readOnly={isSubmitting} />`
    - Pass `entryId` (undefined when entry is unsaved), `activeLocale`, and `isSubmitting` as `readOnly`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 10. Final checkpoint — end-to-end validation
  - Run `pnpm typecheck` across all apps in the monorepo
  - Run all test suites (`pnpm vitest --run` in `apps/admin`, backend Jest in `apps/api`)
  - Ensure no orphaned code (all components and modules are imported and used)
  - Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at each major boundary
- Property tests use `fast-check` with `numRuns: 100`; each test is tagged with `// Feature: entry-relationships-tab, Property N: ...`
- Unit tests and property tests are complementary — unit tests cover specific examples and edge cases, property tests validate universal invariants
- The `@@unique([source_entry_id, target_entry_id, type])` DB constraint acts as a second line of defence against duplicate relationships; client-side filtering (Property 7) is the first
- Backend test file: `apps/api/src/admin/entry-relationship/admin-entry-relationship.service.spec.ts`
- Frontend unit test file: `apps/admin/src/components/entries/__tests__/relationships-panel.test.tsx`
- Frontend property test files: `apps/admin/src/lib/api/__tests__/entry-relationships.property.test.ts` and `apps/admin/src/components/entries/__tests__/relationships-panel.property.test.ts`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "4.1"] },
    { "id": 3, "tasks": ["2.3", "2.4", "4.2", "4.3", "5.1"] },
    { "id": 4, "tasks": ["2.5", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.6"] },
    { "id": 6, "tasks": ["6.3", "6.4", "6.5", "6.7", "6.8"] },
    { "id": 7, "tasks": ["6.9", "6.10", "6.11", "6.12", "6.13"] },
    { "id": 8, "tasks": ["6.14", "6.15", "6.16", "6.17", "6.18"] },
    { "id": 9, "tasks": ["6.19", "6.20", "6.21", "6.22"] },
    { "id": 10, "tasks": ["8.1"] },
    { "id": 11, "tasks": ["9.1"] }
  ]
}
```
