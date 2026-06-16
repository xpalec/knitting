# Design Document: Entry Sidebar Localization

## Overview

The entry form (`apps/admin/src/components/entries/entry-form.tsx`) is a two-column layout: a left panel with per-language tabs and a right sidebar with "Details", "Images", and "SEO" tabs. Currently the sidebar is language-agnostic — it hardcodes English for category labels, renders a free-text `ChipInput` for tags, shows a global `synonyms` field shared across all locales, and binds SEO fields to the default locale regardless of which tab the editor has open.

This feature makes the sidebar fully locale-aware. The selected locale tab in the left panel becomes the authoritative `activeLocale`, and every sidebar widget that has a translated equivalent — categories, tags, abbreviations, synonyms, SEO title, SEO description — reads from and writes to that locale's slice of state.

Key changes at a glance:

- A shared `activeLocale: string` state variable is lifted into `EntryForm`, driven by the left panel's tab selection.
- Category dropdown labels resolve to the `AdminCategoryTranslation` whose `locale` matches `activeLocale`.
- The free-text `ChipInput` for tags is replaced by a new `TagsPanel` component (modelled on `AbbreviationsPanel`) that searches `adminTagsApi.listTags()`, links/unlinks by ID, and shows translated tag names.
- `synonyms` moves out of the global `EntryFormValues` and into `LocaleTabState`, becoming per-locale.
- `AbbreviationsPanel` receives an `activeLocale` prop and resolves abbreviation labels using it.
- The SEO tab binds to `enrichedLocales[activeLocale].seoTitle` and `enrichedLocales[activeLocale].seoDescription`.
- `UpdateTranslationPayload` gains optional `synonyms?: string[]`, `seo_title?: string`, and `seo_description?: string` fields.
- `mapEntryToFormValues` in the edit page is updated to hydrate per-locale synonyms, SEO fields, and tag IDs from the API response.


---

## Architecture

### Locale Tracking — Lifting `activeLocale` into `EntryForm`

The left-panel `<Tabs>` component already drives which locale content is shown. Today it uses `defaultValue={defaultLocale}` and is otherwise uncontrolled (no `value` / `onValueChange`). The minimal change is to make it controlled:

```tsx
// Before (uncontrolled)
<Tabs defaultValue={defaultLocale}>

// After (controlled)
const [activeLocale, setActiveLocale] = useState<string>(defaultLocale);
<Tabs value={activeLocale} onValueChange={setActiveLocale}>
```

`activeLocale` is passed down as a prop to every sidebar sub-component that needs locale-aware rendering:

- `TagsPanel` — for translated tag names
- `AbbreviationsPanel` — for translated abbreviation labels (new `activeLocale` prop)
- Category dropdown — resolved inline via a helper function
- SEO fields — inline binding to `enrichedLocales[activeLocale]`
- Synonyms `ChipInput` — inline binding to `enrichedLocales[activeLocale].synonyms`

There is no context or global state involved. The `activeLocale` is local to `EntryForm` and flows down as props.

### Translation Resolution Strategy

A shared pure helper is introduced for all translation lookups:

```ts
/**
 * Resolves a translated name for any entity that carries a translations array.
 * Returns { label: string; isFallback: boolean }
 */
function resolveTranslation<T extends { locale: string }>(
  translations: T[],
  activeLocale: string,
  getLabel: (t: T) => string | null | undefined,
  fallbackId: string,
): { label: string; isFallback: boolean }
```

Resolution order:
1. Find translation where `t.locale === activeLocale` — if found and label is non-null, use it.
2. Fall back to `t.locale === 'en'` — if found and label is non-null, use it with `isFallback: true`.
3. Fall back to `fallbackId` (category/tag `id`) with `isFallback: true`.

`isFallback: true` causes the `MissingTranslationBadge` component to be rendered alongside the label.


---

## Components and Interfaces

### `MissingTranslationBadge`

A small inline badge rendered whenever a label is displayed in fallback mode.

```tsx
// apps/admin/src/components/ui/missing-translation-badge.tsx
export function MissingTranslationBadge() {
  return (
    <span
      aria-label="No translation for active locale"
      title="No translation available for the selected language"
      className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold shrink-0 ml-1"
    >
      !
    </span>
  );
}
```

Used inline in category dropdown option labels, tag cards in `TagsPanel`, and abbreviation cards in `AbbreviationsPanel`.

