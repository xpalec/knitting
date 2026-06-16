# Implementation Plan: Entry Sidebar Localization

## Overview

Make the entry form's right sidebar fully locale-aware by lifting `activeLocale` state into `EntryForm`, introducing a shared `resolveTranslation` helper, replacing the free-text tag chip input with a new `TagsPanel`, moving synonyms into per-locale state, wiring SEO fields per-locale, and updating `mapEntryToFormValues` / `updateMutation` to persist and hydrate all new per-locale data.

## Tasks

- [x] 1. Define shared types and the `resolveTranslation` helper
  - [x] 1.1 Update `LocaleTabState` and `EntryFormValues` interfaces
    - Add `synonyms: string[]` to `LocaleTabState`
    - Remove top-level `synonyms` from `EntryFormValues`; confirm `tags` stores `string[]` of UUIDs
    - Update `UpdateTranslationPayload` with optional `synonyms?: string[]`, `seo_title?: string`, `seo_description?: string`
    - _Requirements: 4.1, 4.4, 6.8, 8.1_

  - [x] 1.2 Create `resolveTranslation` pure helper function
    - Create `apps/admin/src/lib/resolve-translation.ts`
    - Implement the three-tier resolution (active locale → `"en"` → `fallbackId`) returning `{ label: string; isFallback: boolean }`
    - Export `resolveTranslation` for use in `EntryForm`, `TagsPanel`, and `AbbreviationsPanel`
    - _Requirements: 1.2, 1.4, 2.1, 2.2, 2.3, 3.3, 3.4, 3.5, 5.1, 5.2_

  - [ ]* 1.3 Write property test for `resolveTranslation` (Property 1)
    - **Property 1: Translation label resolution resolves in priority order**
    - **Validates: Requirements 1.2, 1.4, 2.1, 2.2, 2.3, 3.3, 3.4, 3.5, 5.1, 5.2**
    - Use `fast-check` in `apps/admin/src/__tests__/entry-sidebar-localization/resolve-translation.test.ts`
    - Generate arbitrary translations arrays and arbitrary active locale codes; assert priority order

- [x] 2. Create `MissingTranslationBadge` UI component
  - [x] 2.1 Implement `MissingTranslationBadge` component
    - Create `apps/admin/src/components/ui/missing-translation-badge.tsx`
    - Render a small red `!` badge with `aria-label="No translation for active locale"` and a tooltip title
    - Export for use in category dropdown, `TagsPanel`, and `AbbreviationsPanel`
    - _Requirements: 1.4, 2.2, 3.4, 3.5, 5.2_

- [x] 3. Lift `activeLocale` state into `EntryForm` and update the left-panel tabs
  - [x] 3.1 Make the left-panel `<Tabs>` controlled and expose `activeLocale`
    - Add `const [activeLocale, setActiveLocale] = useState<string>(defaultLocale)` in `EntryForm`
    - Switch `<Tabs defaultValue={defaultLocale}>` to `<Tabs value={activeLocale} onValueChange={setActiveLocale}>`
    - Pass `activeLocale` as a prop to all sidebar sub-components that need it
    - _Requirements: 1.1, 1.3_

  - [ ]* 3.2 Write property test for global fields invariant under locale switching (Property 2)
    - **Property 2: Global fields are invariant under locale switching**
    - **Validates: Requirements 2.4, 7.1**
    - Use `fast-check` in `apps/admin/src/__tests__/entry-sidebar-localization/locale-switch-invariant.test.ts`
    - Generate random initial `categoryId`, `entryTemplateId`, `tags` and a sequence of locale switches; assert all three are unchanged

- [x] 4. Update `EntryFormValues` initialisation and `buildValues()` for per-locale synonyms
  - [x] 4.1 Remove global `synonyms` state and wire per-locale synonyms in `EntryForm`
    - Remove the `synonyms` `useState` from `EntryForm`
    - Bind the synonyms `<ChipInput>` to `enrichedLocales[activeLocale]?.synonyms ?? []`
    - Mutate via `handleLocaleChange(activeLocale, { synonyms: chips })`
    - Update `buildValues()` so it no longer includes a top-level `synonyms` field
    - _Requirements: 4.1, 4.2_

  - [ ]* 4.2 Write property test for per-locale synonyms isolation (Property 3)
    - **Property 3: Per-locale synonyms are isolated**
    - **Validates: Requirements 4.1, 4.2**
    - Use `fast-check` in `apps/admin/src/__tests__/entry-sidebar-localization/per-locale-synonyms.test.ts`
    - Generate random locales map with distinct synonym arrays; apply a random edit to one locale; assert all other locales are unchanged

