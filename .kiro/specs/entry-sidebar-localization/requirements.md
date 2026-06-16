# Requirements Document

## Introduction

The entry new/edit form (`apps/admin/src/components/entries/entry-form.tsx`) has a two-column layout: a left panel with per-language tabs (EN, PL, …) and a right sidebar with "Details", "Images", and "SEO" tabs. Currently the sidebar is language-agnostic — it does not react to which locale tab is active on the left. This feature makes the sidebar fully locale-aware: category names, tag names, abbreviation labels, synonyms, and SEO fields all reflect the currently active language tab, and the relevant fields become per-locale where the domain requires it.

## Glossary

- **EntryForm**: The React component at `apps/admin/src/components/entries/entry-form.tsx` that renders the two-column entry creation/editing form.
- **ActiveLocale**: The locale code (e.g. `"en"`, `"pl"`) of the language tab currently selected in the left panel of the EntryForm.
- **Sidebar**: The right-hand panel of the EntryForm containing the "Details", "Images", and "SEO" tabs.
- **LocaleTabState**: The per-locale state shape `{ title, slug, shortDescription, seoTitle, seoDescription, blocks, synonyms }` stored in `EntryFormValues.locales`.
- **AdminCategory**: The API type returned by `listEntryCategories()`, containing a `translations: AdminCategoryTranslation[]` array with per-locale `name` values.
- **AdminTag**: The API type from `adminTagsApi`, containing a `translations: AdminTagTranslation[]` array with per-locale `name` values.
- **TagsPanel**: A new component, modelled on `AbbreviationsPanel`, that allows searching and linking/unlinking global tags on an entry.
- **UpdateTranslationPayload**: The payload type for `entriesApi.updateTranslation()`, currently without a `synonyms` field.
- **MissingTranslationBadge**: A small red `!` badge displayed next to a fallback English name when no translation exists for the ActiveLocale.
- **SupportedLocale**: The `string` type alias used for locale codes throughout the form.

---

## Requirements

### Requirement 1: Sidebar Tracks the Active Locale

**User Story:** As an editor, I want the right sidebar to automatically reflect whichever language tab I have selected on the left, so that I always see and edit locale-relevant data without switching between unrelated panels.

#### Acceptance Criteria

1. WHEN the user selects a locale tab on the left panel, THE EntryForm SHALL update a shared `activeLocale` state variable to the selected locale code.
2. WHILE an ActiveLocale is selected, THE Sidebar SHALL use that locale when resolving translated names for categories, tags, and abbreviations.
3. WHEN the EntryForm first renders, THE EntryForm SHALL initialise `activeLocale` to the default language locale.
4. IF a sidebar item has no translation for the ActiveLocale, THEN THE Sidebar SHALL display a fallback value (English name or raw identifier) accompanied by a MissingTranslationBadge, rather than rendering an empty or broken element.

---

### Requirement 2: Localised Category Display

**User Story:** As an editor, I want the Category dropdown in the sidebar to show the category name in the language I am currently editing, so that I can identify the correct category in my working language.

#### Acceptance Criteria

1. WHILE an ActiveLocale is selected, THE EntryForm SHALL display each category option label in the Category dropdown using the `AdminCategoryTranslation.name` whose `locale` matches the ActiveLocale.
2. IF no `AdminCategoryTranslation` exists for the ActiveLocale, THEN THE EntryForm SHALL display the English (`"en"`) category name as a fallback, accompanied by a MissingTranslationBadge.
3. IF no English `AdminCategoryTranslation` exists either, THEN THE EntryForm SHALL display the `category.id` as a last-resort label to prevent a blank dropdown option.
4. THE EntryForm SHALL store the category selection as a single global `categoryId` string shared across all locales; switching the ActiveLocale SHALL NOT reset or change the selected `categoryId`.
5. IF the categories API call fails, THEN THE EntryForm SHALL display an empty Category dropdown and a visible error message indicating that categories could not be loaded.

---

### Requirement 3: Localised Tag Panel (Replacing Chip Input)

**User Story:** As an editor, I want to search for and link existing tags from a panel similar to the abbreviations panel, and see tag names in my active language, so that I can manage tags efficiently without free-text guessing.

#### Acceptance Criteria