### `TagsPanel`

A new component in `apps/admin/src/components/tags/tags-panel.tsx`, modelled closely on `AbbreviationsPanel`. It handles search, link, and unlink of global `AdminTag` entities.

```tsx
export interface TagsPanelProps {
  /** The ID of the saved entry. Undefined for a new (unsaved) entry. */
  entryId?: string;
  /** Full AdminTag objects for every currently linked tag (for name resolution). */
  linkedTags: AdminTag[];
  /** The active locale code, used to pick the right translation. */
  activeLocale: string;
  /** Called when the user links or unlinks a tag (updates parent form state). */
  onTagsChange: (tagIds: string[]) => void;
  /** Called after a successful API link/unlink so the parent can refetch. */
  onLinkChanged?: () => void;
  disabled?: boolean;
}
```

Internal state:
- `searchOpen: boolean` — controls the search popover
- `searchInput: string` — raw user input
- `debouncedQ: string` — 300 ms debounced value of `searchInput`
- `searchResults: AdminTag[]` — results from `adminTagsApi.listTags({ search: debouncedQ })`
- `isSearching: boolean` — loading state

Interaction model mirrors `AbbreviationsPanel`:
- User types ≥1 character → 300 ms debounce → `listTags({ search: q, limit: 20 })` → display results excluding already-linked IDs.
- User selects a result → if `entryId` is defined, call `entriesApi.linkTag(entryId, tagId)` immediately (if the endpoint exists) then call `onLinkChanged`; always call `onTagsChange` with the new tag ID added.
- User removes a linked tag → if `entryId` is defined, call `entriesApi.unlinkTag(entryId, tagId)` immediately (if the endpoint exists); always call `onTagsChange` with that ID removed.
- If link/unlink endpoints are absent, log a `console.warn` and proceed with state-only updates (requirement 8.5 graceful degradation).

Tag name resolution within `TagsPanel`:

```ts
function resolveTagLabel(tag: AdminTag, activeLocale: string): { label: string; isFallback: boolean } {
  return resolveTranslation(
    tag.translations,
    activeLocale,
    (t) => t.name,
    tag.id,
  );
}
```

### Updated `AbbreviationsPanel`

The existing `AbbreviationsPanel` receives a new required prop:

```tsx
export interface AbbreviationsPanelProps {
  entryId: string;
  entryOriginLanguage: string;
  linkedAbbreviations: (EntryAbbreviation & { abbreviation: Abbreviation })[];
  onLinkChanged?: () => void;
  /** NEW: the active locale for label resolution */
  activeLocale: string;
}
```

Abbreviation label resolution:

```ts
function resolveAbbreviationLabel(
  abbreviation: Abbreviation,
  activeLocale: string,
): { label: string; isFallback: boolean } {
  const translations = abbreviation.translations ?? [];
  // Try active locale short_meaning
  const activeTr = translations.find((t) => t.locale === activeLocale);
  if (activeTr && activeTr.short_meaning) return { label: activeTr.short_meaning, isFallback: false };
  // Fall back to source_language translation
  const sourceTr = translations.find((t) => t.locale === abbreviation.source_language);
  if (sourceTr && sourceTr.short_meaning) return { label: sourceTr.short_meaning, isFallback: true };
  // Last resort: abbreviation code
  return { label: abbreviation.code, isFallback: true };
}
```

The `AbbreviationCard` sub-component is updated to accept `activeLocale` and use `resolveAbbreviationLabel` to render the display label and conditionally render `MissingTranslationBadge`.


### Updated `EntryForm`

Key prop additions to `EntryFormProps`:

```tsx
export interface EntryFormProps {
  // ... existing props ...
  /** Full AdminTag objects for all tags linked to this entry, used by TagsPanel for name resolution. */
  linkedTags?: AdminTag[];
  /** Called by TagsPanel after a successful API link/unlink so parent can refetch. */
  onTagLinkChanged?: () => void;
}
```

`EntryFormValues` changes:

```tsx
// Before
export interface EntryFormValues {
  // ...
  synonyms: string[];   // global, removed
  tags: string[];       // now stores IDs, not names
  // ...
}

// After
export interface EntryFormValues {
  // ...
  // synonyms removed from top level
  tags: string[];       // tag IDs (UUIDs)
  // ...
}

// LocaleTabState gains synonyms
export interface LocaleTabState {
  title: string;
  slug: string;
  slugManuallyEdited: boolean;
  shortDescription: string;
  seoTitle: string;
  seoDescription: string;
  synonyms: string[];   // NEW — per-locale
  blocks: BlockEditorState[];
}
```

