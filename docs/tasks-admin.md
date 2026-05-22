# Admin Dashboard — Implementation Plan

> **Visual reference**: Clean sidebar-based admin layout (see design image).
> Left sidebar with grouped nav sections + icons, top bar with global search and user profile,
> content area with page title, stats, filter bar, and data tables with badges and row actions.
>
> **Stack**: Next.js 16 App Router · Tailwind CSS v4 · shadcn/ui · TanStack Query · Zustand · `apps/api` NestJS backend

Status legend: `[ ]` not started · `[x]` done · `[-]` in progress · `[~]` deferred

---

## Phase A — Foundation & dependencies

### A1 — Install UI dependencies in `apps/admin`

- [x] Install `shadcn` CLI and initialise: `npx shadcn@latest init`
  - [x] Choose CSS variables theme, Tailwind v4 mode, `src/` path
- [x] Add shadcn components used across the dashboard:
  - [x] `button`, `badge`, `card`, `input`, `select`, `separator`
  - [x] `table`, `dropdown-menu`, `dialog`, `sheet`
  - [x] `form`, `label`, `textarea`, `skeleton`, `tabs`
  - [x] `toast` (Sonner), `popover`, `breadcrumb`, `avatar`
- [x] Install TanStack Query: `@tanstack/react-query` + `@tanstack/react-query-devtools`
- [x] Install Zustand: `zustand`
- [x] Install `lucide-react` for icons
- [x] Install `js-cookie` + `@types/js-cookie` for cookie handling

### A2 — API client layer (`src/lib/api/`)

- [x] Create `src/lib/api/client.ts`
  - [x] Base `fetch` wrapper with `credentials: 'include'` (sends HttpOnly JWT cookie)
  - [x] Auto-prefix all requests with `NEXT_PUBLIC_API_URL` env var (default `http://localhost:4000`)
  - [x] Handle `401` → redirect to `/login`
  - [x] Handle `{ data, meta?, error? }` response envelope — unwrap `data` automatically
- [x] Create typed API modules (one file per domain):
  - [x] `src/lib/api/auth.ts` — `login()`, `logout()`, `refresh()`
  - [x] `src/lib/api/entries.ts` — `listEntries()`, `getEntry()`, `createEntry()`, `updateEntry()`, `updateEntryStatus()`, `deleteEntry()`, `updateBlocks()`, `updateTranslation()`
  - [x] `src/lib/api/queue.ts` — `listQueueEntries()`, `approveQueueEntry()`, `rejectQueueEntry()`, `listQueueTranslations()`, `approveQueueTranslation()`, `rejectQueueTranslation()`, `listQueueCorrections()`, `resolveQueueCorrection()`
  - [x] `src/lib/api/articles.ts` — `listArticles()`, `getArticle()`, `createArticle()`, `updateArticle()`
  - [x] `src/lib/api/media.ts` — `listMedia()`, `uploadMedia()`
  - [x] `src/lib/api/users.ts` — `listUsers()`, `createUser()`, `updateUserRole()`
  - [x] `src/lib/api/templates.ts` — `listTemplates()`, `updateTemplate()`
  - [x] `src/lib/api/categories.ts` — `getCategoryTree()`
  - [x] `src/lib/api/dashboard.ts` — aggregate stats (entries count, pending queue count, translation coverage)
- [x] Add `.env.example` entry: `NEXT_PUBLIC_API_URL=http://localhost:4000`

### A3 — Zustand auth store (`src/store/auth.ts`)

- [x] State: `currentUser: { id, email, role } | null`, `isLoading: boolean`
- [x] Actions: `setUser()`, `clearUser()`, `logout()` (calls API + clears state)
- [x] Persist to `sessionStorage` (not localStorage — admin session only)

### A4 — TanStack Query provider

- [x] Create `src/providers/query-provider.tsx` — wraps `QueryClientProvider`
- [x] Add to root `layout.tsx`
- [x] Configure: `staleTime: 30s`, `retry: 1`, global error handler for `401`

