# Requirements Document

## Introduction

The admin-content-blocks feature replaces the minimal `BlocksTab` stub on the entry detail page (`/entries/[id]`) with a fully-featured content blocks management UI. Editors and admins can view, edit, reorder, add, and delete structural content blocks on an `Entry`, with full per-type field editing and immediate visual feedback. The feature covers only the entry-level `content_blocks` array (edited via `PUT /api/v1/admin/entries/:id/blocks`); translation-level content blocks remain out of scope for this feature.

---

## Glossary

- **Blocks_Tab**: The "Blocks" tab inside the entry detail page, visible only to admin users.
- **Content_Block**: A structured piece of content attached to an `Entry`, with fields `type`, `order`, `visible`, and zero or more type-specific fields. Defined by the `ContentBlock` interface in `entries.ts`.
- **Block_Type**: One of six string values identifying the kind of block: `definition`, `technique`, `media`, `callout`, `related`, `pattern_usage`.
- **Definition_Block**: A `Content_Block` of type `definition` with a single type-specific field `content: string`.
- **Technique_Block**: A `Content_Block` of type `technique` with no additional type-specific fields in the current schema.
- **Media_Block**: A `Content_Block` of type `media` with type-specific fields `url: string`, `alt_text: string`, and `caption: string`.
- **Callout_Block**: A `Content_Block` of type `callout` with a single type-specific field `text: string`.
- **Related_Block**: A `Content_Block` of type `related`. Its content is managed in the Related tab and is read-only in the Blocks tab.
- **Pattern_Usage_Block**: A `Content_Block` of type `pattern_usage`. Its content is managed in the Related tab and is read-only in the Blocks tab.
- **Block_Form**: The inline editing panel that appears inside a block row when it is expanded, containing the type-specific input fields for that block.
- **Block_List**: The ordered list of `Content_Block` items shown inside the Blocks_Tab.
- **Entries_API_Client**: The `entriesApi` object in `apps/admin/src/lib/api/entries.ts`.
- **Admin_API**: The NestJS backend at `/api/v1/admin`.
- **Entry_Detail_Page**: The page at `/entries/[id]`, which hosts the Blocks_Tab among its tabs.

---

## Requirements

### Requirement 1: Block List Display

**User Story:** As an admin, I want to see all content blocks for an entry in a clear, ordered list, so that I can understand the block structure at a glance before making edits.

#### Acceptance Criteria

1. WHEN the Blocks_Tab is rendered with a non-empty `entry.content_blocks` array, THE Blocks_Tab SHALL display one row per block in ascending order of `block.order`.
2. EACH block row SHALL display the block's `order` value, a type badge showing the `Block_Type` in capitalised human-readable form (`definition` → "Definition", `technique` → "Technique", `media` → "Media", `callout` → "Callout", `related` → "Related", `pattern_usage` → "Pattern Usage"), and a `visible` toggle; the `visible` toggle SHALL reflect the block's current `visible` field in local component state only and SHALL NOT be persisted until an explicit save.
3. EACH block row SHALL display a content preview using the following rules: for `definition` blocks, the first 80 characters of the `content` string (or "—" if absent); for `media` blocks, the `url` value truncated to 80 characters (or "—" if absent); for `callout` blocks, the first 80 characters of the `text` string (or "—" if absent); for `technique`, `related`, and `pattern_usage` blocks, the static label "Managed in Translations tab".
4. WHEN `entry.content_blocks` is empty or absent, THE Blocks_Tab SHALL display an empty-state message "No blocks yet. Add a block below." in place of the block list.
5. THE Blocks_Tab SHALL display block rows inside a `Card` component using a `CardContent` wrapper with `pt-6 space-y-3` spacing classes, consistent with the other tab cards in the Entry_Detail_Page.

---

### Requirement 2: Block Visibility Toggle

**User Story:** As an admin, I want to toggle a block's visibility without saving the whole form, so that I can quickly show or hide blocks and see the change reflected in the pending state.

