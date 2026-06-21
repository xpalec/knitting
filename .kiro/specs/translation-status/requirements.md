# Requirements Document

## Introduction

This feature makes three focused changes to the admin entry editor:

1. **Translation status values** — replace the existing `draft | reviewed | published` union on `Translation.status` and `UpdateTranslationPayload.status` with `draft | review | ready`, aligning the canonical status vocabulary across the data model and API layer.
2. **Synonyms optional** — remove the required-field asterisk from the Synonyms `ChipInput` label and drop any associated validation, making the field fully optional while keeping it visible.
3. **Disabled Preview button** — render a visually-disabled `Preview` button immediately before the `Close` button in the entry editor action bar, with no click handler or tooltip.

No changes to the entry-level `EntryStatus` type, SEO fields, or any other form behaviour are in scope.

## Glossary

- **Translation** — the TypeScript interface in `apps/admin/src/lib/api/entries.ts` that represents a single locale's data for an entry, including its `status` field.
- **UpdateTranslationPayload** — the TypeScript interface in the same file used when calling `entriesApi.updateTranslation`, which also carries an optional `status` field.
- **TranslationStatus** — the union type for a `Translation`'s status. Current value: `"draft" | "reviewed" | "published"`. New value after this feature: `"draft" | "review" | "ready"`.
- **EntryStatus** — the separate entry-level status type (`"draft" | "review" | "published" | "deprecated"`). This type is **not** changed by this feature.
- **ChipInput** — the reusable inline-tag input component defined inside `entry-form.tsx` that renders a label, a chip list, and a text input.
- **Entry editor action bar** — the `<div>` containing `StatusPill`, `Actions` dropdown, `Close` button, and `Save`/`Publish` button at the top of `EntryForm`.
- **Preview button** — a new `<Button>` element with `disabled` prop set, added to the entry editor action bar.

## Requirements

### Requirement 1 — Translation Status Type Replacement

**User Story:** As a developer, I want the `Translation.status` field to use the values `draft | review | ready`, so that the translation workflow vocabulary is consistent with the rest of the application.

#### Acceptance Criteria

1. THE `Translation` interface SHALL define `status` as the union type `"draft" | "review" | "ready"`.
2. THE `UpdateTranslationPayload` interface SHALL define the optional `status` field as the union type `"draft" | "review" | "ready"`.
3. THE codebase SHALL contain no remaining references to the literal string `"reviewed"` or `"published"` as a valid `Translation.status` value after the change.
4. WHEN TypeScript compilation runs, THE admin application SHALL produce no type errors related to the `Translation.status` or `UpdateTranslationPayload.status` fields.

---

### Requirement 2 — Synonyms Field Made Optional

**User Story:** As a content editor, I want the Synonyms field to be optional, so that I can save an entry translation without being required to enter any synonyms.

#### Acceptance Criteria

1. THE `ChipInput` component call for the Synonyms field in `LocaleTabContent` SHALL render the label `"Synonyms"` without a required-indicator asterisk (`*`).
2. THE `ChipInput` component SHALL NOT render `<span className="text-red-500">*</span>` inside its label when used for the Synonyms field.
3. WHEN an entry form is submitted with an empty synonyms array for one or more locales, THE `EntryForm` SHALL accept the submission without displaying a validation error related to synonyms.
4. THE Synonyms `ChipInput` field SHALL remain visible in the locale tab layout after the asterisk is removed.

---

### Requirement 3 — Disabled Preview Button in Entry Editor Action Bar

**User Story:** As a product stakeholder, I want a visually-disabled Preview button present in the entry editor, so that users can see the upcoming Preview affordance without it being functional yet.

#### Acceptance Criteria

1. THE entry editor action bar SHALL render a `<Button>` element with the label `"Preview"` immediately before the `Close` button.
2. THE `Preview` button SHALL have the `disabled` prop set to `true` at all times.
3. THE `Preview` button SHALL NOT have an `onClick` handler attached.
4. WHEN the entry editor action bar is rendered, THE `Preview` button SHALL appear between the `Actions` dropdown and the `Close` button in DOM order.
5. IF the `onCancel` prop is not provided to `EntryForm`, THEN THE `Preview` button SHALL still be rendered in the action bar.
