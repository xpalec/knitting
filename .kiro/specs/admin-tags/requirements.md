# Requirements — Admin Tags CRUD

## Overview

Add a full Tags management section to the admin frontend. The NestJS API is already complete and live. All work is frontend-only except for one minor API gap noted below.

---

## API Gap Analysis

The existing API is fully functional. One gap exists:

- **`GET /api/v1/admin/tags` searches by `slug` only.** The user confirmed slug-only search is acceptable, so no API change is required.

**Conclusion: zero backend changes needed.**

---

## Functional Requirements

### 1. Tags List Page (`/tags`)

**1.1** The page shall display a paginated table of all tags with columns: Name (EN), Slug, Type, Color, Entry Count, and a row-actions menu.

**1.2** The page shall provide a search input that filters tags by slug (debounced, 300 ms).

**1.3** The page shall provide a Type filter dropdown with options: All Types, fiber_type, needle_type, garment_part, style_tradition.

**1.4** The page shall display four summary cards showing counts per type (fiber_type, needle_type, garment_part, style_tradition) and a total.

**1.5** The page shall include an "Add Tag" button that navigates to `/tags/new`.

**1.6** Each table row shall be clickable and navigate to `/tags/[slug]`.

**1.7** Each row's actions menu shall include Edit (navigates to `/tags/[slug]`) and Delete (opens a confirmation dialog).

**1.8** Delete shall be blocked with a toast error when the API returns HTTP 400 (entries assigned). The confirmation dialog shall warn that delete requires admin role.

**1.9** The page shall support pagination (page size 20) with Prev/Next controls.

**1.10** Color swatches shall be rendered inline in the table when `color_hex` is present.

### 2. New Tag Page (`/tags/new`)

**2.1** The page shall render a form with fields: Slug (required, kebab-case), English Name (required), Type (optional select), Color Hex (optional, native color input + hex text field).

**2.2** The slug field shall auto-generate from the English Name as the user types (same `toSlug` helper used by categories), and allow manual override.

**2.3** On successful creation the page shall navigate to `/tags/[slug]`.

**2.4** A 409 conflict response shall surface as an inline slug error ("This slug is already taken").

### 3. Edit Tag Page (`/tags/[slug]`)

**3.1** The page shall load the tag by slug and pre-populate a form with Type and Color Hex fields. Slug is displayed as read-only (immutable).

**3.2** Saving the form shall call `PUT /api/v1/admin/tags/:slug` with only `type` and `color_hex`.

**3.3** The page shall display a Translations section listing all existing translations in a table (columns: Locale, Name, SEO Title, Status, Actions).

**3.4** Each translation row shall have an Edit button that opens the translation dialog pre-populated.

**3.5** Missing locales (from the supported set: en, pl, de, no, fr) shall be shown as "Add Translation (XX)" buttons.

**3.6** The translation dialog shall include fields: Name (required), SEO Title (optional, ≤60 chars), SEO Description (optional, ≤160 chars), Status (draft / reviewed / published). The TipTap description field is out of scope.

**3.7** The page shall include a Delete Tag button that opens a confirmation dialog. Delete requires admin role; the dialog copy shall reflect this.

**3.8** A 400 response on delete shall surface as a toast error explaining that entries must be unassigned first.

### 4. Sidebar Navigation

**4.1** A "Tags" item shall be added to the CONTENT section of the sidebar, between Categories and the next item, using the `Tags` icon from lucide-react.

### 5. API Client (`lib/api/tags.ts`)

**5.1** The module shall export typed interfaces: `AdminTag`, `AdminTagTranslation`, `TagType`, `TranslationStatus`, `AdminTagListParams`, `CreateTagPayload`, `UpdateTagPayload`, `UpsertTagTranslationPayload`.

**5.2** The module shall export `adminTagsApi` with methods: `listTags`, `getTag`, `createTag`, `updateTag`, `deleteTag`, `upsertTranslation`.

**5.3** `lib/api/index.ts` shall re-export everything from `lib/api/tags.ts`.

---

## Non-Functional Requirements

**6.1** All new pages and components shall follow the existing patterns established by the categories feature (React Query, Sonner toasts, shadcn/ui, ConfirmDialog for destructive actions).

**6.2** The tag slug identifier (not numeric id) shall be used as the URL segment and as the key for all API calls.

**6.3** Delete actions shall use `ConfirmDialog` and shall only be triggered by users with the `admin` role (the API enforces this; the frontend should surface a clear error if a non-admin attempts it).