New state variables added inside `EntryForm`:

```tsx
const [activeLocale, setActiveLocale] = useState<string>(defaultLocale);
```

The `synonyms` state variable (`useState<string[]>`) is removed. Synonyms are accessed via `enrichedLocales[activeLocale].synonyms` and mutated via `handleLocaleChange(activeLocale, { synonyms: [...] })`.

Category options rendering (inside the Details tab):

```tsx
const categoryOptions = useMemo(() => {
  if (!categories) return [];
  return categories.map((cat) => {
    const { label, isFallback } = resolveTranslation(
      cat.translations,
      activeLocale,
      (t) => t.name,
      cat.id,
    );
    return { value: cat.id, label, isFallback };
  });
}, [categories, activeLocale]);
```

`ComboboxField` is extended to accept `isFallback` metadata per option so it can render `MissingTranslationBadge` next to the fallback label in the dropdown list.

SEO tab header update — the tab trigger becomes:

```tsx
<TabsTrigger variant="line" value="seo" className="text-sm">
  SEO <span className="font-mono text-xs text-slate-400 ml-1">{activeLocale.toUpperCase()}</span>
</TabsTrigger>
```

SEO field bindings:

```tsx
// seoTitle
value={enrichedLocales[activeLocale]?.seoTitle ?? ''}
onChange={(e) => handleLocaleChange(activeLocale, { seoTitle: e.target.value.slice(0, SEO_TITLE_MAX) })}

// seoDescription
value={enrichedLocales[activeLocale]?.seoDescription ?? ''}
onChange={(e) => handleLocaleChange(activeLocale, { seoDescription: e.target.value.slice(0, SEO_DESC_MAX) })}
```

Synonyms binding:

```tsx
<ChipInput
  label="Synonyms"
  chips={enrichedLocales[activeLocale]?.synonyms ?? []}
  onChange={(chips) => handleLocaleChange(activeLocale, { synonyms: chips })}
  disabled={isSubmitting}
/>
```

`buildValues()` updated — `synonyms` is no longer a top-level field; it exists inside each locale's `LocaleTabState`.


---

## Data Models

### `LocaleTabState` (updated)

```ts
export interface LocaleTabState {
  title: string;
  slug: string;
  slugManuallyEdited: boolean;
  shortDescription: string;
  seoTitle: string;
  seoDescription: string;
  synonyms: string[];    // moved from EntryFormValues to here
  blocks: BlockEditorState[];
}
```

### `EntryFormValues` (updated)

```ts
export interface EntryFormValues {
  entryTemplateId: string;
  categoryId: string;
  status: EntryStatus;
  // synonyms removed — now per-locale inside locales[locale].synonyms
  tags: string[];                              // tag IDs (UUIDs)
  abbreviations: LinkedAbbreviationState[];
  locales: Record<string, LocaleTabState>;
}
```

### `UpdateTranslationPayload` (updated)

```ts
export interface UpdateTranslationPayload {
  term: string;
  slug?: string;
  metadata?: Record<string, unknown>;
  blocks?: Record<string, { content?: unknown }>;
  status?: 'draft' | 'reviewed' | 'published';
  translator_note?: string;
  // NEW fields:
  synonyms?: string[];
  seo_title?: string;
  seo_description?: string;
}
```

### Tag ID storage in `Entry` API type (reference)

The existing `Entry.tags` array already has shape `Array<{ id: string; name: string }>`. `mapEntryToFormValues` currently maps to `tag.name`; it will change to `tag.id`.

### `AdminTag` and `AdminTagTranslation` (existing, no changes)

```ts
// Already in apps/admin/src/lib/api/tags.ts
export interface AdminTagTranslation {
  locale: string;
  name: string;
  slug: string;
  // ...
}

export interface AdminTag {
  id: string;
  translations: AdminTagTranslation[];
  entry_count: number;
  updated_at?: string | null;
}
```

### `AdminCategory` and `AdminCategoryTranslation` (existing, no changes)

Already contains `translations: AdminCategoryTranslation[]` with `locale` and `name` fields. No schema changes needed.

### `Abbreviation` translation shape (existing)