---

## Phase B — Shell layout

### B1 — Authentication pages

- [x] Create `src/app/(auth)/login/page.tsx`
  - [x] Centered card layout (not the sidebar shell)
  - [x] Fields: email, password
  - [x] On submit: calls `POST /api/v1/auth/login`, stores user in Zustand, redirects to `/dashboard`
  - [x] Show inline error on invalid credentials
  - [x] Loading state on submit button
- [x] Create `src/middleware.ts`
  - [x] Read JWT cookie (`knitting_access_token`)
  - [x] Redirect unauthenticated requests (any path except `/login`) to `/login`
  - [x] Redirect authenticated users away from `/login` to `/dashboard`

### B2 — Authenticated shell layout (`src/app/(dashboard)/layout.tsx`)

- [x] Two-column layout: fixed sidebar (240px) + scrollable main content area
- [x] **Sidebar** (`src/components/layout/sidebar.tsx`)
  - [x] Logo / app name at top ("Knitting Admin")
  - [x] Collapsible sidebar toggle button (chevron icon, like the reference image)
  - [x] Grouped navigation sections with section labels:
    - [x] **CONTENT**: Dashboard, Entries, Queue, Articles
    - [x] **MEDIA**: Media Library
    - [x] **SETTINGS**: Block Templates, Users (admin only)
  - [x] Each nav item: icon + label, active highlight (blue background), hover state
  - [x] Role-conditional items: "Block Templates" and "Users" hidden for non-admin roles
  - [x] Collapsed state: show icons only (no labels), tooltip on hover
- [x] **Top bar** (`src/components/layout/topbar.tsx`)
  - [x] Global search input (searches entries by term — calls `/api/v1/search`)
  - [x] User avatar + name + role badge (from Zustand auth store)
  - [x] Dropdown menu: Profile, Logout
- [x] **Toast area** — Sonner `<Toaster />` mounted in layout
- [x] Root redirect: `/` → `/dashboard`

---

## Phase C — Dashboard overview page

### C1 — Stats cards (`/dashboard`)

- [x] Page fetches aggregate data from API:
  - [x] Total published entries (`GET /api/v1/admin/stats` → `publishedEntries`)
  - [x] Pending queue items (`GET /api/v1/admin/stats` → `pendingQueueItems`)
  - [x] Translation coverage: `GET /api/v1/admin/stats` → `enCoverage`, `plCoverage` (Prisma counts per locale)
- [x] Render 4 stat cards in a grid (like reference image top row):
  - [x] **Published Entries** — count + "View all" link
  - [x] **Pending Submissions** — count + "Review queue" link
  - [x] **EN Coverage** — % of entries with English translation
  - [x] **PL Coverage** — % of entries with Polish translation
- [x] Each card: icon, large number, label, subtle trend or link
- [x] Skeleton loading state while fetching

### C2 — Recent activity table

- [x] Fetch last 10 approved/rejected queue items
- [x] Table columns: Type (entry/translation/correction), Term, Action (approved/rejected), Reviewer, Date
- [x] Status badge: green "Approved" / red "Rejected"
- [x] Empty state: "No recent activity"

---

## Phase D — Entry management

### D1 — Entry list page (`/entries`)

- [x] Page title "Entries" + "New Entry" button (top right, blue, like reference image)
- [x] Stats row: total entry count with icon (like "120 Doctor" in reference)
- [x] Filter bar:
  - [x] Search input (filters by term client-side or via API `q` param)
  - [x] Status select: All / Draft / Review / Published / Deprecated
  - [x] Skill level select: All / Beginner / Intermediate / Advanced / Expert
  - [x] Origin language select: All / en / pl / no / de / fr
