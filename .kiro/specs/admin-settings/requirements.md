# Requirements Document

## Introduction

Phase H adds two admin-only pages to the Knitting Encyclopedia admin dashboard (`apps/admin`, Next.js 16 App Router, port 3001): a block template editor (`/settings/templates`) and a user management page (`/users`). Both pages are restricted to users with the `admin` role.

**H1 — Block Templates** (`/settings/templates`): Admins can view all entry-type block templates in a table and open a slide-out Sheet to edit the block list for any template (add, reorder, toggle visibility, remove). Changes are saved via `PUT /api/v1/admin/settings/templates/:entry_type` and apply only to new entries.

**H2 — User Management** (`/users`): Admins can view all users in a paginated table, create new users via a dialog form, and change any user's role via an inline select in the table row.

All API calls use the existing typed clients: `src/lib/api/templates.ts` (`templatesApi`) and `src/lib/api/users.ts` (`usersApi`). UI components come exclusively from the existing shadcn/ui library. Patterns follow the reference implementations in `/articles` (list + dialog) and the Blocks tab in `/entries/[id]` (block list + add/toggle).

---

## Glossary

- **Admin_User**: A user whose `role` field equals `'admin'` in the Zustand auth store (`useAuthStore`).
- **Block_Template**: A server-side record keyed by `entry_type` that defines the default ordered list of content blocks applied to new entries of that type. Represented by the `BlockTemplate` interface in `src/lib/api/templates.ts`.
- **BlockTemplateItem**: A single block within a `Block_Template`, with fields `type: string`, `order: number`, and `visible: boolean`.
- **Entry_Type**: One of the five fixed values: `stitch`, `technique`, `tool`, `tradition`, `yarn_weight`.
- **Template_Editor_Sheet**: The slide-out `Sheet` component opened when an admin clicks a template row, used to edit that template's block list.
- **AdminUser**: A user record returned by the users API, with fields `id`, `name?`, `email`, `role`, and `created_at`. (Distinct from Admin_User above.)
- **UserRole**: One of three fixed values: `admin`, `editor`, `reviewer`.
- **New_User_Dialog**: The `Dialog` component opened when an admin clicks "New User", used to create a new user account.
- **templatesApi**: The existing TypeScript API client at `src/lib/api/templates.ts` exposing `listTemplates()` and `updateTemplate()`.
- **usersApi**: The existing TypeScript API client at `src/lib/api/users.ts` exposing `listUsers()`, `createUser()`, and `updateUserRole()`.
- **TanStack_Query**: The data-fetching and caching library configured with `staleTime: 30s` and `retry: 1`.
- **ConfirmDialog**: The existing reusable confirmation dialog at `src/components/ui/confirm-dialog`.
- **Sonner**: The toast notification library used for success and error feedback.

---

## Requirements

### Requirement 1: Block Templates Page

**User Story:** As an admin, I want to view and edit block templates for each entry type, so that I can control which content blocks are included by default when new entries are created.

#### Acceptance Criteria

1. WHEN an Admin_User navigates to `/settings/templates`, THE Templates_Page SHALL display a data table with columns: Entry Type, Block Count, Last Updated, and Actions.
2. WHEN the template list is loading, THE Templates_Page SHALL display skeleton rows in place of the table body.
3. WHEN the template list loads successfully, THE Templates_Page SHALL render one row per `Block_Template` with the correct `entry_type`, `block_count`, and formatted `updated_at` values.
4. WHEN a non-admin user navigates to `/settings/templates`, THE Templates_Page SHALL redirect the user to `/dashboard`.
5. WHEN an Admin_User clicks a table row or the Edit action for a template, THE Templates_Page SHALL open the Template_Editor_Sheet for that template.
6. WHEN the Template_Editor_Sheet opens, THE Template_Editor_Sheet SHALL display the current list of `BlockTemplateItem` entries with each item's type, order, and visibility state.
7. WHEN the Template_Editor_Sheet opens, THE Template_Editor_Sheet SHALL display a warning banner stating that changes apply to new entries only.
8. WHEN an Admin_User saves changes in the Template_Editor_Sheet, THE Template_Editor_Sheet SHALL call `PUT /api/v1/admin/settings/templates/:entry_type` with the updated blocks array, show a success toast, close the Sheet, and refresh the template list.
9. IF the save API call fails, THEN THE Template_Editor_Sheet SHALL show an error toast and keep the Sheet open with the current edits intact.

---

### Requirement 2: Block List Editing

**User Story:** As an admin, I want to add, reorder, toggle, and remove blocks within a template, so that I can customise the default block structure for each entry type.

#### Acceptance Criteria

