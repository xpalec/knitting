# Requirements Document

## Introduction

This feature adds a full abbreviation management system to the knitting encyclopedia admin app. Knitting abbreviations (e.g. `K2tog`, `yo`, `ssk`) appear in patterns and need to be stored, translated, and linked to encyclopedia entries so that readers can understand their meaning in their preferred language.

Administrators must be able to create abbreviations, attach multilingual translations (short plain-text meanings and rich Tiptap descriptions), connect abbreviations to encyclopedia entries with ordering and primary-flag metadata, search across abbreviations by code and source language, and manage the full lifecycle via a standalone Abbreviations page and inline within the entry editor.

Abbreviation parsing (e.g. decomposing `K2` into `K` + repetition count `2`) is explicitly out of scope. Only explicitly stored abbreviations are handled.

## Glossary

- **Abbreviation**: A notation as it appears in knitting patterns (e.g. `K2tog`, `yo`). Identified by its `code` and `source_language` together. Case-insensitive for search but stored with original formatting.
- **AbbreviationTranslation**: A locale-specific record containing an optional `short_meaning` (plain text) and an optional `description` (Tiptap JSON) for one `Abbreviation` in one locale.
- **EntryAbbreviation**: The join record connecting an `Abbreviation` to an `Entry`. Carries `is_primary` (boolean) and `sort_order` (integer).
- **Source Language**: The BCP-47 locale code (e.g. `en`, `no`, `de`) identifying the knitting tradition an abbreviation originates from. Stored as a plain string, matching the same convention as `Entry.origin_language`. There is no `Language` database model; languages are managed in the client-side Zustand store (`store/languages.ts`).
- **Display Language**: The BCP-47 locale code in which the reader wants to see an abbreviation's meaning.
- **Translation Fallback Chain**: The ordered strategy for resolving a displayed meaning when an `AbbreviationTranslation` does not exist for the requested locale: display language → English (`en`) → first available locale → `null` (show code and entry title only).
- **Admin_API**: The NestJS REST backend at `/api/v1/admin/`, protected by JWT + roles guard with role `editor`.
- **Admin_UI**: The Next.js admin frontend at `apps/admin/`.
- **Entry_Form**: The existing entry add/edit page in `Admin_UI` that already contains template, category, synonym, tag, and abbreviation fields.
- **Abbreviations_Page**: The dashboard page at `/abbreviations` in `Admin_UI`, currently a "Coming soon" stub.
- **Combobox**: The Popover + Command pattern from shadcn/ui used for searchable selects throughout `Admin_UI`.

---

## Requirements

---

### Requirement 1: Abbreviation Data Model

**User Story:** As a system architect, I want the database to store abbreviations with their source language and translations, so that the data layer can support multilingual display and reliable uniqueness constraints.

#### Acceptance Criteria

1. THE `Admin_API` SHALL store each `Abbreviation` with the fields: `id` (UUID, PK), `code` (non-empty string, maximum 255 characters), `source_language` (BCP-47 locale string), `created_at` (timestamptz), `updated_at` (timestamptz).
2. THE `Admin_API` SHALL enforce a unique constraint on the combination of `(code, source_language)` using case-insensitive comparison so that `K2tog` and `k2tog` for the same source language are treated as the same abbreviation.
3. THE `Admin_API` SHALL store each `AbbreviationTranslation` with the fields: `id` (UUID, PK), `abbreviation_id` (FK to `Abbreviation`), `locale` (BCP-47 string), `short_meaning` (nullable plain text, maximum 500 characters), `description` (nullable Tiptap JSON), `created_at` (timestamptz), `updated_at` (timestamptz).
4. THE `Admin_API` SHALL enforce a unique constraint on `(abbreviation_id, locale)` so that at most one translation row exists per locale per abbreviation.
5. THE `Admin_API` SHALL store each `EntryAbbreviation` join record with the fields: `entry_id` (FK to `Entry`), `abbreviation_id` (FK to `Abbreviation`), `is_primary` (boolean, default `false`), `sort_order` (integer, default `0`). The composite `(entry_id, abbreviation_id)` SHALL be the primary key.
6. THE `Admin_API` SHALL follow existing Prisma conventions: UUIDs generated with `gen_random_uuid()`, timestamps typed as `@db.Timestamptz`, relation names in snake_case, and table names mapped via `@@map`.
7. IF an `Abbreviation` is deleted, THEN THE `Admin_API` SHALL cascade the deletion to all of its `AbbreviationTranslation` rows and all `EntryAbbreviation` rows that reference it.
8. IF an `Entry` is deleted, THEN THE `Admin_API` SHALL cascade the deletion to all `EntryAbbreviation` rows for that entry, while preserving the referenced `Abbreviation` records unchanged.
9. IF an `AbbreviationTranslation` is deleted, THEN THE `Admin_API` SHALL preserve the parent `Abbreviation` record unchanged.
10. IF an `EntryAbbreviation` row is deleted, THEN THE `Admin_API` SHALL preserve both the `Abbreviation` record and the `Entry` record unchanged.

