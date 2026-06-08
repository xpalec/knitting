# Implementation Plan: admin-entries

## Overview

Upgrade the `/entries` admin page from a basic table to a full-featured list view matching the categories page patterns. The work spans three layers: backend API extension (new flat projections + filter params on `GET /api/v1/admin/entries`), frontend API client type extensions in `entries.ts`, and a complete page overhaul with stat cards, status tabs, filter row, sortable table with checkbox selection, bulk-action bar, per-row actions, and pagination.

## Tasks

- [x] 1. Extend the backend admin entries service and controller
  - [x] 1.1 Add `type`, `category_id`, `category_name`, `tags`, and `languages` flat projections to `findAll` in `AdminEntryService`
    - Extend the Prisma query to include `tags` (with `TagTranslation` for `en` locale, fallback to `Tag.slug`), `categories` (with `CategoryTranslation` for `en` locale), and `translations` locales
    - Map the raw Prisma result to the new `EntryListItem` shape: `type`, `category_id`, `category_name`, `tags: Array<{id, name}>`, `languages: string[]`
    - `category_name` is the `CategoryTranslation.name` for `en` locale; return `null` if no category or no `en` translation
    - `languages` is the array of distinct `locale` values from the entry's `Translation` rows
    - Return `null` (not omit) for `type`, `category_id`, `category_name` when the value is absent
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.2 Add `type` and `category_id` query parameter filtering to `findAll`
    - Accept `type?: string` and `category_id?: string` in the `findAll` method signature
    - Validate `type` against the `EntryType` enum values; throw `BadRequestException` (HTTP 400) for unrecognised values
    - Validate `status` against the `EntryStatus` enum values; throw `BadRequestException` (HTTP 400) for unrecognised values
    - Add `status` filter support to `findAll` (currently only `search` is supported)
    - Apply `where` conditions for `type` and `category_id` when provided
    - _Requirements: 1.6, 1.7, 1.8, 1.9_

  - [x] 1.3 Update `AdminEntryController` to pass new query params to `findAll`
    - Add `@Query('q') q`, `@Query('type') type`, `@Query('category_id') categoryId`, `@Query('status') status` parameters to the `findAll` handler
    - Pass all params through to the service method
    - _Requirements: 1.6, 1.8_

- [x] 2. Extend the frontend API client (`entries.ts`)
  - [x] 2.1 Extend `Entry` interface and `ListEntriesParams` with new fields
    - Add optional `category_id?: string | null`, `category_name?: string | null` to the `Entry` interface
    - Add optional `tags?: Array<{ id: string; name: string }>` to `Entry`
    - Add optional `languages?: string[]` to `Entry`
    - Add optional `type?: EntryType` and `category_id?: string` to `ListEntriesParams`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.2 Add `listEntryCategories` function to `entries.ts`
    - Import `adminCategoriesApi` and `AdminCategory` from `categories.ts`
    - Implement `listEntryCategories(): Promise<ApiResponse<AdminCategory[]>>` delegating to `adminCategoriesApi.listCategories({ type: 'entry', limit: 200 })`
    - Export the function
    - _Requirements: 2.6_

- [x] 3. Create the `EntryTypeBadge` component
  - [x] 3.1 Create `apps/admin/src/components/entries/entry-type-badge.tsx`
    - Define `TYPE_COLORS: Record<string, { bg: string; color: string }>` with values for all five `EntryType` values (stitch, technique, tool, tradition, yarn_weight) and a `NEUTRAL` fallback
    - Define `TYPE_LABELS: Record<string, string>` with explicit human-readable strings (e.g. `yarn_weight` → `"Yarn Weight"`)
    - Render a `<span>` with `rounded-lg px-4 py-1 text-xs font-semibold min-w-[72px] inline-flex items-center justify-center` and inline `backgroundColor`/`color` styles
    - For unknown types, use neutral grey style (`#F1F5F9` / `#64748B`) and display the raw value — no throw, no null
    - Accept `type: string` prop (not narrowed to `EntryType`) so unknown values render gracefully without a type cast
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 3.2 Write property tests for `EntryTypeBadge` (Properties 4, 5, 6)
    - Install `fast-check` as a dev dependency in `apps/admin` if not already present
    - Create `apps/admin/src/components/entries/__tests__/entry-type-badge.test.ts`
    - **Property 4: EntryTypeBadge color mapping is exhaustive and correct** — `fc.constantFrom(...EntryTypeValues)` — assert rendered `style.backgroundColor` and `style.color` match `TYPE_COLORS` — **Validates: Requirements 3.2**
    - **Property 5: EntryTypeBadge label mapping uses explicit strings** — `fc.constantFrom(...EntryTypeValues)` — assert rendered text equals `TYPE_LABELS[type]` — **Validates: Requirements 3.3**
    - **Property 6: EntryTypeBadge unknown type fallback renders without error** — `fc.string().filter(s => !EntryTypeValues.includes(s as EntryType))` — assert renders with neutral grey style and raw string text — **Validates: Requirements 3.5**

