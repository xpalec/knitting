# Requirements Document

## Introduction

The admin application manages multilingual content entities — Articles, Entries, and Categories — each of which has a form editor with language tabs (locales such as EN, FR, DE, PL, NO). Every locale tab exposes at minimum a title/name field and a slug field.

Currently, save/publish buttons across all three editors are gated on `locales.en.title.trim()` (or `locales.en.name.trim()` for categories), which is incorrect: it forces the English locale and ignores the slug. This feature replaces that check with a locale-agnostic validation rule: **at least one locale must have both its title/name and slug fields non-empty** before the user may save or publish.

The feature also adds complementary UX signals: per-locale tab indicators reflect whether a locale is "complete" (has both title and slug), inline helper text nudges the author when a title exists but the slug is empty, and a clear banner or tooltip explains why the action buttons are disabled.

## Glossary

- **Locale**: A language/region code supported by an editor form (e.g., `en`, `fr`, `de`, `pl`, `no`). The set of supported locales may differ per entity type.
- **Complete Locale**: A locale tab whose title/name field AND slug field are both non-empty after trimming whitespace.
- **Validation_Utility**: A shared pure function (or module) that determines whether a given set of locale states satisfies the "at least one complete locale" invariant.
- **ValidationRule**: A discrete, named validation check that can be evaluated against the current form values and returns either `null` (passing) or an error message string (failing).
- **ValidationRule_Registry**: A collection of ValidationRules configured per editor instance, evaluated at submit time to produce a list of errors.
- **ArticleEditorForm**: The React component at `apps/admin/src/components/articles/article-editor-form.tsx` that renders the article editor.
- **EntryForm**: The React component at `apps/admin/src/components/entries/entry-form.tsx` that renders the entry editor.
- **CategoryForm**: The React component at `apps/admin/src/components/categories/category-form.tsx` that renders the category editor.
- **Tab_Indicator**: The small colored dot rendered inside each locale tab trigger that communicates the completion state of that locale.
- **Save_Draft_Button**: The "Save draft" action button present in ArticleEditorForm and EntryForm.
- **Publish_Button**: The "Publish" action button present in ArticleEditorForm and EntryForm (labeled "Save" in CategoryForm).
- **Inline_Slug_Helper**: A short helper message rendered beneath the slug input field when a title is present but the slug is empty.
- **Required_Field_Rule**: A built-in ValidationRule that checks whether a specific top-level field (e.g., `category_id`) is non-empty.
- **Required_Block_Rule**: A built-in ValidationRule that checks whether at least one content block of a specified type is present and visible in the blocks list.

---

## Requirements

### Requirement 1: Shared Locale Validation Logic

**User Story:** As a developer, I want a single shared utility for the "at least one complete locale" validation, so that all three editor forms apply the rule identically and future editors can adopt it without duplication.

#### Acceptance Criteria

1. THE Validation_Utility SHALL export a pure function `hasAtLeastOneCompleteLocale` that accepts a record mapping locale keys to objects containing at minimum a title/name string and a slug string.
2. WHEN `hasAtLeastOneCompleteLocale` is called with a locale record, THE Validation_Utility SHALL return `true` if and only if at least one locale has both its title/name field and its slug field non-empty after trimming whitespace.
3. WHEN `hasAtLeastOneCompleteLocale` is called with a locale record where every locale has an empty title or an empty slug, THE Validation_Utility SHALL return `false`.
4. THE Validation_Utility SHALL be implementation-free (no React, no DOM, no side effects) so that it can be unit-tested in isolation.
5. FOR ALL locale records `r`, `hasAtLeastOneCompleteLocale(r)` SHALL produce the same result regardless of the iteration order of the locale keys (order independence).

---

### Requirement 2: Article Editor Validation

**User Story:** As a content author, I want the Article editor to let me save or publish an article as long as I have filled in both the title and slug in any language, so that I am not forced to use English.

#### Acceptance Criteria