---

### Requirement 2: Abbreviation CRUD API

**User Story:** As an editor, I want REST endpoints to create, read, update, and delete abbreviations, so that I can manage the abbreviation library from any interface.

#### Acceptance Criteria

1. WHEN `GET /api/v1/admin/abbreviations` is called with valid authentication, THE `Admin_API` SHALL return a paginated list of abbreviations in the response envelope `{ data: Abbreviation[], meta: { total, page, limit } }`, protected by JWT + role `editor`. Default `page` is `1` and default `limit` is `20`; `limit` SHALL NOT exceed `100`.
2. WHEN `GET /api/v1/admin/abbreviations/:id` is called with valid authentication and an existing `id`, THE `Admin_API` SHALL return a single abbreviation with its `translations` array and `entry_abbreviations` array, protected by JWT + role `editor`.
3. WHEN `GET /api/v1/admin/abbreviations/:id` is called with an `id` that does not exist, THEN THE `Admin_API` SHALL return HTTP 404.
4. WHEN `POST /api/v1/admin/abbreviations` is called with valid authentication and a valid body, THE `Admin_API` SHALL accept `{ code, source_language }`, trim `code`, persist the record, and return the created `Abbreviation` with HTTP 201, protected by JWT + role `editor`.
5. WHEN `PATCH /api/v1/admin/abbreviations/:id` is called with valid authentication and a valid body, THE `Admin_API` SHALL accept partial updates to `code` and/or `source_language` and return the updated `Abbreviation`, protected by JWT + role `editor`.
6. WHEN `PATCH /api/v1/admin/abbreviations/:id` is called with an `id` that does not exist, THEN THE `Admin_API` SHALL return HTTP 404.
7. WHEN `DELETE /api/v1/admin/abbreviations/:id` is called with valid authentication and the abbreviation exists, THE `Admin_API` SHALL permanently delete the `Abbreviation` and return HTTP 204, protected by JWT + role `editor`.
8. WHEN `DELETE /api/v1/admin/abbreviations/:id` is called with an `id` that does not exist, THEN THE `Admin_API` SHALL return HTTP 404.
9. WHEN `POST /api/v1/admin/abbreviations` or `PATCH /api/v1/admin/abbreviations/:id` is called with a `(code, source_language)` pair that already exists (case-insensitively), THEN THE `Admin_API` SHALL return HTTP 409 with an error message in the response envelope.
10. WHEN `code` is missing or blank after trimming in a create or update request, THEN THE `Admin_API` SHALL return HTTP 400.
11. WHEN `source_language` is missing or blank in a create request, THEN THE `Admin_API` SHALL return HTTP 400.
12. WHEN any endpoint is called without valid authentication or with insufficient role, THEN THE `Admin_API` SHALL return HTTP 401 or HTTP 403 respectively.
13. WHEN `GET /api/v1/admin/abbreviations` is called with query parameters `q` (search string, searches `code` only), `source_language` (locale filter), `page`, and `limit`, THEN THE `Admin_API` SHALL apply those filters before paginating and SHALL always return both `data` and `meta` fields in the response envelope.

---

### Requirement 3: Translation CRUD API

**User Story:** As an editor, I want REST endpoints to add, update, and delete per-locale translations for an abbreviation, so that I can provide meanings and descriptions in every supported language.

#### Acceptance Criteria