1. THE Template_Editor_Sheet SHALL display an "Add block" control consisting of a type select and an "Add" button.
2. WHEN an Admin_User selects a block type and clicks "Add", THE Template_Editor_Sheet SHALL append a new `BlockTemplateItem` with `visible: true` and an `order` equal to the current block count plus one.
3. WHEN an Admin_User clicks the up arrow on a block that is not the first in the list, THE Template_Editor_Sheet SHALL swap that block with the block above it and renumber all `order` fields to match the new positions.
4. WHEN an Admin_User clicks the down arrow on a block that is not the last in the list, THE Template_Editor_Sheet SHALL swap that block with the block below it and renumber all `order` fields to match the new positions.
5. WHEN an Admin_User toggles the visibility checkbox on a block, THE Template_Editor_Sheet SHALL update that block's `visible` field to the new value.
6. WHEN an Admin_User clicks the remove button on a block, THE Template_Editor_Sheet SHALL remove that block from the list and renumber all remaining `order` fields so they are contiguous starting from 1.
7. WHILE the Template_Editor_Sheet is open, THE Template_Editor_Sheet SHALL reflect all add, reorder, toggle, and remove operations immediately in the UI without making any API calls.

---

### Requirement 3: User Management Page

**User Story:** As an admin, I want to view all users in a paginated table, so that I can manage who has access to the admin dashboard and what role they hold.

#### Acceptance Criteria

1. WHEN an Admin_User navigates to `/users`, THE Users_Page SHALL display a data table with columns: Name, Email, Role, Created At, and Actions.
2. WHEN the user list is loading, THE Users_Page SHALL display skeleton rows in place of the table body.
3. WHEN the user list loads successfully, THE Users_Page SHALL render one row per `AdminUser` with the correct field values.
4. WHEN the user list loads successfully and contains no users, THE Users_Page SHALL display an empty-state message in place of the table rows.
5. WHEN a non-admin user navigates to `/users`, THE Users_Page SHALL redirect the user to `/dashboard`.
6. THE Users_Page SHALL always display pagination controls (previous/next buttons and a page indicator), regardless of whether the user list is empty.
7. WHEN a user clicks the previous or next pagination button, THE Users_Page SHALL fetch and display the corresponding page of users.

---

### Requirement 4: Create New User

**User Story:** As an admin, I want to create new user accounts with a name, email, password, and role, so that I can grant dashboard access to new team members.

#### Acceptance Criteria

1. THE Users_Page SHALL display a "New User" button that opens the New_User_Dialog when clicked.
2. THE New_User_Dialog SHALL include the following fields: Name (optional text input), Email (required text input), Password (required password input), and Role (required select with options: admin, editor, reviewer).
3. WHEN a user submits the New_User_Dialog with a missing or invalid email address, THE New_User_Dialog SHALL display an inline validation error on the Email field and prevent submission.
4. WHEN a user submits the New_User_Dialog with a password shorter than 8 characters, THE New_User_Dialog SHALL display an inline validation error on the Password field and prevent submission.
5. WHEN a user submits a valid New_User_Dialog form, THE New_User_Dialog SHALL call `POST /api/v1/admin/users` with the form data, show a success toast, close the dialog, reset all form fields, and refresh the user list.
6. IF the create API call fails, THEN THE New_User_Dialog SHALL show an error toast and keep the dialog open with the current field values intact.
7. WHEN the New_User_Dialog is closed for any reason, THE New_User_Dialog SHALL reset all field values to empty and clear all validation errors.

---

### Requirement 5: Change User Role

**User Story:** As an admin, I want to change a user's role directly from the table row, so that I can quickly adjust permissions without navigating to a separate edit page.

#### Acceptance Criteria

1. THE Users_Page SHALL render the Role column as an inline select control pre-populated with the user's current role.
2. WHEN an Admin_User changes the role select for a user row, THE Users_Page SHALL immediately call `PATCH /api/v1/admin/users/:id` with the new role, show a success toast, and refresh the user list.
3. IF the role update API call fails, THEN THE Users_Page SHALL show an error toast and the role select SHALL revert to the user's previous role.

---

### Requirement 6: Role Badge Display

**User Story:** As an admin, I want role badges to be colour-coded, so that I can quickly distinguish user roles at a glance.

#### Acceptance Criteria

1. THE Users_Page SHALL render the role value in the Role column using a colour-coded badge.
2. WHEN a user has the `admin` role, THE Users_Page SHALL render the role badge with purple styling.
3. WHEN a user has the `editor` role, THE Users_Page SHALL render the role badge with blue styling.
4. WHEN a user has the `reviewer` role, THE Users_Page SHALL render the role badge with grey/slate styling.
5. WHEN a user's role changes via the inline select, THE Users_Page SHALL update the role badge colour to match the new role after the list refreshes.
