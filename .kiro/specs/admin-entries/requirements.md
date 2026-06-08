# Requirements Document

## Introduction

The admin-entries feature upgrades the existing `/entries` admin page from a basic table into a fully-featured list view that matches the visual quality and interaction patterns of the Categories list page. The upgrade covers:

- **API contract extension**: The list endpoint must expose `type`, `category_id`, `category_name`, `tags`, and `languages` as top-level flat fields alongside the existing `term` and `slug` projections.
- **API client update**: Extend `entries.ts` types and `ListEntriesParams` to reflect the new fields and the `type` / `category` filter params.
- **Frontend page overhaul**: Replace the current basic table with a rich page that includes summary stat cards, status tabs, an inline filter row (search + Type dropdown + Category dropdown + Clear filters), a sortable table with checkbox selection, a bulk-action bar, per-row actions menu, and a paginated footer — all matching the visual patterns of the categories page.
- **New `EntryTypeBadge` component**: A badge that renders each `EntryType` value in a distinct colour, analogous to `CategoryTypeBadge`.
- **Tags rendering**: Inline tag badges with an overflow "+N" indicator.

---

## Glossary

- **Entries_List_Page**: The `/entries` admin page that displays all encyclopaedia entries in a filterable, sortable, paginated table.
- **Admin_API**: The NestJS backend at `/api/v1/admin/entries`.
- **Entry**: An encyclopaedia record with fields `id`, `type`, `origin_language`, `status`, `metadata`, `translations`, `content_blocks`, `created_at`, `updated_at`, plus list-only flat projections `term`, `slug`, `category_id`, `category_name`, `tags`, and `languages`.
- **Entry_Status**: One of four values — `draft`, `review`, `published`, `deprecated` — indicating the editorial state of an entry.
- **Entry_Type**: One of five values — `stitch`, `technique`, `tool`, `tradition`, `yarn_weight` — indicating the encyclopaedic classification of an entry.
- **Entry_Tag**: An object `{ id: string; name: string }` representing a tag associated with an entry, where `name` is the tag's `en`-locale translation name.
- **Entries_API_Client**: The `entriesApi` object in `apps/admin/src/lib/api/entries.ts`.
- **EntryTypeBadge**: A new React component in `apps/admin/src/components/entries/entry-type-badge.tsx` that renders an `Entry_Type` value as a colour-coded badge.
- **Bulk_Action_Bar**: The row rendered inside the table footer that appears when one or more rows are selected, showing the selection count, a Status dropdown, and an Actions dropdown.
- **Summary_Stat_Cards**: The four bordered stat cards shown above the tab bar, displaying counts for Total, Published, Draft, and Needs Review entries.
- **Supported_Locales**: The locale strings used for `languages` badges: `en`, `pl`, `fr`, `de`, `no`.

---

## Requirements

### Requirement 1: API List Response — Extended Flat Projections

**User Story:** As a frontend developer, I want the entries list endpoint to return `type`, `category_id`, `category_name`, `tags`, and `languages` as top-level fields on each item, so that the list page can display them without fetching individual entry detail records.

#### Acceptance Criteria

