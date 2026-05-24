# Implementation Plan: Admin Settings (Phase H)

## Overview

Implement two admin-only pages: block template editor (`/settings/templates`) and user management (`/users`). Both pages reuse existing API clients, follow the articles list pattern, and share the role-guard pattern from the entry editor's Blocks tab.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "4"] },
    { "wave": 2, "tasks": ["2", "5"] },
    { "wave": 3, "tasks": ["3", "6"] }
  ]
}
```

## Tasks

- [x] 1. Create TemplateEditorSheet component
  - Create `src/components/settings/template-editor-sheet.tsx`
  - Props: `template: BlockTemplate | null`, `open: boolean`, `onOpenChange: (open: boolean) => void`, `onSaved: () => void`
  - Internal state: `blocks: BlockTemplateItem[]` (reset from `template.blocks` on each open via `useEffect([template])`), `newBlockType: string`
  - Block list: render each block as a row with order number, type `<Badge variant="outline">`, up/down arrow buttons, visibility checkbox, and remove (×) button
  - Up arrow: swap block with the one above; down arrow: swap with the one below; after each swap renumber `order` fields to be 1-based contiguous
  - Remove button: remove block from array and renumber remaining `order` fields
  - Visibility checkbox: toggle `block.visible` for that index
  - Add block row: `<Select>` with `BLOCK_TYPE_OPTIONS` + "Add" button; appends `{ type, order: blocks.length + 1, visible: true }`
  - Warning banner: amber `<Alert>` at top of Sheet body — "Changes apply to new entries only. Existing entries are not affected."
  - Save mutation: `templatesApi.updateTemplate(template.entry_type, blocks)` → success toast + `onSaved()` + close; error toast on failure
  - Sheet layout: `SheetContent side="right" className="w-[480px] sm:max-w-[480px]"`, `SheetHeader` with title "Edit Template: {entry_type}", `SheetFooter` with Cancel + Save buttons
  - Import `templatesApi` from `src/lib/api/templates`, `BlockTemplate`, `BlockTemplateItem` types
  - _Requirements: 1.6, 1.7, 1.8, 1.9, 2.1–2.7_

- [ ]* 1.1 Write property test for block order renumbering invariant
  - **Property 3: Block order renumbering invariant**
  - Test the pure reorder/add/remove logic extracted from the component (or tested via the component's state)
  - Generate random block arrays; apply random sequences of add/move-up/move-down/remove operations; assert `blocks[i].order === i + 1` for all `i` after each operation
  - **Validates: Requirements 2.3, 2.4, 2.6**

- [ ]* 1.2 Write property test for visibility toggle
  - **Property 4: Visibility toggle flips the boolean**
  - Generate random block arrays and random valid indices; toggle visibility at that index; assert the target block's `visible` is flipped and all other blocks are unchanged
  - **Validates: Requirements 2.5**

- [ ]* 1.3 Write property test for save payload equals local state
  - **Property 5: Save payload equals local blocks state**
  - Generate random block arrays representing the local state; assert the argument passed to `updateTemplate` mock equals the local blocks array at save time
  - **Validates: Requirements 1.8**

- [x] 2. Create Block Templates page
  - Create `src/app/(dashboard)/settings/templates/page.tsx` as a Client Component
  - Role guard: `useAuthStore` → if `currentUser.role !== 'admin'`, call `router.replace('/dashboard')` in `useEffect`
  - State: `editTarget: BlockTemplate | null`
  - Query: `useQuery({ queryKey: ['templates'], queryFn: () => templatesApi.listTemplates() })`
  - Page header: "Block Templates" h1 (no create button — templates are fixed per entry type)
  - Table columns: Entry Type, Block Count, Last Updated, Actions
  - Entry Type cell: `<Badge variant="outline" className="capitalize">` with the `entry_type` value
  - Last Updated cell: `toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })`
  - Row click: sets `editTarget` to the clicked template
  - Actions cell: "Edit" button that sets `editTarget`
  - Skeleton: 5 skeleton rows while `isLoading`
  - Empty state: Settings icon + "No templates found" when `templates.length === 0` and not loading
  - Render `<TemplateEditorSheet>` with `template={editTarget}`, `open={editTarget !== null}`, `onOpenChange` that clears `editTarget`, `onSaved` that calls `queryClient.invalidateQueries({ queryKey: ['templates'] })`
  - Import `templatesApi`, `BlockTemplate` from `src/lib/api/templates`
  - _Requirements: 1.1–1.5, 1.8, 1.9_

- [ ]* 2.1 Write property test for template table row count
  - **Property 1: Template table renders one row per template**
  - Generate random arrays of `BlockTemplate` objects; render the table; assert row count equals array length and each row's cells match the corresponding template's fields
  - **Validates: Requirements 1.3**

- [ ]* 2.2 Write property test for Sheet block list rendering
  - **Property 2: Sheet block list renders all blocks**
  - Generate random `BlockTemplate` objects with varying block counts; open the Sheet; assert the rendered list item count equals `template.blocks.length` and each item shows the correct type, order, and visible state
  - **Validates: Requirements 1.6**

- [x] 3. Checkpoint — Templates feature complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create NewUserDialog component
  - Create `src/components/settings/new-user-dialog.tsx`
  - Props: `open: boolean`, `onOpenChange: (open: boolean) => void`, `onCreated: () => void`
  - Internal state: `name`, `email`, `password`, `role: UserRole` (default `'reviewer'`), `errors: Record<string, string>`
  - Validation on submit: email required + must match basic email pattern (contains `@` with non-empty parts) → "Valid email is required."; password required + length ≥ 8 → "Password must be at least 8 characters."
  - Create mutation: `usersApi.createUser({ name, email, password, role })` → success toast + `onCreated()` + `onOpenChange(false)` + reset all fields; error toast on failure
  - Form reset: on `onOpenChange(false)` for any reason, reset all fields to empty and clear errors
  - Dialog layout: `DialogContent className="sm:max-w-[440px]"`, `DialogHeader` title "New User", fields (Name optional Input, Email required Input, Password required Input type="password", Role Select with admin/editor/reviewer options), `DialogFooter` with Cancel + "Create User" button
  - Import `usersApi`, `UserRole` from `src/lib/api/users`
  - _Requirements: 4.1–4.7_

- [ ]* 4.1 Write property test for invalid email rejection
  - **Property 9: Invalid email rejected by New User dialog**
  - Generate random strings that do not match a basic email pattern; attempt form submission with each; assert validation error is shown and `createUser` is not called
  - **Validates: Requirements 4.3**

- [ ]* 4.2 Write property test for short password rejection
  - **Property 10: Short password rejected by New User dialog**
  - Generate random strings of length 0–7; attempt form submission with each; assert validation error is shown and `createUser` is not called
  - **Validates: Requirements 4.4**

- [ ]* 4.3 Write property test for dialog reset on close
  - **Property 11: New User dialog resets on close**
  - Generate random combinations of field values and validation errors; close the dialog; assert all fields are empty strings and errors are cleared
  - **Validates: Requirements 4.7**

- [x] 5. Create User Management page
  - Create `src/app/(dashboard)/users/page.tsx` as a Client Component
  - Role guard: same pattern as templates page — redirect non-admin to `/dashboard`
  - State: `newUserOpen: boolean`, `page: number`
  - Query: `useQuery({ queryKey: ['users', { page, limit: 20 }], queryFn: () => usersApi.listUsers({ page, limit: 20 }) })`
  - `listUsers` returns `ApiResponse<AdminUser[]>` — use `data?.data` and `data?.meta?.total` for pagination
  - Page header: "Users" h1 + "New User" Button (Plus icon) that sets `newUserOpen = true`
  - Table columns: Name, Email, Role, Created At, Actions
  - Name cell: `user.name ?? '—'`
  - Role cell: inline `<Select>` pre-populated with `user.role`; `onValueChange` fires `updateRoleMutation.mutate({ id: user.id, role: newRole })`
  - Role badge: render a colour-coded `<span>` alongside or inside the select using `ROLE_BADGE_STYLES` (purple/blue/slate per role)
  - Created At cell: formatted with `toLocaleDateString('en-GB', ...)`
  - Update role mutation: `usersApi.updateUserRole(id, role)` → success toast + `queryClient.invalidateQueries({ queryKey: ['users'] })`; error toast on failure
  - Skeleton: 5 skeleton rows while `isLoading`
  - Empty state: Users icon + "No users found"
  - Pagination: same prev/next + "Page X of Y" pattern as articles page; always rendered
  - Render `<NewUserDialog>` with `open={newUserOpen}`, `onOpenChange={setNewUserOpen}`, `onCreated` that invalidates `['users']`
  - Import `usersApi`, `AdminUser`, `UserRole` from `src/lib/api/users`
  - _Requirements: 3.1–3.7, 4.1–4.7, 5.1–5.3, 6.1–6.5_

- [ ]* 5.1 Write property test for user table row count
  - **Property 6: User table renders one row per user**
  - Generate random arrays of `AdminUser` objects; render the table; assert row count equals array length and each row's cells match the corresponding user's fields
  - **Validates: Requirements 3.3**

- [ ]* 5.2 Write property test for role select pre-population
  - **Property 7: Role select pre-populated with current role**
  - Generate random `AdminUser` objects with each possible `UserRole`; render the table row; assert the select's value equals the user's `role` field
  - **Validates: Requirements 5.1**

- [ ]* 5.3 Write property test for role badge colour
  - **Property 8: Role badge colour matches role**
  - For each `UserRole` value (`admin`, `editor`, `reviewer`), render the role badge; assert the class string contains the expected colour tokens and does not contain colour tokens from other roles
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 6. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Both pages use the same role-guard pattern: `useEffect` redirect to `/dashboard` for non-admin users
- The sidebar already has nav items for both routes with `adminOnly: true` — no sidebar changes needed
- `BLOCK_TYPE_OPTIONS = ['definition', 'technique', 'media', 'callout', 'related', 'pattern_usage']` — same constant used in the entry editor's Blocks tab
- `ROLE_BADGE_STYLES` mirrors the `StatusBadge` pattern from the entry editor: inline-flex span with rounded-full border and colour classes
- Property tests should use a lightweight test runner (Vitest) consistent with the project setup
