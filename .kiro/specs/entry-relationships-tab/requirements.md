# Requirements Document

## Introduction

This feature adds a "Relationships" tab to the entry add/edit view in the admin application. The tab appears after the existing "Images" tab in the right-side panel. It allows editors to search for existing dictionary entries, select a directional relationship type, and link the two entries together. Linked relationships are displayed in a grouped list, organized by relationship type. All relationship data is persisted to a dedicated `EntryRelationship` table through the backend API.

## Glossary

- **Entry**: A dictionary or glossary record managed in the admin application; the top-level entity being edited.
- **Source Entry**: The entry currently open in the editor — the origin of any relationship being created.
- **Target Entry**: An existing entry selected by the user to be linked to the Source Entry.
- **EntryRelationship**: A directed link between a Source Entry and a Target Entry, carrying a typed relationship and an optional free-text note.
- **EntryRelationshipType**: An enumerated classification of the semantic relationship between two entries. Valid values are: `PREREQUISITE`, `VARIANT_OF`, `ALTERNATIVE_TO`, `COMMONLY_CONFUSED_WITH`, `USED_IN`, `PART_OF`, `COUNTERPART_OF`, `RELATED_TO`.
- **Relationships Panel**: The UI panel inside the "Relationships" tab that renders the search controls, add controls, and the grouped list of existing relationships.
- **Relationship Group**: A collapsible or flat section within the Relationships Panel that lists all relationships sharing the same `EntryRelationshipType`.
- **Relationships API**: The backend REST endpoints that create, list, and delete `EntryRelationship` records.
- **Admin App**: The Next.js admin application located at `apps/admin`.

---

## Requirements

### Requirement 1: Relationships Tab Placement

**User Story:** As an editor, I want a dedicated Relationships tab in the entry editor sidebar, so that I can manage entry relationships without cluttering the Details or SEO tabs.

#### Acceptance Criteria

1. WHEN the entry editor sidebar renders, THE Admin_App SHALL display the sidebar tabs in the order: Details, Images, Relationships, SEO, with the "Relationships" tab immediately after the "Images" tab.
2. THE Relationships_Panel SHALL be rendered as the content of the "Relationships" tab.
3. IF the entry being edited has not yet been saved (no `entryId` is present), THEN THE Relationships_Panel SHALL display a message communicating that relationships can be added after the entry is first saved, and SHALL NOT render the add controls or the relationships list.
4. WHEN an `entryId` is present, THE Relationships_Panel SHALL render the add controls and the relationships list.

---

### Requirement 2: Add Relationship Controls

**User Story:** As an editor, I want to search for an existing entry, choose a relationship type, and add it with a single click, so that I can quickly link related entries.

#### Acceptance Criteria

1. THE Relationships_Panel SHALL display an entry search input, a relationship type selector containing all eight `EntryRelationshipType` values as labeled options, an optional note input, and an "Add" button.
2. WHEN the user types at least 1 character into the entry search input, THE Relationships_Panel SHALL query the Entries API after a 300 ms debounce delay and display up to 10 matching entries as selectable options.
3. WHEN the entry search input contains fewer than 1 character, THE Relationships_Panel SHALL hide the options list.
4. WHEN no target entry has been selected, THE Relationships_Panel SHALL disable the "Add" button.
5. WHEN no relationship type has been selected, THE Relationships_Panel SHALL disable the "Add" button.
6. WHEN both a target entry and a relationship type are selected, THE Relationships_Panel SHALL enable the "Add" button.
7. WHILE a create operation is in progress, THE Relationships_Panel SHALL disable the "Add" button and display a loading indicator on it to prevent duplicate submissions.
8. WHEN the Relationships API successfully creates a relationship, THE Relationships_Panel SHALL clear the target entry selection, the relationship type selection, and the note field.
9. IF the Relationships API returns an error when creating a relationship, THEN THE Relationships_Panel SHALL display a toast error message indicating that the relationship could not be created, and SHALL preserve the current target entry, relationship type, and note field values so the user can retry.
10. THE Relationships_Panel SHALL exclude the Source Entry from the search results so a self-referential relationship cannot be created.
11. IF a relationship type is selected, THEN THE Relationships_Panel SHALL exclude entries already linked to the Source Entry under that selected relationship type from the search results.

---

### Requirement 3: Display Linked Relationships Grouped by Type

**User Story:** As an editor, I want to see all relationships grouped under their type heading, so that I can quickly scan what relationships exist and of which kind.

#### Acceptance Criteria

1. THE Relationships_Panel SHALL render a list section below the add controls that shows all relationships currently linked to the Source Entry.
2. THE Relationships_Panel SHALL group relationships by `EntryRelationshipType`, rendering one group header per type that has at least one relationship.
3. THE Relationships_Panel SHALL display group headers using the following exact human-readable labels: `PREREQUISITE` → "Prerequisite", `VARIANT_OF` → "Variant of", `ALTERNATIVE_TO` → "Alternative to", `COMMONLY_CONFUSED_WITH` → "Commonly confused with", `USED_IN` → "Used in", `PART_OF` → "Part of", `COUNTERPART_OF` → "Counterpart of", `RELATED_TO` → "Related to".
4. THE Relationships_Panel SHALL display relationship groups in the fixed enum declaration order: PREREQUISITE, VARIANT_OF, ALTERNATIVE_TO, COMMONLY_CONFUSED_WITH, USED_IN, PART_OF, COUNTERPART_OF, RELATED_TO.
5. WHEN no relationships exist for the Source Entry, THE Relationships_Panel SHALL display a message containing "No relationships added yet." and SHALL still render the add controls.
6. WHEN relationships exist, THE Relationships_Panel SHALL render each relationship as a card showing the Target Entry's display name within its group, resolved from the Target Entry's translations using the active locale; IF no translation exists for the active locale THEN the default locale SHALL be used; IF no default locale translation exists THEN the entry's identifier SHALL be displayed.

