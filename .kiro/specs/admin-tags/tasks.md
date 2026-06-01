# Tasks — Admin Tags CRUD

## Overview

All work is frontend-only. The NestJS API is complete and requires no changes.

---

## Task List

- [x] 1. Create `lib/api/tags.ts` — typed interfaces and `adminTagsApi` client
  - Define `TagType`, `TagTranslationStatus`, `AdminTagTranslation`, `AdminTag`, `AdminTagListParams`, `CreateTagPayload`, `UpdateTagPayload`, `UpsertTagTranslationPayload`
  - Implement `adminTagsApi.listTags`, `getTag`, `createTag`, `updateTag`, `deleteTag`, `upsertTranslation` using `apiGetWithMeta`, `apiGet`, `apiPost`, `apiPut`, `apiDelete` from `lib/api/client`
  - Note: `getTag` response is `{ data: tag }` — `apiGet` unwraps the envelope automatically
  - Add `export * from './tags'` to `lib/api/index.ts`

- [x] 2. Create `components/tags/tag-type-badge.tsx`
  - Accept `type: TagType | null` prop
  - Render shadcn `<Badge variant="outline">` with color styles per type (purple/fiber_type, blue/needle_type, amber/garment_part, green/style_tradition)
  - Render `—` badge for null type
  - Human-readable labels: replace underscores with spaces, title-case

- [x] 3. Create `components/tags/tag-form.tsx`
  - Fields: Slug (text, auto-generated from name_en via `toSlug`, read-only when `slugReadOnly=true`), English Name (text, only shown when `slugReadOnly=false`), Type (select, optional), Color Hex (native `<input type="color">` + text Input, synced, with Clear button)
  - Export `TagFormValues` interface and `TagForm` component
  - Reuse `toSlug` helper (copy from `category-form.tsx` or import if extracted)
  - Submit disabled when slug is empty (create) or when submitting

- [x] 4. Create `components/tags/tag-translation-dialog.tsx`
  - Fields: Name (required), SEO Title (optional, note ≤60 chars), SEO Description (optional, note ≤160 chars), Status (draft/reviewed/published select)
  - No slug field, no TipTap description field
  - Export `TagTranslationDialogProps` and `TagTranslationDialog`
  - Re-populate fields via `useEffect` when `open` or `initialValues` changes (same pattern as `translation-dialog.tsx`)

- [x] 5. Create `app/(dashboard)/tags/new/page.tsx` — New Tag page
  - Render `<TagForm submitLabel="Create Tag" slugReadOnly={false}>`
  - `useMutation` calling `adminTagsApi.createTag`
  - On success: `toast.success('Tag created')` + `router.push('/tags/' + tag.slug)`
  - On 409: set inline slug error "This slug is already taken"
  - On other error: `toast.error('Failed to create tag')`
  - Back link to `/tags`

- [x] 6. Create `app/(dashboard)/tags/[slug]/page.tsx` — Edit Tag page
  - `useQuery` fetching `adminTagsApi.getTag(slug)`
  - Render `<TagForm slugReadOnly>` pre-populated with `type` and `color_hex`; slug shown as read-only text
  - `useMutation` for update calling `adminTagsApi.updateTag(slug, { type, color_hex })`
  - Translations section: table with columns Locale, Name, SEO Title, Status, Actions (Edit button)
  - Missing locales (en, pl, de, no, fr) shown as "Add Translation (XX)" buttons
  - `<TagTranslationDialog>` for add/edit translations, calling `adminTagsApi.upsertTranslation`
  - Delete button → `<ConfirmDialog>` → `adminTagsApi.deleteTag(slug)` → redirect to `/tags`
  - 400 on delete → `toast.error` with API message; 404 → "Tag not found" state
  - Loading skeleton and error states

- [x] 7. Create `app/(dashboard)/tags/page.tsx` — Tags List page
  - Summary cards: 4 type counts + total (independent query `['tags-summary']` with `limit: 1000`)
  - Filter bar: search input (debounced 300 ms, resets page to 1) + type filter select
  - Paginated table (page size 20): Name (EN), Slug (monospace), Type badge, Color swatch, Entry Count, row-actions menu (Edit / Delete)
  - Color swatch: filled circle when `color_hex` present, `—` otherwise
  - Delete via `<ConfirmDialog>` with note about admin-only requirement; 400 → toast error
  - Pagination Prev/Next controls
  - Empty state with `<FileX>` icon

- [x] 8. Add Tags to sidebar navigation
  - In `components/layout/sidebar.tsx`, added `{ label: 'Tags', href: '/tags', icon: Tags }` to the CONTENT section after the Categories item
  - Used `Tags` icon (distinct from the `Tag` icon used by Categories)

---

## Implementation Notes

- Use `slug` (not `id`) everywhere as the URL segment and React Query key for individual tags.
- The `UpdateTagPayload` must never include `slug` — the API rejects it and the slug is immutable.
- Color hex sent to the API must be `#RRGGBB` or omitted. Send `undefined` (not empty string) when the field is cleared.
- The summary cards query must be independent of the filter/search query so it always reflects the full dataset count.
- Follow the exact same file/component structure as the categories feature for consistency.
