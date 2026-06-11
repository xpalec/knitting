# Requirements Document

## Introduction

The **content-block-types-entry-templates** feature delivers a proper Entry Template CRUD system in the admin panel. Templates define the structural layout of encyclopedia entries through an ordered list of typed content blocks. Each block carries **per-locale default values** (e.g. a heading shown to readers) keyed by a stable per-block `id`, allowing the same template to serve multiple languages with appropriate defaults.

`ContentBlockType` remains a **frontend-only concept** — a hardcoded registry of available block types and their field schemas. It is not persisted as a separate database entity. The `/content-blocks` page and `ContentBlockType` API are removed.

Per-entry `ContentBlock` data (stored in `Entry.content_blocks` and `Translation.blocks`) is unaffected by this feature.

Supported locales: `en` and `pl`.

---

## Glossary

- **EntryTemplate**: A named, managed entity that holds an ordered list of `TemplateBlock` items assigned to one `Entry_Type`. Has `id`, `name`, optional `description`, `entry_type`, `blocks`, and a `translations` map keyed by locale. Identified by `id` — no slug.
- **TemplateBlock**: One item in an `EntryTemplate`'s ordered block list. Has a stable client-generated `id` (UUID), a `type` slug (e.g. `rich_text`), an `order` integer (1-based), and a `required` boolean.
- **BlockType**: A frontend-only descriptor for a category of block (e.g. `rich_text`). Defined as a hardcoded constant in the admin codebase. Not stored in the database as a separate entity.
- **Block_Type_Slug**: The machine-readable identifier of a `BlockType` (e.g. `rich_text`). Used as the `type` field in `TemplateBlock`.
- **translations**: A JSON column on `EntryTemplate` holding all per-locale default values for every block. Structure: `{ [blockId]: { [locale]: { [fieldName]: string } } }`. Example: `{ "uuid-1": { "en": { "heading": "Introduction" }, "pl": { "heading": "Wstęp" } } }`.
- **Entry_Type**: One of five fixed values: `stitch`, `technique`, `tool`, `tradition`, `yarn_weight`.
- **Locale**: One of the two supported BCP-47 locale codes: `en`, `pl`.
- **Translation_Status**: A per-locale completeness indicator for an `EntryTemplate`. Derived by checking whether all `TemplateBlock` items have a non-empty `heading` default for that locale.
- **Entry_Templates_List_Page**: The admin page at `/entry-templates` showing a table of all `EntryTemplate` entities.
- **Entry_Template_Create_Page**: The admin page at `/entry-templates/new`.
- **Entry_Template_Edit_Page**: The admin page at `/entry-templates/[id]`.
- **EntryTemplateForm**: The reusable form component used on create and edit pages.
- **Admin_Panel**: The Next.js admin application at `apps/admin` (port 3001).
- **EntryTemplate_API**: The backend API endpoints for `EntryTemplate` CRUD at `/api/v1/admin/entry-templates`.
- **TanStack_Query**: The data-fetching library used throughout the admin panel.
- **Sonner**: The toast notification library used for feedback.

---

## Requirements

### Requirement 1: EntryTemplate Entity and API

**User Story:** As an admin, I want entry templates to be named, managed entities with their own CRUD API, so that I can create, edit, and delete multiple templates per entry type.

#### Acceptance Criteria

1. THE EntryTemplate_API SHALL expose an `EntryTemplate` entity with the following fields: `id` (UUID), `name` (non-empty string ≤255 chars), `description` (optional string ≤1000 chars), `entry_type` (one of the five `Entry_Type` values), `blocks` (ordered array of `TemplateBlock` objects), `translations` (a JSON object holding all per-locale default values keyed by block id then locale), `created_at` (ISO 8601), and `updated_at` (ISO 8601).
2. EACH `TemplateBlock` in the `blocks` array SHALL have: `id` (a UUID, stable and unique within the template), `type` (non-empty `Block_Type_Slug` string), `order` (positive integer, 1-based, contiguous), and `required` (boolean).
3. THE `translations` column structure SHALL be: `{ [blockId: string]: { [locale: string]: { [fieldName: string]: string } } }`. Example: `{ "uuid-1": { "en": { "heading": "Introduction" }, "pl": { "heading": "Wstęp" } } }`. This is a single JSON column on the `EntryTemplate` row — no separate translation table.
4. THE EntryTemplate_API SHALL expose `GET /api/v1/admin/entry-templates` returning all records ordered by `created_at` ascending; IF no records exist THE endpoint SHALL return `[]` with HTTP 200.
5. THE EntryTemplate_API SHALL expose `POST /api/v1/admin/entry-templates` accepting `name`, `description` (optional), `entry_type`, `blocks` (optional, defaults to `[]`), and `translations` (optional, defaults to `{}`), returning the created record with HTTP 201.
6. IF a `POST` request is submitted with an invalid `entry_type`, THEN THE EntryTemplate_API SHALL return HTTP 422.
7. THE EntryTemplate_API SHALL expose `GET /api/v1/admin/entry-templates/:id` returning the full record with HTTP 200; IF not found, HTTP 404.
8. THE EntryTemplate_API SHALL expose `PUT /api/v1/admin/entry-templates/:id` accepting the same fields as create, returning the updated record with HTTP 200; IF not found, HTTP 404.
9. THE EntryTemplate_API SHALL expose `DELETE /api/v1/admin/entry-templates/:id` returning HTTP 204; IF not found, HTTP 404.
10. THE `EntryTemplate` entity SHALL NOT have a `slug` field; templates are identified solely by `id`.