1. WHEN the ArticleEditorForm renders, THE ArticleEditorForm SHALL compute the `isSubmitDisabled` flag using `hasAtLeastOneCompleteLocale` applied to all locale states (replacing the current `!locales.en.title.trim()` check).
2. WHILE no locale has both title and slug filled, THE ArticleEditorForm SHALL disable the Publish_Button.
3. WHILE no locale has both title and slug filled, THE ArticleEditorForm SHALL disable the Save_Draft_Button.
4. WHEN at least one locale has both title and slug filled, THE ArticleEditorForm SHALL enable both the Publish_Button and the Save_Draft_Button.
5. IF the Publish_Button is disabled, THEN THE ArticleEditorForm SHALL display a tooltip or inline message explaining that at least one locale must have both title and slug filled before saving.

---

### Requirement 3: Entry Editor Validation

**User Story:** As a content author, I want the Entry editor to let me save or publish an entry as long as I have filled in both the title and slug in any language, so that I am not forced to use English.

#### Acceptance Criteria

1. WHEN the EntryForm renders, THE EntryForm SHALL compute the `isSubmitDisabled` flag using `hasAtLeastOneCompleteLocale` applied to all locale states (replacing the current `!locales.en.title.trim()` check).
2. WHILE no locale has both title and slug filled, THE EntryForm SHALL disable the Publish_Button.
3. WHILE no locale has both title and slug filled, THE EntryForm SHALL disable the Save_Draft_Button.
4. WHEN at least one locale has both title and slug filled, THE EntryForm SHALL enable both the Publish_Button and the Save_Draft_Button.
5. IF the Publish_Button is disabled, THEN THE EntryForm SHALL display a tooltip or inline message explaining that at least one locale must have both title and slug filled before saving.

---

### Requirement 4: Category Editor Validation

**User Story:** As a content author, I want the Category editor to let me save a category as long as I have filled in both the name and slug in any language, so that I am not forced to use English.

#### Acceptance Criteria

1. WHEN the CategoryForm renders, THE CategoryForm SHALL compute the `isSubmitDisabled` flag using `hasAtLeastOneCompleteLocale` applied to all locale states (replacing the current `!locales.en.name.trim()` check, noting that CategoryForm uses `name` instead of `title`).
2. WHILE no locale has both name and slug filled, THE CategoryForm SHALL disable the Save button (the primary action button in CategoryForm).
3. WHEN at least one locale has both name and slug filled, THE CategoryForm SHALL enable the Save button (subject to the existing `!type` condition remaining in force).
4. IF the Save button is disabled due to missing locale content, THEN THE CategoryForm SHALL display a tooltip or inline message explaining that at least one locale must have both name and slug filled before saving.

---

### Requirement 5: Per-Locale Tab Indicators

**User Story:** As a content author, I want the colored dot on each locale tab to reflect whether that locale is complete (has both title/name and slug), so that I can see at a glance which locales still need attention.

#### Acceptance Criteria

1. WHEN a locale tab's title/name AND slug are both non-empty, THE Tab_Indicator for that locale SHALL be rendered with the green (`bg-green-500`) color class.
2. WHEN a locale tab's title/name OR slug is empty, THE Tab_Indicator for that locale SHALL be rendered without the green color (transparent or neutral), signaling the locale is incomplete.
3. THE ArticleEditorForm, EntryForm, and CategoryForm SHALL each apply this updated Tab_Indicator logic (replacing the existing check that only tests for a non-empty title).
4. WHEN the user fills in a slug for a locale that already has a title, THE Tab_Indicator for that locale SHALL update immediately to green without requiring a form submission.
5. WHEN the user clears either the title or the slug of a previously complete locale, THE Tab_Indicator for that locale SHALL revert to the incomplete (non-green) state immediately.

---

### Requirement 6: Inline Slug Helper Message

**User Story:** As a content author, I want a helpful nudge when I have typed a title but left the slug empty, so that I know exactly which field is missing before trying to save.

#### Acceptance Criteria

1. WHEN a locale's title/name is non-empty AND the locale's slug is empty, THE Inline_Slug_Helper SHALL be visible beneath the slug input for that locale.
2. WHEN a locale's slug is non-empty, THE Inline_Slug_Helper SHALL NOT be rendered for that locale (it disappears as soon as the slug has a value).
3. WHEN a locale's title/name is empty, THE Inline_Slug_Helper SHALL NOT be rendered for that locale (the helper only appears after a title has been entered).
4. THE Inline_Slug_Helper message SHALL instruct the author to fill in the slug field (e.g., "Add a slug to make this locale complete").
5. THE ArticleEditorForm, EntryForm, and CategoryForm SHALL each render the Inline_Slug_Helper according to the above rules.

