# Entry Template Blocks Missing for Untranslated Locales — Bugfix Design

## Overview

When a user edits an existing entry that has an entry template, locale tabs without a saved
`Translation` row show zero content block rows. The root cause is in `mapEntryToFormValues`
inside `apps/admin/src/app/(dashboard)/entries/[id]/page.tsx`: it iterates only over locales
that already appear in `entry.translations`, so any locale that has never been saved is silently
omitted from `defaultValues.locales`. `EntryForm` then initialises those locales with an empty
`LocaleTabState` (`blocks: []`), and the reactive `enrichedLocales` fallback cannot recover
because it does not use the `entry.entry_template` data embedded in the entry response.

The fix is minimal and surgical: modify `mapEntryToFormValues` to accept the full list of active
locales, iterate over all of them, and populate block slots from `entry.entry_template` for any
locale that has no saved translation. No other part of the form needs to change.

---

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — `entry.entry_template` is non-null
  AND no `Translation` row exists for the given locale in `entry.translations`.
- **Property (P)**: The desired behavior when the bug condition holds — `localeState.blocks`
  contains one `BlockEditorState` per template block slot, sorted by `block.order`.
- **Preservation**: All behaviors unrelated to the bug condition that must remain unchanged after
  the fix, particularly: existing translation data is still loaded correctly for translated locales,
  and entries without a template still produce `blocks: []`.
- **`mapEntryToFormValues`**: The pure mapping function in
  `apps/admin/src/app/(dashboard)/entries/[id]/page.tsx` that converts an `Entry` API response
  into an `EntryFormValues` object used as `defaultValues` for `EntryForm`.
- **`entry.entry_template`**: The inline template object embedded in the `Entry` detail response,
  containing `blocks` (ordered slot definitions) and `translations` (per-block locale defaults).
- **`LocaleTabState`**: The per-locale slice of form state, containing `title`, `slug`,
  `shortDescription`, `blocks`, etc.
- **`BlockEditorState`**: The per-block slice of form state, containing `blockId`, `type`,
  `heading`, `content`, `visible`, `required`, and `order`.
- **`buildDefaultLocales`**: Helper in `EntryForm` that seeds per-locale state from
  `defaultValues.locales`, producing an empty `LocaleTabState` for any key that is absent.
- **Active locales**: The list of locale strings from the language settings store, passed into
  `mapEntryToFormValues` from the page component.

---

## Bug Details

### Bug Condition

The bug manifests when an entry has an entry template and the user visits a locale tab for a
locale that has never had a translation saved. `mapEntryToFormValues` builds locale state only
for locales present in `entry.translations`, so untranslated locales are missing from the map.
When `EntryForm` initialises, `buildDefaultLocales` fills those gaps with `blocks: []`, showing
a blank content-blocks section instead of the template's block rows.

**Formal Specification:**

```
FUNCTION isBugCondition(entry, locale)
  INPUT: entry of type Entry, locale of type string
  OUTPUT: boolean

  RETURN entry.entry_template IS NOT NULL
     AND NOT EXISTS(t IN entry.translations WHERE t.locale = locale)
END FUNCTION
```

### Examples

- **Polish tab, never saved**: Entry has template with 3 blocks; English translation exists.
  User opens Polish tab → sees "No content blocks yet." (bug). Expected: 3 block rows shown.

- **French tab, never saved**: Entry has template with 1 block. Only `en` translation exists.
  User opens French tab → 0 blocks shown (bug). Expected: 1 block row shown with default heading.

- **English tab, translation exists**: Entry has `en` translation with content. User opens English
  tab → blocks shown correctly from saved data (no bug; isBugCondition is false).

- **Entry with no template**: `entry.entry_template` is null. Any locale tab shows 0 blocks and
  the "No content blocks yet" empty state — this is correct behaviour, not a bug.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- For any locale that already has a `Translation` row in `entry.translations`, `mapEntryToFormValues`
  MUST continue to load `title`, `slug`, `shortDescription`, `synonyms`, `seoTitle`,
  `seoDescription`, and each block's `heading` / `content` from that saved translation.
- For entries with `entry.entry_template === null`, all locale tabs MUST continue to show
  `blocks: []` (the "No content blocks yet" empty state).
- The `EntryForm` save path MUST continue to submit `updateTranslation` only for locales whose
  `title` field is non-empty after trimming; untranslated locales pre-populated with `title: ''`
  MUST NOT be saved automatically.
- `handleTemplateChange` in `EntryForm` (new-entry flow) MUST continue to rebuild blocks for all
  active locales when the user selects a different template.

**Scope:**
All inputs where `isBugCondition` is false MUST be completely unaffected by this fix. This
includes:
- Locales with a saved translation (they get their data from the `Translation` row as before).
- Entries without any entry template (they produce `blocks: []` as before).
- The new-entry flow (no `entry.entry_template` is involved; `handleTemplateChange` handles it).

---

## Hypothesized Root Cause

Based on code analysis, the root cause is confirmed and isolated to a single logical error in
`mapEntryToFormValues`:

