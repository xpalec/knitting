# Implementation Plan: translation-status

## Overview

Three surgical changes to two files in the admin app. Each change is independent and can be applied in any order, though updating the type alias first avoids transient TypeScript errors in the form file.

## Tasks

- [x] 1. Replace `Translation.status` union type in `entries.ts`
  - [x] 1.1 Add `TranslationStatus` type alias and update `Translation` and `UpdateTranslationPayload`
    - In `apps/admin/src/lib/api/entries.ts`, add `export type TranslationStatus = "draft" | "review" | "ready";`
    - Change `Translation.status` from `"draft" | "reviewed" | "published"` to `TranslationStatus`
    - Change `UpdateTranslationPayload.status?` from `"draft" | "reviewed" | "published"` to `TranslationStatus`
    - Do NOT touch `EntryStatus` (`"draft" | "review" | "published" | "deprecated"`)
    - _Requirements: 1.1, 1.2_

  - [ ]* 1.2 Write property test for `TranslationStatus` exhaustiveness
    - **Property 1 (indirect): Empty synonyms never block form submission**
    - Verify no call site in `entries.ts` or its consumers references the literal `"reviewed"` or `"published"` on a `Translation.status` field
    - Run `tsc --noEmit` in `apps/admin` and confirm zero type errors related to `Translation.status` or `UpdateTranslationPayload.status`
    - _Requirements: 1.3, 1.4_

- [x] 2. Remove required-indicator asterisk from `ChipInput` in `entry-form.tsx`
  - [x] 2.1 Remove the `<span className="text-red-500">*</span>` from `ChipInput`'s label
    - In `apps/admin/src/components/entries/entry-form.tsx`, locate the `ChipInput` function
    - Change the label from `{label} <span className="text-red-500">*</span>` to `{label}` (remove the span entirely)
    - Confirm the `ChipInput` component has no `required` prop and the `allErrors` computation does not reference synonyms
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.2 Write property test for synonyms optional submission
    - **Property 1: Empty synonyms never block form submission**
    - **Validates: Requirements 2.3**
    - Using a React Testing Library + Vitest unit test, render `EntryForm` with a valid locale (title + slug filled) and synonyms set to `[]`
    - Assert that `allErrors` does not include any synonyms-related message and the Save button is enabled
    - Also verify the `ChipInput` label element does not contain `*`
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 3. Add disabled Preview button to the `EntryForm` action bar
  - [x] 3.1 Insert `<Button disabled>Preview</Button>` before the `Close` button in `entry-form.tsx`
    - In `apps/admin/src/components/entries/entry-form.tsx`, locate the action bar `<div>` inside `EntryForm` (after the `Actions` `DropdownMenu`, before the `{onCancel && ...}` block)
    - Add the following button unconditionally (outside any conditional block):
      ```tsx
      <Button variant="outline" type="button" disabled>
        Preview
      </Button>
      ```
    - Ensure it appears between the `Actions` dropdown and the `{onCancel && ...}` Close button in DOM order
    - No `onClick`, no tooltip, `variant="outline"` to match surrounding buttons
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 3.2 Write property test for Preview button invariant
    - **Property 2: Preview button is always rendered and always disabled**
    - **Validates: Requirements 3.2, 3.5**
    - Using React Testing Library + Vitest, render `EntryForm` twice: once with `onCancel` provided and once without
    - In both renders, assert a button with text `"Preview"` exists in the DOM and `button.disabled === true`
    - Assert no `onClick` handler is attached (i.e. `getByRole('button', { name: 'Preview' }).onclick === null`)
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 4. Checkpoint — verify TypeScript compiles cleanly
  - Run `pnpm --filter admin typecheck` (or `tsc --noEmit` in `apps/admin`)
  - Confirm zero errors related to `Translation.status`, `UpdateTranslationPayload.status`, or the new button
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster implementation
- Tasks 1, 2, and 3 are independent — they can be executed in any order or in parallel
- The `EntryStatus` type must not be changed; only `Translation.status` and `UpdateTranslationPayload.status` are affected
- The `ChipInput` component is only used for Synonyms in `entry-form.tsx`, so removing the asterisk there is the complete change — no other call sites exist
- The Preview button requires no new imports; `Button` is already imported in `entry-form.tsx`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "3.2"] }
  ]
}
```