- [x] Data table (TanStack Query, paginated 20/page):
  - [x] Columns: Term (en), Origin, Skill Level (badge), Status (badge), Created At, Actions (⋮ menu)
  - [x] Status badge colours: draft=grey, review=yellow, published=green, deprecated=red
  - [x] Skill badge colours: beginner=green, intermediate=blue, advanced=orange, expert=red
  - [x] Row click → navigate to `/entries/[id]`
  - [x] ⋮ menu actions: Edit, Change Status, Delete (with confirm dialog)
- [x] Pagination controls (prev/next + page indicator)
- [x] Skeleton rows while loading

### D2 — Create entry page (`/entries/new`)

- [x] Form card layout
- [x] Fields:
  - [x] Entry type (select): stitch / technique / tool / tradition / yarn_weight
  - [x] Origin language (select): en / pl 
  - [x] Skill level (select)
  - [x] Short definition (textarea, English)
  - [x] Term — English (input)
  - [x] Slug — English (input, auto-generated from term, editable)
- [x] On save: `POST /api/v1/admin/entries` → redirect to `/entries/[id]`
- [x] Cancel button → back to `/entries`
- [x] Validation: all fields required, slug format check (lowercase, hyphens only)

### D3 — Entry editor page (`/entries/[id]`)

- [x] Page header: term (from `en` Translation) + status badge + "View on site" link
- [x] Tabbed interface (shadcn `Tabs`):

#### D3a — Core tab
- [x] Edit `origin_language`, `metadata.skill_level`, `metadata.definition_short`
- [x] Status panel (right side or bottom):
  - [x] Current status badge
  - [x] Promote button: Draft→Review / Review→Published (role-gated)
  - [x] Deprecate button (with confirm dialog)
- [x] Save button → `PUT /api/v1/admin/entries/:id`

#### D3b — Translations tab
- [x] List of locale tabs (en, pl, + any others present)
- [x] Per locale form:
  - [x] Term (input)
  - [x] Slug (input, warn on change)
  - [x] Abbreviation (input, optional)
  - [x] Short definition (textarea)
  - [x] Translation status badge (draft/reviewed/published)
- [x] Per block content editors (based on `content_blocks` layout):
  - [x] `definition` block: plain `<textarea>` for now (TipTap deferred to Phase F)
  - [~] `technique` block: name input, difficulty select, step list (add/remove/reorder)
  - [x] `media` block: alt text input, caption input (URL shown read-only)
  - [x] `callout` block: text input
  - [x] `related` / `pattern_usage`: read-only notice ("Managed in Related tab")
- [x] Save per locale → `PUT /api/v1/admin/entries/:id/translations/:locale`

#### D3c — Related entries tab
- [~] Table of existing `RelatedEntry` rows: linked term (en), relation type, direction
- [~] Add relation: search entries by term (typeahead), select relation type, save
- [~] Remove relation: delete button with confirm

#### D3d — Media tab
- [x] Grid of `MediaAsset` rows: thumbnail, URL, sort order
- [x] Upload new asset: drag-and-drop zone → `POST /api/v1/admin/media/upload`
- [~] Reorder assets (drag handles)
- [x] Delete asset (with confirm)

#### D3e — Blocks tab (admin role only)
- [x] List of `content_blocks` with drag-to-reorder
- [x] Toggle `visible` per block
- [x] Add block type (select + add button)
- [x] Save → `PUT /api/v1/admin/entries/:id/blocks`

---

## Phase E — Queue management

### E1 — Queue layout (`/queue`)

- [ ] Tabs across top: "Entry Submissions" / "Translations" / "Corrections" (like reference image tabs)
- [ ] Badge on each tab showing pending count

### E2 — Entry submissions tab (`/queue` → entries tab)

- [ ] Stats row: pending count
- [ ] Table columns: Term, Definition preview, Category, Origin, Submitted at, Submitter email, Actions
- [ ] Row actions:
  - [ ] **Approve** (green button) → `PATCH /api/v1/admin/queue/entries/:id` `{ action: 'approve' }` → toast success
  - [ ] **Reject** (red button) → opens Dialog with reviewer note textarea → `PATCH` with `{ action: 'reject', reviewer_note }`
  - [ ] **Expand row** → inline preview panel showing full submission payload