- [x] 5. Update `AbbreviationsPanel` to accept and use `activeLocale`
  - [x] 5.1 Add `activeLocale` prop to `AbbreviationsPanel` and resolve labels
    - Add `activeLocale: string` to `AbbreviationsPanelProps`
    - Implement `resolveAbbreviationLabel` inside the component (active locale `short_meaning` → `source_language` fallback → `abbreviation.code`)
    - Render `MissingTranslationBadge` when `isFallback` is true
    - Update `AbbreviationCard` sub-component to pass through `activeLocale`
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 5.2 Pass `activeLocale` from `EntryForm` to `AbbreviationsPanel`
    - Update the `<AbbreviationsPanel>` usage in `EntryForm` to include `activeLocale={activeLocale}`
    - _Requirements: 5.4_

- [x] 6. Localise the Category dropdown
  - [x] 6.1 Compute locale-aware `categoryOptions` in `EntryForm`
    - Add a `useMemo` that maps `categories` to `{ value, label, isFallback }` using `resolveTranslation`
    - Extend `ComboboxField` to accept `isFallback` per-option and render `MissingTranslationBadge` next to fallback labels in the list
    - Add an inline error banner in the Details tab when `categoriesError` is truthy
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 7. Build and integrate the `TagsPanel` component
  - [x] 7.1 Create `TagsPanel` component
    - Create `apps/admin/src/components/tags/tags-panel.tsx`
    - Implement props: `entryId?`, `linkedTags`, `activeLocale`, `onTagsChange`, `onLinkChanged?`, `disabled?`
    - Add internal state: `searchOpen`, `searchInput`, `debouncedQ` (300 ms), `searchResults`, `isSearching`, `searchError`
    - Implement search via `adminTagsApi.listTags({ search: debouncedQ, limit: 20 })`, excluding already-linked IDs from results
    - Display linked tags using `resolveTranslation` / `MissingTranslationBadge`; render search results in a popover
    - On tag select: call `entriesApi.linkTag` immediately if `entryId` is defined (and endpoint exists); always call `onTagsChange` with the new ID added, guarding against duplicates
    - On tag remove: call `entriesApi.unlinkTag` immediately if `entryId` is defined (and endpoint exists); always call `onTagsChange` with the ID removed
    - Surface `searchError` inside the popover; surface link/unlink errors as `toast.error`
    - Log `console.warn` and skip API calls when link/unlink endpoints are absent
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 8.3, 8.4, 8.5_

  - [ ]* 7.2 Write property test for tag idempotency (Property 9)
    - **Property 9: Tag linking is idempotent — no duplicate IDs**
    - **Validates: Requirements 3.6**
    - Use `fast-check` in `apps/admin/src/__tests__/entry-sidebar-localization/tag-idempotency.test.ts`
    - Generate a random tags array and pick an already-present ID; call the add handler; assert the array is unchanged

  - [x] 7.3 Replace `ChipInput` for tags with `TagsPanel` in `EntryForm`
    - Remove the free-text `ChipInput` for tags from `EntryForm`
    - Add `linkedTags?: AdminTag[]` and `onTagLinkChanged?: () => void` to `EntryFormProps`
    - Render `<TagsPanel>` in the Details tab, passing `entryId`, `linkedTags`, `activeLocale`, `onTagsChange`, and `onLinkChanged`
    - _Requirements: 3.1, 3.8_

- [x] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Wire per-locale SEO fields in `EntryForm`
  - [x] 9.1 Bind SEO Title and SEO Description inputs to `enrichedLocales[activeLocale]`
    - Bind the SEO Title input to `enrichedLocales[activeLocale]?.seoTitle ?? ''` with `maxLength` / `slice(0, 60)` enforcement
    - Bind the SEO Description textarea to `enrichedLocales[activeLocale]?.seoDescription ?? ''` with `maxLength` / `slice(0, 160)` enforcement
    - Update the SEO tab trigger label to include `activeLocale.toUpperCase()` as a `<span>` suffix
    - Mutate via `handleLocaleChange(activeLocale, { seoTitle: ... })` and `handleLocaleChange(activeLocale, { seoDescription: ... })`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 9.2 Write property test for per-locale SEO field isolation (Property 4)
    - **Property 4: Per-locale SEO fields are bound and isolated**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
    - Use `fast-check` in `apps/admin/src/__tests__/entry-sidebar-localization/per-locale-seo.test.ts`
    - Generate random locales map with distinct `seoTitle`/`seoDescription`; apply a random SEO edit to one locale; assert other locales are unchanged

  - [ ]* 9.3 Write property test for SEO tab header uppercase locale (Property 10)
    - **Property 10: SEO tab header displays the active locale code in uppercase**
    - **Validates: Requirements 6.5**
    - Use `fast-check` in `apps/admin/src/__tests__/entry-sidebar-localization/seo-tab-header.test.ts`
    - Generate random lowercase locale codes; render the SEO tab trigger; assert the text contains `locale.toUpperCase()`