#### Acceptance Criteria

1. EACH block row SHALL include a toggle control (checkbox or switch) labelled "Visible"; WHEN `block.visible` is `true`, the control SHALL be in the checked/on state; WHEN `block.visible` is `false`, the control SHALL be in the unchecked/off state.
2. WHEN an admin toggles the visibility control on a block row, THE Blocks_Tab SHALL synchronously flip the `visible` field for that block in local state (from `true` to `false` or from `false` to `true`) without calling the API.
3. THE visibility toggle change SHALL be included in the pending local state that is submitted when the admin clicks the "Save Blocks" button.
4. IF the "Save Blocks" button has not been clicked, THEN THE Blocks_Tab SHALL NOT call `PUT /api/v1/admin/entries/:id/blocks` as a result of toggling visibility.

---

### Requirement 3: Per-Type Block Editing

**User Story:** As an admin, I want to expand a block and edit its type-specific fields inline, so that I can update block content without leaving the Blocks tab.

#### Acceptance Criteria

1. EACH block row SHALL include a single expand/collapse button (e.g. a chevron or "Edit" button); ALL block rows SHALL be in a collapsed (Block_Form hidden) state by default on initial render.
2. WHEN an admin clicks the expand/collapse button on a collapsed block row, THE Blocks_Tab SHALL reveal the Block_Form for that block.
3. WHEN an admin expands a `definition` block, THE Block_Form SHALL display a labelled `Textarea` pre-populated with `block.content` (empty string if absent).
4. WHEN the admin changes the value in the `definition` Block_Form `Textarea`, THE Blocks_Tab SHALL update `block.content` in local state.
5. WHEN an admin expands a `media` block, THE Block_Form SHALL display three labelled `Input` fields: "URL" pre-populated with `block.url`, "Alt text" pre-populated with `block.alt_text`, and "Caption" pre-populated with `block.caption` (each defaulting to empty string if absent).
6. WHEN the admin changes any field in the `media` Block_Form, THE Blocks_Tab SHALL update the corresponding field (`url`, `alt_text`, or `caption`) in local state for that block.
7. WHEN an admin expands a `callout` block, THE Block_Form SHALL display a labelled `Input` field "Text" pre-populated with `block.text` (empty string if absent).
8. WHEN the admin changes the value in the `callout` Block_Form `Input`, THE Blocks_Tab SHALL update `block.text` in local state.
9. WHEN an admin expands a `technique` block, THE Block_Form SHALL display a read-only message: "Technique blocks have no editable fields in this tab."
10. WHEN an admin expands a `related` or `pattern_usage` block, THE Block_Form SHALL display a read-only message: "This block's content is managed in the Related tab."
11. AT MOST ONE block SHALL be expanded at a time; WHEN an admin expands a block other than the currently expanded block, THE Blocks_Tab SHALL collapse the previously expanded block and expand the new one.
12. WHEN an admin expands a block whose type is not one of the six defined Block_Type values, THE Block_Form SHALL display a read-only message: "Unknown block type. Raw data preserved on save." and SHALL NOT render any editable input fields.
13. All Block_Form field changes SHALL update only local state; they SHALL NOT trigger an API call individually.

---

### Requirement 4: Block Reordering

**User Story:** As an admin, I want to reorder blocks using up and down buttons, so that I can control the sequence in which blocks appear on the entry.

#### Acceptance Criteria

1. EACH block row SHALL display an "Up" button and a "Down" button to reorder that block relative to its neighbours.
2. WHEN an admin clicks the "Up" button on a block at 0-indexed position `i` (where `i > 0`), THE Blocks_Tab SHALL swap that block with the block at position `i - 1` in the local list and recalculate each block's `order` field so that the block at position `k` (0-indexed) has `order` equal to `k + 1`.
3. WHEN an admin clicks the "Down" button on a block at 0-indexed position `i` (where `i < N - 1`, and N is the total number of blocks), THE Blocks_Tab SHALL swap that block with the block at position `i + 1` in the local list and recalculate `order` values using the same rule (position `k` → `order` `k + 1`).
4. THE "Up" button on the block at position 0 (the first block in the list) SHALL be disabled; IF there is only one block in the list, BOTH the "Up" and "Down" buttons on that block SHALL be disabled.
5. THE "Down" button on the block at position N - 1 (the last block in the list) SHALL be disabled.
6. Reordering SHALL update only local state; THE Blocks_Tab SHALL NOT call the API as a result of clicking Up or Down.

