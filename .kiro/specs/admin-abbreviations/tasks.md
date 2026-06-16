# Implementation Plan: Admin Abbreviations

## Overview

Implement the full abbreviation management system across three layers: Prisma schema + migration, NestJS `AdminAbbreviationModule`, and Next.js Admin UI. Tasks are ordered so that each layer is usable before building the layer above it. Pure utility functions and their property-based tests are implemented as their own discrete unit before the UI components that consume them.

## Tasks

- [x] 1. Add Prisma models and migration
  - [x] 1.1 Add `Abbreviation`, `AbbreviationTranslation`, and `EntryAbbreviation` models to `packages/database/prisma/schema.prisma`
    - Follow existing Prisma conventions: `@id @default(dbgenerated("gen_random_uuid()")) @db.Uuid`, `@db.Timestamptz`, `@updatedAt`, `@@map` for snake_case table names
    - Add `@@index([source_language])` on `Abbreviation`, `@@unique([abbreviation_id, locale])` and `@@index([locale])` on `AbbreviationTranslation`, `@@id([entry_id, abbreviation_id])` and `@@index([entry_id])` on `EntryAbbreviation`
    - Add `abbreviations EntryAbbreviation[]` relation to the existing `Entry` model
    - Add `onDelete: Cascade` on `AbbreviationTranslation → Abbreviation` and both FK sides of `EntryAbbreviation`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

  - [x] 1.2 Generate and amend the Prisma migration for the case-insensitive uniqueness index
    - Run `prisma migrate dev --name add-abbreviation-models` to scaffold the migration SQL
    - Append the raw SQL expression index to the generated migration file:
      ```sql
      CREATE UNIQUE INDEX abbreviation_code_source_language_unique
        ON abbreviation (lower(code), source_language);
      ```
    - Re-run `prisma migrate dev` to apply the amended migration and regenerate the Prisma client
    - _Requirements: 1.2_

- [x] 2. Implement NestJS DTOs
  - [x] 2.1 Create all seven DTO files under `apps/api/src/admin/abbreviation/dto/`
    - `create-abbreviation.dto.ts`: `@IsString() @MaxLength(255) @IsNotEmpty() code`, `@IsString() @IsNotEmpty() source_language`
    - `update-abbreviation.dto.ts`: same fields wrapped in `@IsOptional()`
    - `create-translation.dto.ts`: `@IsString() @IsNotEmpty() locale`, `@IsOptional() @IsString() @MaxLength(500) short_meaning`, `@IsOptional() description`
    - `update-translation.dto.ts`: `short_meaning` and `description` fields, both optional
    - `link-entry-abbreviation.dto.ts`: `@IsUUID() abbreviation_id`, optional `@IsBoolean() is_primary`, optional `@IsInt() @Min(0) @Max(9999) sort_order`
    - `update-entry-abbreviation.dto.ts`: optional `is_primary` and `sort_order`
    - `list-abbreviations-query.dto.ts`: optional `q`, `source_language`, `display_language`, `page` (min 1), `limit` (min 1, max 100); use `@Type(() => Number)` for numeric fields
    - _Requirements: 2.1, 2.4, 2.5, 2.9, 2.10, 2.11, 3.1, 3.2, 3.5, 3.7, 4.1, 4.5, 5.6_

- [ ] 3. Implement `AdminAbbreviationService`
  - [x] 3.1 Create `apps/api/src/admin/abbreviation/admin-abbreviation.service.ts` with `findAll`, `findOne`, `create`, `update`, `delete` methods
    - `findAll`: accept `ListAbbreviationsQueryDto`, apply `q` filter (case-insensitive `ILIKE`), `source_language` filter, default `page=1` and `limit=20`, return `{ data, meta: { total, page, limit } }`; if `display_language` provided, resolve `resolved_short_meaning` per the fallback chain (exact locale → `en` → first → `null`)
    - `create`: trim `code`, attempt insert; catch Prisma `P2002` via global filter and throw `ConflictException`
    - `update`: find-or-404, attempt update; catch `P2002` and throw `ConflictException`
    - `delete`: find-or-404, delete (cascades handled by Prisma)
    - `findOne`: include `translations` and `entry_abbreviations` in select
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 5.1, 5.2, 5.3, 5.4_

  - [x] 3.2 Add translation methods `createTranslation`, `updateTranslation`, `deleteTranslation` to `AdminAbbreviationService`
    - `createTranslation`: verify parent exists (404), catch `P2002` on `(abbreviation_id, locale)` as 409
    - `updateTranslation`: verify parent and locale row both exist (404 each), update
    - `deleteTranslation`: verify parent and locale row both exist (404 each), delete
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 3.3 Add entry-link methods `linkEntry`, `updateLink`, `unlinkEntry` to `AdminAbbreviationService`
    - `linkEntry`: verify `entryId` and `abbreviationId` both exist (404); catch `P2002` on `(entry_id, abbreviation_id)` as 409; default `is_primary=false`, `sort_order=0`
    - `updateLink`: verify join row exists (404), update
    - `unlinkEntry`: verify join row exists (404), delete
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [-] 3.4 Write unit tests for `AdminAbbreviationService`
    - Located at `apps/api/src/admin/abbreviation/__tests__/admin-abbreviation.service.spec.ts`
    - Mock `PrismaService`; test all success, 404, 409, and 400 branches for every method
    - Include: `create` (success, duplicate 409, blank code 400), `findAll` (pagination defaults, `q`, `source_language`, `display_language` fallback), `findOne` (success, 404), `update` (success, 404, 409), `delete` (cascade success, 404), all translation methods, all link methods
    - _Requirements: 2.1–2.13, 3.1–3.7, 4.1–4.8_

