# Requirements Document

## Introduction

The admin-categories feature adds a Categories management section to the Knitpedia admin app. It allows editors and admins to create, view, edit, and delete categories used to organise dictionary entries, abbreviations, and articles. Categories are flat (no parent/child hierarchy). Each category has a type (Entry, Abbreviation, Article) that determines which content it can be assigned to. Categories support multilingual translations and a publish/draft status workflow.

The feature spans three layers:
- **API**: Add a `type` field to the Category model and expose it through the admin endpoints.
- **API client library**: Expand `categories.ts` to cover all admin CRUD operations.
- **Admin frontend**: `/categories` list page, `/categories/new` create page, and `/categories/[id]` edit page, plus a sidebar navigation link.

---

## Glossary

- **Category_List_Page**: The `/categories` admin page that displays all categories in a paginated table.
- **Category_Form_Page**: The `/categories/new` and `/categories/[id]` pages used to create or edit a category.
- **Admin_API**: The NestJS backend at `GET|POST|PUT|DELETE /api/v1/admin/categories`.
- **Category**: A flat taxonomy node with a type, status, icon, sort order, cover image, entry count, and multilingual translations.
- **Category_Type**: One of three values — `entry`, `abbreviation`, or `article` — indicating which content the category organises.
- **Translation**: A locale-specific record containing `name`, `slug`, `description`, and `status` for a category.
- **Status**: Either `draft` (not publicly visible) or `published` (publicly visible).
- **Admin_Categories_API_Client**: The `adminCategoriesApi` object in `apps/admin/src/lib/api/categories.ts` that wraps all admin category HTTP calls.

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
7. THE Admin_Categories_API_Client SHALL export TypeScript interfaces `AdminCategory` (with fields `id`, `type`, `icon`, `sort_order`, `status`, `entry_count`, `cover_image_url`, `translations`, `children_count`, `created_at`, `updated_at`), `AdminCategoryListParams` (with optional `page`, `limit`, `search`, `type`, `status`), `CreateCategoryPayload`, `UpdateCategoryPayload`, and `UpsertTranslationPayload` that match the API contract.
8. IF any Admin_Categories_API_Client function receives a non-2xx HTTP response, THEN it SHALL propagate the error thrown by the underlying `apiGet`/`apiPost`/`apiPut`/`apiDelete` helper so that callers can catch and handle it.

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

1. WHEN an editor navigates to `/categories/new`, THE Category_Form_Page SHALL display a form with the following fields: Name (required text, English), Slug (required text, English), Type (required select: Entry / Abbreviation / Article), Icon (optional text), Sort Order (optional number, default 0), Cover Image URL (optional text), and Status (select: Draft / Published, default Draft).
2. WHEN the Name field value changes and the editor has not manually edited the Slug field, THE Category_Form_Page SHALL update the Slug field to the lowercase kebab-case equivalent of the Name value (e.g. "Basic Stitches" → "basic-stitches").
3. WHEN the editor manually edits the Slug field, THE Category_Form_Page SHALL stop auto-populating the Slug field from the Name for the remainder of the session on that page.
4. THE Category_Form_Page SHALL keep the submit button disabled while the Name field is empty or the Type field has no selection.
5. WHEN an editor submits the form with valid data, THE Category_Form_Page SHALL call `POST /api/v1/admin/categories` and, on a 2xx response, navigate to `/categories/[id]` for the newly created category.
6. IF the create API call returns HTTP 409, THEN THE Category_Form_Page SHALL display an inline validation error on the Slug field (e.g. "This slug is already taken") and keep the form open.
7. IF the create API call returns any non-2xx status other than HTTP 409, THEN THE Category_Form_Page SHALL display a toast error message and keep the form open.
8. THE Category_Form_Page SHALL display a "Cancel" button that navigates back to `/categories` without submitting the form.

---

### Requirement 7: Edit Category Page

**User Story:** As an editor, I want to edit an existing category's fields and manage its translations, so that I can keep category data accurate and multilingual.

#### Acceptance Criteria

1. WHEN an editor navigates to `/categories/[id]`, THE Category_Form_Page SHALL call `GET /api/v1/admin/categories/:id` and pre-populate all form fields (Name, Slug of the English translation, Type, Icon, Sort Order, Cover Image URL, Status) with the returned values.
2. WHILE the category data is loading, THE Category_Form_Page SHALL display skeleton placeholders for each form field.
3. IF `GET /api/v1/admin/categories/:id` returns HTTP 404, THEN THE Category_Form_Page SHALL display a "Category not found" message and a link that navigates back to `/categories`.
4. WHEN the category data has loaded, THE Category_Form_Page SHALL display a Translations section listing all existing translations, each showing locale, name, slug, and status.
5. WHEN an editor clicks "Edit" on an existing translation row, THE Category_Form_Page SHALL open a dialog pre-populated with that translation's current name, slug, description, and status.
6. WHEN an editor clicks "Add Translation" for a locale that has no existing translation, THE Category_Form_Page SHALL open a dialog with empty name, slug, description fields and status defaulting to "draft".
7. WHEN an editor submits a translation dialog, THE Category_Form_Page SHALL call `PUT /api/v1/admin/categories/:id/translations/:locale`; on a 2xx response it SHALL close the dialog and refresh the translation list.
8. IF a translation dialog submit returns a non-2xx response, THEN THE Category_Form_Page SHALL display a toast error message and keep the dialog open.
9. WHEN an editor submits the main category form, THE Category_Form_Page SHALL call `PUT /api/v1/admin/categories/:id`; on a 2xx response it SHALL display a success toast.
10. IF `PUT /api/v1/admin/categories/:id` returns HTTP 409, THEN THE Category_Form_Page SHALL display an inline validation error on the Slug field.
11. IF `PUT /api/v1/admin/categories/:id` returns any non-2xx status other than HTTP 409, THEN THE Category_Form_Page SHALL display a toast error message.
12. THE Category_Form_Page SHALL display a "Delete Category" button; WHEN clicked it SHALL show a confirmation dialog; WHEN confirmed it SHALL call `DELETE /api/v1/admin/categories/:id`; on a 2xx response it SHALL navigate back to `/categories`.
13. IF the delete call from the edit page returns HTTP 400, THEN THE Category_Form_Page SHALL display a toast error message indicating the category cannot be deleted while it has entries assigned.

---

### Requirement 8: Category Overview Summary

**User Story:** As an editor, I want to see a summary of category counts by type on the list page, so that I can quickly understand the taxonomy composition.

#### Acceptance Criteria

1. THE Category_List_Page SHALL display a summary panel showing the count of Entry categories, Abbreviation categories, Article categories, and the total count; these counts SHALL reflect all categories in the database regardless of the active search or filter state.
2. WHILE the summary data is loading, THE Category_List_Page SHALL display skeleton placeholders for each count value in the summary panel.
3. THE Category_List_Page SHALL derive the summary counts by making a separate `GET /api/v1/admin/categories` request with a page size large enough to retrieve all categories (e.g. `limit=1000`) independently of the filtered list query.
4. IF the summary data request fails, THEN THE Category_List_Page SHALL display a dash ("—") in place of each count value and show a toast error message.
