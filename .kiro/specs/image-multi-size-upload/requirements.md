# Requirements Document

## Introduction

This feature extends the existing media upload system to support multi-size image generation (original, medium, small), broaden entity association beyond entries to include articles (and future content types), add an images tab on entry/article detail pages, allow post-upload alt text editing, and automatically clean up R2 objects when their parent entity is deleted.

The resizing strategy is server-side: on upload, the NestJS API resizes the image in-memory using a Node.js image processing library (e.g. Sharp) before writing three separate objects to Cloudflare R2. This keeps the implementation self-contained without requiring Cloudflare Workers or Image Resizing add-ons.

Entity association uses a polymorphic design: each `MediaAsset` stores a `source_id` (UUID) and a `source_type` (discriminator string such as `"entry"` or `"article"`). This allows new content types to be supported without schema changes.

## Glossary

- **Media_Service**: The NestJS service responsible for image processing, R2 upload, and `MediaAsset` persistence.
- **Media_Controller**: The NestJS controller exposing HTTP endpoints for upload and asset management.
- **MediaAsset**: The Prisma model (table `media_asset`) that records one uploaded image and its three size variants.
- **ImageVariant**: One of the three stored size variants: `original`, `medium`, or `small`.
- **R2**: Cloudflare R2 object storage, accessed via the AWS S3-compatible SDK (`@aws-sdk/client-s3`).
- **Entry**: An encyclopedia entry entity (`entry` table) managed by the existing `Entry` module.
- **Article**: A long-form editorial content entity (`article` table) managed by the existing `Article` module.
- **Source_Entity**: Any content entity (currently `Entry` or `Article`) to which a `MediaAsset` is associated.
- **Source_Id**: The UUID of the `Source_Entity` stored on a `MediaAsset`.
- **Source_Type**: A discriminator string stored on a `MediaAsset` identifying the kind of `Source_Entity` (e.g. `"entry"`, `"article"`).
- **Alt_Text**: A short descriptive string attached to a `MediaAsset` for accessibility purposes.
- **Images_Tab**: The UI tab on an entry or article detail page in the Next.js admin that lists all associated `MediaAsset` records with their variant URLs.
- **Admin**: The Next.js admin application.
- **Cascade_Delete**: Automatic deletion of R2 objects triggered when the parent `Source_Entity` is deleted.

---

## Requirements

### Requirement 1: Multi-Size Image Generation on Upload

**User Story:** As an editor, I want uploaded images to automatically produce three size variants (original, medium, small), so that the front end can serve appropriately sized images without manual intervention.

#### Acceptance Criteria

1. WHEN an image file is uploaded, THE Media_Service SHALL generate three variants: `original` (unmodified), `medium` (longest edge ≤ 800 px, aspect ratio preserved), and `small` (longest edge ≤ 300 px, aspect ratio preserved).
2. WHEN resizing, THE Media_Service SHALL encode all non-SVG variants as WebP with quality 85.
3. IF the uploaded file has MIME type `image/svg+xml`, THEN THE Media_Service SHALL store the file as `original` without re-encoding and SHALL skip medium and small variant generation.
4. IF an image's longest edge is already smaller than or equal to the resize threshold for a given variant (800 px for medium, 300 px for small), THEN THE Media_Service SHALL store that variant at the image's original dimensions without upscaling.
5. THE Media_Service SHALL upload all generated variants to R2 under the key pattern `{entity_type}/{entity_id}/{uuid}/{size}.{ext}` where `{size}` is `original`, `medium`, or `small`, `{ext}` is `.webp` for medium and small variants, and `{ext}` is the source file's original extension for the original variant.
6. WHEN any R2 upload for a variant fails, THE Media_Service SHALL abort the entire upload operation, attempt to delete any already-uploaded variants for the same asset, and return a 5xx error response indicating the upload could not be completed.
7. THE Media_Service SHALL complete the full upload-and-resize operation for a single image within 30 seconds.

### Requirement 2: Expanded Entity Association (Entry and Article)

**User Story:** As an editor, I want to associate uploaded images with either an entry or an article (and any future content type), so that all content types can have their own media galleries without requiring schema changes to support new types.

#### Acceptance Criteria

1. THE MediaAsset SHALL store a `source_id` (UUID) and a `source_type` (string, maximum 50 characters, e.g. `"entry"` or `"article"`) to identify the associated `Source_Entity` using a polymorphic association.
2. WHEN a media upload request targets an entry, THE Media_Controller SHALL route `POST /api/v1/admin/media/entry/{entryId}/upload` requests to the Media_Service.
3. WHEN a media upload request targets an article, THE Media_Controller SHALL route `POST /api/v1/admin/media/article/{articleId}/upload` requests to the Media_Service.
4. WHEN handling an entry upload, THE Media_Service SHALL verify that the entry identified by `entryId` exists in the database before processing the file.
5. WHEN handling an article upload, THE Media_Service SHALL verify that the article identified by `articleId` exists in the database before processing the file.
6. IF the referenced entry does not exist, THEN THE Media_Service SHALL return a 404 error and SHALL NOT write any data to storage or the database.
7. IF the referenced article does not exist, THEN THE Media_Service SHALL return a 404 error and SHALL NOT write any data to storage or the database.
8. WHEN a file upload request arrives, THE Media_Service SHALL validate the file type and size before performing any entity existence lookup or storage write.
9. IF the R2/S3 write fails, THEN THE Media_Service SHALL return a 5xx error and SHALL NOT persist a `MediaAsset` record to the database.