---

### Requirement 2: EntryTemplate Translations

**User Story:** As an admin, I want to define per-locale default field values for each block in a template, so that entries created from this template start with the correct heading text in each language.

#### Acceptance Criteria

1. THE `translations` JSON column SHALL be included in all API responses for `EntryTemplate`.
2. THE `translations` field SHALL be accepted on both create (`POST`) and update (`PUT`) endpoints.
3. THE EntryTemplate_API SHALL accept partial translations — locales and blocks not present in the submitted `translations` object are simply absent from the stored JSON.
4. THE EntryTemplate_API SHALL expose an upsert endpoint `PUT /api/v1/admin/entry-templates/:id/translations/:locale` accepting a map of `{ [blockId]: { [fieldName]: string } }` and returning the full updated `EntryTemplate`. This endpoint merges the submitted locale data into the `translations` JSON, leaving other locales untouched.
5. IF a `PUT /api/v1/admin/entry-templates/:id/translations/:locale` request is submitted with an unsupported locale, THEN THE EntryTemplate_API SHALL return HTTP 422.
6. IF the `:id` does not exist, THEN THE EntryTemplate_API SHALL return HTTP 404.
7. THE Admin_Panel SHALL derive a per-locale `Translation_Status` for each `EntryTemplate` as follows: `complete` WHEN every `TemplateBlock` in `blocks` has a non-empty value for every translatable field in `translations[block.id][locale]`; `incomplete` WHEN some blocks have the locale key but at least one field is empty; `missing` WHEN no data exists for that locale across any block.

---

### Requirement 3: Entry Templates List Page

**User Story:** As an admin, I want a list page at `/entry-templates` showing all templates in a searchable, sortable table with per-row actions, so that I can discover and navigate to individual templates.

#### Acceptance Criteria

1. WHEN an admin navigates to `/entry-templates`, THE Entry_Templates_List_Page SHALL fetch all `EntryTemplate` records from `GET /api/v1/admin/entry-templates` and display them in a table.
2. THE Entry_Templates_List_Page SHALL display a stats row showing total template count and a per-`Entry_Type` breakdown. WHILE loading, skeleton placeholders SHALL be shown.
3. WHEN an admin types in the search bar, THE Entry_Templates_List_Page SHALL filter rows to those whose `name` contains the search term (case-insensitive), debounced 300 ms, resetting to page 1 on change.
4. EACH table row SHALL display: Name, Entry Type (human-readable label), EN Translation Status, PL Translation Status, Block Count, Updated (locale date string), and an Actions column.
5. The EN and PL Translation Status cells SHALL render a green check ("Complete"), amber alert ("Incomplete"), or muted dash ("Missing") badge, following the same visual pattern as other translation status indicators in the admin panel.
6. THE Entry_Templates_List_Page SHALL display an Actions menu on each row with "Edit" and "Delete".
7. WHEN an admin selects "Edit" OR clicks anywhere on the row body except the Actions cell, THE Entry_Templates_List_Page SHALL navigate to `/entry-templates/[id]`.
8. WHEN an admin selects "Delete", THE Entry_Templates_List_Page SHALL show a confirmation dialog with the template name. On confirm, it SHALL call `DELETE /api/v1/admin/entry-templates/:id`; on HTTP 204 show a success toast "Template deleted" and refresh; on failure show an error toast and leave the list unchanged.
9. WHILE loading THE Entry_Templates_List_Page SHALL display 5 skeleton rows.
10. WHEN the list is empty (no records or no search matches), THE Entry_Templates_List_Page SHALL display "No templates found" and an "+ Add Template" button navigating to `/entry-templates/new`.
11. THE Entry_Templates_List_Page SHALL paginate at 20 rows per page with Prev/Next buttons disabled at boundaries.
12. THE Entry_Templates_List_Page SHALL display an "+ Add Template" button in the page header navigating to `/entry-templates/new`.
13. IF the `GET /api/v1/admin/entry-templates` request fails, THE Entry_Templates_List_Page SHALL display an error state with a retry button and toast error, and SHALL NOT render the table body.