1. WHEN `POST /api/v1/admin/abbreviations/:id/translations` is called with valid authentication and a valid body, THE `Admin_API` SHALL accept `{ locale, short_meaning?, description? }` and return the created `AbbreviationTranslation` with HTTP 201, protected by JWT + role `editor`. WHEN the parent abbreviation `:id` does not exist, THEN THE `Admin_API` SHALL return HTTP 404.
2. WHEN `PATCH /api/v1/admin/abbreviations/:id/translations/:locale` is called with valid authentication and a valid body, THE `Admin_API` SHALL accept `{ short_meaning?, description? }` and return the updated `AbbreviationTranslation`, protected by JWT + role `editor`. WHEN the parent abbreviation `:id` does not exist, or when no translation row exists for the given `:locale`, THEN THE `Admin_API` SHALL return HTTP 404.
3. WHEN `DELETE /api/v1/admin/abbreviations/:id/translations/:locale` is called with valid authentication, THE `Admin_API` SHALL remove the translation row and return HTTP 204, protected by JWT + role `editor`. WHEN the parent abbreviation `:id` does not exist, or when no translation row exists for the given `:locale`, THEN THE `Admin_API` SHALL return HTTP 404.
4. WHEN a translation is created for a `(abbreviation_id, locale)` pair that already has a row, THEN THE `Admin_API` SHALL return HTTP 409.
5. WHEN `description` is provided in a create or update request and is not valid JSON, THEN THE `Admin_API` SHALL return HTTP 400.
6. THE `Admin_API` SHALL accept `description: null` to explicitly clear a previously stored Tiptap description, and SHALL accept `short_meaning: null` to explicitly clear a previously stored short meaning.
7. WHEN `locale` in a create request is not a valid BCP-47 locale string (e.g. contains spaces or invalid characters), THEN THE `Admin_API` SHALL return HTTP 400.

---

### Requirement 4: Entry–Abbreviation Link API

**User Story:** As an editor, I want REST endpoints to connect and disconnect abbreviations from encyclopedia entries, so that each entry can reference the abbreviations used within it.

#### Acceptance Criteria

1. WHEN `POST /api/v1/admin/entries/:entryId/abbreviations` is called with valid authentication and a valid body, THE `Admin_API` SHALL accept `{ abbreviation_id, is_primary?: boolean, sort_order?: integer }` (where `sort_order` is in the range 0–9999, defaulting to `0`, and `is_primary` defaults to `false`) and return the created `EntryAbbreviation` record with HTTP 201, protected by JWT + role `editor`.
2. WHEN `DELETE /api/v1/admin/entries/:entryId/abbreviations/:abbreviationId` is called with valid authentication and the join row exists, THE `Admin_API` SHALL remove the `EntryAbbreviation` row and return HTTP 204, protected by JWT + role `editor`.
3. WHEN `POST /api/v1/admin/entries/:entryId/abbreviations` is called with an `abbreviation_id` that is already linked to the given `entryId`, THEN THE `Admin_API` SHALL return HTTP 409.
4. WHEN `POST /api/v1/admin/entries/:entryId/abbreviations` is called with an `entryId` or `abbreviation_id` that does not exist, THEN THE `Admin_API` SHALL return HTTP 404.
5. WHEN `PATCH /api/v1/admin/entries/:entryId/abbreviations/:abbreviationId` is called with valid authentication and a valid body, THEN THE `Admin_API` SHALL accept `{ is_primary?: boolean, sort_order?: integer }` (where `sort_order` is in the range 0–9999) and return the updated `EntryAbbreviation` record, protected by JWT + role `editor`.
6. WHEN `DELETE /api/v1/admin/entries/:entryId/abbreviations/:abbreviationId` is called and no matching join row exists, THEN THE `Admin_API` SHALL return HTTP 404.
7. WHEN `PATCH /api/v1/admin/entries/:entryId/abbreviations/:abbreviationId` is called with an `entryId` or `abbreviationId` that does not match an existing join row, THEN THE `Admin_API` SHALL return HTTP 404.
8. WHEN any endpoint in this requirement is called without valid authentication or with insufficient role, THEN THE `Admin_API` SHALL return HTTP 401 or HTTP 403 respectively.

---

### Requirement 5: Abbreviation Search

**User Story:** As an editor, I want to search abbreviations by code and source language, so that I can quickly find existing abbreviations without creating duplicates.

#### Acceptance Criteria

