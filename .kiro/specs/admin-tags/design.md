# Design — Admin Tags CRUD

## Overview

The Tags feature is a pure frontend addition. The NestJS API is complete. The design mirrors the categories feature closely, with three key differences: slug-as-identifier, color_hex field, and SEO fields on translations.

---

## Architecture

```
lib/api/tags.ts                          ← new API client module
lib/api/index.ts                         ← add re-export

components/tags/
  tag-form.tsx                           ← create/edit form (slug, name_en, type, color_hex)
  tag-type-badge.tsx                     ← colored badge for fiber_type | needle_type | ...
  tag-translation-dialog.tsx             ← dialog: name, seo_title, seo_description, status

app/(dashboard)/tags/
  page.tsx                               ← list page
  new/page.tsx                           ← create page
  [slug]/page.tsx                        ← edit page

components/layout/sidebar.tsx            ← add Tags nav item
```

---

## Data Model (frontend types)

```ts
// lib/api/tags.ts

export type TagType = 'fiber_type' | 'needle_type' | 'garment_part' | 'style_tradition';
export type TranslationStatus = 'draft' | 'reviewed' | 'published';

export interface AdminTagTranslation {
  locale: string;
  name: string;
  seo_title: string | null;
  seo_description: string | null;
  status: TranslationStatus;
}

export interface AdminTag {
  id: string;
  slug: string;                          // immutable, used as URL key
  type: TagType | null;
  color_hex: string | null;              // #RRGGBB or null
  translations: AdminTagTranslation[];
  entry_count: number;
}

export interface AdminTagListParams {
  page?: number;
  limit?: number;
  search?: string;                       // slug search only
  type?: TagType;
}

export interface CreateTagPayload {
  slug: string;
  name_en: string;
  type?: TagType;
  color_hex?: string;
}

export interface UpdateTagPayload {
  type?: TagType | null;
  color_hex?: string | null;
}

export interface UpsertTagTranslationPayload {
  name: string;
  seo_title?: string;
  seo_description?: string;
  status?: TranslationStatus;
}
```

---

## API Client

```ts
// lib/api/tags.ts (adminTagsApi)

listTags(params?)   → GET /api/v1/admin/tags          → ApiResponse<AdminTag[]>
getTag(slug)        → GET /api/v1/admin/tags/:slug     → AdminTag
createTag(dto)      → POST /api/v1/admin/tags          → AdminTag
updateTag(slug,dto) → PUT /api/v1/admin/tags/:slug     → AdminTag
deleteTag(slug)     → DELETE /api/v1/admin/tags/:slug  → void
upsertTranslation(slug, locale, dto)
                    → PUT /api/v1/admin/tags/:slug/translations/:locale
                    → AdminTagTranslation
```

The `getTag` response is wrapped in `{ data: tag }` by the API — unwrap via `apiGet` which strips the envelope.

---

## Component Design

### `tag-form.tsx`

Props:
```ts
interface TagFormProps {
  defaultValues?: Partial<TagFormValues>;
  slugReadOnly?: boolean;          // true on edit page (slug is immutable)
  onSubmit: (values: TagFormValues) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  slugError?: string;
  onCancel?: () => void;
}

interface TagFormValues {
  slug: string;
  name_en: string;                 // only used on create; ignored on update
  type: TagType | '';
  color_hex: string;               // empty string = no color
}
```

Fields:
- **Slug** — text input, auto-generated from `name_en` via `toSlug()` on create; read-only on edit (display as `<code>` or disabled input).
- **English Name** — text input, only shown on create page (not needed on edit since translations are managed separately).
- **Type** — `<Select>` with options: (none), fiber_type, needle_type, garment_part, style_tradition.
- **Color Hex** — `<input type="color">` paired with a text `<Input>` showing the hex value. Both stay in sync. Empty string means no color (null sent to API).

Color field implementation:
```tsx
<div className="flex items-center gap-2">
  <input
    type="color"
    value={colorHex || '#000000'}
    onChange={(e) => setColorHex(e.target.value)}
    className="h-9 w-12 cursor-pointer rounded border border-slate-200 p-0.5"
  />
  <Input
    placeholder="#RRGGBB or leave empty"
    value={colorHex}
    onChange={(e) => setColorHex(e.target.value)}
  />
  {colorHex && (
    <Button variant="ghost" size="sm" onClick={() => setColorHex('')}>Clear</Button>
  )}
</div>
```