- [ ] 4. Implement `AdminAbbreviationController` and `AdminAbbreviationModule`
  - [-] 4.1 Create `apps/api/src/admin/abbreviation/admin-abbreviation.controller.ts`
    - `@ApiTags('admin/abbreviations')`, `@Controller('api/v1/admin')`, `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles('editor')`
    - Wire all 11 endpoints to corresponding service methods; use `@HttpCode(201)` on creates and `@HttpCode(204)` on deletes
    - Validate query params via `@Query()` with the `ListAbbreviationsQueryDto`; validate bodies via `@Body()` with the appropriate DTOs
    - _Requirements: 2.1–2.13, 3.1–3.7, 4.1–4.8, 5.1–5.6_

  - [x] 4.2 Create `apps/api/src/admin/abbreviation/admin-abbreviation.module.ts` and register it in `apps/api/src/app.module.ts`
    - Declare and export `AdminAbbreviationModule` with `AdminAbbreviationController` and `AdminAbbreviationService`
    - Import `PrismaModule`
    - Add `AdminAbbreviationModule` to the `imports` array in `AppModule`
    - _Requirements: 2.12_

- [x] 5. Checkpoint — API layer complete
  - Ensure all API unit tests pass. Run `pnpm test` in `apps/api`. Ask the user if questions arise.

- [x] 6. Implement typed API client and utility functions (frontend)
  - [x] 6.1 Create `apps/admin/src/lib/api/abbreviations.ts`
    - Export `Abbreviation`, `AbbreviationTranslation`, `EntryAbbreviation` interfaces and all payload/params interfaces
    - Export `abbreviationsApi` object using `apiGet`, `apiGetWithMeta`, `apiPost`, `apiPatch`, `apiDelete` from `client.ts`; include `upsertTranslation` (POST vs PATCH based on `exists` flag), `listAbbreviations`, `getAbbreviation`, `createAbbreviation`, `updateAbbreviation`, `deleteAbbreviation`, `deleteTranslation`, `linkAbbreviation`, `updateLink`, `unlinkAbbreviation`
    - Re-export from `apps/admin/src/lib/api/index.ts`
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 6.2 Create `apps/admin/src/lib/abbreviations-utils.ts` with `rankAbbreviations` and `resolveTranslation`
    - `rankAbbreviations(query, abbreviations)`: tier 0 = exact match, tier 1 = prefix match, tier 2 = other; stable alphabetical sort within tier; return input unchanged when query is empty or list is empty
    - `resolveTranslation(locale, translations)`: exact match → `en` fallback → `translations[0]` → `null`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 6.3 Write property-based tests for `rankAbbreviations` — Property 1
    - Located at `apps/admin/src/lib/api/__tests__/abbreviations.property.test.ts`
    - **Property 1: rankAbbreviations preserves the rank ordering invariant**
    - **Validates: Requirements 10.1, 10.2, 10.3**
    - Use `fc.property(fc.string({ minLength: 1, maxLength: 20 }), fc.array(abbreviationArbitrary(), { maxLength: 30 }), ...)` with `numRuns: 100`
    - Assert: tier ordering invariant holds for all consecutive pairs; alphabetical order holds within each tier; output length equals input length; no throw on empty array
    - Tag comment: `// Feature: admin-abbreviations, Property 1: rankAbbreviations preserves the rank ordering invariant`

  - [x] 6.4 Write property-based tests for `resolveTranslation` — Property 2
    - Same file: `apps/admin/src/lib/api/__tests__/abbreviations.property.test.ts`
    - **Property 2: resolveTranslation follows the fallback chain for all inputs**
    - **Validates: Requirements 10.4, 10.5, 10.6, 10.7**
    - Use `fc.property(fc.string({ minLength: 1, maxLength: 10 }), fc.array(translationArbitrary(), { maxLength: 10 }), ...)` with `numRuns: 100`
    - Deduplicate translations by locale before assertion to respect one-translation-per-locale invariant
    - Assert the full fallback chain: exact → `en` → `translations[0]` → `null`; no throw on any input
    - Tag comment: `// Feature: admin-abbreviations, Property 2: resolveTranslation follows the fallback chain for all inputs`