The `Abbreviation` type in `apps/admin/src/lib/api/abbreviations.ts` already carries a `translations` array. `AbbreviationsPanel` does not currently use it — the update adds consumption of `translation.short_meaning` and `abbreviation.source_language` for display resolution.


### `mapEntryToFormValues` (updated — edit page)

The function in `apps/admin/src/app/(dashboard)/entries/[id]/page.tsx` is updated to:

1. Map `entry.tags[].id` instead of `.name` into `tags`.
2. Parse `synonyms` from each locale's translation metadata (or dedicated field once backend supports it).
3. Parse `seo_title` / `seo_description` from each locale's translation into `seoTitle` / `seoDescription`.

```ts
locales[locale] = {
  title: t?.term ?? '',
  slug: t?.slug ?? '',
  slugManuallyEdited: Boolean(t?.slug),
  shortDescription: (t?.metadata as Record<string, unknown>)?.definition_short as string ?? '',
  seoTitle: (t?.metadata as Record<string, unknown>)?.seo_title as string ?? '',
  seoDescription: (t?.metadata as Record<string, unknown>)?.seo_description as string ?? '',
  synonyms: ((t?.metadata as Record<string, unknown>)?.synonyms as string[] | undefined) ?? [],
  blocks,
};
// ...
return {
  // ...
  tags: (entry.tags ?? []).map((tag) => tag.id),  // changed from tag.name
  // synonyms no longer at top level
};
```

> Note: The exact field path for `seo_title`, `seo_description`, and `synonyms` on the `Translation` type depends on whether the backend exposes them as top-level `Translation` fields or inside `metadata`. The design assumes they arrive in `metadata` until `UpdateTranslationPayload` changes are deployed; the form will read from `metadata` on load and send them as top-level fields on submit.

### `updateMutation` (updated — edit page)

The mutation in the edit page gains tag reconciliation and inclusion of synonyms/SEO in the translation payload:

```ts
// Tag reconciliation (Requirements 8.3, 8.5)
const serverTagIds = new Set((entry.tags ?? []).map((t) => t.id));
const submittedTagIds = new Set(values.tags);
const toAdd = [...submittedTagIds].filter((id) => !serverTagIds.has(id));
const toRemove = [...serverTagIds].filter((id) => !submittedTagIds.has(id));

if (typeof entriesApi.linkTag === 'function' && typeof entriesApi.unlinkTag === 'function') {
  await Promise.all([
    ...toAdd.map((id) => entriesApi.linkTag!(entryId, id)),
    ...toRemove.map((id) => entriesApi.unlinkTag!(entryId, id)),
  ]);
} else {
  console.warn('[EntryForm] entriesApi.linkTag / unlinkTag not available; skipping tag reconciliation.');
}

// Per-locale translation payload (Requirements 4.5, 6.7)
return entriesApi.updateTranslation(id, locale, {
  term: ls.title.trim(),
  slug: ls.slug.trim() || undefined,
  metadata: ls.shortDescription.trim() ? { definition_short: ls.shortDescription.trim() } : undefined,
  blocks: Object.keys(blocks).length > 0 ? blocks : undefined,
  synonyms: ls.synonyms,                                    // always include, even if []
  seo_title: ls.seoTitle.trim() || undefined,
  seo_description: ls.seoTitle.trim() && ls.seoDescription.trim()
    ? ls.seoDescription.trim()
    : undefined,
});
```


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Prework: Redundancy Reflection

Before writing the final properties, redundancy was considered:

- Requirements 2.1–2.3 (category label resolution), 3.3–3.5 (tag label resolution), and 5.1–5.2 (abbreviation label resolution) all describe the same resolution algorithm applied to different entity types. They can be unified into one generic property that covers all translated-label lookups via `resolveTranslation`.
- Requirements 2.4 and 7.1 both say "global fields must not change when switching locale". These combine into a single locale-switch invariant property.
- Requirements 6.1 and 6.2 (SEO title/description binding) are structurally identical. They are combined into one property.
- Requirements 6.3 and 6.4 (SEO field isolation) are structurally identical. They are combined into one property.
- Requirements 4.3 and 6.6 (loading persisted per-locale data) cover the same round-trip pattern for different fields. They are combined into one `mapEntryToFormValues` round-trip property.

---

### Property 1: Translation label resolution resolves in priority order