1. WHEN `GET /api/v1/admin/abbreviations` is called with `q` (1–100 characters) and `source_language` query parameters, THE `Admin_API` SHALL return abbreviations whose `code` contains the `q` string case-insensitively, filtered to the given `source_language`, with a maximum of 50 results per response.
2. WHEN search results are returned, THE `Admin_API` SHALL rank them with exact `code` matches first, prefix matches second, and substring matches third; ties within the same rank tier SHALL be broken by ascending alphabetical order of `code`.
3. WHEN `GET /api/v1/admin/abbreviations` is called with a `display_language` query parameter, THE `Admin_API` SHALL include a `resolved_short_meaning` field for each result using the translation fallback chain: requested locale → `en` → first available locale → `null`.
4. WHEN no translation exists for the requested `display_language` or its fallback chain, THE `Admin_API` SHALL return `resolved_short_meaning: null` for that abbreviation.
5. WHEN `GET /api/v1/admin/abbreviations` is called with a `q` parameter, THE `Admin_API` SHALL respond within 500 ms at the p95 percentile.
6. WHEN `q` is provided but is empty (zero characters) or exceeds 100 characters, THEN THE `Admin_API` SHALL return HTTP 400 with an error message describing the constraint violation.

---

### Requirement 6: Entry Form — Abbreviation Panel

**User Story:** As an editor, I want an Abbreviations panel in the entry add/edit form, so that I can connect abbreviations to an entry while editing it without leaving the page.

#### Acceptance Criteria

1. THE `Entry_Form` SHALL display an Abbreviations panel in the entry editor's sidebar or as a dedicated section, replacing the existing plain-text chip input for abbreviations (`EntryFormValues.abbreviations: string[]`).
2. THE `Entry_Form` SHALL display the abbreviations currently linked to the entry as a list of cards, each showing the abbreviation `code`, source language badge, `is_primary` indicator, and `sort_order`.
3. THE `Entry_Form` SHALL provide a "Add new abbreviation" action that opens an inline form or dialog with the fields: `code` (required), `source_language` (required, selected from the languages in the Zustand store via `useLanguages()`), `short_meaning` (optional plain text), `description` (optional, rendered with `RichTextEditor`), `is_primary` checkbox, and `sort_order` integer (range 0–9999, default 0).
4. WHEN an editor submits the "Add new abbreviation" form, THE `Entry_Form` SHALL call `POST /api/v1/admin/abbreviations` to create the abbreviation, then call `POST /api/v1/admin/entries/:entryId/abbreviations` to link it, and SHALL refresh the abbreviation panel to reflect the new link. WHEN creation succeeds but linking fails, THE `Entry_Form` SHALL display a success toast for the created abbreviation and an inline error message within the panel indicating that linking failed. WHEN both operations succeed, THE `Entry_Form` SHALL display only a success toast.
5. WHEN an editor submits the "Add new abbreviation" form with a `(code, source_language)` combination that already exists, THE `Entry_Form` SHALL display an inline error message identifying the conflicting `code` and `source_language` values instead of creating a new record.
6. THE `Entry_Form` SHALL provide an "Add existing abbreviation" Combobox with a debounce of 300 ms that searches abbreviations using `GET /api/v1/admin/abbreviations` with the entered text (minimum 1 character) as `q` and the entry's `origin_language` as `source_language`.
7. WHEN an editor selects an abbreviation from the "Add existing abbreviation" Combobox, THE `Entry_Form` SHALL call `POST /api/v1/admin/entries/:entryId/abbreviations` to create only the join record, without modifying the `Abbreviation` itself, and SHALL display a success toast on success or an error toast on failure.
8. THE `Entry_Form` SHALL provide a remove action on each linked abbreviation card that calls `DELETE /api/v1/admin/entries/:entryId/abbreviations/:abbreviationId` after confirmation via `ConfirmDialog`, displaying a success toast on success or an error toast on failure.
9. THE `Entry_Form` SHALL provide an edit action on each linked abbreviation card that opens the abbreviation edit dialog pre-populated with the abbreviation's current data.
10. THE `Entry_Form` SHALL use `useLanguages()` for all locale lists so that source language options reflect the languages currently configured in the Zustand store.
11. THE `Entry_Form` SHALL use TanStack Query (`useQuery`, `useMutation`) for all abbreviation data fetching and mutations.

---

### Requirement 7: Abbreviation Edit Dialog

**User Story:** As an editor, I want to edit an abbreviation's code, source language, and per-locale translations from a single dialog, so that I can keep abbreviation data accurate without navigating to a separate page.

#### Acceptance Criteria

