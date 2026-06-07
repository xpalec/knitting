# Requirements Document

## Introduction

The admin-categories feature adds a Categories management section to the Knitpedia admin app. It allows editors and admins to create, view, edit, and delete categories used to organise dictionary entries, abbreviations, and articles. Categories are hierarchical — each category optionally belongs to a parent category via `parent_id` (self-join); top-level categories have `parent_id = null`. Each category has a type (Entry, Abbreviation, Article) that determines which content it can be assigned to. Categories support multilingual translations and a publish/draft status workflow.

The feature spans three layers:
- **API**: Add a `type` field to the Category model and expose it through the admin endpoints.
- **API client library**: Expand `categories.ts` to cover all admin CRUD operations.
- **Admin frontend**: `/categories` list page, `/categories/new` create page, and `/categories/[id]` edit page, plus a sidebar navigation link.

---

## Glossary

- **Category_List_Page**: The `/categories` admin page that displays all categories in a paginated table.
- **Category_Form_Page**: The `/categories/new` and `/categories/[id]` pages used to create or edit a category.
- **Admin_API**: The NestJS backend at `GET|POST|PUT|DELETE /api/v1/admin/categories`.
- **Category**: A hierarchical taxonomy node with a type, optional parent, status, icon, sort order, cover image, entry count, and multilingual translations. `Category` has no `name` or `slug` columns — those live exclusively in `CategoryTranslation`.
- **Category_Type**: One of three values — `entry`, `abbreviation`, or `article` — indicating which content the category organises.
- **CategoryTranslation**: A locale-specific record containing `name`, `slug`, `short_description`, `description` (TipTap JSON), `seo_title`, `seo_description`, `translator_note`, and `status` for a category. One row per locale per category.
- **Translation_Status**: One of three values — `draft`, `reviewed`, or `published` — indicating the editorial state of a single locale's translation.
- **Status**: The category-level publication status. Either `draft` (not publicly visible) or `published` (publicly visible).
- **Admin_Categories_API_Client**: The `adminCategoriesApi` object in `apps/admin/src/lib/api/categories.ts` that wraps all admin category HTTP calls.
- **TipTap_JSON**: A JSON document conforming to the TipTap ProseMirror node schema used for the `description` field in `CategoryTranslation`.
- **Supported_Locales**: The five locales supported for category translations: `en` (English), `pl` (Polish), `fr` (Français), `de` (Deutsch), `no` (Norwegian).

---

## Requirements

### Requirement 1: Category Type Field

**User Story:** As an editor, I want each category to have a type (Entry, Abbreviation, Article), so that I can understand which content the category organises.

#### Acceptance Criteria

1. THE Admin_API SHALL include a `type` field with values `entry`, `abbreviation`, or `article` in every Category response object returned by `GET /api/v1/admin/categories`, `GET /api/v1/admin/categories/:id`, `POST /api/v1/admin/categories`, and `PUT /api/v1/admin/categories/:id`.
2. WHEN a category is created via `POST /api/v1/admin/categories`, THE Admin_API SHALL require a `type` field with one of the three valid values (`entry`, `abbreviation`, `article`).
3. IF a `POST /api/v1/admin/categories` request omits the `type` field or provides a value outside `entry`, `abbreviation`, `article`, THEN THE Admin_API SHALL return HTTP 400 with a validation error message indicating the `type` field is missing or invalid, without creating the category.
4. WHEN a category is updated via `PUT /api/v1/admin/categories/:id`, THE Admin_API SHALL allow updating the `type` field to any of the three valid values.
5. IF a `PUT /api/v1/admin/categories/:id` request provides a `type` value outside `entry`, `abbreviation`, `article`, THEN THE Admin_API SHALL return HTTP 400 with a validation error message indicating the `type` field is invalid, without modifying the category.

---

### Requirement 2: Admin Categories API Client

**User Story:** As a frontend developer, I want a typed API client for admin category operations, so that I can call the backend without writing raw fetch calls.

#### Acceptance Criteria