1. THE EntryForm SHALL replace the free-text `ChipInput` for tags with a `TagsPanel` component that provides search, link, and unlink functionality for global tags.
2. WHEN the user types at least 1 character in the `TagsPanel` search field, THE TagsPanel SHALL query `adminTagsApi.listTags()` with the typed string as `search` parameter, debounced by 300 ms; IF the API call fails, THE TagsPanel SHALL display an error message and leave the linked tags list unchanged.
3. WHILE an ActiveLocale is selected, THE TagsPanel SHALL display each linked tag's name using the `AdminTagTranslation.name` whose `locale` matches the ActiveLocale.
4. IF no `AdminTagTranslation` exists for the ActiveLocale, THEN THE TagsPanel SHALL display the English (`"en"`) tag name as a fallback, accompanied by a MissingTranslationBadge.
5. IF no English `AdminTagTranslation` exists either, THEN THE TagsPanel SHALL display the tag's `id` accompanied by a MissingTranslationBadge.
6. WHEN the user selects a tag from search results that is not already linked, THE TagsPanel SHALL add that tag's `id` to `EntryFormValues.tags`; IF the tag is already linked, THE TagsPanel SHALL NOT add a duplicate.
7. WHEN the user removes a linked tag, THE TagsPanel SHALL remove that tag's `id` from `EntryFormValues.tags`.
8. THE EntryForm SHALL pass the full `AdminTag[]` objects of linked tags to the `TagsPanel` so that translated names are available without additional API calls.
9. WHEN `entryId` is defined, THE TagsPanel SHALL call the link/unlink API immediately on user action; WHEN `entryId` is undefined (new entry), THE TagsPanel SHALL remain interactive and accumulate tag ID changes in form state only, deferring API calls until after the entry is created.

---

### Requirement 4: Per-Locale Synonyms

**User Story:** As an editor, I want each language to have its own independent list of synonyms, so that I can record language-specific synonyms without polluting other languages.

#### Acceptance Criteria

1. THE EntryForm SHALL store synonyms inside `LocaleTabState` (keyed by locale), so each locale has its own independent `synonyms: string[]`; the global top-level `synonyms` field SHALL be removed from `EntryFormValues`.
2. WHILE an ActiveLocale is selected, THE synonym ChipInput in the sidebar SHALL reflect and modify only `enrichedLocales[activeLocale].synonyms`; the `synonyms` arrays of all other locales SHALL remain unchanged.
3. WHEN the EntryForm loads an existing entry whose translation record includes a `synonyms` field for a given locale, THE EntryForm SHALL populate `enrichedLocales[locale].synonyms` with those persisted values.
4. THE `UpdateTranslationPayload` type SHALL include an optional `synonyms?: string[]` field.
5. WHEN the EntryForm submits a locale whose title is non-empty, THE EntryForm SHALL include the `synonyms` array of that locale in the `UpdateTranslationPayload`, even if the array is empty, so that previously saved synonyms are cleared when the user has removed all entries.

---

### Requirement 5: Language-Aware Abbreviation Display

**User Story:** As an editor, I want the abbreviations panel to display abbreviation labels in my active language, so that I can confirm I am linking the right abbreviation.

#### Acceptance Criteria

1. WHILE an ActiveLocale is selected, THE AbbreviationsPanel SHALL display each linked abbreviation's label using the `AbbreviationTranslation.short_meaning` whose `locale` matches the ActiveLocale; IF `short_meaning` is null for that translation, THE AbbreviationsPanel SHALL display `abbreviation.code` instead.
2. IF no `AbbreviationTranslation` exists for the ActiveLocale, THEN THE AbbreviationsPanel SHALL display the `AbbreviationTranslation` whose `locale` matches `abbreviation.source_language` as a fallback, accompanied by a MissingTranslationBadge; IF that fallback translation's `short_meaning` is also null, THE AbbreviationsPanel SHALL display `abbreviation.code`.
3. THE AbbreviationsPanel SHALL accept an `activeLocale: SupportedLocale` prop and use it for translation resolution.
4. THE EntryForm SHALL pass the current `activeLocale` value to `AbbreviationsPanel` via the `activeLocale` prop.

---

### Requirement 6: Per-Locale SEO Fields