1. THE `Entry_Form` SHALL provide an abbreviation edit dialog (using `Dialog` from shadcn/ui) that shows `code` (text input) and `source_language` (dropdown populated from `useLanguages()`) fields in a metadata sidebar and per-locale `short_meaning` + `description` fields in a tabbed left panel, one tab per configured language, following the two-column form layout used by the category and entry forms.
2. THE `Entry_Form` SHALL render the `description` field in each locale tab using `RichTextEditor`.
3. WHEN an editor saves changes in the abbreviation edit dialog, THE `Entry_Form` SHALL call `PATCH /api/v1/admin/abbreviations/:id` only when `code` or `source_language` differs from the values at dialog open time, and call `PATCH /api/v1/admin/abbreviations/:id/translations/:locale` (or `POST` if the translation row does not yet exist) only for locale tabs whose `short_meaning` or `description` differs from values at dialog open time. WHEN all operations succeed, THE `Entry_Form` SHALL close the dialog and display a success toast via `sonner`.
4. WHEN the abbreviation being edited is linked to more than one entry, THE `Entry_Form` SHALL display a non-blocking warning banner within the edit dialog stating that changes will affect all linked entries; the editor SHALL be able to proceed with saving despite this warning.
5. THE `Entry_Form` SHALL display each locale tab with a green dot indicator when that locale has at least one non-empty field — `short_meaning` with at least one non-whitespace character, or `description` containing at least one text node with at least one non-whitespace character.
6. WHEN saving the abbreviation edit dialog fails due to a duplicate `(code, source_language)` conflict (HTTP 409), THE `Entry_Form` SHALL display an inline error message within the dialog that remains visible until the editor modifies the conflicting fields or dismisses it, without closing the dialog.
7. WHEN saving the abbreviation edit dialog fails due to any reason other than a duplicate conflict (network error, server error, or other validation failure), THE `Entry_Form` SHALL close the dialog and display an error toast via `sonner`.
8. WHEN `PATCH /api/v1/admin/abbreviations/:id` succeeds but one or more translation upserts fail, THE `Entry_Form` SHALL keep the dialog open, display an inline message identifying which locale tabs failed, and retain the unsaved values in those tabs so the editor can retry.

---

### Requirement 8: Standalone Abbreviations Page

**User Story:** As an editor, I want a dedicated Abbreviations management page in the admin dashboard, so that I can browse, create, edit, and delete abbreviations independently of any specific entry.

#### Acceptance Criteria

1. THE `Abbreviations_Page` SHALL replace the existing "Coming soon" stub at `apps/admin/src/app/(dashboard)/abbreviations/page.tsx` with a full management UI following the same list/create/edit pattern used by the categories, tags, and articles pages.
2. THE `Abbreviations_Page` SHALL display a `PageHeader` with title "Abbreviations" and description "Manage knitting abbreviations and their translations across languages", followed by a searchable, filterable table of all abbreviations.
3. THE `Abbreviations_Page` SHALL display each abbreviation row with: `code`, source language badge (using `LanguageBadges`), number of linked entries, number of available translations, and created date.
4. THE `Abbreviations_Page` SHALL provide a search input with a 300 ms debounce that filters abbreviations by `code` using `GET /api/v1/admin/abbreviations?q=`, resetting the page to 1 on each new search.
5. THE `Abbreviations_Page` SHALL provide a source language filter defaulting to "all languages" that restricts results to a selected locale using the `source_language` query parameter when a specific language is chosen.
6. THE `Abbreviations_Page` SHALL provide a "New abbreviation" button that opens a create dialog with `code`, `source_language`, and an optional initial English translation (`short_meaning`, `description`).
7. WHEN an editor clicks on an abbreviation row, THE `Abbreviations_Page` SHALL open an edit dialog pre-populated with the abbreviation's current data, using the two-column tabbed layout described in Requirement 7.
8. THE `Abbreviations_Page` SHALL provide a delete action per row that calls `DELETE /api/v1/admin/abbreviations/:id` after confirmation via `ConfirmDialog`. WHEN deletion succeeds, THE `Abbreviations_Page` SHALL display a success toast and remove the row from the table. WHEN deletion fails, THE `Abbreviations_Page` SHALL display an error toast via `sonner` describing the failure reason.
9. WHEN the table has no results matching the current search and filter state, THE `Abbreviations_Page` SHALL display an empty-state message indicating that no abbreviations were found and suggesting the editor create one or clear the filters.
10. THE `Abbreviations_Page` SHALL use TanStack Query for all data fetching and mutations.
11. THE `Abbreviations_Page` SHALL use `useLanguages()` for source language filter options and locale tab labels.

---

### Requirement 9: Frontend API Client

