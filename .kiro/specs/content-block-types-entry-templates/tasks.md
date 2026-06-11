# Implementation Plan: Entry Templates with Translations

## Overview

Redesign the Entry Templates feature to support per-locale default values on template blocks. The `ContentBlockType` database entity and `/content-blocks` admin page are removed. Block type metadata moves to a hardcoded frontend registry (`BLOCK_TYPES`). Each `TemplateBlock` gets a stable client-generated `id`; per-locale defaults are stored in `EntryTemplateTranslation.blocks_defaults[block.id]`.

## Tasks

- [ ] 1. Define `BLOCK_TYPES` frontend registry
  - Create `apps/admin/src/lib/block-types.ts`
  - Define `BlockTypeField`, `BlockTypeDescriptor` interfaces
  - Export `BLOCK_TYPES` constant with the `rich_text` entry: `{ slug: 'rich_text', label: 'Rich Text', translatableFields: [{ name: 'heading', label: 'Header', maxLength: 255 }] }`
  - Export `getBlockType(slug)` helper
  - Design so adding future types (e.g. `steps_list`) requires only a new array entry, no component changes
  - _Requirements: 6.1–6.4_

- [ ] 2. Update `entry-templates.ts` API client
  - Update `TemplateBlock` interface: add `id: string` (UUID) field alongside existing `type`, `order`, `required`
  - Add `TemplateTranslations` type: `Record<string, Record<string, Record<string, string>>>` (blockId → locale → fieldName → value)
  - Add `translations: TemplateTranslations` to `EntryTemplate`
  - Add `translations` (optional) to `CreateEntryTemplatePayload` and `UpdateEntryTemplatePayload`
  - Add `upsertTranslation(id, locale, blockTranslations)` method where `blockTranslations` is `Record<string, Record<string, string>>` (blockId → fieldName → value for that locale)
  - Export `SUPPORTED_LOCALES`, `Locale`, `LOCALE_LABELS`
  - _Requirements: 1.1–1.10, 2.1–2.6_

- [ ] 3. Add `deriveTemplateTranslationStatus` utility
  - Add `deriveTemplateTranslationStatus(template, locale)` to `entry-templates.ts` (or a shared utils file)
  - Returns `'complete'` when all blocks have non-empty values for all translatable fields in that locale
  - Returns `'incomplete'` when translation record exists but some fields are empty
  - Returns `'missing'` when no translation record exists for the locale
  - Uses `getBlockType` to determine which fields are translatable; unknown block types do not block completion
  - _Requirements: 2.7_

- [ ] 4. Update Prisma schema
  - Add `entry_type String` and `translations Json @default("{}")` columns to `EntryTemplate` model
  - Remove `ContentBlockType` and `ContentBlockTypeTranslation` models
  - No `EntryTemplateTranslation` model needed — all translation data is in the `translations` JSON column
  - _Requirements: 1.1–1.3_

- [ ] 5. Update backend API (`AdminEntryTemplateController`)
  - Add `entry_type` field to create/update endpoints
  - Include `translations` in all API responses (eager-loaded)
  - Support `translations` in create (`POST`) and update (`PUT`) payloads
  - Add `upsertTranslation` endpoint: merges submitted `{ [blockId]: { [fieldName]: string } }` into `EntryTemplate.translations[blockId][locale]`, leaving other locales untouched; returns full updated record
  - Validate `entry_type` against known values (422 on invalid)
  - Validate `locale` against supported locales (422 on invalid)
  - Remove `ContentBlockType` and `ContentBlockTypeTranslation` controllers and services
  - _Requirements: 1.4–1.9, 2.3–2.6_

- [ ] 6. Export pure block helpers and translation state helpers from `entry-template-form.tsx`
  - Export `renumber`, `moveUp`, `moveDown`, `removeBlock`, `addBlock`, `toggleRequired`
  - Update `TemplateBlock` to include `id: string` in all helpers (`addBlock` generates `crypto.randomUUID()`)
  - Export `initBlockDefaults(translations, blockId)` — adds `blockId` key (value `{}`) to `TemplateTranslations`
  - Export `removeBlockDefaults(translations, blockId)` — removes `blockId` key from `TemplateTranslations`
  - Export `setTranslationField(translations, blockId, locale, fieldName, value)` — immutably sets one field value
  - _Requirements: 7.1–7.7_

