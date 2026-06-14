# Implementation Plan: Multilingual Content Validation

## Overview

Replace the hard-coded English-only submit guard across all three editor forms with a locale-agnostic rule: at least one locale must have both its title/name and slug non-empty before any save action is permitted. The change is anchored in a new shared pure-function module (`lib/validation.ts`), a new `ValidationSummary` banner component, and targeted updates to the three editor forms.

## Tasks

- [x] 1. Create `lib/validation.ts` — pure validation utilities
  - [x] 1.1 Implement `LocaleEntry` interface, `hasAtLeastOneCompleteLocale`, `ValidationRule` type, `requireField`, and `requireBlockType`
    - Export `LocaleEntry` interface with optional `title`, optional `name`, and required `slug` fields
    - Implement `hasAtLeastOneCompleteLocale(locales: Record<string, LocaleEntry>): boolean` using `Object.values` iteration (not key order) — resolves primary label as `entry.title ?? entry.name ?? ''`
    - Export `ValidationRule<T>` as a type alias `(values: T) => string | null`
    - Implement `requireField<T>(fieldKey, message?)` factory returning a `ValidationRule<T>` that fails when `values[fieldKey]` is falsy
    - Implement `requireBlockType<T extends WithBlocks>(blockType, message?)` factory returning a `ValidationRule<T>` that fails when no block with matching `type` and `visible: true` exists in `values.blocks`
    - Both factories must accept an optional `message` parameter that overrides the default error string
    - File must have zero React/DOM imports — pure TypeScript only
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 8.1, 8.7, 8.8, 8.9_

  - [x]* 1.2 Write property tests for `hasAtLeastOneCompleteLocale` (Properties 1 & 2)
    - **Property 1: `hasAtLeastOneCompleteLocale` is an if-and-only-if condition** — for any generated locale record, the function returns `true` iff at least one entry has a non-empty (trimmed) primary label AND non-empty (trimmed) slug
    - **Property 2: `hasAtLeastOneCompleteLocale` is order-independent** — shuffling the key insertion order of a locale record produces the same boolean result
    - File: `apps/admin/src/__tests__/validation.property.test.ts`
    - Use `fc.dictionary` / `fc.record` arbitraries from fast-check; run with `vitest --run`
    - _Requirements: 1.2, 1.3, 1.5_

  - [x]* 1.3 Write property tests for `requireField` and `requireBlockType` (Properties 7, 8, 9 & 10)
    - **Property 7: `requireField` passes iff the field is truthy** — for any field key and values object, returns `null` when truthy, non-empty string when falsy
    - **Property 8: `requireField` uses caller-supplied message** — when message is provided and field is falsy, the returned string equals the supplied message exactly
    - **Property 9: `requireBlockType` passes iff a visible block of that type exists**
    - **Property 10: `requireBlockType` uses caller-supplied message** — when message is provided and no matching visible block exists, the returned string equals the supplied message
    - File: `apps/admin/src/__tests__/validation.property.test.ts`
    - _Requirements: 8.7, 8.8, 8.9_

- [x] 2. Create `ValidationSummary` component
  - [x] 2.1 Implement `apps/admin/src/components/ui/validation-summary.tsx`
    - Define `ValidationSummaryProps` with `errors: string[]` and optional `className`
    - Return `null` when `errors.length === 0`
    - Render an amber-bordered card containing an unordered list of error messages when non-empty
    - Use existing shadcn/ui and Tailwind classes; visually distinct from API toast errors (amber tones, not red)
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.6_