1. THE Admin_Categories_API_Client SHALL expose a `listCategories(params: AdminCategoryListParams)` function that calls `GET /api/v1/admin/categories` using `apiGetWithMeta` and returns `Promise<ApiResponse<AdminCategory[]>>`.
2. THE Admin_Categories_API_Client SHALL expose a `getCategory(id: string)` function that calls `GET /api/v1/admin/categories/:id` using `apiGet` and returns `Promise<AdminCategory>`.
3. THE Admin_Categories_API_Client SHALL expose a `createCategory(dto: CreateCategoryPayload)` function that calls `POST /api/v1/admin/categories` using `apiPost` and returns `Promise<AdminCategory>`.
4. THE Admin_Categories_API_Client SHALL expose an `updateCategory(id: string, dto: UpdateCategoryPayload)` function that calls `PUT /api/v1/admin/categories/:id` using `apiPut` and returns `Promise<AdminCategory>`.
5. THE Admin_Categories_API_Client SHALL expose a `deleteCategory(id: string)` function that calls `DELETE /api/v1/admin/categories/:id` using `apiDelete` and returns `Promise<void>`.
6. THE Admin_Categories_API_Client SHALL expose an `upsertTranslation(id: string, locale: string, dto: UpsertTranslationPayload)` function that calls `PUT /api/v1/admin/categories/:id/translations/:locale` using `apiPut` and returns `Promise<AdminCategoryTranslation>`.
7. THE Admin_Categories_API_Client SHALL export TypeScript interfaces `AdminCategory` (with fields `id`, `type`, `parent_id`, `icon`, `sort_order`, `status`, `entry_count`, `cover_image_url`, `translations`, `children_count`, `created_at`, `updated_at`), `AdminCategoryTranslation` (with fields `locale`, `name`, `slug`, `short_description`, `description`, `seo_title`, `seo_description`, `translator_note`, `status`), `AdminCategoryListParams`, `CreateCategoryPayload`, `UpdateCategoryPayload`, and `UpsertTranslationPayload` that match the API contract.
8. THE `CreateCategoryPayload` interface SHALL NOT include `name_en` or `slug_en` fields. WHEN creating a category, THE Admin_Categories_API_Client SHALL send only the language-independent fields (`type`, `parent_id`, `icon`, `sort_order`, `cover_image_url`, `status`) in the `POST /api/v1/admin/categories` request; translations SHALL be created separately via `upsertTranslation`.
9. IF any Admin_Categories_API_Client function receives a non-2xx HTTP response, THEN it SHALL propagate the error thrown by the underlying `apiGet`/`apiPost`/`apiPut`/`apiDelete` helper so that callers can catch and handle it.

---

### Requirement 3: Sidebar Navigation

**User Story:** As an editor, I want a "Categories" link in the admin sidebar, so that I can navigate to the categories section from anywhere in the app.

#### Acceptance Criteria

1. THE Sidebar SHALL display a "Categories" navigation item with href `/categories` in the CONTENT section, positioned after the "Articles" item, using the `Tag` icon from `lucide-react`.
2. WHEN the current pathname starts with `/categories`, THE Sidebar SHALL apply the active styles (`bg-blue-50 text-blue-700` on the link and `text-blue-600` on the icon) to the "Categories" item, matching the pattern used by all other active nav items.
3. THE Sidebar SHALL display the "Categories" item to all authenticated users regardless of role (no `adminOnly` flag).
4. WHEN the sidebar is in collapsed state, THE Sidebar SHALL render the "Categories" item as a 40×40 px icon-only button with a tooltip showing "Categories" on hover, matching the collapsed behaviour of all other nav items.

---

### Requirement 4: Category List Page

**User Story:** As an editor, I want to see all categories in a paginated table with filtering, so that I can quickly find and manage any category.

#### Acceptance Criteria