- [ ]* 7. Write property-based tests for pure helpers
  - Create `apps/admin/src/components/entry-templates/__tests__/entry-template-form.test.ts`
  - `blockArb = fc.record({ id: fc.uuidV(4), type: fc.stringMatching(...), order: fc.integer(...), required: fc.boolean() })`
  - **Property 1:** `renumber` — contiguous 1-based order, `id`/`type`/`required` unchanged
  - **Property 2:** `moveUp` — swaps i and i-1, renumbers
  - **Property 3:** `moveDown` — swaps i and i+1, renumbers
  - **Property 4:** `moveUp` at 0 — identity
  - **Property 5:** `moveDown` at last — identity
  - **Property 6:** `removeBlock` — length N-1, item absent, renumbered
  - **Property 7:** `toggleRequired` — only target flipped
  - **Property 8:** `addBlock` — appends with correct id (non-empty), type, order, required=false
  - **Property 10:** `removeBlockDefaults` — `blockId` is absent as a top-level key in the result
  - **Property 11:** `initBlockDefaults` — `blockId` is present as a top-level key in the result (value is `{}` or pre-existing data)
  - _Requirements: 7.1–7.7_

- [ ] 8. Update `EntryTemplateForm` component
  - Add `translations` to `EntryTemplateFormValues` and component state
  - Remove `blockTypes` and `isLoadingBlockTypes` props — resolve types via `getBlockType(slug)` instead
  - Wire `handleAddBlock`: call `addBlock` + `initBlockDefaults`
  - Wire `handleRemoveBlock`: call `removeBlock` + `removeBlockDefaults`
  - Add "Translations" card below the "Template structure" card (left column)
  - Translations card: `Tabs` with one tab per locale; each tab renders one heading `Input` per block, labelled with block type label; tab dot indicator showing `complete` status
  - Update `buildValues()` to include `translations`
  - _Requirements: 4.3–4.9, 5.1, 5.5_

- [ ]* 9. Write property-based test: submit button disabled invariant
  - **Property 9:** `fc.record({ name: fc.string(), entry_type: fc.oneof(...) })` → button disabled when name empty OR entry_type `''`; enabled otherwise (isSubmitting=false)
  - _Requirements: 4.9_

- [ ] 10. Move `TranslationStatusBadge` to shared UI
  - Move `apps/admin/src/components/content-blocks/translation-status-badge.tsx` → `apps/admin/src/components/ui/translation-status-badge.tsx`
  - Update all imports across the codebase
  - _Requirements: 3.5_

- [ ] 11. Update Entry Templates list page (`/entry-templates/page.tsx`)
  - Add EN and PL translation status columns using `deriveTemplateTranslationStatus` + `TranslationStatusBadge`
  - No other structural changes needed
  - _Requirements: 3.4–3.5_

- [ ] 12. Update Create Entry Template page (`/entry-templates/new/page.tsx`)
  - Remove `useQuery(['content-block-types'], ...)` — no longer needed
  - Pass `translations` from form values in `entryTemplatesApi.create(...)` payload
  - _Requirements: 4.10–4.12_

- [ ] 13. Update Edit Entry Template page (`/entry-templates/[id]/page.tsx`)
  - Remove `useQuery(['content-block-types'], ...)` — no longer needed
  - Update `mapTemplateToFormValues` to include `translations`
  - Pass `translations` from form values in `entryTemplatesApi.update(...)` payload
  - _Requirements: 5.1–5.10_

- [ ] 14. Remove `/content-blocks` page and related files
  - Delete `apps/admin/src/app/(dashboard)/content-blocks/` directory (except `[id]/__tests__/` — check if tests reference removed API)
  - Remove the `/content-blocks` sidebar link from `sidebar.tsx`
  - Remove `contentBlockTypesApi` usages from all pages (already replaced by `BLOCK_TYPES`)
  - _Requirements: 6.5, 8.2_

- [ ] 15. Final checkpoint — ensure all tests pass
  - Run full test suite; fix any broken imports or references left from the content-blocks removal
  - _Requirements: all_

## Notes

- `addBlock` uses `crypto.randomUUID()` which is available in all modern browsers and Node 19+; no polyfill needed
- The `entry_type` field was missing from the `EntryTemplate` Prisma model in the previous spec — it must be added as part of Task 4
- `TranslationStatusBadge` props interface is unchanged; only the import path moves
- Tasks marked `*` are optional for MVP
- The existing `templatesApi` (settings-based) and `template-editor-sheet.tsx` are retained for backward compatibility; do not modify or delete them

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2", "4"] },
    { "id": 1, "tasks": ["3", "5", "6"] },
    { "id": 2, "tasks": ["7", "8", "10"] },
    { "id": 3, "tasks": ["9", "11", "12", "13"] },
    { "id": 4, "tasks": ["14"] },
    { "id": 5, "tasks": ["15"] }
  ]
}
```