1. WHEN `GET /api/v1/admin/entries` is called, THE Admin_API SHALL include a `type` field (one of `stitch`, `technique`, `tool`, `tradition`, `yarn_weight`) on every item in the response array; IF an entry's `type` is null or missing in the database, THE Admin_API SHALL return `null` for that field rather than omitting it.
2. WHEN `GET /api/v1/admin/entries` is called, THE Admin_API SHALL include a `category_id` field (string UUID or `null`) on every item in the response array.
3. WHEN `GET /api/v1/admin/entries` is called, THE Admin_API SHALL include a `category_name` field (string or `null`) on every item in the response array; the value SHALL be the `CategoryTranslation.name` for the `en` locale of the assigned category, or `null` if no category is assigned or no `en` `CategoryTranslation` row exists.
4. WHEN `GET /api/v1/admin/entries` is called, THE Admin_API SHALL include a `tags` field (array of `{ id: string; name: string }`) on every item, where each tag's `name` is the tag's `en`-locale `TagTranslation.name` with fallback to the tag's `slug` if no EN translation exists; an entry with no tags SHALL receive an empty array `[]`.
5. WHEN `GET /api/v1/admin/entries` is called, THE Admin_API SHALL include a `languages` field (array of locale strings, e.g. `["en", "pl"]`) on every item representing the locales for which the entry has at least one `Translation` record; an entry with no translations SHALL receive an empty array `[]`.
6. WHEN a `type` query parameter is provided to `GET /api/v1/admin/entries` with a value matching one of the five Entry_Type values, THE Admin_API SHALL return only entries whose `type` matches the parameter value.
7. IF no `type` query parameter is provided, THE Admin_API SHALL return entries of all types without filtering.
8. WHEN a `category_id` query parameter is provided as a valid UUID to `GET /api/v1/admin/entries`, THE Admin_API SHALL return only entries assigned to the category with that `id`; IF no entries are assigned to that category, THE Admin_API SHALL return `data: []` with `meta.total: 0`.
9. IF an invalid value is passed for the `type` or `status` query parameter (i.e. a value not in the defined enum), THEN THE Admin_API SHALL return HTTP 400 with a descriptive validation error and SHALL NOT return any partial result.

---

### Requirement 2: Entries API Client — Type Extensions

**User Story:** As a frontend developer, I want the TypeScript `Entry` interface and `ListEntriesParams` to include the new projected fields and filter parameters, so that the list page components are type-safe.

#### Acceptance Criteria

1. THE `Entry` interface in `apps/admin/src/lib/api/entries.ts` SHALL include an optional `category_id` field (`string | null`) and an optional `category_name` field (`string | null`).
2. THE `Entry` interface SHALL include an optional `tags` field typed as `Array<{ id: string; name: string }>`.
3. THE `Entry` interface SHALL include an optional `languages` field typed as `string[]`.
4. THE `ListEntriesParams` interface SHALL include an optional `type` field typed as `EntryType`.
5. THE `ListEntriesParams` interface SHALL include an optional `category_id` field typed as `string`.
6. THE `Entries_API_Client` SHALL expose a `listEntryCategories` function that accepts no additional parameters, calls `GET /api/v1/admin/categories` with fixed params `{ type: 'entry', limit: 200 }` (importing from the categories API client), and returns `Promise<ApiResponse<AdminCategory[]>>`, used to populate the Category filter dropdown.

---

### Requirement 3: EntryTypeBadge Component

**User Story:** As an editor, I want each entry row to show its type (Stitch, Technique, etc.) as a colour-coded badge, so that I can visually distinguish entry types at a glance.

#### Acceptance Criteria

1. THE `EntryTypeBadge` component SHALL be created at `apps/admin/src/components/entries/entry-type-badge.tsx` and SHALL accept a single `type` prop of type `EntryType`.
2. THE `EntryTypeBadge` component SHALL render each `Entry_Type` value with a distinct background and text colour using inline styles: `stitch` (bg `#EDE7FF` / color `#7F6BBF`), `technique` (bg `#DBEAFE` / color `#1D4ED8`), `tool` (bg `#FEF3C7` / color `#B45309`), `tradition` (bg `#D1FAE5` / color `#065F46`), `yarn_weight` (bg `#FCE7F3` / color `#9D174D`).
3. THE `EntryTypeBadge` component SHALL display these human-readable labels using an explicit string mapping (not CSS `capitalize`): `stitch` → "Stitch", `technique` → "Technique", `tool` → "Tool", `tradition` → "Tradition", `yarn_weight` → "Yarn Weight".
4. THE `EntryTypeBadge` component SHALL use the same rounded-lg pill shape, `px-4 py-1 text-xs font-semibold` sizing, and `min-w-[72px]` minimum width as `CategoryTypeBadge` to ensure visual consistency.
5. IF `EntryTypeBadge` receives an unrecognised `type` value that is not one of the five defined Entry_Type values, THE component SHALL render the raw value as text with a neutral grey style (bg `#F1F5F9` / color `#64748B`) without throwing an error.

