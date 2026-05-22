# Design Document — Phase F: Articles Management

## Overview

Phase F adds two pages to the admin dashboard: an article list page (`/articles`) and an article editor page (`/articles/new` and `/articles/[id]`). Both pages follow the established patterns from the entries section (`/entries`, `/entries/new`, `/entries/[id]`).

The sidebar already includes the "Articles" nav item under CONTENT (confirmed in `sidebar.tsx`). No sidebar changes are needed.

The `articlesApi` client is already implemented in `src/lib/api/articles.ts`. A `deleteArticle()` function needs to be added to support row deletion.

---

## Architecture

### File structure to create

```
src/
  app/(dashboard)/
    articles/
      page.tsx              ← F1: Article list (Client Component)
      new/
        page.tsx            ← F2: Create article (Client Component)
      [id]/
        page.tsx            ← F2: Edit article (Client Component)
  components/articles/
    article-form.tsx        ← Shared form used by both new and [id] pages
    tags-input.tsx          ← Tags multi-input component
    cover-image-upload.tsx  ← Cover image upload + preview component
```

### API client additions

Add `deleteArticle(id: string)` to `src/lib/api/articles.ts`:
```ts
deleteArticle: (id: string): Promise<void> =>
  apiDelete<void>(`/api/v1/articles/${id}`),
```

Import `apiDelete` from `./client` (already used in the entries editor for media deletion).

---

## Component Design

### `articles/page.tsx` — Article List

**Pattern:** mirrors `entries/page.tsx` exactly.

**State:**
- `searchInput: string` — raw input value
- `q: string` — debounced search query (300ms)
- `page: number` — current page (resets to 1 on query change)
- `deleteTarget: Article | null` — article staged for deletion

**Data fetching:**
```ts
useQuery({
  queryKey: ['articles', { page, limit: PAGE_SIZE, q }],
  queryFn: () => articlesApi.listArticles({ page, limit: PAGE_SIZE, q: q || undefined }),
})
```

**Table columns:** Title, Slug, Tags, Country, Author, Created At, Actions (⋮)

**Tags cell:** render each tag as `<Badge variant="outline">` inline. If no tags, render `—`.

**Actions menu (⋮):**
- Edit → `router.push('/articles/${article.id}')`
- Delete → sets `deleteTarget`, opens `ConfirmDialog`

**Row click:** `router.push('/articles/${article.id}')` — stop propagation on the Actions cell.

**Delete mutation:**
```ts
useMutation({
  mutationFn: (id: string) => articlesApi.deleteArticle(id),
  onSuccess: () => {
    toast.success('Article deleted');
    queryClient.invalidateQueries({ queryKey: ['articles'] });
    setDeleteTarget(null);
  },
  onError: () => toast.error('Failed to delete article'),
})
```

**Pagination:** always rendered (prev/next + "Page X of Y"). Disabled when at bounds.

**Skeleton:** 5 skeleton rows while `isLoading`.

**Empty state:** `FileX` icon + "No articles found" message when `articles.length === 0` and not loading.

---

### `components/articles/tags-input.tsx` — Tags Multi-Input

**Props:**
```ts
interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}
```

**Behaviour:**
- Renders current tags as `<Badge>` chips with an `×` button each
- Text input below/beside the chips
- On `Enter` or `,` keydown: trim the input value, add to tags array if non-empty and not duplicate, clear input
- On `×` click: remove that tag from the array
- Controlled component — parent owns the tags array

**Implementation:** plain `useState` for the input field value; calls `onChange` for every add/remove.

---

### `components/articles/cover-image-upload.tsx` — Cover Image Upload

**Props:**
```ts
interface CoverImageUploadProps {
  value: string | undefined;          // current CDN URL
  onChange: (url: string | undefined) => void;
  disabled?: boolean;
}
```

**States:**
- No image: shows a file input button ("Choose image")
- Uploading: shows a spinner / "Uploading…" indicator, input disabled
- Image present: shows `<img>` thumbnail (max-h-40), a "Remove" button

**Upload flow:**
1. User selects file via `<input type="file" accept="image/*">`
2. Component calls `mediaApi.uploadMedia(formData)` — `formData` contains the file
3. On success: calls `onChange(asset.cdn_url ?? asset.url)`
4. On error: `toast.error('Cover image upload failed')`, leaves value unchanged

**Remove:** calls `onChange(undefined)`, clears the thumbnail.

---

### `components/articles/article-form.tsx` — Shared Article Form

Used by both the create and edit pages. Receives initial values and an `onSubmit` callback.

**Props:**
```ts
interface ArticleFormProps {
  initialValues?: Partial<ArticleFormValues>;
  onSubmit: (values: ArticleFormValues) => void;
  isSubmitting: boolean;
  submitLabel: string;
  onCancel: () => void;
}

interface ArticleFormValues {
  title: string;
  slug: string;
  content: string;
  tags: string[];
  country: string;
  author: string;
  cover_image_url: string | undefined;
}
```

**Internal state:**
- `title`, `slug`, `content`, `tags`, `country`, `author`, `cover_image_url` — all controlled
- `slugManuallyEdited: boolean` — tracks whether the user has manually changed the slug
- `errors: Record<string, string>` — validation error messages per field

**Slug auto-generation:**
```ts
function toSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
```
When `title` changes and `!slugManuallyEdited`, update `slug = toSlug(title)`.
When user edits `slug` directly, set `slugManuallyEdited = true`.