*For any* translated entity (category, tag, or abbreviation) carrying a `translations` array, *for any* active locale code, `resolveTranslation(translations, activeLocale, getLabel, fallbackId)` SHALL return:
- the label from the translation whose `locale === activeLocale` (when non-null), with `isFallback: false`;
- otherwise the label from the `locale === "en"` translation (when non-null), with `isFallback: true`;
- otherwise `fallbackId`, with `isFallback: true`.

**Validates: Requirements 1.2, 1.4, 2.1, 2.2, 2.3, 3.3, 3.4, 3.5, 5.1, 5.2**

---

### Property 2: Global fields are invariant under locale switching

*For any* initial form state with a given `categoryId`, `entryTemplateId`, and `tags` array, *for any* sequence of `activeLocale` changes (simulating tab clicks), the values of `categoryId`, `entryTemplateId`, and `tags` SHALL be identical to their values before the locale changes.

**Validates: Requirements 2.4, 7.1**

---

### Property 3: Per-locale synonyms are isolated

*For any* `EntryFormValues` with N locales each having distinct synonym arrays, editing the synonyms of locale A SHALL leave the synonyms arrays of all other locales unchanged.

**Validates: Requirements 4.1, 4.2**

---

### Property 4: Per-locale SEO fields are bound and isolated

*For any* set of locales each having distinct `seoTitle` and `seoDescription` values:
- The SEO Title input for the active locale displays exactly `enrichedLocales[activeLocale].seoTitle`.
- The SEO Description textarea for the active locale displays exactly `enrichedLocales[activeLocale].seoDescription`.
- Editing the SEO Title or SEO Description for locale A leaves all other locales' `seoTitle` and `seoDescription` values unchanged.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

---

### Property 5: mapEntryToFormValues round-trip for per-locale data

*For any* `Entry` whose `translations` array contains records with per-locale `synonyms`, `seo_title`, and `seo_description` data, `mapEntryToFormValues(entry)` SHALL produce a `locales` map where each locale's `synonyms`, `seoTitle`, and `seoDescription` are equal to the corresponding values in the translation record.

**Validates: Requirements 4.3, 6.6**

---

### Property 6: mapEntryToFormValues maps tag names to tag IDs

*For any* `Entry` with a non-empty `tags` array, `mapEntryToFormValues(entry).tags` SHALL be deeply equal to `entry.tags.map(t => t.id)`.

**Validates: Requirements 8.1, 8.2**

---

### Property 7: updateTranslationPayload includes synonyms for non-empty titles

*For any* locale whose `title` is a non-empty string, the `UpdateTranslationPayload` built for that locale SHALL include a `synonyms` field equal to that locale's `synonyms` array — including the case where the array is empty.

**Validates: Requirements 4.5**

---

### Property 8: Tag set difference is computed correctly

*For any* pair of sets (`serverTagIds: Set<string>`, `submittedTagIds: Set<string>`), the computed additions SHALL equal `submittedTagIds − serverTagIds` and the computed removals SHALL equal `serverTagIds − submittedTagIds`.

**Validates: Requirements 8.3**

---

### Property 9: Tag linking is idempotent — no duplicate IDs

*For any* current `tags` array and any tag ID already present in that array, calling the "add tag" handler with that ID SHALL leave the array unchanged (no duplicate inserted).

**Validates: Requirements 3.6**

---

### Property 10: SEO tab header displays the active locale code in uppercase

*For any* active locale code string `l`, the SEO tab trigger label SHALL contain the substring `l.toUpperCase()`.

**Validates: Requirements 6.5**


---

## Error Handling

### Categories API Failure (Requirement 2.5)

If `listEntryCategories()` throws, React Query places the query in an error state. The `EntryForm` receives `categories={undefined}` or `categories={[]}` and `isLoadingCategories={false}`. The category `ComboboxField` renders as an empty dropdown. An inline error banner is added to the Details tab:

```tsx
{!isLoadingCategories && categoriesError && (
  <p role="alert" className="text-xs text-red-600">
    Categories could not be loaded. Please refresh and try again.
  </p>
)}
```

### Tag Search API Failure (Requirement 3.2)

`TagsPanel` catches errors from `adminTagsApi.listTags()` inside its `fetchResults` function and sets a local `searchError: string | null` state:

```tsx
} catch (err) {
  setSearchError('Could not load tags. Please try again.');
  setSearchResults([]);
}
```