---

### Requirement 4: Page Header

**User Story:** As an editor, I want the entries page to have a clear title, subtitle, and quick-action buttons in the header, so that I can immediately understand where I am and take common actions.

#### Acceptance Criteria

1. THE Entries_List_Page SHALL render a `PageHeader` component with title "Entries" and subtitle "Manage and organize encyclopaedia entries".
2. THE Entries_List_Page SHALL render an "Import" button in the header using `Button variant="outline"` with an upload icon.
3. WHEN an editor clicks the "Import" button, THE Entries_List_Page SHALL open a hidden file `<input>` accepting `.csv` files.
4. IF the selected file is not a `.csv` file, THEN THE Entries_List_Page SHALL display a toast error with the message "Invalid file type. Please select a .csv file.", clear the file input, and take no further action.
5. IF the selected file is a `.csv` file but exceeds 5 MB in size, THEN THE Entries_List_Page SHALL display a toast error with the message "File is too large. Maximum allowed size is 5 MB.", clear the file input, and take no further action.
6. THE Entries_List_Page SHALL render a "Filters" button in the header styled with a violet outline and violet text.
7. WHEN an editor clicks the "Filters" button, THE Entries_List_Page SHALL toggle the visibility of the filter panel or drawer (behavior consistent with the rest of the admin app).
8. THE Entries_List_Page SHALL render an "Add" button in the header styled with a violet fill and white text that navigates to `/entries/new` when clicked.

---

### Requirement 5: Summary Stat Cards

**User Story:** As an editor, I want to see four stat cards showing total, published, draft, and needs-review counts, so that I can understand the overall health of the entries catalogue at a glance.

#### Acceptance Criteria

1. THE Entries_List_Page SHALL display four Summary_Stat_Cards with labels: "Total entries", "Published", "Drafts", and "Needs review"; "Total entries" SHALL include all statuses including `deprecated`.
2. THE Summary_Stat_Cards counts SHALL reflect the full dataset regardless of active search or filter state; they SHALL be derived independently of the filtered list query.
3. WHILE summary counts are loading, THE Entries_List_Page SHALL display skeleton placeholders for each count value in the Summary_Stat_Cards.
4. EACH Summary_Stat_Card SHALL display a numeric count, a label, and a distinct icon with a tinted background: Total entries uses a violet-tinted icon, Published uses a green-tinted icon, Drafts uses a slate-tinted icon, Needs review uses an amber-tinted icon.
5. THE "Needs review" Summary_Stat_Card SHALL display the count of entries where `status === "review"`.
6. IF the summary data request fails, THEN THE Entries_List_Page SHALL display a dash ("—") in place of each count value in the Summary_Stat_Cards.

---

### Requirement 6: Status Tabs

**User Story:** As an editor, I want tab buttons to quickly filter entries by status, so that I can focus on a specific editorial state without using the filter dropdowns.

#### Acceptance Criteria

1. THE Entries_List_Page SHALL render a `Tabs` component with `TabsList` and `TabsTrigger` components using the `line` variant, with four tabs: "All entries", "Published", "Draft", and "Needs review".
2. WHEN an editor clicks the "Published" tab, THE Entries_List_Page SHALL set the `status` filter to `published` and reset the page to 1.
3. WHEN an editor clicks the "Draft" tab, THE Entries_List_Page SHALL set the `status` filter to `draft` and reset the page to 1.
4. WHEN an editor clicks the "Needs review" tab, THE Entries_List_Page SHALL set the `status` filter to `review` and reset the page to 1.
5. WHEN an editor clicks the "All entries" tab, THE Entries_List_Page SHALL clear the `status` filter (set to `all`) and reset the page to 1.
6. THE `Tabs` component's `value` prop SHALL equal the tab key corresponding to the active `status` filter state: `all` → "all entries" tab, `published` → "published" tab, `draft` → "draft" tab, `review` → "needs review" tab.
7. WHEN the status filter is changed via the filter bar's Status dropdown and the new value is `deprecated` (which has no corresponding tab), THEN no tab SHALL appear active (no tab's `value` matches).