---

### Requirement 4: Create Entry Template Page

**User Story:** As an admin, I want a create page at `/entry-templates/new` with a form covering template details, block structure, and per-locale translations, so that I can define a new named template ready for all supported languages.

#### Acceptance Criteria

1. WHEN an admin navigates to `/entry-templates/new`, THE Entry_Template_Create_Page SHALL display the `EntryTemplateForm` with empty defaults: Name empty, Description empty, Entity Type unselected, block list empty, all translation fields empty.
2. THE `EntryTemplateForm` SHALL contain a "Template details" card: Name (required, max 255), Description (optional textarea, max 1000), and Entity Type (required select).
3. THE `EntryTemplateForm` SHALL contain a "Template structure" card with an ordered block list. EACH block row SHALL display: block type label (resolved from the hardcoded `BLOCK_TYPES` registry by `type` slug, fallback to raw slug), a warning icon when the slug matches no known type, a Required/Optional toggle, Up/Down reorder buttons (disabled at list boundaries), and a remove button.
4. WHEN an admin clicks "+ Add block", THE `EntryTemplateForm` SHALL append a new `TemplateBlock` with a client-generated UUID as `id`, `required: false`, and `order` equal to current max + 1 (or 1 if list is empty).
5. WHEN an admin clicks the remove button, THE `EntryTemplateForm` SHALL remove that block and renumber remaining `order` fields to a contiguous 1-based sequence; the removed block's `id` SHALL also be removed from all locale `blocks_defaults` maps in local state.
6. WHEN an admin clicks Up or Down on a block, the block SHALL swap with its neighbour and both `order` fields SHALL update; the Up button on position 0 and Down button on the last position SHALL be disabled.
7. THE `EntryTemplateForm` SHALL contain a "Translations" section with one tab per locale (`en`, `pl`). EACH tab SHALL display one heading input per `TemplateBlock` in the current block list, labelled with the block type label and pre-populated from local translation state. The tab indicator SHALL show a dot when all blocks in that locale have non-empty headings.
8. WHEN an admin edits a heading input for a locale and block, the change SHALL update `translations[locale].blocks_defaults[block.id].heading` in local state.
9. THE submit button SHALL be disabled WHILE `name` is empty OR `entry_type` is unselected.
10. WHEN an admin submits the form with `name` and `entry_type` set, THE Entry_Template_Create_Page SHALL call `POST /api/v1/admin/entry-templates` with `name`, `description` (omitted if empty), `entry_type`, `blocks`, and `translations`. On HTTP 201 show toast "Template created" and navigate to `/entry-templates/[id]`.
11. IF the create call returns non-2xx, THE Entry_Template_Create_Page SHALL re-enable submit, show an error toast, and keep all field values intact.
12. THE Entry_Template_Create_Page SHALL display a "Cancel" button navigating back to `/entry-templates` without confirmation.

---

### Requirement 5: Edit Entry Template Page

**User Story:** As an admin, I want an edit page at `/entry-templates/[id]` that pre-populates the form with existing template data including all translations, so that I can update a template's details, structure, and per-locale defaults.

#### Acceptance Criteria