- [x] 3. Update `article-editor-form.tsx`
  - [x] 3.1 Add `validationRules` prop and replace submit-disabled logic
    - Add `validationRules?: ValidationRule<ArticleEditorFormValues>[]` to `ArticleEditorFormProps`
    - Import `hasAtLeastOneCompleteLocale` and `ValidationRule` from `@/lib/validation`
    - Replace `const isSubmitDisabled = isSubmitting || !locales.en.title.trim()` with a `useMemo`-derived `allErrors: string[]` (locale completeness error + rule errors) and `isSubmitDisabled = isSubmitting || allErrors.length > 0`
    - Apply `isSubmitDisabled` to **both** the Publish button and the Save Draft button (Save Draft currently only gates on `isSubmitting`)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 7.1, 7.3, 7.5, 8.2, 8.4, 8.5, 8.6, 8.10_

  - [x] 3.2 Update tab indicators and add inline slug helper
    - In the `TabsTrigger` map, replace `hasTitle` check with `isComplete = title.trim().length > 0 && slug.trim().length > 0`
    - Inside `LocaleTabContent`, add a conditional `<p className="text-xs text-amber-600">Add a slug to make this locale complete.</p>` beneath the slug `Input` — visible when `state.title.trim() && !state.slug.trim()`
    - _Requirements: 2.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 3.3 Integrate `ValidationSummary` and disabled-button tooltip
    - Import and render `<ValidationSummary errors={allErrors} />` between the `TabsList` and the first `TabsContent`
    - Wrap the Publish button in a shadcn `<Tooltip>` (secondary affordance) when `isSubmitDisabled && allErrors.length > 0` — tooltip content mirrors the locale completeness message or first error
    - _Requirements: 2.5, 9.1, 9.2, 9.3, 9.4, 9.6_

- [x] 4. Checkpoint — article form
  - Ensure all tests pass and the article form compiles cleanly. Run `vitest --run` and check for TypeScript errors. Ask the user if anything is unclear before proceeding.

- [x] 5. Update `entry-form.tsx`
  - [x] 5.1 Add `validationRules` prop and replace submit-disabled logic
    - Add `validationRules?: ValidationRule<EntryFormValues>[]` to `EntryFormProps`
    - Import `hasAtLeastOneCompleteLocale` and `ValidationRule` from `@/lib/validation`
    - Replace `const isSubmitDisabled = isSubmitting || !locales.en.title.trim()` with `useMemo`-derived `allErrors` and `isSubmitDisabled = isSubmitting || allErrors.length > 0`
    - Apply `isSubmitDisabled` to **both** the Publish button and the Save Draft button (Save Draft currently only gates on `isSubmitting`)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 7.2, 7.4, 7.6, 8.3, 8.4, 8.5, 8.6, 8.10_

  - [x] 5.2 Update tab indicators and add inline slug helper
    - In the `TabsTrigger` map, replace `hasTitle` check with `isComplete = title.trim().length > 0 && slug.trim().length > 0`
    - Inside `LocaleTabContent`, add the inline slug helper `<p>` beneath the slug `Input` — same condition as article form
    - _Requirements: 3.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 5.3 Integrate `ValidationSummary` and disabled-button tooltip
    - Import and render `<ValidationSummary errors={allErrors} />` between the `TabsList` and the first `TabsContent`
    - Wrap the Publish button in a shadcn `<Tooltip>` when `isSubmitDisabled && allErrors.length > 0`
    - _Requirements: 3.5, 9.1, 9.2, 9.3, 9.4, 9.6_

- [x] 6. Update `category-form.tsx`
  - [x] 6.1 Replace submit-disabled logic (no `validationRules` prop needed)
    - Import `hasAtLeastOneCompleteLocale` from `@/lib/validation`
    - Replace `isSubmitDisabled = isSubmitting || !locales.en.name.trim() || !type` with `const localeValid = hasAtLeastOneCompleteLocale(locales); const isSubmitDisabled = isSubmitting || !localeValid || !type`
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.2 Update tab indicator and add inline slug helper
    - Replace `isLocaleTranslated` to check both `name` and `slug`: `state.name.trim().length > 0 && state.slug.trim().length > 0`
    - Inside `LocaleTabContent`, add inline slug helper `<p className="text-xs text-amber-600">Add a slug to make this locale complete.</p>` beneath the slug `Input` — visible when `state.name.trim() && !state.slug.trim()`
    - _Requirements: 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 6.3 Integrate `ValidationSummary` and disabled-button tooltip
    - Derive `localeErrors: string[]` inline: `hasAtLeastOneCompleteLocale(locales) ? [] : ['At least one language must have both a name and slug filled.']`
    - Render `<ValidationSummary errors={localeErrors} />` between `TabsList` and the first `TabsContent`
    - Wrap the Save button in a shadcn `<Tooltip>` when `isSubmitDisabled && localeErrors.length > 0`
    - _Requirements: 4.4, 9.1, 9.2, 9.3, 9.4, 9.6_