1. **Loop iterates only over translated locales**: The function builds `allLocales` exclusively
   from `entry.translations.map((t) => t.locale)`. There is a comment acknowledging this gap
   ("Also ensure we populate any standard locales even if not yet translated") but the fix was
   never applied — `allLocales` is identical to `translationLocales`.

2. **No active-locale parameter**: `mapEntryToFormValues` does not accept the list of active
   locales as an argument. The page component calls it as `mapEntryToFormValues(entry)` and then
   passes the result straight to `EntryForm`, so the form has no information about locales that
   lack a translation.

3. **enrichedLocales fallback is insufficient**: `EntryForm` has a reactive `enrichedLocales`
   computation that could in principle fall back to template blocks for missing locales, but it
   depends on the separate `templates` React Query result (not on `entry.entry_template`) and
   only fills in blocks if the template list has already loaded. This creates a race condition
   on first render and a permanent blank state when the query fails.

4. **No other component is responsible**: `buildDefaultLocales` in `EntryForm` is correct by
   design — it intentionally seeds any missing locale with an empty state, trusting that
   `defaultValues` already contains the correct block structure.

---

## Correctness Properties

Property 1: Bug Condition — Template blocks visible for untranslated locales

_For any_ `(entry, locale)` pair where `isBugCondition(entry, locale)` is true (entry has a
template and locale has no saved translation), the fixed `mapEntryToFormValues'(entry, activeLocales)`
SHALL produce a `locales[locale]` entry where:
- `locales[locale]` is not `undefined`,
- `locales[locale].blocks.length` equals `entry.entry_template.blocks.length`,
- `locales[locale].blocks` is sorted by `block.order` ascending,
- `locales[locale].title` is `''`,
- `locales[locale].slug` is `''`,
- `locales[locale].slugManuallyEdited` is `false`,
- each block's `content` is `null`,
- each block's `heading` equals the template's default heading for that locale if present,
  otherwise `''`.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation — Translated locale data is unchanged

_For any_ `(entry, locale)` pair where `isBugCondition(entry, locale)` is false (locale has a
saved translation OR entry has no template), the fixed `mapEntryToFormValues'` SHALL produce
exactly the same `locales[locale]` value as the original `mapEntryToFormValues`, preserving all
saved `title`, `slug`, `shortDescription`, block `heading`, and block `content` data.

**Validates: Requirements 3.1, 3.2**

---

## Fix Implementation

### Changes Required

**File**: `apps/admin/src/app/(dashboard)/entries/[id]/page.tsx`

**Function**: `mapEntryToFormValues`

**Specific Changes:**

1. **Add `activeLocales` parameter**: Change the function signature to
   `mapEntryToFormValues(entry: Entry, activeLocales: string[]): EntryFormValues`. This allows
   the page to pass in the full list of configured locales without the function needing to query
   the language store directly.

2. **Iterate over all active locales**: Replace the `allLocales` derivation:
   ```ts
   // Before (buggy):
   const translationLocales = (entry.translations ?? []).map((t) => t.locale);
   const allLocales = Array.from(new Set([...translationLocales]));

   // After (fixed):
   const translationLocales = (entry.translations ?? []).map((t) => t.locale);
   const allLocales = Array.from(new Set([...activeLocales, ...translationLocales]));
   ```
   Including `translationLocales` in the union ensures any locale that has a saved translation
   but is no longer in the active locale list is still processed (edge case: locale removed from
   settings after translations were saved).

3. **Block structure already correct**: The block-building loop inside `mapEntryToFormValues`
   already uses `entry.entry_template?.blocks ?? []` and handles the case where no translation
   exists (`t` is undefined when `entry.translations?.find(...)` returns nothing). No changes
   are needed inside the block-mapping logic.

4. **Update the call site in the page component**: The `EntryForm` render already uses the
   `useLanguages` hook indirectly through the form, but the page component needs access to
   `allLocales` before rendering the form. Use the `useLanguages` hook in `EntryEditPage` and
   pass `allLocales` to `mapEntryToFormValues`:
   ```ts
   // In EntryEditPage:
   const { allLocales } = useLanguages();
   // ...
   defaultValues={mapEntryToFormValues(entry, allLocales)}
   ```

5. **No changes to `EntryForm`**: `buildDefaultLocales`, `enrichedLocales`, and all other form
   internals remain untouched. The fix is entirely in the data-mapping layer.

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that
demonstrate the bug on unfixed code, then verify the fix works correctly and preserves
existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix.
Confirm that the root cause is `mapEntryToFormValues` iterating only over translated locales.

**Test Plan**: Write unit tests that call `mapEntryToFormValues` (or its fixed variant) with
an `Entry` fixture containing an `entry_template` but no translation for a given locale. Run
these tests against the original function to observe the `undefined` / missing key failure.