### Requirement 3: MediaAsset Multi-Variant Storage

**User Story:** As a developer, I want the `MediaAsset` record to store URLs for all three size variants alongside metadata, so that consumers can retrieve the right URL without additional processing.

#### Acceptance Criteria

1. THE MediaAsset SHALL store `url_original` (non-nullable string), `url_medium` (nullable string), and `url_small` (nullable string) as separate fields, replacing the legacy single `url` field.
2. THE MediaAsset SHALL store an `alt_text` field (nullable string, max 500 characters).
3. THE MediaAsset SHALL store a `filename` field (non-nullable string, max 255 characters) containing the original uploaded filename.
4. THE MediaAsset SHALL retain the existing `type`, `sort_order`, and `id` fields.
5. IF the uploaded file has MIME type `image/svg+xml`, THEN THE Media_Service SHALL populate `url_original` with a non-empty string and SHALL set `url_medium` and `url_small` to null.
6. WHEN a `MediaAsset` is created for a non-SVG image, THE Media_Service SHALL populate `url_original`, `url_medium`, and `url_small` each with a non-empty string.

### Requirement 4: Alt Text Editing

**User Story:** As an editor, I want to update the alt text of an uploaded image after the fact, so that I can improve accessibility without re-uploading the image.

#### Acceptance Criteria

1. WHEN a PATCH request is made to `/api/v1/admin/media/assets/{assetId}` with an `alt_text` value of 0 to 500 characters or null, THE Media_Controller SHALL update the `alt_text` field on the `MediaAsset` and return the updated record with HTTP 200, including all fields defined in Requirement 3.
2. THE Media_Service SHALL accept `alt_text` values of 0 to 500 characters inclusive, as well as null.
3. IF the `assetId` does not match any `MediaAsset` record, THEN THE Media_Service SHALL return a 404 error with the message `MediaAsset {assetId} not found` without processing the request body.
4. IF `alt_text` exceeds 500 characters, THEN THE Media_Service SHALL return a 400 error with the message `alt_text must not exceed 500 characters`.
5. IF the PATCH request body does not contain the `alt_text` key, THEN THE Media_Service SHALL preserve the existing `alt_text` value unchanged and return the current `MediaAsset` record with HTTP 200.

### Requirement 5: Images Tab in Admin UI

**User Story:** As an editor, I want a dedicated Images tab on the entry and article detail pages in the admin, so that I can view, manage, and copy URLs for all images associated with that entity.

#### Acceptance Criteria

1. WHEN an editor navigates to an entry or article detail page, THE Admin SHALL display an Images tab alongside existing tabs.
2. WHEN the Images tab is active, THE Admin SHALL fetch and display all `MediaAsset` records associated with the current entity, completing the fetch within 5 seconds.
3. WHEN displaying a `MediaAsset`, THE Admin SHALL show the image using its `url_small` if available otherwise `url_original`, the filename, the alt text, and a click-to-copy control for each available URL variant (`url_original`, `url_medium`, `url_small`).
4. WHEN the Images tab is active and the entity has no associated `MediaAsset` records, THE Admin SHALL display a message indicating that no images have been uploaded.
5. WHEN an editor clicks the Save button after editing the alt text of a `MediaAsset` in the Images tab, THE Admin SHALL call `PATCH /api/v1/admin/media/assets/{assetId}` with the updated alt text (maximum 500 characters) and update the displayed alt text upon receiving a success response.
6. IF the `PATCH /api/v1/admin/media/assets/{assetId}` call fails, THEN THE Admin SHALL display an error message indicating the alt text could not be saved and restore the previously displayed alt text value.
7. WHEN the Images tab is active on an entry detail page, THE Admin SHALL display an upload control that calls `POST /api/v1/admin/media/entry/{entryId}/upload` and adds the newly returned `MediaAsset` to the displayed list upon a success response.
8. WHEN the Images tab is active on an article detail page, THE Admin SHALL display an upload control that calls `POST /api/v1/admin/media/article/{articleId}/upload` and adds the newly returned `MediaAsset` to the displayed list upon a success response.

### Requirement 6: Automatic Cascade Deletion of R2 Objects

**User Story:** As a system operator, I want R2 objects to be automatically removed when their parent entry or article is deleted, so that orphaned files do not accumulate in storage.

#### Acceptance Criteria

1. WHEN an `Entry` is deleted, THE Media_Service SHALL delete all R2 objects for every `MediaAsset` associated with that entry (where `source_type = "entry"` and `source_id = entryId`) before the database rows are removed.
2. WHEN an `Article` is deleted, THE Media_Service SHALL delete all R2 objects for every `MediaAsset` associated with that article (where `source_type = "article"` and `source_id = articleId`) before the database rows are removed.
3. WHEN deleting R2 objects for a `MediaAsset`, THE Media_Service SHALL derive the R2 key by stripping the R2 public base URL prefix from the `url_original`, `url_medium`, and `url_small` fields, and SHALL attempt to delete each non-null URL's corresponding key.
4. IF one or more R2 deletions fail during cascade, THE Media_Service SHALL log each failure with the affected key and SHALL continue deleting remaining objects; the associated `MediaAsset` database rows SHALL be removed regardless of R2 deletion outcome.
5. THE Media_Service SHALL expose a `deleteAssetsForEntity` method that accepts a `source_type` (`"entry"` | `"article"`) and `source_id`, performs all R2 object deletions, then removes all matching `MediaAsset` database rows; IF no matching `MediaAsset` records exist, THE method SHALL return without error.
