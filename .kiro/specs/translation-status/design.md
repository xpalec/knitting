# Design Document — translation-status

## Overview

This design covers three focused, low-risk changes to the admin entry editor. All three changes are confined to two files:

- `apps/admin/src/lib/api/entries.ts` — type definitions
- `apps/admin/src/components/entries/entry-form.tsx` — React component

No new abstractions, no new files, and no changes to the API call shape are required.

---

## Architecture

The admin application is a Next.js app using React Query for server state and Zod/manual validation for form state. The two affected files are:

```
apps/admin/src/
├── lib/
│   └── api/
│       └── entries.ts          ← Translation + UpdateTranslationPayload types
└── components/
    └── entries/
        └── entry-form.tsx      ← ChipInput label + action bar buttons
```

No new components, hooks, or utilities are needed.

---

## Components

### 1 — `Translation` and `UpdateTranslationPayload` (entries.ts)

**Current state:**

```typescript
export interface Translation {
  // ...
  status: "draft" | "reviewed" | "published";
}

export interface UpdateTranslationPayload {
  // ...
  status?: "draft" | "reviewed" | "published";
}
```

**Target state:**

```typescript
export type TranslationStatus = "draft" | "review" | "ready";

export interface Translation {
  // ...
  status: TranslationStatus;
}

export interface UpdateTranslationPayload {
  // ...
  status?: TranslationStatus;
}
```

Introducing a named `TranslationStatus` type alias keeps future changes to a single edit site and makes intent clear. The alias is not strictly required, but it improves readability.

No other fields change. The `EntryStatus` type (`"draft" | "review" | "published" | "deprecated"`) is entirely separate and must not be touched.

**Downstream impact:** Any code that currently assigns or compares `"reviewed"` or `"published"` against a `Translation.status` field will produce a TypeScript error after the change. A codebase search confirms only two places reference the old literals:

- The `Translation` and `UpdateTranslationPayload` interfaces themselves (which we are changing).
- No call sites in `entries.ts` or the page components hard-code the old literal values for a translation status.

---

### 2 — `ChipInput` required indicator (entry-form.tsx)

**Current state** — the `ChipInput` component always renders an asterisk:

```tsx
<Label className="text-sm font-medium text-slate-700">
  {label} <span className="text-red-500">*</span>
</Label>
```

**Target state** — the asterisk is removed from the `ChipInput` component entirely. The Synonyms field is the only consumer of `ChipInput`, so there is no risk of accidentally affecting other fields. The label text remains `"Synonyms"`.

```tsx
<Label className="text-sm font-medium text-slate-700">
  {label}
</Label>
```

No validation logic in `EntryForm` currently gates submission on a non-empty synonyms array. The `allErrors` computation only checks `hasAtLeastOneCompleteLocale` (title + slug) and any explicitly passed `validationRules`. The synonyms field participates in neither, so removing the asterisk is the complete change — no validation code needs touching.

---

### 3 — Disabled Preview button (entry-form.tsx)

**Current action bar structure:**

```
[StatusPill] [Actions ▾] [Close] [Save / Publish]
```

**Target action bar structure:**

```
[StatusPill] [Actions ▾] [Preview] [Close] [Save / Publish]
```

The `Close` button is currently wrapped in a conditional `{onCancel && ...}`. The `Preview` button must appear in the same position regardless of whether `onCancel` is provided, so it is rendered unconditionally.

**Implementation:**

```tsx
{/* Preview button — always rendered, always disabled, no handler */}
<Button
  variant="outline"
  type="button"
  disabled
>
  Preview
</Button>

{onCancel && (
  <Button
    variant="outline"
    type="button"
    onClick={onCancel}
    disabled={isSubmitting}
    className="gap-1.5"
  >
    <X size={14} aria-hidden="true" /> Close
  </Button>
)}
```

- `disabled` without a value is equivalent to `disabled={true}`.
- No `onClick` prop is provided.
- No tooltip is needed per the requirements.
- The button uses `variant="outline"` to match the surrounding buttons visually.

---

## Data Models

No data model changes beyond the type alias described in Component 1.

The `TranslationStatus` alias does not change the wire format — the API already accepts/returns these strings; the change is purely a TypeScript vocabulary alignment.

---

## Error Handling

None of the three changes introduce new error paths:

- The type change is compile-time only.
- The asterisk removal has no runtime logic.
- A `disabled` button with no `onClick` produces no events.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Empty synonyms never block form submission

*For any* valid `EntryForm` state (where at least one locale has a title and slug), setting the synonyms array to empty for any or all locales SHALL NOT cause `allErrors` to contain a synonyms-related message, and the submit button SHALL remain enabled.

**Validates: Requirements 2.3**

### Property 2: Preview button is always rendered and always disabled

*For any* combination of `EntryForm` props — including `onCancel` being `undefined` or a function, and `isSubmitting` being `true` or `false` — the action bar SHALL render a button with the text `"Preview"` that has `disabled` set to `true`.

**Validates: Requirements 3.2, 3.5**