---

### Requirement 7: Validation State Consistency Across Save Actions

**User Story:** As a content author, I want both "Save draft" and "Publish" to enforce the same locale completeness rule, so that incomplete content cannot be persisted in any status.

#### Acceptance Criteria

1. THE ArticleEditorForm SHALL apply the `hasAtLeastOneCompleteLocale` check to both the Publish_Button and the Save_Draft_Button so that neither action can be invoked when no complete locale exists.
2. THE EntryForm SHALL apply the `hasAtLeastOneCompleteLocale` check to both the Publish_Button and the Save_Draft_Button so that neither action can be invoked when no complete locale exists.
3. WHEN the `isSubmitting` flag is `true`, THE ArticleEditorForm SHALL disable both buttons regardless of locale completeness (existing behavior retained).
4. WHEN the `isSubmitting` flag is `true`, THE EntryForm SHALL disable both buttons regardless of locale completeness (existing behavior retained).
5. IF the author attempts to invoke a disabled save action via keyboard or programmatic means, THEN THE ArticleEditorForm SHALL ignore the action without throwing an error.
6. IF the author attempts to invoke a disabled save action via keyboard or programmatic means, THEN THE EntryForm SHALL ignore the action without throwing an error.

---

### Requirement 8: Extensible Validation Rule System

**User Story:** As a developer, I want a composable validation rule system for editor forms, so that I can declare which fields are required (e.g., category, required content blocks) per editor instance without modifying form internals.

#### Acceptance Criteria

1. THE Validation_Utility SHALL export a `ValidationRule` type: a pure function with the signature `(values: FormValues) => string | null`, where returning `null` means the rule passes and returning a string means it fails with that message.
2. THE ArticleEditorFormProps interface SHALL accept an optional `validationRules?: ValidationRule[]` prop that the parent page can populate.
3. THE EntryForm props interface SHALL accept an optional `validationRules?: ValidationRule[]` prop that the parent page can populate.
4. WHEN `validationRules` is provided, THE editor form SHALL evaluate all rules against the current form values before allowing a save or publish action.
5. WHEN any ValidationRule returns a non-null string, THE editor form SHALL treat the form as invalid, disable the save/publish buttons, and surface the error message(s) to the author.
6. WHEN all ValidationRules return `null` AND at least one locale is complete, THE editor form SHALL treat the form as valid and enable the save/publish buttons.
7. THE Validation_Utility SHALL export a built-in `requireField(fieldKey: string, message?: string): ValidationRule` factory that produces a rule failing when `values[fieldKey]` is falsy (empty string, null, or undefined).
8. THE Validation_Utility SHALL export a built-in `requireBlockType(blockType: string, message?: string): ValidationRule` factory that produces a rule failing when no block with the given `type` and `visible: true` exists in `values.blocks`.
9. THE built-in rule factories SHALL accept an optional `message` parameter that overrides the default error message, giving callers control over copy without touching form internals.
10. WHEN no `validationRules` prop is provided, THE editor form SHALL behave exactly as specified in Requirements 2–7 (no regression).

---

### Requirement 9: Validation Error Display

**User Story:** As a content author, I want to see a clear list of what is blocking me from saving, so that I can fix all issues in one pass rather than discovering them one by one.

#### Acceptance Criteria

1. WHEN one or more ValidationRules fail, THE editor form SHALL render a validation summary — a visible, non-modal UI element (e.g., an inline banner near the action buttons) listing each failing rule's error message.
2. THE validation summary SHALL update reactively as the author edits the form, removing resolved errors in real time.
3. THE validation summary SHALL NOT be rendered when all ValidationRules pass and at least one locale is complete.
4. THE locale-completeness error ("At least one language must have both a title and slug") SHALL be included in the validation summary using the same mechanism as other ValidationRule errors, rather than a separate ad-hoc UI treatment.
5. IF multiple rules are failing simultaneously, THE validation summary SHALL display all failing messages, not just the first one.
6. THE validation summary SHALL be visually distinct from general form errors (e.g., API errors shown via toast) so the author can distinguish blocking validation from network failures.