1. WHEN an editor navigates to `/categories`, THE Category_List_Page SHALL fetch categories from `GET /api/v1/admin/categories` using TanStack Query and render them in a table.
2. THE Category_List_Page SHALL display the following columns: Name (text), Type (badge), Entry Count (number), Status (badge), Updated date, and an Actions menu column.
3. IF a category has a non-null `icon` value, THEN THE Category_List_Page SHALL render the icon alongside the category name in the Name column.
4. THE Category_List_Page SHALL display a search input that sends the search term as the `search` query parameter to `GET /api/v1/admin/categories` after a 300 ms debounce, and resets the page to 1 on each new search.
5. THE Category_List_Page SHALL display a Type filter select (options: All / Entry / Abbreviation / Article) that sends the selected value as the `type` query parameter to `GET /api/v1/admin/categories` and resets the page to 1 on change.
6. THE Category_List_Page SHALL display a Status filter select (options: All / Draft / Published) that sends the selected value as the `status` query parameter to `GET /api/v1/admin/categories` and resets the page to 1 on change.
7. THE Category_List_Page SHALL paginate results at 20 items per page and display Prev/Next buttons and a "Page X of Y" label; the Prev button SHALL be disabled when on page 1 and the Next button SHALL be disabled when on the last page.
8. WHEN the list is loading, THE Category_List_Page SHALL display 5 skeleton rows in place of the table body.
9. WHEN the list is not loading and the API returns zero categories for the current filters, THE Category_List_Page SHALL display an empty-state section with an icon and a message; this section SHALL NOT be rendered while loading.
10. THE Category_List_Page SHALL display the total count of categories matching the current filters above the table (e.g. "28 categories").
11. WHEN an editor clicks a table row, THE Category_List_Page SHALL navigate to `/categories/[id]` for that row's category.
12. THE Category_List_Page SHALL display a "+ Add Category" button that navigates to `/categories/new`.
13. THE Category_List_Page SHALL display an Export button that, when clicked, fetches all categories matching the current filters and triggers a browser download of a CSV file named `categories.csv`.
14. THE Category_List_Page SHALL display an Import button that, when clicked, opens a file picker accepting `.csv` files up to 5 MB; IF the selected file exceeds 5 MB or is not a `.csv`, THEN THE Category_List_Page SHALL display a toast error and abort the import without sending a request.
15. IF the `GET /api/v1/admin/categories` request fails, THEN THE Category_List_Page SHALL display a toast error message and render an empty table body without skeleton rows.

---

### Requirement 5: Category Actions Menu

**User Story:** As an editor, I want per-row actions on the category list, so that I can edit or delete a category without leaving the list.

#### Acceptance Criteria

1. THE Category_List_Page SHALL display a "⋯" actions menu button on each table row containing "Edit" and "Delete" menu items.
2. WHEN an editor selects "Edit" from the actions menu, THE Category_List_Page SHALL navigate to `/categories/[id]` for that row's category.
3. WHEN an editor selects "Delete" from the actions menu, THE Category_List_Page SHALL display a confirmation dialog with the category name before sending any request.
4. WHEN an editor cancels the confirmation dialog, THE Category_List_Page SHALL close the dialog and take no further action.
5. WHEN an editor confirms the deletion, THE Category_List_Page SHALL send `DELETE /api/v1/admin/categories/:id`; IF the response status is HTTP 2xx, THEN THE Category_List_Page SHALL display a success toast, close the dialog, and re-fetch the category list without a full page reload.
6. IF the delete API call returns HTTP 400, THEN THE Category_List_Page SHALL display a toast error message indicating the category cannot be deleted while it has entries assigned.
7. IF the delete API call returns any non-2xx status other than HTTP 400, THEN THE Category_List_Page SHALL display a generic toast error message.

---

### Requirement 6: Create Category Page

**User Story:** As an editor, I want a form to create a new category, so that I can add new taxonomy nodes to the dictionary.

#### Acceptance Criteria