**User Story:** As an editor, I want the SEO title and SEO description in the sidebar to show and edit the values for the language I am currently working on, so that each language version of an entry has its own SEO metadata.

#### Acceptance Criteria

1. WHILE an ActiveLocale is selected, THE EntryForm SHALL bind the SEO Title input to `enrichedLocales[activeLocale].seoTitle`.
2. WHILE an ActiveLocale is selected, THE EntryForm SHALL bind the SEO Description textarea to `enrichedLocales[activeLocale].seoDescription`.
3. WHEN the user edits the SEO Title, THE EntryForm SHALL update `enrichedLocales[activeLocale].seoTitle` and SHALL NOT modify the `seoTitle` of any other locale; the SEO Title input SHALL enforce a maximum length of 60 characters.
4. WHEN the user edits the SEO Description, THE EntryForm SHALL update `enrichedLocales[activeLocale].seoDescription` and SHALL NOT modify the `seoDescription` of any other locale; the SEO Description textarea SHALL enforce a maximum length of 160 characters.
5. WHILE an ActiveLocale is selected, THE SEO tab panel header SHALL display the uppercase locale code (e.g. `"EN"`, `"PL"`) so the editor knows which language's SEO data they are viewing.
6. WHEN the EntryForm loads an existing entry whose translation record includes `seo_title` or `seo_description` for a given locale, THE EntryForm SHALL populate `enrichedLocales[locale].seoTitle` and `enrichedLocales[locale].seoDescription` with those persisted values.
7. WHEN the EntryForm submits a locale whose title is non-empty and whose `seoTitle` is non-empty, THE EntryForm SHALL include both `seo_title` and `seo_description` (if non-empty) in the `UpdateTranslationPayload` for that locale; IF `seoTitle` is empty, THE EntryForm SHALL omit both `seo_title` and `seo_description` from the payload for that locale.
8. THE `UpdateTranslationPayload` type SHALL include optional `seo_title?: string` and `seo_description?: string` fields.

---

### Requirement 7: Entry Template Remains Global

**User Story:** As an editor, I want the Entry Template selector to continue working as a single global choice, so that all language versions of an entry share one template structure.

#### Acceptance Criteria

1. THE EntryForm SHALL keep the Entry Template selector bound to the global `entryTemplateId` state, independent of ActiveLocale; switching the ActiveLocale SHALL NOT change the selected `entryTemplateId`.
2. WHEN the user changes the Entry Template and the new template ID is found in the loaded templates list, THE EntryForm SHALL rebuild content blocks for all locales simultaneously using the new template's block definitions.
3. IF the selected template ID is not found in the loaded templates list, THEN THE EntryForm SHALL retain each locale's existing content blocks unchanged and SHALL display an error message indicating the template could not be loaded; the template selector SHALL still reflect the newly chosen ID.
4. WHEN an entry has already been saved with a template (i.e. `entryTemplateId` is non-empty on initial load), THE EntryForm SHALL disable the Entry Template selector so the template cannot be changed.

---

### Requirement 8: Mapping and Persistence of Tag IDs

**User Story:** As a developer, I want tag linkage to use tag IDs rather than tag names, so that the entry correctly references tag entities and can survive tag renames.

#### Acceptance Criteria

1. THE `EntryFormValues.tags` field SHALL store tag IDs (`string[]` of UUIDs) instead of tag name strings.
2. WHEN `mapEntryToFormValues` builds the initial form state, THE function SHALL populate `tags` with `entry.tags[].id` values.
3. WHEN the edit page's `updateMutation` runs and `entriesApi.linkTag` / `entriesApi.unlinkTag` endpoints are available, THE mutation SHALL compute the set difference between the entry's current server-side tag IDs and the submitted tag IDs, then call `entriesApi.unlinkTag` for each ID to remove and `entriesApi.linkTag` for each ID to add.
4. IF `entriesApi.linkTag` or `entriesApi.unlinkTag` returns an error, THEN THE EntryForm SHALL surface that error as a toast notification and SHALL preserve the current form state without resetting the tags field.
5. IF the entry tags API does not yet expose link/unlink endpoints, THEN THE mutation SHALL skip tag reconciliation, log a warning to the console, and continue saving all other entry fields successfully.