**Test Cases**:
1. **Untranslated locale, template with blocks** (fails on unfixed code): Call
   `mapEntryToFormValues(entry)` where `entry.entry_template` has 3 blocks and `entry.translations`
   contains only `en`. Assert `result.locales['pl']` is defined with 3 blocks — will fail because
   `locales['pl']` is absent.

2. **All locales untranslated except origin** (fails on unfixed code): Entry has 4 active locales;
   only `en` has a translation. Assert each non-English locale has `blocks.length === templateBlockCount`.

3. **Template with locale-specific default headings** (fails on unfixed code): Template has a
   block with `translations[blockId]['pl'].heading = 'Nagłówek'`. Assert `locales['pl'].blocks[0].heading`
   equals `'Nagłówek'` — fails because the Polish locale is never populated.

4. **Out-of-range locale not in active list** (may fail on unfixed code): Pass `activeLocales`
   that includes a locale absent from both translations and the template defaults. Assert the
   locale is present with empty blocks array when no template exists, or template blocks when
   template exists.

**Expected Counterexamples**:
- `result.locales['pl']` is `undefined` instead of a `LocaleTabState` with blocks.
- Possible causes confirmed: `mapEntryToFormValues` only iterates `entry.translations`, so any
  locale not present in that array is simply never added to the map.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces
the expected behavior.

**Pseudocode:**
```
FOR ALL (entry, locale) WHERE isBugCondition(entry, locale) DO
  activeLocales ← [locale, ...otherLocales]
  formValues ← mapEntryToFormValues'(entry, activeLocales)
  localeState ← formValues.locales[locale]
  ASSERT localeState IS NOT undefined
  ASSERT localeState.blocks.length = entry.entry_template.blocks.length
  ASSERT localeState.blocks sorted by block.order ascending
  ASSERT localeState.title = ''
  ASSERT localeState.slug = ''
  ASSERT localeState.slugManuallyEdited = false
  FOR ALL block IN localeState.blocks DO
    ASSERT block.content = null
    templateDefaultHeading ← entry.entry_template.translations[block.blockId]?.[locale]?.heading ?? ''
    ASSERT block.heading = templateDefaultHeading
  END FOR
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function
produces the same result as the original function.

**Pseudocode:**
```
FOR ALL (entry, locale) WHERE NOT isBugCondition(entry, locale) DO
  activeLocales ← localesThatInclude(locale)
  ASSERT mapEntryToFormValues(entry).locales[locale]
       = mapEntryToFormValues'(entry, activeLocales).locales[locale]
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many entry + translation combinations automatically.
- It catches edge cases such as partial metadata, null blocks maps, or multiple translated locales.
- It provides strong guarantees that translated locale data is unchanged for all non-buggy inputs.

**Test Plan**: Observe behavior on UNFIXED code for translated locales first to establish a
baseline, then write property-based tests that verify this baseline is preserved after the fix.

**Test Cases**:
1. **Translated locale data preserved**: For any locale in `entry.translations`, `title`, `slug`,
   `shortDescription`, and block `heading`/`content` values must be identical before and after
   the fix.
2. **No-template entry unchanged**: When `entry.entry_template` is null, all locale tabs continue
   to produce `blocks: []`.
3. **Extra translation locale**: If `entry.translations` contains a locale not in `activeLocales`,
   that locale's state is still included in the output (union logic in `allLocales`).

### Unit Tests

- Test `mapEntryToFormValues` with an entry that has a template and no Polish translation:
  assert `locales['pl']` is defined and `blocks.length` matches the template.
- Test `mapEntryToFormValues` with `entry.entry_template === null`: assert all locale tabs have
  `blocks: []`.
- Test `mapEntryToFormValues` for a translated locale: assert `title`, `slug`, and block content
  match the saved `Translation` row values, with template defaults used only for `heading` when
  the saved translation has no explicit heading.
- Test block ordering: assert `blocks` are sorted ascending by `order` regardless of input order.
- Test default heading fallback: when `entry.entry_template.translations[blockId][locale].heading`
  exists, it MUST be used as `heading`; when absent, `heading` MUST be `''`.

### Property-Based Tests

- **Fix property (Property 1)**: Generate random `Entry` values where `entry.entry_template` is
  non-null with 1–10 blocks and `entry.translations` does not include a given locale. Assert all
  conditions of Property 1 hold for the fixed function.
- **Preservation property (Property 2)**: Generate random `Entry` values where `entry.translations`
  includes at least one locale. Assert the fixed function produces identical `locales[locale]`
  state for every translated locale.
- **No-template preservation**: Generate random entries with `entry.entry_template = null`. Assert
  `blocks: []` for all locales in the output.

### Integration Tests

- Open the edit page for an entry with a template where only English is translated; navigate to
  the Polish tab and assert that block rows are rendered (not the "No content blocks yet" empty
  state).
- Verify that after loading, the Polish tab's block headings match the template's Polish-locale
  defaults where configured.
- Verify that saving from the Polish tab (after filling in a title) creates a new `Translation`
  row without affecting the English translation.
- Verify that the English tab continues to display its saved content after the fix is applied.