---

### Requirement 5: Add Block

**User Story:** As an admin, I want to add a new block of any supported type, so that I can extend an entry's content structure.

#### Acceptance Criteria

1. THE Blocks_Tab SHALL display an "Add Block" control consisting of a `Select` dropdown with these six options in this order — "Definition" (value `definition`), "Technique" (value `technique`), "Media" (value `media`), "Callout" (value `callout`), "Related" (value `related`), "Pattern Usage" (value `pattern_usage`) — and an "Add" button.
2. WHEN an admin clicks the "Add" button, THE Blocks_Tab SHALL append a new block to the end of the local block list with: `type` equal to the currently selected Block_Type value; `visible` set to `true`; `order` set to the current maximum `order` value plus 1 (or `1` if the list is empty); and every content field specific to the selected Block_Type (i.e. all fields other than `type`, `visible`, and `order`) initialised to the empty string `""`.
3. WHEN a new block is added, THE Blocks_Tab SHALL set the Block_Form for the newly added block to the open (expanded) state so that it is visible without further interaction by the admin.
4. THE default selected Block_Type in the Add Block dropdown SHALL be `definition` on initial render and after each page load.
5. Adding a block SHALL update only local state; THE Blocks_Tab SHALL NOT call the API as a result of adding a block.

---

### Requirement 6: Delete Block

**User Story:** As an admin, I want to delete individual blocks, so that I can remove obsolete or incorrect blocks from an entry.

#### Acceptance Criteria

1. EACH block row SHALL include a "Delete" button (e.g. a trash icon button).
2. WHEN an admin clicks the "Delete" button on a block, THE Blocks_Tab SHALL open a `ConfirmDialog` showing the message: "Delete this [Block_Type] block? This change will take effect when you save." where [Block_Type] is the human-readable label for that block's type.
3. WHEN the admin confirms the delete dialog, THE Blocks_Tab SHALL close the `ConfirmDialog`, remove the block from the local list, recalculate `order` values so they remain a contiguous sequence starting from 1, and clear the expanded state if the deleted block was the currently expanded block.
4. WHEN the admin cancels the delete dialog, THE Blocks_Tab SHALL close the dialog and make no change to local state.
5. Deletion SHALL update only local state; THE Blocks_Tab SHALL NOT call the API as a result of confirming deletion.

---

### Requirement 7: Save Blocks

**User Story:** As an admin, I want a single "Save Blocks" button that submits all pending changes at once, so that I can make multiple edits before committing them to the backend.

#### Acceptance Criteria

1. THE Blocks_Tab SHALL display a "Save Blocks" button at the bottom of the tab; the button SHALL be disabled WHEN there are no unsaved changes (i.e. local block state matches the last saved state as defined in Requirement 8).
2. WHEN an admin clicks "Save Blocks", THE Blocks_Tab SHALL call `PUT /api/v1/admin/entries/:id/blocks` via `entriesApi.updateBlocks(entryId, blocks)` with the full current local block array.
3. WHEN the `updateBlocks` call returns successfully (HTTP 2xx), THE Blocks_Tab SHALL display a success toast with the message "Blocks saved" and invalidate the `['entry', entryId]` React Query cache entry to refresh the entry data.
4. IF the `updateBlocks` call returns a non-2xx response, THEN THE Blocks_Tab SHALL display an error toast with the message "Failed to save blocks" and leave local state unchanged so the admin can retry.
5. WHILE the `updateBlocks` mutation is pending, THE Blocks_Tab SHALL disable the "Save Blocks" button and change its label to "Saving…"; the button SHALL re-enable (or remain disabled due to no unsaved changes) on the next render cycle after mutation completion, regardless of whether the mutation succeeded or failed.
6. WHILE the `updateBlocks` mutation is pending, THE Blocks_Tab SHALL disable the Add button, all Delete buttons, all Up buttons, all Down buttons, and all visibility toggle controls; expand/collapse controls SHALL remain enabled so the admin can still review block content during the save.