- [x] 4. Overhaul the entries page — skeleton and stat cards
  - [x] 4.1 Replace page state, imports, and summary queries
    - Replace existing filter state with the full state shape from the design: `searchInput`, `q`, `statusFilter`, `activeTab`, `typeFilter`, `categoryFilter`, `page`, `pageSize`, `sortKey`, `sortDirection`, `selectedIds`, `deleteTarget`, `statusTarget`, `bulkDeleteOpen`
    - Add four parallel summary queries using `useQueries` with keys `['entries-summary', 'all']`, `['entries-summary', 'published']`, `['entries-summary', 'draft']`, `['entries-summary', 'review']` — each calls `entriesApi.listEntries({ limit: 1, status? })` — none include active filter state
    - Add list query using `useQuery` with key `['entries', params]` where `params` includes all active filter/page/sort values
    - Add categories query using `useQuery` with key `['entry-categories']` calling `listEntryCategories()`
    - Add `isError` handling: `useEffect` that fires `toast.error('Failed to load entries')` when `isError` is true
    - _Requirements: 5.1, 5.2, 5.3, 12.1, 12.2_

  - [x] 4.2 Render the page header with Import, Filters, and Add buttons
    - Render `PageHeader` with title `"Entries"` and subtitle `"Manage and organize encyclopaedia entries"`
    - Render "Import" button (`variant="outline"` with upload icon) that triggers a hidden `<input type="file" accept=".csv" />`
    - On file selection: validate `.csv` extension (show toast `"Invalid file type. Please select a .csv file."` and clear input on failure); validate size ≤ 5,242,880 bytes (show toast `"File is too large. Maximum allowed size is 5 MB."` and clear input on failure)
    - Render "Filters" button with violet outline styling
    - Render "Add" button (`bg-violet-600 text-white`) linking to `/entries/new`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 4.3 Write property test for file import validation (Property 7)
    - **Property 7: File import validation rejects non-CSV and oversized files** — `fc.record({ name: fc.string(), size: fc.integer({ min: 0, max: 10_000_000 }) })` — assert toast is shown iff name doesn't end with `.csv` OR size > 5_242_880 — **Validates: Requirements 4.4, 4.5**

  - [x] 4.4 Render Summary Stat Cards
    - Render four `<div>` stat card blocks with labels: "Total entries" (violet-tinted BookOpen icon), "Published" (green-tinted CheckCircle icon), "Drafts" (slate-tinted FileText icon), "Needs review" (amber-tinted Clock icon)
    - Read counts from the four `summaryQueries` results using `meta.total`
    - Show `<Skeleton>` placeholders for each count value while the respective query is loading
    - Show `"—"` when the respective summary query returns an error
    - The "Needs review" card uses the `status: 'review'` query result
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 4.5 Write property tests for summary independence and needs-review count (Properties 8, 9)
    - **Property 8: Summary stat counts are independent of active filters** — assert `summaryQueries` query keys never include `q`, `type`, or `category_id` params — **Validates: Requirements 5.2**
    - **Property 9: "Needs review" stat card count equals review-status entry count** — for any dataset, the count shown in "Needs review" equals the count from the `status: 'review'` query `meta.total` — **Validates: Requirements 5.5**

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Overhaul the entries page — status tabs and filter row
  - [x] 6.1 Render Status Tabs
    - Render `<Tabs>` with `line` variant using `TabsList` and four `TabsTrigger` components: "All entries" (value `"all"`), "Published" (value `"published"`), "Draft" (value `"draft"`), "Needs review" (value `"needs-review"`)
    - Set `Tabs value` prop to the mapped tab key based on `statusFilter` state: `all` → `"all"`, `published` → `"published"`, `draft` → `"draft"`, `review` → `"needs-review"`, `deprecated` → `"deprecated"` (no match, no active tab)
    - On tab click: set `statusFilter` to the mapped `EntryStatus` value and reset `page` to 1
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 6.2 Write property tests for tab↔status sync (Properties 10, 11)
    - **Property 10: Tab click sets correct status filter and resets page** — for any tab value, clicking sets the correct `statusFilter` and resets `page` to 1 — **Validates: Requirements 6.2, 6.3, 6.4, 6.5**
    - **Property 11: Active tab reflects status filter — bidirectional consistency** — for any `statusFilter` value, the `Tabs value` prop equals the tab key for that status; `deprecated` produces no matching tab — **Validates: Requirements 6.6, 6.7**

  - [x] 6.3 Render filter row (search input, Type dropdown, Category dropdown, Clear filters)
    - Render search `Input` with leading search icon, placeholder `"Search entries…"`, `maxLength={200}`; debounce 300 ms before setting `q` and resetting `page` to 1
    - Render "Type" `Select` with options: "All types" (`all`), "Stitch" (`stitch`), "Technique" (`technique`), "Tool" (`tool`), "Tradition" (`tradition`), "Yarn Weight" (`yarn_weight`); on non-`all` selection set `typeFilter` and reset `page` to 1
    - Render "Category" `Select` populated from `catData` with a leading "All categories" option; show `<Skeleton>` / disabled state while `catLoading`; show toast and disable on `catError`
    - Derive `hasFilters`: true iff `searchInput` has non-whitespace chars, or `typeFilter !== 'all'`, or `categoryFilter !== 'all'`
    - Render "Clear filters" link when `hasFilters` is true; on click reset `searchInput = ''`, `typeFilter = 'all'`, `categoryFilter = 'all'`, `activeTab = 'all'`, `page = 1`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_

  - [ ]* 6.4 Write property tests for search debounce and filter state (Properties 12, 13, 14)
    - **Property 12: Search debounce — query updates only after 300 ms of inactivity** — simulate rapid keystrokes; assert `q` does not update until 300 ms after final keystroke, and resets `page` to 1 — **Validates: Requirements 7.1**
    - **Property 13: hasFilters is true iff at least one filter is active** — `fc.record({ search: fc.string(), type: fc.option(fc.constantFrom('stitch','technique','tool','tradition','yarn_weight')), category: fc.option(fc.uuid()) })` — assert `hasFilters` logic matches definition — **Validates: Requirements 7.6, 7.7, 7.8**
    - **Property 14: Clear filters resets all filter state to defaults** — for any active filter combination, clicking "Clear filters" sets all filter state to defaults and `page` to 1 — **Validates: Requirements 7.10**