1. WHEN an editor navigates to `/categories/new`, THE Category_Form_Page SHALL display a form with two sections: a language-independent section and a tabbed per-language translation section.
2. THE language-independent section SHALL contain the following fields: Type (required select: Entry / Abbreviation / Article), Parent Category (optional select populated from all existing categories, with a "None — top-level category" option), Icon (optional text), Sort Order (optional number, default 0), Cover Image URL (optional text), and Status (select: Draft / Published, default Draft).
3. THE tabbed per-language translation section SHALL display one tab per Supported_Locale (`en`, `pl`, `fr`, `de`, `no`), with each tab containing the following fields for that locale: Name (required text), Slug (auto-generated from Name, editable), Short Description (optional plain text, single-line), Description (optional TipTap rich-text editor), SEO Title (optional text, ≤60 chars), SEO Description (optional text, ≤160 chars), and Translation Status (select: Draft / Reviewed / Published, default Draft).
4. WHEN the Name field value changes within a language tab and the editor has not manually edited the Slug field for that locale, THE Category_Form_Page SHALL update the Slug field for that locale to the lowercase kebab-case equivalent of the Name value (e.g. "Basic Stitches" → "basic-stitches").
5. WHEN the editor manually edits a Slug field within any language tab, THE Category_Form_Page SHALL stop auto-populating that locale's Slug field from the Name for the remainder of the session on that page.
6. THE Category_Form_Page SHALL keep the submit button disabled while the English (EN) Name field is empty or the Type field has no selection.
7. WHEN an editor submits the form, THE Category_Form_Page SHALL call `POST /api/v1/admin/categories` with only the language-independent fields; on a 2xx response it SHALL call `PUT /api/v1/admin/categories/:id/translations/:locale` for each locale tab that has a non-empty Name field; on completion it SHALL navigate to `/categories/[id]` for the newly created category.
8. IF any create or translation API call returns HTTP 409, THEN THE Category_Form_Page SHALL display an inline validation error on the Slug field of the affected locale tab (e.g. "This slug is already taken") and keep the form open.
9. IF any create or translation API call returns any non-2xx status other than HTTP 409, THEN THE Category_Form_Page SHALL display a toast error message and keep the form open.
10. THE Category_Form_Page SHALL display a "Cancel" button that navigates back to `/categories` without submitting the form.

---

### Requirement 7: Edit Category Page

**User Story:** As an editor, I want to edit an existing category's fields and manage its translations inline on the same page, so that I can keep category data accurate and multilingual without navigating away.

#### Acceptance Criteria

1. WHEN an editor navigates to `/categories/[id]`, THE Category_Form_Page SHALL call `GET /api/v1/admin/categories/:id` and pre-populate all form fields — language-independent fields (Type, Parent Category, Icon, Sort Order, Cover Image URL, Status) and per-locale translation fields (Name, Slug, Short Description, Description, SEO Title, SEO Description, Translation Status) for each Supported_Locale tab.
2. WHILE the category data is loading, THE Category_Form_Page SHALL display skeleton placeholders for each form field.
3. IF `GET /api/v1/admin/categories/:id` returns HTTP 404, THEN THE Category_Form_Page SHALL display a "Category not found" message and a link that navigates back to `/categories`.
4. THE Category_Form_Page SHALL display the per-language translation fields as tabs labelled by locale (e.g. "EN English", "PL Polish", "FR Français", "DE Deutsch", "NO Norwegian"); each tab SHALL show the translation fields for that locale.
5. WHEN the category data has loaded, THE Category_Form_Page SHALL pre-populate each locale tab with the corresponding `CategoryTranslation` data if it exists, or show empty fields if no translation exists yet for that locale.
6. THE Category_Form_Page SHALL render the `description` field in each locale tab using a TipTap rich-text editor component, not a plain textarea; the editor SHALL accept and produce TipTap_JSON.
7. WHEN an editor submits the main category form, THE Category_Form_Page SHALL call `PUT /api/v1/admin/categories/:id` with the language-independent fields and `PUT /api/v1/admin/categories/:id/translations/:locale` for each locale tab whose Name field is non-empty; on successful completion it SHALL display a success toast and invalidate the cached category data.
8. IF `PUT /api/v1/admin/categories/:id` returns HTTP 409 for a slug conflict on any locale, THEN THE Category_Form_Page SHALL display an inline validation error on the Slug field of the affected locale tab and keep the form open.
9. IF `PUT /api/v1/admin/categories/:id` or any translation upsert returns any non-2xx status other than HTTP 409, THEN THE Category_Form_Page SHALL display a toast error message.
10. THE Category_Form_Page SHALL display a "Delete Category" button; WHEN clicked it SHALL show a confirmation dialog containing the category name; WHEN confirmed it SHALL call `DELETE /api/v1/admin/categories/:id`; on a 2xx response it SHALL navigate back to `/categories`.
11. IF the delete call from the edit page returns HTTP 400, THEN THE Category_Form_Page SHALL display a toast error message indicating the category cannot be deleted while it has entries assigned.

---

### Requirement 8: Parent Category Selector

**User Story:** As an editor, I want to assign a parent category when creating or editing a category, so that I can build a hierarchical taxonomy with subcategories.

#### Acceptance Criteria