The error is displayed inside the search popover below the input. The linked tags list is not modified.

### Tag Link/Unlink API Failure (Requirement 8.4)

Errors from `entriesApi.linkTag` / `entriesApi.unlinkTag` are caught in their respective `useMutation` `onError` callbacks and surfaced as a `toast.error(...)` notification. The form state (tags array) is NOT rolled back — the optimistic UI update (adding/removing from the in-memory list) remains until the user refreshes or the parent refetches.

Rationale: Rolling back optimistic state on error introduces complexity and can surprise users who already see the change. A toast notification with "Failed to link/unlink tag" plus a manual refresh is the simpler, less disruptive behaviour consistent with how `AbbreviationsPanel` handles similar failures.

### Missing `linkTag` / `unlinkTag` Endpoints (Requirement 8.5)

The `updateMutation` in the edit page guards tag reconciliation with an existence check:

```ts
if (typeof entriesApi.linkTag === 'function' && typeof entriesApi.unlinkTag === 'function') {
  // ... reconcile tags
} else {
  console.warn('[EntryForm] entriesApi.linkTag / unlinkTag not yet available; skipping tag sync.');
}
```

All other fields (translations, status, category) continue saving normally. This prevents the entire save from failing when tag endpoints are not yet deployed.

### Template Not Found (Requirement 7.3)

`handleTemplateChange` already calls `templates?.find((t) => t.id === id)`. If the template is not found, the function returns early without rebuilding blocks. A visible error is surfaced:

```tsx
{entryTemplateId && !templates?.find((t) => t.id === entryTemplateId) && !isLoadingTemplates && (
  <p role="alert" className="text-xs text-amber-600">
    The selected template could not be found. Content blocks may be incomplete.
  </p>
)}
```


---

## Testing Strategy

### PBT Applicability Assessment

This feature is appropriate for property-based testing. The core logic — translation label resolution, per-locale state isolation, set difference computation, form value mapping — consists of pure functions operating over structured data. Properties 1, 2, 3, 4, 5, 6, 7, 8, 9, and 10 all test our code's logic, vary meaningfully with input, and would benefit from 100+ iterations exposing edge cases (missing translations, empty arrays, locale codes with unexpected casing, duplicate tag IDs, etc.).

The chosen PBT library is **fast-check** (already available in the Next.js ecosystem; pairs well with Vitest).

### Unit Tests

Unit tests cover specific examples, wiring assertions, and error conditions:

| Test | Requirement(s) |
|------|----------------|
| `EntryForm` renders with `activeLocale` initialized to `defaultLanguage.locale` | 1.3 |
| Category dropdown is empty and shows error message when API fails | 2.5 |
| `TagsPanel` is rendered; free-text tags `ChipInput` is absent | 3.1 |
| `TagsPanel` calls `listTags` after 300 ms when user types | 3.2 |
| `TagsPanel` calls API immediately for existing entry; accumulates state-only for new entry | 3.9 |
| `EntryFormValues` has no top-level `synonyms` field at runtime | 4.1 |
| `AbbreviationsPanel` renders given `activeLocale` prop | 5.3, 5.4 |
| `EntryForm` passes `activeLocale` to `AbbreviationsPanel` | 5.4 |
| Template selector is disabled when `defaultValues.entryTemplateId` is non-empty | 7.4 |
| Template not found → existing blocks preserved + error banner | 7.3 |
| `tags` field stores UUIDs after `mapEntryToFormValues` | 8.1 |
| Tag link API error → toast shown, tags state unchanged | 8.4 |
| Missing `linkTag`/`unlinkTag` → form saves all other fields, `console.warn` emitted | 8.5 |

### Property-Based Tests

Each property test runs a minimum of 100 iterations. Tests live in `apps/admin/src/__tests__/entry-sidebar-localization/`.

```
// Tag format for each test:
// Feature: entry-sidebar-localization, Property N: <property text>
```

**Property 1 — Translation label resolution**

```ts
// Feature: entry-sidebar-localization, Property 1: Translation label resolution resolves in priority order
fc.assert(fc.property(
  arbitraryTranslations(), fc.string({ minLength: 2, maxLength: 5 }),
  (translations, activeLocale) => {
    const { label, isFallback } = resolveTranslation(translations, activeLocale, (t) => t.name, 'fallback-id');
    const active = translations.find((t) => t.locale === activeLocale);
    if (active?.name) {
      return label === active.name && isFallback === false;
    }
    const en = translations.find((t) => t.locale === 'en');
    if (en?.name) {
      return label === en.name && isFallback === true;
    }
    return label === 'fallback-id' && isFallback === true;
  }
));
```