**Validation (on submit):**
- `title`: required — "Title is required."
- `slug`: required — "Slug is required." / must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` — "Slug must be lowercase letters, numbers, and hyphens only."
- All other fields optional

**Country options:**
```ts
const COUNTRY_OPTIONS = [
  { value: 'pl', label: 'Poland' },
  { value: 'no', label: 'Norway' },
  { value: 'de', label: 'Germany / Austria' },
  { value: 'gb', label: 'UK / Ireland' },
  { value: 'fr', label: 'France' },
];
```

**Form layout (Card):**
```
Title *
Slug *  (auto-generated hint)
Content  (textarea, optional)
Tags  (TagsInput component)
Country  (Select, optional)
Author  (Input, optional)
Cover Image  (CoverImageUpload component)
```

Footer: Cancel button (calls `onCancel`) + Submit button (calls `onSubmit` after validation).

---

### `articles/new/page.tsx` — Create Article

**Pattern:** mirrors `entries/new/page.tsx`.

```tsx
'use client';

export default function NewArticlePage() {
  const router = useRouter();

  const createMutation = useMutation({
    mutationFn: (values: ArticleFormValues) =>
      articlesApi.createArticle({
        title: values.title,
        slug: values.slug,
        content: values.content || undefined,
        tags: values.tags.length ? values.tags : undefined,
        country: values.country || undefined,
        author: values.author || undefined,
        cover_image_url: values.cover_image_url,
      }),
    onSuccess: (article) => {
      toast.success('Article created');
      router.push(`/articles/${article.id}`);
    },
    onError: () => toast.error('Failed to create article'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/articles"><ArrowLeft size={16} /> Back to Articles</Link>
        </Button>
      </div>
      <h1 className="text-2xl font-semibold text-slate-800">New Article</h1>
      <div className="mx-auto max-w-2xl">
        <ArticleForm
          submitLabel="Create Article"
          isSubmitting={createMutation.isPending}
          onSubmit={(values) => createMutation.mutate(values)}
          onCancel={() => router.push('/articles')}
        />
      </div>
    </div>
  );
}
```

---

### `articles/[id]/page.tsx` — Edit Article

**Pattern:** mirrors `entries/[id]/page.tsx` (simplified — no tabs needed).

```tsx
'use client';

export default function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();

  const { data: article, isLoading, isError, refetch } = useQuery({
    queryKey: ['article', id],
    queryFn: () => articlesApi.getArticle(id),
  });

  const updateMutation = useMutation({
    mutationFn: (values: ArticleFormValues) =>
      articlesApi.updateArticle(id, { ...values }),
    onSuccess: () => {
      toast.success('Article saved');
      queryClient.invalidateQueries({ queryKey: ['article', id] });
    },
    onError: () => toast.error('Failed to save article'),
  });

  if (isLoading) { /* skeleton */ }
  if (isError || !article) { /* error + Retry */ }

  return (
    <div className="space-y-6">
      {/* Breadcrumb / back link */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/articles"><ArrowLeft size={16} /> Back to Articles</Link>
      </Button>
      <h1 className="text-2xl font-semibold text-slate-800">{article.title}</h1>
      <div className="mx-auto max-w-2xl">
        <ArticleForm
          initialValues={{
            title: article.title,
            slug: article.slug,
            content: article.content ?? '',
            tags: article.tags ?? [],
            country: article.country ?? '',
            author: article.author ?? '',
            cover_image_url: article.cover_image_url,
          }}
          submitLabel="Save Article"
          isSubmitting={updateMutation.isPending}
          onSubmit={(values) => updateMutation.mutate(values)}
          onCancel={() => router.push('/articles')}
        />
      </div>
    </div>
  );
}
```

**Loading skeleton:** `<Skeleton className="h-8 w-64" />` for title + `<Skeleton className="h-96 w-full" />` for form area.

**Error state:** Card with "Failed to load article." + `<Button onClick={() => refetch()}>Retry</Button>`.

---

## TanStack Query Keys

| Key | Used by |
|---|---|
| `['articles', { page, limit, q }]` | Article list page |
| `['article', id]` | Edit article page |

Invalidate `['articles']` after delete (list page) and after create (redirects away, so no invalidation needed). Invalidate `['article', id]` after successful update.

---

## Sidebar — No Changes Needed

The sidebar already includes:
```ts
{ label: 'Articles', href: '/articles', icon: FileText },
```
under the CONTENT section, with active detection via `pathname.startsWith(item.href)`. This covers `/articles`, `/articles/new`, and `/articles/[id]` automatically.

---

## API Client Addition

`src/lib/api/articles.ts` needs one new method:

```ts
import { apiGet, apiGetWithMeta, apiPost, apiPut, apiDelete } from "./client";

// add to articlesApi:
deleteArticle: (id: string): Promise<void> =>
  apiDelete<void>(`/api/v1/articles/${id}`),
```

Check that `apiDelete` is exported from `client.ts` (it is — used in the entries editor for media deletion).

---

## Requirements Traceability

| Requirement | Implemented by |
|---|---|
| R1 — Article List Page | `articles/page.tsx` |
| R2 — Search & Filtering | `articles/page.tsx` (debounced search, page reset) |
| R3 — Create Article | `articles/new/page.tsx` + `article-form.tsx` |
| R4 — Edit Article | `articles/[id]/page.tsx` + `article-form.tsx` |
| R5 — Cover Image Upload | `cover-image-upload.tsx` |
| R6 — Tags Multi-Input | `tags-input.tsx` |
| R7 — Navigation & Sidebar | Sidebar already done; pages use `(dashboard)` layout |
