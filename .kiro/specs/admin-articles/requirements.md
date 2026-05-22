# Requirements Document

## Introduction

Phase F adds article management to the Knitting Encyclopedia admin dashboard (`apps/admin`, Next.js 16 App Router, port 3001). Editors and administrators can list, create, edit, and delete editorial articles. Articles are distinct from encyclopedia entries: they are long-form content pieces with a title, slug, rich-text body, tags, country association, author attribution, and an optional cover image.

The feature consists of two surfaces:
- **F1 — Article list** (`/articles`): paginated table with search, row navigation, and row-level actions.
- **F2 — Article editor** (`/articles/new` and `/articles/[id]`): form for creating and editing articles, including cover-image upload.

All API calls use the existing `articlesApi` client (`src/lib/api/articles.ts`) and `mediaApi.uploadMedia()` for cover images. UI components come exclusively from the existing shadcn/ui library. Patterns follow the reference implementation in `/entries` and `/entries/[id]`.

---

## Glossary

- **Article**: A long-form editorial content piece stored in the backend, identified by a unique `id` and a URL-safe `slug`.
- **Article_List_Page**: The admin page at `/articles` that displays a paginated table of articles.
- **Article_Editor_Page**: The admin page at `/articles/new` (create) or `/articles/[id]` (edit) that renders the article form.
- **Article_Form**: The set of input controls on the Article_Editor_Page used to author or modify an article.
- **Slug**: A URL-safe string composed of lowercase letters, digits, and hyphens, uniquely identifying an article.
- **Cover_Image**: An optional image file uploaded via `mediaApi.uploadMedia()` and stored as a CDN URL on the article.
- **Tags**: An optional ordered list of free-text label strings associated with an article, rendered as badges.
- **articlesApi**: The existing TypeScript API client at `src/lib/api/articles.ts` exposing `listArticles()`, `getArticle()`, `createArticle()`, and `updateArticle()`.
- **TanStack_Query**: The data-fetching and caching library configured with `staleTime: 30s` and `retry: 1`.
- **ConfirmDialog**: The existing reusable confirmation dialog component at `src/components/ui/confirm-dialog`.
- **Sonner**: The toast notification library used for success and error feedback.

---

## Requirements

### Requirement 1: Article List Page

**User Story:** As an editor, I want to see a paginated table of all articles, so that I can quickly find and navigate to any article.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to `/articles`, THE Article_List_Page SHALL display a data table with columns: Title, Slug, Tags, Country, Author, Created At, and Actions.
2. WHEN the article list is loading, THE Article_List_Page SHALL display skeleton rows in place of the table body.
3. WHEN the article list loads successfully and contains articles, THE Article_List_Page SHALL render one row per article with the correct field values.
4. WHEN the article list loads successfully and contains no articles, THE Article_List_Page SHALL display an empty-state message in place of the table rows.
5. WHEN an article has one or more tags, THE Article_List_Page SHALL render each tag as a Badge component within the Tags column.
6. WHEN an article has no tags, THE Article_List_Page SHALL display a dash (`—`) in the Tags column.
7. THE Article_List_Page SHALL display a "New Article" button that navigates to `/articles/new` when clicked.
8. WHEN a user clicks anywhere on a table row, THE Article_List_Page SHALL navigate to `/articles/[id]` for that article.
9. WHEN a user clicks the Actions menu (⋮) on a row, THE Article_List_Page SHALL display an "Edit" option and a "Delete" option.
10. WHEN a user selects "Edit" from the Actions menu, THE Article_List_Page SHALL navigate to `/articles/[id]`.
11. WHEN a user selects "Delete" from the Actions menu, THE Article_List_Page SHALL open a ConfirmDialog asking the user to confirm deletion.
12. WHEN a user confirms deletion in the ConfirmDialog, THE Article_List_Page SHALL call `DELETE /api/v1/articles/:id`, show a success toast via Sonner, and refresh the article list.
13. IF the delete API call fails, THEN THE Article_List_Page SHALL show an error toast via Sonner and leave the article in the list.
14. THE Article_List_Page SHALL always display pagination controls (previous/next buttons and a page indicator), regardless of whether the article list is empty.
15. WHEN a user clicks the previous or next pagination button, THE Article_List_Page SHALL fetch and display the corresponding page of articles.

---

### Requirement 2: Article Search and Filtering

**User Story:** As an editor, I want to search articles by title, so that I can quickly locate a specific article in a large list.

#### Acceptance Criteria

1. THE Article_List_Page SHALL display a search input in a filter bar above the table.
2. WHEN a user types in the search input, THE Article_List_Page SHALL debounce the input by 300 ms before issuing a new API request with the `q` parameter.
3. WHEN the search query changes, THE Article_List_Page SHALL reset the current page to 1.
4. WHEN the search input is cleared, THE Article_List_Page SHALL fetch and display the unfiltered article list.

---

### Requirement 3: Create Article

**User Story:** As an editor, I want to create a new article with all required metadata, so that I can publish editorial content on the encyclopedia.