- [x] 7. Checkpoint — all three forms
  - Ensure all tests pass and all three form files compile without TypeScript errors. Run `vitest --run`. Ask the user if questions arise.

- [x] 8. Write component property tests
  - [x]* 8.1 Write property tests for tab indicator and inline slug helper (Properties 3 & 4)
    - **Property 3: Tab indicator color matches locale completeness** — for any generated locale state, the tab dot has `bg-green-500` iff both primary label and slug are non-empty after trim; test across all three form components
    - **Property 4: Inline slug helper visibility matches title-without-slug condition** — for any locale state, the helper `<p>` is in the DOM iff primary label is non-empty and slug is empty after trim; test across all three forms
    - File: `apps/admin/src/__tests__/forms.property.test.ts`
    - Mock `RichTextEditor`, `CoverImageUpload`, and other heavy sub-components at the module level
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3_

  - [x]* 8.2 Write property tests for button disabled state (Properties 5 & 6)
    - **Property 5: Submit buttons disabled exactly when no locale is complete (and not submitting)** — for any Article/Entry form state where `isSubmitting=false` and `validationRules` is empty/omitted, both Publish and Save Draft are disabled iff `hasAtLeastOneCompleteLocale(locales)` is `false`
    - **Property 6: `isSubmitting=true` disables all save actions regardless of locale state** — for any locale state, when `isSubmitting=true`, both buttons are disabled
    - File: `apps/admin/src/__tests__/forms.property.test.ts`
    - _Requirements: 2.2, 2.3, 2.4, 3.2, 3.3, 3.4, 7.1, 7.2, 7.3, 7.4_

  - [x]* 8.3 Write property tests for `ValidationSummary` rendering (Properties 11 & 12)
    - **Property 11: `ValidationSummary` renders all failing rule messages** — for any non-empty list of failing `ValidationRule`s, the rendered form contains one visible list item per failing rule with no omissions
    - **Property 12: `ValidationSummary` is absent when all rules pass and locale is complete** — for any form state where `hasAtLeastOneCompleteLocale` returns `true` and all rules return `null`, the summary element is not in the DOM
    - File: `apps/admin/src/__tests__/forms.property.test.ts`
    - _Requirements: 9.1, 9.3, 9.5_

- [x] 9. Final checkpoint — full test suite
  - Run `vitest --run` and confirm all tests pass (unit + property). Check TypeScript compilation for all modified files. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- The design document is the authoritative reference for all implementation details; implementation tasks intentionally avoid duplicating design content
- `CategoryForm` does **not** receive a `validationRules` prop — only `ArticleEditorForm` and `EntryForm` need it per Requirements 8.2–8.3
- The `isSubmitting` guard must remain the **first** clause in `isSubmitDisabled` to preserve existing loading-state behavior (Requirements 7.3, 7.4)
- `ValidationSummary` is the primary error surface; the disabled-button tooltip is a secondary hover affordance
- Property tests belong in `apps/admin/src/__tests__/validation.property.test.ts` (pure-function properties) and `apps/admin/src/__tests__/forms.property.test.ts` (component properties)
- Run tests with `vitest --run` (single-pass, not watch mode)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1"] },
    { "id": 2, "tasks": ["3.1", "5.1", "6.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "5.2", "5.3", "6.2", "6.3"] },
    { "id": 4, "tasks": ["8.1", "8.2", "8.3"] }
  ]
}
```