**Property 2 — Global fields invariant under locale switching**

Generator produces random initial `categoryId` / `entryTemplateId` / `tags` and a sequence of locale switch events. After applying all events, asserts values are unchanged.

**Property 3 — Per-locale synonyms are isolated**

Generator produces random `locales` map (2–5 locales, each with random synonyms). Applies a random synonym edit to one locale. Asserts all other locales' synonyms are identical.

**Property 4 — Per-locale SEO fields are bound and isolated**

Generator produces random `locales` map with random `seoTitle` / `seoDescription` per locale. Applies a random SEO edit to one locale. Asserts other locales' SEO fields unchanged.

**Property 5 — mapEntryToFormValues round-trip for per-locale data**

Generator produces a realistic `Entry` shape with random per-locale synonyms, seo_title, seo_description inside the translations. Calls `mapEntryToFormValues`, asserts correct population.

**Property 6 — mapEntryToFormValues maps tag names to tag IDs**

Generator produces an entry with random `tags: Array<{ id: string; name: string }>`. Asserts `mapEntryToFormValues(entry).tags === entry.tags.map(t => t.id)`.

**Property 7 — UpdateTranslationPayload includes synonyms for non-empty titles**

Generator produces random locale state with non-empty title and random synonyms array. Calls the payload builder. Asserts `payload.synonyms` is present and equal to the input synonyms.

**Property 8 — Tag set difference**

Generator produces two random sets of UUID strings. Asserts additions = A−B and removals = B−A using the pure `computeTagDiff(serverIds, submittedIds)` function extracted from the mutation.

**Property 9 — Tag linking is idempotent**

Generator produces a random tags array and picks a random tag ID from it. Calls the add-tag handler. Asserts the array is unchanged (length and contents).

**Property 10 — SEO tab header uppercase locale**

Generator produces random locale codes (lowercase ASCII, 2–5 chars). Renders the SEO tab trigger for that locale. Asserts the text contains `locale.toUpperCase()`.


### Design Decisions and Rationale

**`activeLocale` as local state, not context or URL param** — The sidebar and the left-panel tabs are always co-located in `EntryForm`. Passing `activeLocale` as a prop to child components keeps the data flow explicit and avoids the indirection of React context. URL-based locale tracking would complicate unsaved-state handling and back-navigation.

**Pure `resolveTranslation` helper instead of three separate resolvers** — Categories, tags, and abbreviations all follow the same three-tier resolution (active locale → English → identifier). Extracting one pure function makes all three paths unit-testable and eliminates duplicated fallback logic.

**`TagsPanel` mirrors `AbbreviationsPanel` exactly** — Same search-debounce pattern, same optimistic link/unlink with `useMutation`, same card-based display. This keeps the UX consistent and minimises the surface area that editors need to learn.

**Synonyms move into `LocaleTabState`** — Semantically, synonyms are translation-specific (Polish synonyms for a knitting stitch are different from English ones). Keeping them in the global `EntryFormValues` was an oversight; the fix naturally flows from the locale-awareness requirement. The migration is non-breaking for new entries; existing entries without saved synonyms default to `[]`.

**Tag IDs instead of tag names** — Tags can be renamed on the tags management page. Storing names would cause stale references. IDs are stable and unambiguous. The `TagsPanel` resolves display names at render time from `AdminTag.translations`.

**Optimistic UI for tag link/unlink** — The in-memory tags array is updated immediately on user action, with the API call running asynchronously. If the API fails, a toast is shown but the state is not rolled back. This matches the existing behaviour of `AbbreviationsPanel` and is consistent with the UX pattern across the admin app.

**SEO fields conditionally included in payload** — Including `seo_title: ""` in the payload could accidentally clear SEO data on the server if the server treats missing vs empty-string differently. The design sends `seo_title` only when non-empty, and omits `seo_description` if `seo_title` is absent (since a description without a title is not useful). This is the safest default while the backend evolves.

**`synonyms` always included in payload even when empty** — Requirement 4.5 explicitly asks for this. An empty `synonyms: []` signals intent to clear previously-saved synonyms, which is a valid user action.