#### Acceptance Criteria

1. WHEN a user navigates to `/articles/new`, THE Article_Editor_Page SHALL display the Article_Form with empty fields.
2. THE Article_Form SHALL include the following fields: Title (required text input), Slug (required text input, auto-generated), Content (optional textarea), Tags (optional multi-value text input), Country (optional select), Author (optional text input), and Cover Image (optional file upload).
3. WHEN a user types in the Title field, THE Article_Form SHALL automatically derive the Slug value by converting the title to lowercase, replacing spaces with hyphens, and removing non-alphanumeric characters (except hyphens).
4. WHEN a user manually edits the Slug field, THE Article_Form SHALL stop auto-generating the slug from the title for the remainder of that session.
5. WHEN a user submits the Article_Form with a missing Title, THE Article_Form SHALL display an inline validation error on the Title field and prevent submission, regardless of any prior validation state.
6. WHEN a user submits the Article_Form with a missing or empty Slug, THE Article_Form SHALL display an inline validation error on the Slug field and prevent submission.
7. WHEN a user submits the Article_Form with a Slug that does not match the pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$`, THE Article_Form SHALL display an inline validation error on the Slug field and prevent submission.
8. WHEN a user submits a valid Article_Form on the create page, THE Article_Editor_Page SHALL call `POST /api/v1/articles` with the form data, show a success toast, and redirect to `/articles/[id]` for the newly created article.
9. IF the create API call fails, THEN THE Article_Editor_Page SHALL show an error toast and keep the form in its current state.
10. THE Article_Editor_Page SHALL display a "Cancel" button that navigates back to `/articles` without saving.

---

### Requirement 4: Edit Article

**User Story:** As an editor, I want to edit an existing article's fields, so that I can correct or update published content.

#### Acceptance Criteria

1. WHEN a user navigates to `/articles/[id]`, THE Article_Editor_Page SHALL fetch the article via `getArticle(id)` and pre-populate all Article_Form fields with the existing values.
2. WHEN the article is loading, THE Article_Editor_Page SHALL display skeleton placeholders in place of the form fields.
3. IF the article fetch fails or the article is not found, THEN THE Article_Editor_Page SHALL display an error state with a "Retry" button.
4. WHEN a user modifies fields and submits the Article_Form on the edit page and the API call succeeds, THE Article_Editor_Page SHALL show a success toast and invalidate the TanStack_Query cache for that article.
5. IF the update API call fails, THEN THE Article_Editor_Page SHALL show an error toast and keep the form in its current state without showing a success toast or invalidating the cache.
6. THE Article_Editor_Page SHALL display a breadcrumb or back-navigation link that returns the user to `/articles`.

---

### Requirement 5: Cover Image Upload

**User Story:** As an editor, I want to upload a cover image for an article, so that the article has a visual header on the public site.

#### Acceptance Criteria

1. THE Article_Form SHALL include a Cover Image upload control that accepts image files.
2. WHEN a user selects an image file in the Cover Image control, THE Article_Form SHALL call `mediaApi.uploadMedia()` with the selected file, display an upload-in-progress indicator, and update the `cover_image_url` field with the returned CDN URL upon success.
3. WHEN a cover image URL is present (either pre-populated from an existing article or just uploaded), THE Article_Form SHALL display a thumbnail preview of the image.
4. WHEN a user clicks a remove/clear button on the cover image preview, THE Article_Form SHALL clear the `cover_image_url` field and remove the thumbnail.
5. IF the cover image upload fails, THEN THE Article_Form SHALL show an error toast and leave the Cover Image field unchanged.

---

### Requirement 6: Tags Multi-Input

**User Story:** As an editor, I want to add and remove multiple tags on an article, so that the article is discoverable by topic.

#### Acceptance Criteria

1. THE Article_Form SHALL display a tags input that allows entering multiple tag strings.
2. WHEN a user types a tag value and presses Enter or a comma, THE Article_Form SHALL add the tag to the tags list and clear the tag input field.
3. WHEN a user clicks the remove control on an existing tag badge, THE Article_Form SHALL remove that tag from the tags list.
4. THE Article_Form SHALL render each current tag as a Badge with a remove (×) button.
5. WHEN the Article_Form is submitted, THE Article_Form SHALL include the current tags list in the payload sent to the API.

---

### Requirement 7: Navigation and Sidebar Integration

**User Story:** As an editor, I want the Articles section to be accessible from the sidebar, so that I can navigate to it from anywhere in the admin dashboard.

#### Acceptance Criteria

1. THE Sidebar SHALL include an "Articles" navigation item under the CONTENT section that links to `/articles`.
2. WHEN the current route starts with `/articles`, THE Sidebar SHALL render the "Articles" navigation item with the active highlight style.
3. THE Article_List_Page SHALL be rendered within the authenticated dashboard layout (sidebar + topbar).
4. THE Article_Editor_Page SHALL be rendered within the authenticated dashboard layout (sidebar + topbar).