- [x] 10. Update `mapEntryToFormValues` to hydrate per-locale fields
  - [x] 10.1 Hydrate synonyms, SEO fields, and tag IDs in `mapEntryToFormValues`
    - In `apps/admin/src/app/(dashboard)/entries/[id]/page.tsx`, update the `locales[locale]` builder to read `seoTitle`, `seoDescription`, and `synonyms` from `t?.metadata` (falling back to `""` / `[]`)
    - Change `tags` mapping from `tag.name` to `tag.id`
    - Remove the top-level `synonyms` field from the returned object
    - _Requirements: 4.3, 6.6, 8.1, 8.2_

  - [ ]* 10.2 Write property test for `mapEntryToFormValues` round-trip (Property 5)
    - **Property 5: mapEntryToFormValues round-trip for per-locale data**
    - **Validates: Requirements 4.3, 6.6**
    - Use `fast-check` in `apps/admin/src/__tests__/entry-sidebar-localization/map-entry-form-values.test.ts`
    - Generate realistic `Entry` shapes with per-locale `synonyms`, `seo_title`, `seo_description` in translation metadata; assert correct population

  - [ ]* 10.3 Write property test for tag ID mapping (Property 6)
    - **Property 6: mapEntryToFormValues maps tag names to tag IDs**
    - **Validates: Requirements 8.1, 8.2**
    - Use `fast-check` in `apps/admin/src/__tests__/entry-sidebar-localization/map-entry-tag-ids.test.ts`
    - Generate an entry with random `tags: Array<{ id: string; name: string }>`; assert `mapEntryToFormValues(entry).tags` equals `entry.tags.map(t => t.id)`

- [x] 11. Update `updateMutation` in the edit page for per-locale payload and tag reconciliation
  - [x] 11.1 Implement tag reconciliation and per-locale translation payload
    - In the edit page `updateMutation`, compute `toAdd` / `toRemove` via set difference of `serverTagIds` vs `values.tags`
    - Call `entriesApi.linkTag` / `entriesApi.unlinkTag` for each diff entry, guarded by endpoint existence check with `console.warn` fallback
    - Include `synonyms: ls.synonyms` in every `UpdateTranslationPayload` for non-empty-title locales
    - Include `seo_title` and `seo_description` in the payload only when non-empty (conditional per design)
    - Surface link/unlink errors as `toast.error` without resetting form state
    - _Requirements: 4.5, 6.7, 8.3, 8.4, 8.5_

  - [ ]* 11.2 Write property test for tag set difference (Property 8)
    - **Property 8: Tag set difference is computed correctly**
    - **Validates: Requirements 8.3**
    - Extract `computeTagDiff(serverIds, submittedIds)` as a pure function; use `fast-check` in `apps/admin/src/__tests__/entry-sidebar-localization/tag-set-diff.test.ts`
    - Generate two random sets of UUID strings; assert additions = submitted − server and removals = server − submitted

  - [ ]* 11.3 Write property test for `UpdateTranslationPayload` synonyms inclusion (Property 7)
    - **Property 7: updateTranslationPayload includes synonyms for non-empty titles**
    - **Validates: Requirements 4.5**
    - Use `fast-check` in `apps/admin/src/__tests__/entry-sidebar-localization/update-translation-payload.test.ts`
    - Generate random locale state with non-empty title and random synonyms; call the payload builder; assert `payload.synonyms` is present and equal to the input

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use `fast-check` (already available in the Next.js ecosystem with Vitest)
- Unit tests cover wiring, error conditions, and specific examples complementary to property tests
- The `resolveTranslation` helper (task 1.2) is the foundation for tasks 5–7 and must be completed first
- Tag link/unlink API may not yet be deployed; the implementation guards this with an existence check (requirement 8.5)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "3.1"] },
    { "id": 2, "tasks": ["3.2", "4.1", "5.1"] },
    { "id": 3, "tasks": ["4.2", "5.2", "6.1"] },
    { "id": 4, "tasks": ["7.1", "9.1"] },
    { "id": 5, "tasks": ["7.2", "7.3", "9.2", "9.3", "10.1"] },
    { "id": 6, "tasks": ["10.2", "10.3", "11.1"] },
    { "id": 7, "tasks": ["11.2", "11.3"] }
  ]
}
```