- [x] 7. Overhaul the entries page — data table
  - [x] 7.1 Implement the updated table structure with all nine columns
    - Render `<Table>` with `<TableHeader>` columns in order: Checkbox, Title, Type, Category, Tags, Status, Updated, Languages, Actions
    - Use `SortableTableHead` for Title, Type, and Updated columns; pass `sortKey`, `currentSort`, `currentDirection`, and `onSort` handler; clicking cycles unsorted → asc → desc → unsorted; only one column active at a time
    - On row click (excluding Checkbox and Actions cells), navigate to `/entries/[id]`; stop propagation on Checkbox and Actions cells
    - _Requirements: 8.1, 8.9, 8.12_

  - [x] 7.2 Implement table cell rendering for all data columns
    - Title: display `entry.term` if non-null and non-empty, else `"—"`
    - Type: render `<EntryTypeBadge type={entry.type} />` (import from `components/entries/entry-type-badge`)
    - Category: display `entry.category_name` if non-null, else `"—"`
    - Tags: render each `tag.name` as a small inline badge; if `tags.length > 3`, render first 3 + `"+${tags.length - 3}"` overflow badge
    - Status: use the existing `StatusBadge` with `STATUS_COLORS` matching the spec (draft: `#F1F5F9`/`#64748B` "Draft", review: `#FEF9C3`/`#A16207` "Needs review", published: `#EAF6F0`/`#63A48B` "Published", deprecated: `#FEE2E2`/`#DC2626` "Deprecated") — update labels to match requirements
    - Updated: format `entry.updated_at` as `"MMM D, YYYY"` using `toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })`
    - Languages: render `<LanguageBadges locales={entry.languages ?? []} />`
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [x] 7.3 Implement loading skeleton, empty state, and error state
    - Update `SkeletonRows` to render exactly 5 rows with 9 skeleton cells each matching the approximate shape of each column
    - Render `SkeletonRows` when `isLoading` is true
    - Render empty state (single row spanning 9 columns with centred `FileX` icon, `"No entries found"` text, `"Try adjusting your filters or search query"` sub-text) when `!isLoading && entries.length === 0 && !isError`
    - Render empty `<TableBody>` (no skeleton, no empty state) when `isError` is true
    - _Requirements: 8.10, 8.11, 12.1, 12.2_

  - [ ]* 7.4 Write property tests for table cell rendering (Properties 15, 16, 17, 18, 19)
    - **Property 15: Title column displays term or fallback** — `fc.option(fc.string({ minLength: 1 }))` for `term` — assert cell shows `term` or `"—"` — **Validates: Requirements 8.2**
    - **Property 16: Tags column renders up to 3 tags and correct overflow badge** — `fc.array(fc.record({ id: fc.uuid(), name: fc.string({ minLength: 1 }) }))` — assert ≤3 tags shows all; >3 shows 3 + `"+N"` — **Validates: Requirements 8.5**
    - **Property 17: Status badge color and label mapping is correct** — `fc.constantFrom('draft','review','published','deprecated')` — assert `style.backgroundColor`, `style.color`, and text match spec — **Validates: Requirements 8.6**
    - **Property 18: Updated column date format is "MMM D, YYYY" in en-US** — `fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') })` — assert formatted output matches `toLocaleDateString('en-US', ...)` — **Validates: Requirements 8.7**
    - **Property 19: Sort direction cycles through unsorted → asc → desc → unsorted** — `fc.array(fc.constantFrom('title','type','updated'), { minLength: 1, maxLength: 20 })` — simulate clicks and assert cycle and single-column invariants — **Validates: Requirements 8.9**