---

### Requirement 7: Filter Row

**User Story:** As an editor, I want an inline search bar and Type and Category dropdowns to narrow the entry list, so that I can quickly locate specific entries.

#### Acceptance Criteria

1. THE Entries_List_Page SHALL display a search `Input` with a leading search icon and placeholder "Search entries…", accepting up to 200 characters of input; WHEN the input value changes, THE Entries_List_Page SHALL debounce the change by 300 ms before applying it as the `q` query parameter and resetting the page to 1.
2. THE Entries_List_Page SHALL display a "Type" `Select` dropdown with options: "All types" (value `all`), "Stitch", "Technique", "Tool", "Tradition", "Yarn Weight"; WHEN a non-`all` value is selected, THE Entries_List_Page SHALL set the `type` query parameter to the selected `EntryType` value and reset the page to 1.
3. THE Entries_List_Page SHALL display a "Category" `Select` dropdown populated from `listEntryCategories()`, with a leading "All categories" option (value `all`); WHEN a non-`all` value is selected, THE Entries_List_Page SHALL set the `category_id` query parameter to the selected category's `id` and reset the page to 1.
4. WHILE the category list is loading, THE Entries_List_Page SHALL render the Category `Select` in a disabled state.
5. IF the category list request fails, THEN THE Entries_List_Page SHALL display the Category `Select` in a disabled state and show a toast error; THE rest of the page SHALL continue to render normally.
6. A search filter is considered active WHEN the search input contains one or more non-whitespace characters.
7. A type filter is considered active WHEN the selected Type dropdown value is not `all`.
8. A category filter is considered active WHEN the selected Category dropdown value is not `all`.
9. WHEN at least one filter (search, type, or category) is active, THE Entries_List_Page SHALL display a "Clear filters" link.
10. WHEN an editor clicks the "Clear filters" link, THE Entries_List_Page SHALL reset the search input to empty, the Type dropdown to `all`, the Category dropdown to `all`, and the page to 1.

---

### Requirement 8: Data Table

**User Story:** As an editor, I want to see entries displayed in a clear table with sortable columns, type and status badges, tags, category, and language badges, so that I can assess and manage entries from the list view.

#### Acceptance Criteria

1. THE Entries_List_Page SHALL render a table with columns in this order: Checkbox, Title, Type, Category, Tags, Status, Updated, Languages, Actions.
2. THE Title column SHALL display the entry's `term` field; WHEN `term` is null or absent, THE Entries_List_Page SHALL display "—".
3. THE Type column SHALL render an `EntryTypeBadge` for the entry's `type` field.
4. THE Category column SHALL display `category_name` as plain text; WHEN `category_name` is `null`, THE Entries_List_Page SHALL display "—".
5. THE Tags column SHALL render each tag in `entry.tags` as a small inline badge showing the tag's `name`; WHEN the entry has more than 3 tags, THE Entries_List_Page SHALL render the first 3 tags and a single overflow badge showing "+N" where N equals `entry.tags.length - 3`.
6. THE Status column SHALL render a coloured badge with these colours and labels: `draft` (bg `#F1F5F9`, color `#64748B`, label "Draft"), `review` (bg `#FEF9C3`, color `#A16207`, label "Needs review"), `published` (bg `#EAF6F0`, color `#63A48B`, label "Published"), `deprecated` (bg `#FEE2E2`, color `#DC2626`, label "Deprecated").
7. THE Updated column SHALL display `entry.updated_at` formatted as "MMM D, YYYY" (e.g. "Jun 5, 2025") using the `en-US` locale.
8. THE Languages column SHALL render `entry.languages` using the existing `LanguageBadges` component; WHEN `entry.languages` is empty or absent, THE `LanguageBadges` component SHALL render "—".
9. THE Title, Type, and Updated column headers SHALL use the `SortableTableHead` component; WHEN a header is clicked, the sort direction for that column SHALL cycle: unsorted → ascending → descending → unsorted; only one column SHALL be sorted at a time.
10. WHEN entries are loading, THE Entries_List_Page SHALL display exactly 5 skeleton rows with placeholders in each of the 9 columns matching the approximate shape of real data.
11. WHEN the entries list query is not in a loading state and the returned `data` array is empty, THE Entries_List_Page SHALL display a single table row spanning all columns containing a centred block with a `FileX` icon, the text "No entries found", and the sub-text "Try adjusting your filters or search query".
12. WHEN an editor clicks a table row anywhere except the Checkbox cell or the Actions cell, THE Entries_List_Page SHALL navigate to `/entries/[id]` for that row's entry.

