# Implementation Plan

## Overview

This plan follows the exploratory bugfix workflow: explore the bug with property-based tests before fixing it, capture preservation behavior on unfixed code, then apply the surgical one-line fix to `mapEntryToFormValues` and validate both properties pass.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2"] },
    { "wave": 2, "tasks": ["3"] },
    { "wave": 3, "tasks": ["4"] }
  ]
}
```

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Template blocks missing for untranslated locales
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate that `mapEntryToFormValues` omits untranslated locales
  - **Scoped PBT Approach**: Scope the property to entries where `entry.entry_template` is non-null and `entry.translations` does not contain the target locale (e.g. `pl`)
  - Create test file at `apps/admin/src/app/(dashboard)/entries/[id]/page.test.ts`
  - Import `fast-check` (`fc`) and the (unexported) `mapEntryToFormValues` — export it for testing or extract it to a testable module if needed
  - Use `fc.record` / `fc.array` to generate entries with 1–10 template blocks and an `en`-only translation; assert that `result.locales['pl']` is defined and `result.locales['pl'].blocks.length` equals `entry.entry_template.blocks.length`
  - isBugCondition pseudocode: `entry.entry_template IS NOT NULL AND NOT EXISTS(t IN entry.translations WHERE t.locale = locale)`
  - Expected behavior pseudocode: `localeState.blocks.length = entry.entry_template.blocks.length`, `localeState.title = ''`, `localeState.slug = ''`
  - Run test on UNFIXED code: `pnpm test` in `apps/admin`
  - **EXPECTED OUTCOME**: Test FAILS — `result.locales['pl']` is `undefined` (confirms the bug)
  - Document counterexample found (e.g. `mapEntryToFormValues(entry)` where entry has 3 template blocks and only `en` translation → `locales['pl']` is `undefined` instead of `{ blocks: [3 items], title: '', slug: '' }`)
  - Mark task complete when test is written, run, and the failure is documented
  - _Requirements: 1.2, 2.1, 2.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Translated locale data is unchanged
  - **IMPORTANT**: Follow observation-first methodology — observe actual output of UNFIXED code first, then encode it as assertions
  - Observe: call `mapEntryToFormValues(entry)` where `entry.translations` contains `en` with `term`, `slug`, and block content; record the returned `locales['en']` values
  - Observe: call `mapEntryToFormValues(entry)` where `entry.entry_template` is `null`; confirm all locale tabs have `blocks: []`
  - Write property-based tests using `fast-check`:
    - **Preservation of translated locale data**: For any entry where `isBugCondition(entry, locale)` is false (locale has a saved translation OR entry has no template), assert that `locales[locale].title`, `locales[locale].slug`, `locales[locale].blocks[i].heading`, and `locales[locale].blocks[i].content` match the saved `Translation` row values — using the UNFIXED `mapEntryToFormValues` as the baseline oracle
    - **No-template preservation**: For any entry with `entry.entry_template = null`, assert every locale produces `blocks: []`
  - Run tests on UNFIXED code: `pnpm test` in `apps/admin`
  - **EXPECTED OUTCOME**: Tests PASS — confirms the baseline behavior to preserve after the fix
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2_

- [x] 3. Fix: include all active locales in `mapEntryToFormValues`

  - [x] 3.1 Export `mapEntryToFormValues` and update its signature
    - In `apps/admin/src/app/(dashboard)/entries/[id]/page.tsx`, export `mapEntryToFormValues` so it is importable in tests
    - Change the function signature from `mapEntryToFormValues(entry: Entry)` to `mapEntryToFormValues(entry: Entry, activeLocales: string[]): EntryFormValues`
    - _Bug_Condition: `isBugCondition(entry, locale)` where `entry.entry_template IS NOT NULL AND NOT EXISTS(t IN entry.translations WHERE t.locale = locale)`_
    - _Expected_Behavior: `localeState.blocks.length = entry.entry_template.blocks.length`, `localeState.title = ''`, `localeState.slug = ''`, `localeState.slugManuallyEdited = false`, each block `content = null`, each block `heading` = template default for locale or `''`_
    - _Preservation: For any locale with a saved translation row, `title`, `slug`, `shortDescription`, and block `heading`/`content` values MUST remain identical to the pre-fix output_
    - _Requirements: 2.2, 2.3, 2.4, 3.1, 3.2_

  - [x] 3.2 Fix `allLocales` derivation to include active locales
    - Replace:
      ```ts
      const allLocales = Array.from(new Set([...translationLocales]));
      ```
      with:
      ```ts
      const allLocales = Array.from(new Set([...activeLocales, ...translationLocales]));
      ```
    - Keeping `translationLocales` in the union preserves locales that have a saved translation but were subsequently removed from the active locale list (edge case: locale removed from settings after translations were saved)
    - _Bug_Condition: `allLocales` previously excluded any locale not in `entry.translations`_
    - _Requirements: 2.2, 2.4_

  - [x] 3.3 Update the call site in `EntryEditPage` to supply `activeLocales`
    - Add `import { useLanguages } from '@/hooks/useLanguages';` to the import block in `apps/admin/src/app/(dashboard)/entries/[id]/page.tsx`
    - Inside `EntryEditPage`, add: `const { allLocales } = useLanguages();`
    - Update the `defaultValues` prop: `defaultValues={mapEntryToFormValues(entry, allLocales)}`
    - _Requirements: 2.4_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Template blocks visible for untranslated locales
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior: `locales[locale]` is defined with `blocks.length === entry.entry_template.blocks.length`, `title === ''`, `slug === ''`
    - Run: `pnpm test` in `apps/admin`
    - **EXPECTED OUTCOME**: Test PASSES — confirms the bug is fixed
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Translated locale data is unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run: `pnpm test` in `apps/admin`
    - **EXPECTED OUTCOME**: Tests PASS — confirms no regressions in translated locale data or no-template entries
    - _Requirements: 3.1, 3.2_

- [x] 4. Checkpoint — Ensure all tests pass
  - Run `pnpm test` in `apps/admin` and confirm the full test suite passes with no failures
  - Verify TypeScript types compile cleanly: `pnpm typecheck` in `apps/admin`
  - Confirm no lint errors: `pnpm lint` in `apps/admin`
  - Ask the user if any questions arise before closing the task

## Notes

- Test file location: `apps/admin/src/app/(dashboard)/entries/[id]/page.test.ts`
- PBT library: `fast-check` (already installed at `^4.8.0`)
- Test runner: `vitest` — run with `pnpm test` in `apps/admin` (executes `vitest --run --passWithNoTests`)
- `mapEntryToFormValues` must be exported from the page file to be importable in the test file
- The fix is entirely contained in `apps/admin/src/app/(dashboard)/entries/[id]/page.tsx` — no other files need changes except adding the `useLanguages` import and call in `EntryEditPage`
- Task 1 tests MUST fail on unfixed code (that is the expected and desired outcome at that stage)
- Task 2 tests MUST pass on unfixed code (they establish the preservation baseline)