- [x] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement checkbox selection and bulk-action bar
  - [x] 9.1 Implement header and row checkboxes with selection state
    - Render `<Checkbox>` in the header row: checked iff all entries on page are selected; indeterminate iff some but not all; unchecked iff none
    - Clicking header checkbox when all unselected: add all page entry IDs to `selectedIds`; when all selected: remove all page IDs from `selectedIds`
    - Render `<Checkbox>` in each data row; clicking toggles that entry's ID in `selectedIds` without navigating
    - Selection set is preserved across page, sort, and filter changes; cleared only after successful bulk action
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.9_

  - [ ]* 9.2 Write property tests for header checkbox state and selection persistence (Properties 20, 22)
    - **Property 20: Header checkbox state is derived correctly from selection and page** — `fc.set(fc.uuid())` for selectedIds + `fc.array(fc.record({ id: fc.uuid() }))` for page entries — assert checked/indeterminate/unchecked logic — **Validates: Requirements 9.1, 9.2, 9.3**
    - **Property 22: Selection persists across filter, sort, and page changes** — `fc.set(fc.uuid())` + `fc.record(filterChangeArbitrary)` — assert selection set unchanged after navigation action — **Validates: Requirements 9.9**

  - [x] 9.3 Implement the Bulk Action Bar (shown when `selectedIds.size > 0`)
    - Define `BulkActionBar` local sub-component replacing `TableFooterBar` in `<TableFooter>` when `selectedIds.size > 0`
    - Show `"{N} selected"` count text
    - Render "Status" `Select` with options Draft, Needs review, Published, Deprecated; on value change: call `entriesApi.updateEntryStatus` for each selected ID using `Promise.allSettled`; on all success: toast success, clear selection, invalidate `['entries']` and `['entries-summary']` query keys; on partial failure: toast success for succeeded count (if > 0) and error toast for failed count; failed IDs remain in selection
    - Render "Actions" `DropdownMenu` with "Delete selected" item; on click: open confirmation dialog showing count; on confirm: call `entriesApi.deleteEntry` for each selected ID via `Promise.allSettled`; handle partial failure same as bulk status
    - _Requirements: 9.5, 9.6, 9.7, 9.8_

  - [ ]* 9.4 Write property test for bulk partial failure toasts (Property 21)
    - **Property 21: Bulk action partial failure toasts reflect correct counts** — `fc.array(fc.boolean())` for success/failure pattern — assert success toast count = S, error toast count = F, failed IDs remain in selection — **Validates: Requirements 9.8**