---

### Requirement 4: Optional Note on a Relationship

**User Story:** As an editor, I want to attach an optional note to a relationship, so that I can provide context about why two entries are related.

#### Acceptance Criteria

1. THE Relationships_Panel SHALL display an optional note input field (maximum 500 characters) in the add controls area.
2. WHEN the user enters non-whitespace text in the note input and activates the "Add" button, THE Relationships_Panel SHALL include the trimmed note value in the Relationships API create payload.
3. WHEN the note input is empty or contains only whitespace, THE Relationships_Panel SHALL omit the `note` field from the create payload entirely (not send an empty string or whitespace-only value).
4. WHEN a relationship is successfully created, THE Relationships_Panel SHALL clear the note input field.
5. WHEN a saved relationship has a non-empty note, THE Relationships_Panel SHALL display the note text below the Target Entry name in the relationship card.
6. WHEN a saved relationship has no note, THE Relationships_Panel SHALL render the relationship card without a note section.

---

### Requirement 5: Remove a Relationship

**User Story:** As an editor, I want to remove an existing relationship from an entry, so that I can correct mistakes or update the entry's connections.

#### Acceptance Criteria

1. WHEN the user activates the remove control on a relationship card, THE Relationships_Panel SHALL display a confirmation prompt before making any API call.
2. WHEN the user dismisses or cancels the confirmation prompt, THE Relationships_Panel SHALL close the prompt, make no API call, and leave the relationship card intact.
3. WHEN the user confirms removal, THE Relationships_Panel SHALL call the Relationships API to delete the relationship and remove the card from the list on success.
4. IF the Relationships API returns an error when deleting a relationship, THEN THE Relationships_Panel SHALL display a toast error message, keep the relationship card visible, and re-enable the remove control for that card.
5. WHILE a delete operation is in progress for a specific relationship card, THE Relationships_Panel SHALL disable the remove control for that card to prevent duplicate requests.
6. WHEN no delete operation is in progress, THE Relationships_Panel SHALL enable the remove control on each relationship card.
7. IF the Relationships_Panel is in a read-only state, THEN THE Relationships_Panel SHALL disable the remove control on all relationship cards regardless of whether a delete operation is in progress.

---

### Requirement 6: Relationships API Client

**User Story:** As a developer, I want a typed API client module for the Relationships API, so that all relationship operations are centralised and type-safe.

#### Acceptance Criteria

1. THE Admin_App SHALL provide an `entryRelationshipsApi` module in `apps/admin/src/lib/api/entry-relationships.ts`.
2. THE `entryRelationshipsApi` module SHALL export a `listRelationships(sourceEntryId: string): Promise<EntryRelationship[]>` function that performs a GET request to retrieve all relationships for the given `sourceEntryId`.
3. THE `entryRelationshipsApi` module SHALL export a `createRelationship(payload: { sourceEntryId: string; targetEntryId: string; type: EntryRelationshipType; note?: string }): Promise<EntryRelationship>` function that performs a POST request to create a new `EntryRelationship` record.
4. THE `entryRelationshipsApi` module SHALL export a `deleteRelationship(id: string): Promise<void>` function that performs a DELETE request to remove an `EntryRelationship` record by its `id`.
5. THE `entryRelationshipsApi` module SHALL export the `EntryRelationshipType` enum and the `EntryRelationship` interface with fields: `id: string`, `sourceEntryId: string`, `targetEntryId: string`, `type: EntryRelationshipType`, `note?: string`, `createdAt: Date`.
6. WHEN the Relationships API returns an HTTP error response, THE `entryRelationshipsApi` module SHALL throw an `ApiError` consistent with the pattern used by other API modules in the Admin App.

---

### Requirement 7: Data Loading and Refresh

**User Story:** As an editor, I want relationship data to load automatically when I open the Relationships tab and to refresh after I add or remove a relationship, so that the list always reflects the current state.

#### Acceptance Criteria

1. WHEN the Relationships tab becomes active AND an `entryId` is available, THE Relationships_Panel SHALL fetch all existing relationships for the Source Entry from the Relationships API.
2. WHEN the Relationships tab becomes active AND no `entryId` is available, THE Relationships_Panel SHALL display an empty relationships list and SHALL NOT issue a fetch request.
3. WHILE a fetch or refetch is in progress, THE Relationships_Panel SHALL display a loading indicator in place of the relationships list.
4. WHEN a relationship is successfully created AND no fetch is currently in progress, THE Relationships_Panel SHALL immediately issue a refetch of the relationships list.
5. WHEN a relationship is successfully created AND a fetch is currently in progress, THE Relationships_Panel SHALL queue exactly one pending refetch to start after the in-progress fetch completes; any additional create or delete events that arrive before the queued refetch starts SHALL be discarded (the queued refetch still runs once).
6. WHEN a relationship is successfully deleted, THE Relationships_Panel SHALL apply the same refetch logic described in criteria 4 and 5.
7. IF the Relationships API returns an error when fetching or refetching relationships, THEN THE Relationships_Panel SHALL display an error message and a retry control that, when activated, re-issues the fetch for the current `entryId`.
