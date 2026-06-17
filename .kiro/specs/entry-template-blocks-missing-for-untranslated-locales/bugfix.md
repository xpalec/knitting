# Bugfix Requirements Document

## Introduction

When editing an existing entry that has an entry template selected, the content block rows are visible in the origin-language locale tab (English) but are absent in every other locale tab (e.g. Polish) that has no saved `Translation` row yet.

This happens because `mapEntryToFormValues` in `apps/admin/src/app/(dashboard)/entries/[id]/page.tsx` only builds `locales[locale]` for locales that already exist in `entry.translations`. If Polish has never been saved, there is no `Translation` for `pl`, so `locales['pl']` is never populated. When `EntryForm` initialises with these `defaultValues`, `buildDefaultLocales()` creates an empty `LocaleTabState` for `pl` (no blocks). The reactive `enrichedLocales` fallback in the form only fills blocks when `templates` is already loaded, and it does not use the `entry.entry_template` data embedded in the entry response — so there is a visible gap on first render and on any locale that has no saved translation.

The fix must ensure that every active locale tab — whether or not a translation has been saved — shows the template's content block rows so translators can fill them in.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an entry has an entry template and the user navigates to a locale tab (e.g. Polish) that has no saved `Translation` row in `entry.translations` THEN the system SHALL show zero content block rows in that tab's content-blocks section

1.2 WHEN `mapEntryToFormValues` processes an entry whose `entry.translations` array does not include a given active locale THEN the system SHALL omit that locale key from the returned `defaultValues.locales` object, producing an `undefined` value for that key

1.3 WHEN `EntryForm` initialises from `defaultValues.locales` that is missing a locale key THEN `buildDefaultLocales` SHALL produce an empty `LocaleTabState` for that locale with `blocks: []`

1.4a WHEN the separate `templates` query has not yet resolved at the time of the first render THEN the `enrichedLocales` fallback SHALL be unable to populate blocks for any locale missing from `locales` state, resulting in a block-less tab on first render

1.4b WHEN the `templates` query fails or returns no matching template THEN the `enrichedLocales` fallback SHALL permanently produce no blocks for untranslated locale tabs, even after re-renders

### Expected Behavior (Correct)

2.1 WHEN an entry has an entry template and the user navigates to any active locale tab THEN the system SHALL display one `BlockRow` for each block slot in `entry.entry_template.blocks`, sorted by `block.order`, regardless of whether a `Translation` row exists for that locale

2.2 WHEN `mapEntryToFormValues` processes an entry where `entry.entry_template` is non-null and has at least one block THEN the system SHALL build a `locales[locale]` entry for every locale passed to the function — not only for locales present in `entry.translations`

2.3 WHEN `mapEntryToFormValues` builds a locale entry for a locale with no saved translation THEN the system SHALL set:
- `blocks` to the full ordered list of `BlockEditorState` objects derived from `entry.entry_template.blocks`
- `heading` for each block to the locale-appropriate default from `entry.entry_template.translations[blockId][locale].heading` if present, otherwise `''`
- `content` for each block to `null`
- `title`, `slug`, and `shortDescription` to `''`
- `slugManuallyEdited` to `false`

2.4 WHEN `mapEntryToFormValues` is called, it SHALL accept the list of active locales as a parameter and iterate over all of them, using `entry.entry_template` data that is already embedded in the entry API response — without waiting for the separate `templates` query to resolve

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `mapEntryToFormValues` processes a locale for which a `Translation` row exists in `entry.translations` THEN the system SHALL CONTINUE TO populate `title` from `t.term`, `slug` from `t.slug`, `shortDescription` from `t.metadata.definition_short`, and each block's `heading` and `content` from `t.blocks[blockId]` — taking precedence over template defaults

3.2 WHEN an entry has no entry template (`entry.entry_template` is null or undefined) THEN the system SHALL CONTINUE TO produce `blocks: []` for all locale tabs, showing the "No content blocks yet" empty state

3.3 WHEN a translator edits block `content` or `heading` in one locale tab and then switches to another locale tab THEN the system SHALL CONTINUE TO show that other locale's blocks unchanged

3.4 WHEN the user clicks Save THEN the system SHALL CONTINUE TO submit `updateTranslation` only for locales whose `title` field is non-empty after trimming, leaving locales with no title unsaved

3.5 WHEN the user changes the entry template via the sidebar combobox (on a new, unsaved entry) THEN `handleTemplateChange` SHALL CONTINUE TO rebuild `blocks` for all active locales from the newly selected template, replacing any prior block state

---

## Bug Condition

**Bug Condition Function:**

```pascal
FUNCTION isBugCondition(entry, locale)
  INPUT: entry of type Entry, locale of type string
  OUTPUT: boolean

  RETURN entry.entry_template IS NOT NULL
     AND NOT EXISTS(t IN entry.translations WHERE t.locale = locale)
END FUNCTION
```

**Property: Fix Checking**

```pascal
FOR ALL (entry, locale) WHERE isBugCondition(entry, locale) DO
  formValues ← mapEntryToFormValues'(entry)
  localeState ← formValues.locales[locale]
  ASSERT localeState IS NOT undefined
  ASSERT localeState.blocks.length = entry.entry_template.blocks.length
  ASSERT localeState.title = ''
  ASSERT localeState.slug = ''
END FOR
```

**Property: Preservation Checking**

```pascal
FOR ALL (entry, locale) WHERE NOT isBugCondition(entry, locale) DO
  ASSERT mapEntryToFormValues(entry).locales[locale]
       = mapEntryToFormValues'(entry).locales[locale]
END FOR
```