---

### Requirement 9: Checkbox Selection and Bulk Actions

**User Story:** As an editor, I want to select multiple entries and apply bulk status changes or deletions, so that I can update many entries in one operation.

#### Acceptance Criteria

1. THE Entries_List_Page SHALL render a `Checkbox` in the table header row; WHEN all visible rows on the current page are unselected and the editor checks the header checkbox, THE Entries_List_Page SHALL add all entry IDs on the current page to the selection set.
2. WHEN all visible rows on the current page are selected and the editor unchecks the header checkbox, THE Entries_List_Page SHALL remove all entry IDs on the current page from the selection set.
3. THE header checkbox SHALL display an indeterminate state WHEN at least one but fewer than all visible rows on the current page are selected.
4. EACH data row SHALL have an individual `Checkbox` in the first cell; WHEN toggled, it SHALL add or remove that entry's ID from the selection set without navigating away from the page.
5. WHEN one or more rows are selected, THE Entries_List_Page SHALL display the Bulk_Action_Bar showing "{N} selected", a "Status" dropdown with options "Draft", "Needs review", "Published", "Deprecated", and an "Actions" dropdown containing "Delete selected".
6. WHEN an editor selects a status from the Bulk_Action_Bar "Status" dropdown, THE Entries_List_Page SHALL call `PATCH /api/v1/admin/entries/:id/status` for each selected entry; WHEN all requests complete successfully, THE Entries_List_Page SHALL display a success toast, clear the entire selection set, and invalidate the entries query.
7. WHEN an editor clicks "Delete selected" in the Bulk_Action_Bar "Actions" dropdown, THE Entries_List_Page SHALL display a confirmation dialog showing the count of entries to be deleted; WHEN the editor confirms, THE Entries_List_Page SHALL call `DELETE /api/v1/admin/entries/:id` for each selected entry; WHEN all requests complete successfully, THE Entries_List_Page SHALL display a success toast, clear the entire selection set, and invalidate the entries query.
8. IF any individual request in a bulk status or bulk delete operation fails, THEN THE Entries_List_Page SHALL display an error toast indicating the number of failed operations, SHALL display a separate success toast for the number that succeeded (if any), and SHALL NOT remove the IDs of failed entries from the selection set.
9. THE selection set SHALL be preserved across page, sort, and filter changes within the same page session; the selection SHALL only be cleared programmatically (after successful bulk action) or when the user navigates away from the page.

---

### Requirement 10: Per-Row Actions Menu

**User Story:** As an editor, I want a per-row actions menu on each entry, so that I can edit, change status, or delete an individual entry without leaving the list.

#### Acceptance Criteria