1. WHEN an admin navigates to `/entry-templates/[id]`, THE Entry_Template_Edit_Page SHALL call `GET /api/v1/admin/entry-templates/:id`; on success pre-populate the `EntryTemplateForm` Name, Description, Entity Type, block list, and all translation fields.
2. WHILE loading, THE Entry_Template_Edit_Page SHALL display skeleton placeholders for all form sections.
3. IF `GET` returns HTTP 404, THE Entry_Template_Edit_Page SHALL display "Template not found" and a back link to `/entry-templates`.
4. IF `GET` returns any other non-2xx, THE Entry_Template_Edit_Page SHALL display an error message with a retry button.
5. WHEN an admin submits the pre-populated form, THE Entry_Template_Edit_Page SHALL call `PUT /api/v1/admin/entry-templates/:id` with all current values including the full `translations` map. On HTTP 200 show toast "Template saved", invalidate `['entry-templates', id]` and `['entry-templates']`, and remain on the current page.
6. IF the `PUT` call returns non-2xx, THE Entry_Template_Edit_Page SHALL show an error toast and preserve all field values.
7. THE Entry_Template_Edit_Page SHALL display a "Delete" button. On click, show a confirmation dialog with the template name.
8. WHEN an admin confirms deletion, THE Entry_Template_Edit_Page SHALL call `DELETE /api/v1/admin/entry-templates/:id`; on HTTP 204 navigate to `/entry-templates` with toast "Template deleted" and invalidate `['entry-templates']`.
9. IF `DELETE` returns non-2xx, THE Entry_Template_Edit_Page SHALL show an error toast and remain on the current page.
10. WHEN an admin adds or removes blocks on the edit page, the translation state in the `EntryTemplateForm` SHALL stay consistent: adding a block creates an empty `blocks_defaults` entry for each locale keyed by the new block's `id`; removing a block removes its `id` from all locale `blocks_defaults` maps.

---

### Requirement 6: BlockType Registry (Frontend-Only)

**User Story:** As an admin, I want the system to know what block types are available and what fields they require, so that the form can display the correct inputs for each block type without needing a database entity.

#### Acceptance Criteria

1. THE Admin_Panel SHALL define a hardcoded `BLOCK_TYPES` constant that lists all available block type descriptors. Each descriptor SHALL have at minimum: `slug` (e.g. `rich_text`), `label` (e.g. `"Rich Text"`), and `translatableFields` (an array of field descriptors, e.g. `[{ name: "heading", label: "Header", maxLength: 255 }]`).
2. THE first supported block type SHALL be `rich_text` with one translatable field: `heading` (label: "Header", max 255 chars).
3. THE `BLOCK_TYPES` registry SHALL be designed so additional block types (e.g. `steps_list`, `image_gallery`) can be added without changing the `EntryTemplateForm` component logic.
4. WHEN a `TemplateBlock.type` slug does not match any entry in `BLOCK_TYPES`, THE Admin_Panel SHALL display the raw slug as the label for that block row and show a warning indicator (e.g. `TriangleAlert` icon).
5. THE `ContentBlockType` API endpoints (`/api/v1/admin/content-block-types`) SHALL be removed; the `/content-blocks` admin page SHALL be removed.

---

### Requirement 7: Block Structure Pure Helpers

**User Story:** As a developer, I want pure, testable helper functions for block list manipulation, so that the form's block reordering and mutation logic is correct and verifiable with property-based tests.

#### Acceptance Criteria

1. THE `EntryTemplateForm` module SHALL export the following pure functions operating on `TemplateBlock[]`: `renumber`, `moveUp`, `moveDown`, `removeBlock`, `addBlock`, `toggleRequired`.
2. `renumber(blocks)` SHALL return a new array where each item at 0-indexed position `k` has `order === k + 1`, with `id`, `type`, and `required` unchanged.
3. `moveUp(blocks, i)` WHERE `i > 0` SHALL swap the item at position `i` with position `i - 1` and renumber; WHERE `i === 0` SHALL return the array unchanged.
4. `moveDown(blocks, i)` WHERE `i < N - 1` SHALL swap the item at position `i` with position `i + 1` and renumber; WHERE `i === N - 1` SHALL return the array unchanged.
5. `removeBlock(blocks, i)` SHALL return a new array of length N - 1 with the item at position `i` absent and all remaining items renumbered.
6. `addBlock(blocks, type)` SHALL append a new item with a client-generated UUID `id`, `type === input`, `order === N + 1` (or 1 if empty), and `required === false`.
7. `toggleRequired(blocks, i)` SHALL return a new array where item `i` has `required === !blocks[i].required` and all other items are unchanged.

---

### Requirement 8: Navigation and Access Control

**User Story:** As an admin, I want clear navigation to the entry templates pages, so that I can discover and manage templates from the admin sidebar.

#### Acceptance Criteria

1. THE Admin_Panel navigation sidebar SHALL include a link to `/entry-templates` labelled "Entry Templates" visible only to users with the `admin` role.
2. THE sidebar link to `/content-blocks` and its `adminOnly` flag SHALL be removed along with the page itself.
3. IF a user with role `editor` or `reviewer` navigates directly to `/entry-templates`, `/entry-templates/new`, or `/entry-templates/[id]`, THEN THE Admin_Panel SHALL redirect to `/dashboard`.
4. WHEN a user with role `admin` navigates to any of the entry template pages, THE Admin_Panel SHALL render the full page content without redirection.