- [x] 7. Implement `AbbreviationEditDialog` component
  - [x] 7.1 Create `apps/admin/src/components/abbreviations/abbreviation-edit-dialog.tsx`
    - Two-column layout: left panel with locale tabs (one per `useLanguages().allLocales`), each tab with `short_meaning` (`Input`) and `description` (`RichTextEditor`); right sidebar with `code` input and `source_language` dropdown
    - Green dot tab indicator: tab has non-empty `short_meaning` (trimmed) OR description with at least one non-whitespace text node
    - Multi-entry warning banner when abbreviation is linked to more than one entry
    - On save: call `updateAbbreviation` only if `code`/`source_language` changed; call `upsertTranslation` only for dirty locale tabs; on full success close dialog and show success toast
    - 409 conflict: show inline error, keep dialog open (_Requirements: 7.6_)
    - Other error: close dialog, show error toast (_Requirements: 7.7_)
    - Partial translation failure: keep dialog open, show per-locale inline error, retain unsaved values (_Requirements: 7.8_)
    - Use TanStack Query `useMutation`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [x] 8. Implement `AbbreviationsPanel` component
  - [x] 8.1 Create `apps/admin/src/components/abbreviations/abbreviations-panel.tsx`
    - Props: `entryId: string`, `linkedAbbreviations: (EntryAbbreviation & { abbreviation: Abbreviation })[]`, mutation callbacks
    - Render linked abbreviation cards: code, source language badge, `is_primary` indicator, `sort_order`
    - "Add new" button opens `AbbreviationCreateDialog` pre-wired to link on save; handle create-success + link-fail edge case (_Requirements: 6.4_)
    - "Add existing" Combobox: 300 ms debounce, `listAbbreviations({ q, source_language: entry.origin_language })`; on select call `linkAbbreviation` (_Requirements: 6.6, 6.7_)
    - Edit button opens `AbbreviationEditDialog` for the card's abbreviation (_Requirements: 6.9_)
    - Remove button: `ConfirmDialog` → `unlinkAbbreviation`, success/error toast (_Requirements: 6.8_)
    - Use TanStack Query `useQuery` + `useMutation`; `useLanguages()` for locale options
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11_

- [x] 9. Update `EntryFormValues` and wire `AbbreviationsPanel` into the entry form
  - [x] 9.1 Update `EntryFormValues` in `apps/admin/src/components/entries/` — replace `abbreviations: string[]` with `abbreviations: LinkedAbbreviationState[]`
    - Define `LinkedAbbreviationState` interface: `abbreviation_id`, `code`, `source_language`, `is_primary`, `sort_order`, optional `abbreviation`
    - Update form default values, validation schema, and submit handler accordingly (mutations are fired directly from `AbbreviationsPanel`; the form submit itself does not batch abbreviation changes)
    - _Requirements: 6.1_

  - [x] 9.2 Render `AbbreviationsPanel` inside the entry add/edit form, passing `entryId` and `linkedAbbreviations` from the entry's `GET` response
    - Remove the old plain-text chip input for abbreviations
    - _Requirements: 6.1, 6.2_

- [x] 10. Implement `AbbreviationsPage`
  - [x] 10.1 Replace the stub at `apps/admin/src/app/(dashboard)/abbreviations/page.tsx` with a full management page
    - `PageHeader` with title "Abbreviations" and description "Manage knitting abbreviations and their translations across languages"
    - Stats bar with total abbreviation count
    - Search input (300 ms debounce, resets page to 1) + source language filter dropdown (`useLanguages()`)
    - Table columns: code, source language badge (`LanguageBadges`), linked entries count, translations count, created date
    - "New abbreviation" button opens `AbbreviationCreateDialog`
    - Row click opens `AbbreviationEditDialog`
    - Row dropdown delete action: `ConfirmDialog` → `deleteAbbreviation`, success/error toast, remove row on success
    - Empty state message when no results
    - Use TanStack Query; `useLanguages()` for filter options
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11_

- [x] 11. Final checkpoint — full feature complete
  - Ensure all tests pass. Run `pnpm test` in both `apps/api` and `apps/admin`. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; they do not block any downstream tasks
- Property tests in 6.3 and 6.4 must be written in the same file (`abbreviations.property.test.ts`) and tagged with the exact comment format for traceability
- The raw SQL expression index in 1.2 is essential for the case-insensitive uniqueness guarantee; it must be part of the migration before any test data is seeded
- `AbbreviationCreateDialog` (used by both `AbbreviationsPanel` and `AbbreviationsPage`) is a thin wrapper around `AbbreviationEditDialog` with no initial `id`; it can be co-located in `components/abbreviations/` or extracted inline within those components
- All frontend mutations fire incrementally from the panel/dialog; the entry form submit does not batch abbreviation changes

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4", "4.1"] },
    { "id": 5, "tasks": ["4.2"] },
    { "id": 6, "tasks": ["6.1", "6.2"] },
    { "id": 7, "tasks": ["6.3", "6.4", "7.1"] },
    { "id": 8, "tasks": ["8.1"] },
    { "id": 9, "tasks": ["9.1"] },
    { "id": 10, "tasks": ["9.2", "10.1"] }
  ]
}
```