**User Story:** As a developer, I want a typed REST client module for abbreviations, so that all components consume the API through a consistent, reusable interface.

#### Acceptance Criteria

1. THE `Admin_UI` SHALL provide a typed API client module for abbreviations, exporting a named object that uses `apiGet`, `apiGetWithMeta`, `apiPost`, `apiPatch`, and `apiDelete` from `client.ts`. All exported functions SHALL have typed parameters and typed return values.
2. THE `Admin_UI` SHALL export TypeScript interfaces `Abbreviation`, `AbbreviationTranslation`, `EntryAbbreviation`, `CreateAbbreviationPayload`, `UpdateAbbreviationPayload`, `UpsertAbbreviationTranslationPayload`, and `LinkEntryAbbreviationPayload` from the abbreviations client module.
3. THE `Admin_UI` SHALL export the following functions with the specified signatures from the abbreviations client module:
   - `listAbbreviations(params?: ListAbbreviationsParams): Promise<ApiResponse<Abbreviation[]>>`
   - `getAbbreviation(id: string): Promise<Abbreviation>`
   - `createAbbreviation(payload: CreateAbbreviationPayload): Promise<Abbreviation>`
   - `updateAbbreviation(id: string, payload: UpdateAbbreviationPayload): Promise<Abbreviation>`
   - `deleteAbbreviation(id: string): Promise<void>`
   - `upsertTranslation(id: string, locale: string, payload: UpsertAbbreviationTranslationPayload): Promise<AbbreviationTranslation>`
   - `deleteTranslation(id: string, locale: string): Promise<void>`
   - `linkAbbreviation(entryId: string, payload: LinkEntryAbbreviationPayload): Promise<EntryAbbreviation>`
   - `unlinkAbbreviation(entryId: string, abbreviationId: string): Promise<void>`
4. THE `Admin_UI` SHALL use `apiGetWithMeta` for `listAbbreviations` so that the pagination `meta` envelope fields (`total`, `page`, `limit`) are preserved and accessible to consumers.

---

### Requirement 10: Search Result Correctness Properties

**User Story:** As a developer, I want property-based tests for the search ranking and translation fallback logic, so that regressions in pure functions are caught automatically.

#### Acceptance Criteria

1. THE `Admin_UI` SHALL provide a pure function `rankAbbreviations(query: string, abbreviations: Abbreviation[]): Abbreviation[]` that, for any non-empty `query`, sorts the input array so that exact code matches appear before prefix matches and prefix matches appear before substring matches, using locale-invariant case comparison (`toLowerCase()`). WHEN the input array is empty, THE function SHALL return an empty array.
2. IF a non-empty `query` string `q` is provided and the input list contains an abbreviation whose `code.toLowerCase()` equals `q.toLowerCase()`, THEN `rankAbbreviations(q, list)[0].code.toLowerCase()` SHALL equal `q.toLowerCase()`.
3. IF a non-empty `query` string `q` is provided, no abbreviation in the input list has an exact case-insensitive match for `q`, and at least one abbreviation's `code.toLowerCase()` starts with `q.toLowerCase()`, THEN `rankAbbreviations(q, list)[0].code.toLowerCase()` SHALL start with `q.toLowerCase()`.
4. THE `Admin_UI` SHALL provide a pure function `resolveTranslation(locale: string, translations: AbbreviationTranslation[]): AbbreviationTranslation | null` implementing the fallback chain: exact locale match → `en` match → first element of array → `null`. Ties within a fallback tier SHALL not occur by definition (one translation per locale).
5. IF a `locale` string is provided and the `translations` array contains an element whose `locale` field equals that string, THEN `resolveTranslation(locale, translations)` SHALL return that element.
6. IF a `locale` string is provided that does not match any element in `translations`, and `translations` contains an element with `locale === 'en'`, THEN `resolveTranslation(locale, translations)` SHALL return the `en` element.
7. IF a `locale` string is provided that does not match any element in `translations`, and no element has `locale === 'en'`, and `translations` is non-empty, THEN `resolveTranslation(locale, translations)` SHALL return `translations[0]`. IF `translations` is empty, THEN `resolveTranslation(locale, translations)` SHALL return `null`.
8. THE `Admin_UI` SHALL implement property-based tests for `rankAbbreviations` and `resolveTranslation` using `fast-check`, generating random abbreviation lists, query strings, locale strings, and translation arrays to verify the properties stated in criteria 1–7.