---

### Requirement 8: Unsaved Changes Warning

**User Story:** As an admin, I want a visual indicator when I have unsaved changes, so that I don't accidentally navigate away and lose my edits.

#### Acceptance Criteria

1. THE Blocks_Tab SHALL track whether local block state differs from the last saved state (the `entry.content_blocks` value received from the API, re-established after each successful save).
2. WHEN local block state differs from the saved state, THE Blocks_Tab SHALL display a visible text label "Unsaved changes" rendered adjacent to the "Save Blocks" button.
3. WHEN local block state matches the saved state (immediately after page load or after a successful save), THE Blocks_Tab SHALL NOT display the "Unsaved changes" label.
4. WHILE the `updateBlocks` mutation is pending, THE Blocks_Tab SHALL continue to display the "Unsaved changes" label; the label SHALL only be hidden once the mutation completes successfully.
5. IF the `updateBlocks` call fails, THE Blocks_Tab SHALL continue to display the "Unsaved changes" label since the local edits have not been persisted.
6. THE comparison used to determine unsaved changes SHALL be based on the serialised JSON of the two arrays (`JSON.stringify(localBlocks) !== JSON.stringify(savedBlocks)`), so that order, field values, and visibility changes are all detected.

---

### Requirement 9: Block Order Invariants

**User Story:** As an admin, I want block order values to always be consistent and predictable, so that the saved data is clean and the display order is unambiguous.

#### Acceptance Criteria

1. WHEN any block list mutation occurs in local state (add, delete, move up, or move down), THE Blocks_Tab SHALL immediately recalculate the `order` field for every block so that the block at 0-indexed position `k` has `order` equal to `k + 1`.
2. WHEN `entry.content_blocks` is loaded from the API on initial page load, THE Blocks_Tab SHALL sort the blocks by `order` ascending before setting local state, so that the display order matches the intended order regardless of the array order returned by the API.
3. THE array submitted to `entriesApi.updateBlocks` SHALL have `order` values normalised immediately before the API call, so that the block at position `k` (0-indexed) in the submitted array has `order` equal to `k + 1`.
4. IF a successful HTTP 2xx response is received from `entriesApi.updateBlocks`, THE Blocks_Tab SHALL re-sort the refreshed `entry.content_blocks` data by `order` ascending before updating local state, applying the same initial-load sort rule.

---

### Requirement 10: Loading and Error States

**User Story:** As an admin, I want clear loading and error feedback so that I always understand the state of the Blocks tab.

#### Acceptance Criteria

1. WHILE the entry data is loading (before `entry.content_blocks` is available), THE Entry_Detail_Page SHALL display 3 skeleton rows as placeholders for the Blocks_Tab block list, using the same `Skeleton` component and approximate row height as the skeleton rows in other tabs.
2. IF the entry data request fails, THE Entry_Detail_Page SHALL display the existing error state ("Failed to load entry" with a Retry button), which applies to all tabs including Blocks_Tab.
3. WHILE the `updateBlocks` mutation is pending, THE Blocks_Tab SHALL disable the "Save Blocks" button and display "Saving…" as described in Requirement 7.5.
4. IF the `updateBlocks` call fails, THEN THE Blocks_Tab SHALL NOT reset or discard the admin's local edits; the local state SHALL remain intact until the admin navigates away from the Entry_Detail_Page or reloads the page, so the admin can attempt to save again.