- [x] 10. Implement per-row actions menu
  - [x] 10.1 Replace the existing per-row `DropdownMenu` with the spec actions
    - Render `DropdownMenu` trigger with `aria-label="Row actions"` in the Actions cell; stop click propagation on the cell
    - Items: "Edit" → navigate to `/entries/[id]`; "Change Status" → open `ChangeStatusDialog` pre-populated with `entry.status`; separator; "Delete" (red) → open `ConfirmDialog` showing `entry.term ?? "—"`
    - On status change confirm: call `entriesApi.updateEntryStatus(id, status)`; on 2xx: toast success, close dialog, invalidate queries; on error: toast error, leave dialog open
    - On delete confirm: call `entriesApi.deleteEntry(id)`; on 2xx: toast success, close dialog, invalidate queries; on error: toast error, leave dialog open
    - While delete mutation in progress: disable confirm button, show `"Deleting…"`
    - While status mutation in progress: disable confirm button, show `"Saving…"`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10_

- [x] 11. Implement the pagination footer
  - [x] 11.1 Wire up `TableFooterBar` and `Pagination` components
    - Render `<TableFooterBar>` inside `<TableFooter>` when `selectedIds.size === 0`; show `BulkActionBar` when `selectedIds.size > 0`
    - Pass `pageSize` and `onPageSizeChange` to `TableFooterBar`; on change: update `pageSize` and reset `page` to 1
    - Render `<Pagination>` below the card when `total > 0`; pass `page`, `totalPages`, `total`, `pageSize`, `onPageChange`, `onPageSizeChange`
    - Previous button disabled when `page <= 1`; Next button disabled when `page >= totalPages`
    - Do not render `Pagination` when `total === 0`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [ ]* 11.2 Write property test for page reset on page-size change (Property 23)
    - **Property 23: Page resets to 1 on page-size change** — `fc.integer({ min: 1 })` for current page + `fc.constantFrom(10, 20, 50, 100)` for new size — assert `page` resets to 1 regardless of previous page — **Validates: Requirements 11.3**

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use `fast-check` (already available in the monorepo); install as dev dependency in `apps/admin` with `pnpm add -D fast-check` if the `package.json` doesn't list it yet
- Properties 1–3 (API contract) are validated by backend integration tests, not frontend property tests
- The design uses TypeScript throughout; all code should be TypeScript

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "3.1"] },
    { "id": 2, "tasks": ["1.3", "3.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.4"] },
    { "id": 4, "tasks": ["4.3", "4.5", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3"] },
    { "id": 6, "tasks": ["6.4", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3"] },
    { "id": 8, "tasks": ["7.4", "9.1"] },
    { "id": 9, "tasks": ["9.2", "9.3", "10.1"] },
    { "id": 10, "tasks": ["9.4", "11.1"] },
    { "id": 11, "tasks": ["11.2"] }
  ]
}
```