### `tag-type-badge.tsx`

```ts
const TYPE_STYLES: Record<TagType, string> = {
  fiber_type:       'bg-purple-50 text-purple-700 border-purple-200',
  needle_type:      'bg-blue-50 text-blue-700 border-blue-200',
  garment_part:     'bg-amber-50 text-amber-700 border-amber-200',
  style_tradition:  'bg-green-50 text-green-700 border-green-200',
};
```

Renders a shadcn `<Badge variant="outline">` with human-readable label (replace `_` with space, title-case).

### `tag-translation-dialog.tsx`

Fields: Name (required), SEO Title (optional), SEO Description (optional), Status (select).
No slug field (tags translations don't have one).
No TipTap description (out of scope).

Props mirror `TranslationDialog` from categories but use `UpsertTagTranslationPayload`.

---

## Page Design

### List Page (`/tags`)

Structure mirrors `categories/page.tsx`:

1. **Header row** — "Tags" h1 + "Add Tag" button (links to `/tags/new`).
2. **Summary cards** — 4 cards (fiber_type, needle_type, garment_part, style_tradition) + total. Fetched via a separate `listTags({ limit: 1000 })` query (same pattern as categories summary).
3. **Filter bar** — search input (slug search) + type filter select.
4. **Table** — columns: Name (EN), Slug, Type badge, Color swatch, Entry Count, Actions menu.
5. **Pagination** — Prev/Next, page X of Y.
6. **Delete confirm dialog** — ConfirmDialog, warns about admin-only requirement.

Color swatch in table:
```tsx
{tag.color_hex ? (
  <span
    className="inline-block h-4 w-4 rounded-full border border-slate-200"
    style={{ backgroundColor: tag.color_hex }}
    title={tag.color_hex}
  />
) : (
  <span className="text-slate-400 text-xs">—</span>
)}
```

Query key: `['tags', params]` for list, `['tags-summary']` for summary cards.

### New Tag Page (`/tags/new`)

- Renders `<TagForm>` with `slugReadOnly={false}`.
- On success: `router.push('/tags/' + createdTag.slug)`.
- 409 → inline slug error.

### Edit Tag Page (`/tags/[slug]`)

- Fetches tag via `useQuery({ queryKey: ['tag', slug], queryFn: () => adminTagsApi.getTag(slug) })`.
- Renders `<TagForm slugReadOnly>` pre-populated with type and color_hex. Slug shown as read-only.
- Translations table: locale, name, seo_title, status, Edit button.
- Missing locales → "Add Translation (XX)" buttons.
- Delete button → ConfirmDialog → `deleteTag(slug)` → redirect to `/tags`.
- 400 on delete → toast error.

---

## Sidebar Change

In `sidebar.tsx`, add to the CONTENT section after Categories:

```ts
{ label: 'Tags', href: '/tags', icon: Tag },
```

The `Tag` icon is already imported in `sidebar.tsx`.

---

## Key Differences vs Categories

| Concern | Categories | Tags |
|---|---|---|
| URL identifier | `id` (UUID) | `slug` (string) |
| Slug mutability | Mutable (via translation) | Immutable — read-only on edit |
| Color field | None | `color_hex` — native color input |
| Translation slug | Yes | No |
| Translation SEO fields | No | `seo_title`, `seo_description` |
| Delete role | editor | admin only |
| Type enum | entry / abbreviation / article | fiber_type / needle_type / garment_part / style_tradition |

---

## Correctness Properties

- **Slug immutability**: The edit form must never send `slug` in the `PUT /tags/:slug` body. `UpdateTagPayload` only contains `type` and `color_hex`.
- **Color hex format**: Values sent to the API must match `/^#[0-9A-Fa-f]{6}$/` or be omitted. The native `<input type="color">` always produces a valid 6-digit hex, so the text field should validate on blur.
- **Delete guard**: A 400 response from the delete endpoint must surface as a toast (not a crash), keeping the user on the edit page.
- **Pagination reset**: Changing the search input or type filter must reset `page` to 1.
- **Summary independence**: The summary card query (`['tags-summary']`) must be independent of the filter/pagination query so it always reflects the full dataset.