1. THE Category_Form_Page SHALL display a Parent Category select field in the language-independent section, populated by fetching all existing categories from `GET /api/v1/admin/categories`.
2. THE Parent Category select field SHALL include a "None — top-level category" option that sets `parent_id` to `null`.
3. WHEN an editor selects a parent category, THE Category_Form_Page SHALL set `parent_id` to the selected category's `id` in the create or update payload.
4. WHEN editing an existing category, THE Category_Form_Page SHALL pre-select the category's current `parent_id` value in the Parent Category select field; WHEN `parent_id` is `null`, THE Category_Form_Page SHALL display "None — top-level category" as the selected option.
5. THE Parent Category select SHALL display each option as the category's English name (from its `en` translation), with a fallback to the category `id` if no English translation exists.
6. IF fetching the parent category list fails, THEN THE Category_Form_Page SHALL display a toast error and render the Parent Category field in a disabled state.

---

### Requirement 9: CategoryTranslation SEO and Short Description Fields

**User Story:** As an editor, I want SEO title, SEO description, and a short description for each category translation, so that I can optimise category pages for search engines and provide concise summaries.

#### Acceptance Criteria

1. THE Admin_API SHALL include `seo_title` (string or null, ≤60 chars), `seo_description` (string or null, ≤160 chars), and `short_description` (string or null) fields in every `CategoryTranslation` object returned by `GET /api/v1/admin/categories/:id` and translation upsert responses.
2. THE `UpsertTranslationPayload` interface SHALL include optional `seo_title` (string, ≤60 chars), `seo_description` (string, ≤160 chars), and `short_description` (string) fields.
3. WHEN an editor enters more than 60 characters in the SEO Title field of a locale tab, THE Category_Form_Page SHALL display an inline character count indicator showing the number of characters remaining (e.g. "58/60").
4. WHEN an editor enters more than 160 characters in the SEO Description field of a locale tab, THE Category_Form_Page SHALL display an inline character count indicator showing the number of characters remaining (e.g. "145/160").
5. IF a `PUT /api/v1/admin/categories/:id/translations/:locale` request includes a `seo_title` value exceeding 60 characters or a `seo_description` value exceeding 160 characters, THEN THE Admin_API SHALL return HTTP 400 with a validation error, without persisting the translation.
6. THE Category_Form_Page SHALL display the Short Description field as a single-line plain text input (not a rich-text editor), distinct from the TipTap Description field.

---

### Requirement 10: TipTap Description Editor

**User Story:** As an editor, I want a rich-text editor for the description field in each translation tab, so that I can write formatted category introductions with headings, bold text, and links.

#### Acceptance Criteria

1. THE Category_Form_Page SHALL render the Description field in each locale tab using a TipTap editor component that supports the permitted node types: `paragraph`, `heading` (h2, h3), `bold` (mark), `italic` (mark), `hard_break`, and `entry_link` (custom inline node linking to an entry by UUID).
2. WHEN an editor types in the TipTap editor, THE Category_Form_Page SHALL store the editor content as TipTap_JSON in the component state and include it as the `description` field value when submitting the translation payload.
3. WHEN the category data has loaded on the edit page and a locale's `CategoryTranslation.description` is non-null, THE Category_Form_Page SHALL initialise the TipTap editor for that locale with the stored TipTap_JSON content.
4. WHEN a locale's `CategoryTranslation.description` is `null` or the translation does not exist, THE Category_Form_Page SHALL initialise the TipTap editor for that locale as an empty document.
5. THE TipTap editor component SHALL be the same editor component used elsewhere in the admin app (shared component); no duplicate implementation SHALL be introduced.

---

### Requirement 11: Category Overview Summary

**User Story:** As an editor, I want to see a summary of category counts by type on the list page, so that I can quickly understand the taxonomy composition.

#### Acceptance Criteria

1. THE Category_List_Page SHALL display a summary panel showing the count of Entry categories, Abbreviation categories, Article categories, and the total count; these counts SHALL reflect all categories in the database regardless of the active search or filter state.
2. WHILE the summary data is loading, THE Category_List_Page SHALL display skeleton placeholders for each count value in the summary panel.
3. THE Category_List_Page SHALL derive the summary counts by making a separate `GET /api/v1/admin/categories` request with a page size large enough to retrieve all categories (e.g. `limit=1000`) independently of the filtered list query.
4. IF the summary data request fails, THEN THE Category_List_Page SHALL display a dash ("—") in place of each count value and show a toast error message.