1. THE Entries_List_Page SHALL render a `DropdownMenu` trigger button with `aria-label="Row actions"` in the Actions cell of each row, containing items: "Edit", "Change Status", and "Delete" (with a separator before "Delete").
2. WHEN an editor selects "Edit", THE Entries_List_Page SHALL navigate to `/entries/[id]` for that entry.
3. WHEN an editor selects "Change Status", THE Entries_List_Page SHALL open a modal dialog containing a `Select` pre-populated with the entry's current status.
4. WHEN the editor confirms the status change dialog, THE Entries_List_Page SHALL call `PATCH /api/v1/admin/entries/:id/status` with the selected status; WHEN the request returns 2xx, THE Entries_List_Page SHALL display a success toast, close the dialog, and invalidate the entries query.
5. WHEN an editor selects "Delete", THE Entries_List_Page SHALL open a `ConfirmDialog` showing the entry's `term` in the message body; THE Entries_List_Page SHALL NOT call `DELETE /api/v1/admin/entries/:id` unless the editor explicitly confirms.
6. WHEN the editor confirms the delete dialog, THE Entries_List_Page SHALL call `DELETE /api/v1/admin/entries/:id`; WHEN the request returns 2xx, THE Entries_List_Page SHALL display a success toast, close the dialog, and invalidate the entries query.
7. IF the delete or status update call returns a non-2xx response, THEN THE Entries_List_Page SHALL display a toast error message and leave the row in its previous state.
8. WHILE a delete mutation is in progress, THE Entries_List_Page SHALL disable the confirm button in the `ConfirmDialog` and display the label "Deleting…".
9. WHILE a status-change mutation is in progress, THE Entries_List_Page SHALL disable the confirm button in the status change dialog and display the label "Saving…".
10. Clicking anywhere within the Actions cell, including opening the `DropdownMenu`, SHALL NOT trigger the row-click navigation to `/entries/[id]`.

---

### Requirement 11: Pagination Footer

**User Story:** As an editor, I want a paginated footer with an item range label, page buttons, and a page-size selector, so that I can navigate large entry lists efficiently.

#### Acceptance Criteria

1. WHEN `total > 0`, THE Entries_List_Page SHALL render the `Pagination` component below the table card, displaying "{start}–{end} of {total} items" on the left, page navigation buttons in the centre, and Previous/Next flanking buttons.
2. THE Entries_List_Page SHALL render the `TableFooterBar` component inside the table's `<TableFooter>` row, displaying the selection count on the left and a "Show N per page" selector on the right with options 10, 20, 50, 100.
3. WHEN an editor changes the page-size selector, THE Entries_List_Page SHALL update `pageSize` state and reset `page` to 1.
4. WHEN the API returns a `meta.total` of 0, THE Entries_List_Page SHALL not render the `Pagination` component.
5. WHEN the current page is 1, THE Entries_List_Page SHALL render the Previous button in a disabled state.
6. WHEN the current page equals `Math.ceil(total / pageSize)`, THE Entries_List_Page SHALL render the Next button in a disabled state.
7. WHEN the page-size selector is changed and the current `page` would exceed the new `totalPages`, THE Entries_List_Page SHALL reset `page` to 1.

---

### Requirement 12: Loading and Error States

**User Story:** As an editor, I want clear loading indicators and error messages when the entries list is slow or unavailable, so that I understand the page state at all times.

#### Acceptance Criteria

1. WHILE the entries list query is in a loading state, THE Entries_List_Page SHALL display 5 skeleton rows in the table body and skeleton placeholders for each count value in the Summary_Stat_Cards.
2. IF the entries list API call returns a non-2xx response, THEN THE Entries_List_Page SHALL display a toast error message and render an empty table body without skeleton rows and without the "No entries found" empty-state block.
3. WHILE the category dropdown options are loading, THE Entries_List_Page SHALL render the Category `Select` in a disabled state with a spinner icon inside the dropdown trigger.
4. WHILE a delete mutation is in progress, THE Entries_List_Page SHALL disable the confirm button in the `ConfirmDialog` and display the label "Deleting…".
5. WHILE a status-change mutation is in progress, THE Entries_List_Page SHALL disable the confirm button in the status change dialog and display the label "Saving…".