- [ ] Optimistic UI: row fades out on approve/reject

### E3 — Translation submissions tab

- [ ] Table columns: Entry term (en), Locale (badge), Translated term, Definition preview, Submitted at, Actions
- [ ] Same approve/reject pattern as E2

### E4 — Corrections tab

- [ ] Table columns: Entry term, Field, Current value, Suggested value, Note, Submitted at, Actions
- [ ] Actions: **Acknowledge** / **Dismiss** (with confirm)

---

## Phase F — Articles management

### F1 — Article list (`/articles`)

- [x] Table columns: Title, Slug, Tags (badges), Country, Author, Created at, Actions
- [x] "New Article" button → `/articles/new`
- [x] Row click → `/articles/[id]`
- [x] ⋮ menu: Edit, Delete (with confirm)

### F2 — Create / edit article (`/articles/new`, `/articles/[id]`)

- [x] Fields: title, slug (auto-generated), content (plain `<textarea>` for now), tags (multi-select), country (select), author (input), cover image (upload)
- [x] Save → `POST` or `PUT /api/v1/articles/:id`

---

## Phase G — Media library (`/media`)

- [x] Grid view of all `MediaAsset` rows (thumbnail, type badge, linked entry term)
- [x] Filter bar: type (image / diagram / video)
- [x] Upload button → drag-and-drop dialog → `POST /api/v1/admin/media/upload`
- [x] Asset card actions: copy CDN URL, go to linked entry editor
- [x] Skeleton grid while loading

---

## Phase H — Settings (admin role only)

### H1 — Block templates (`/settings/templates`)

- [ ] Table: entry type, block count, last updated
- [ ] Click row → edit panel (slide-out Sheet)
  - [ ] List of blocks with type, order, visibility toggle
  - [ ] Add block type, reorder, remove
  - [ ] Warning banner: "Changes apply to new entries only"
  - [ ] Save → `PUT /api/v1/admin/settings/templates/:entry_type`

### H2 — User management (`/users`)

- [ ] Table columns: Name, Email, Role (badge), Created at, Actions
- [ ] "New User" button → Dialog form (name, email, password, role select)
  - [ ] Save → `POST /api/v1/admin/users`
- [ ] Change role: inline role select in row → `PATCH /api/v1/admin/users/:id`
- [ ] Role badge colours: admin=purple, editor=blue, reviewer=grey

---

## Phase I — Cross-cutting concerns

- [ ] **Error boundaries** — per-page error boundary with "Retry" button
- [ ] **Empty states** — illustrated empty state component for all tables (no data yet)
- [ ] **Loading skeletons** — skeleton rows for all tables, skeleton cards for dashboard
- [ ] **Confirm dialogs** — reusable `ConfirmDialog` component (used for delete, reject, deprecate)
- [ ] **Role guard** — `withRole(role)` HOC / hook that redirects or hides UI for insufficient role
- [ ] **Responsive sidebar** — on mobile: sidebar becomes a `Sheet` (slide-out drawer)
- [ ] **Metadata** — update `layout.tsx` title to "Knitting Admin" and add favicon
- [ ] **Type safety** — all API responses typed using `@knitting/types` Zod schemas (`.parse()` or `safeParse()`)
- [ ] **Accessibility** — all interactive elements keyboard-navigable, ARIA labels on icon-only buttons

---

## Delivery order (suggested)

```
A (Foundation) → B (Shell + Auth) → C (Dashboard) → D (Entries) → E (Queue) → F (Articles) → G (Media) → H (Settings) → I (Polish)
```

Each phase is independently deployable — the app is usable after Phase B with a working login and shell.

---

*Created: May 2026*
*API base: `apps/api` (NestJS, port 4000)*
*Admin app: `apps/admin` (Next.js 16, port 3001)*
