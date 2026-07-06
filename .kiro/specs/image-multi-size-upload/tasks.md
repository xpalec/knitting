# Implementation Plan: image-multi-size-upload

## Overview

Extend the existing media upload system to support multi-size image generation via Sharp, polymorphic entity association, richer MediaAsset metadata, alt text editing, an Images tab in the admin, and cascade R2 deletion on parent entity delete.

Implementation proceeds in five phases:
1. Database schema migration (Prisma)
2. API layer — MediaService refactor + new endpoints
3. Integration of cascade delete into AdminEntryService and AdminArticleService
4. Admin API client update
5. Admin UI — ImagesTab component and integration into Entry/Article detail pages

---

## Tasks

- [x] 1. Migrate Prisma schema for MediaAsset

  - Add `source_id`, `source_type`, `url_original`, `url_medium`, `url_small`, `alt_text`, `filename`, `created_at`, `updated_at` columns to `MediaAsset` in `apps/api/prisma/schema.prisma` as nullable initially
  - Remove the `entry_id` FK relation and the legacy `url` field from the model
  - Add `@@index([source_type, source_id])` composite index
  - Write and run `prisma migrate dev` to generate the migration SQL (additive step — new columns nullable)
  - Write a second migration to backfill existing rows: `source_type = 'entry'`, `source_id = entry_id`, `url_original = url`, `filename = ''`
  - Write a third migration to make `url_original` and `filename` non-nullable, drop `entry_id` and legacy `url` columns
  - Regenerate the Prisma client (`prisma generate`)
  - _Requirements: 2.1, 3.1, 3.2, 3.3, 3.4_

- [x] 2. Implement MediaService core — resizing, upload, and entity association

  - [x] 2.1 Install and configure Sharp in the NestJS API
    - Add `sharp` and `@types/sharp` to `apps/api/package.json` (exact versions)
    - Verify Sharp resolves its native binary in the existing Node.js environment (add a smoke test stub)
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 Implement `resizeVariant` private method in `media.service.ts`
    - Use `sharp(input).resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer()`
    - Return `{ buffer, contentType: 'image/webp', ext: '.webp' }`
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 2.3 Write property test for resize longest-edge constraint (Property 1)
    - **Property 1: Resize respects longest-edge constraint**
    - Use `fc.record({ width: fc.integer({min:1,max:5000}), height: fc.integer({min:1,max:5000}) })` to generate arbitrary dimensions; assert longest edge of output ≤ maxEdge
    - **Validates: Requirements 1.1, 1.4**

  - [x] 2.4 Write property test for WebP encoding of non-SVG variants (Property 2)
    - **Property 2: Non-SVG variants are WebP encoded**
    - Use `fc.constantFrom('image/jpeg','image/png','image/webp')` to confirm `contentType === 'image/webp'`
    - **Validates: Requirements 1.2**

  - [x] 2.5 Implement `uploadForEntity` method — R2 multi-variant upload with partial-failure cleanup
    - Validate file type and size first (before any DB/R2 call), per existing `ALLOWED_IMAGE_TYPES` pattern
    - Verify entity existence (entry or article) via Prisma `findUnique`; return 404 if not found
    - Generate UUID for the asset; produce three variants (skip medium/small for SVG)
    - Upload each variant under key `{sourceType}/{sourceId}/{uuid}/{size}.{ext}`
    - On any `PutObjectCommand` failure: run `Promise.allSettled` cleanup of already-uploaded keys, throw `InternalServerErrorException`
    - Insert `MediaAsset` row with `source_id`, `source_type`, `url_original`, `url_medium`, `url_small`, `filename`, `type`, `sort_order`
    - Return `{ data: MediaAssetDto }`
    - _Requirements: 1.1–1.7, 2.1–2.9, 3.1–3.6_

  - [x] 2.6 Write property test for R2 key pattern (Property 3)
    - **Property 3: R2 key matches entity-type/id/uuid/size pattern**
    - Use `fc.record({ sourceType: fc.constantFrom('entry','article'), sourceId: fc.uuid(), uuid: fc.uuid(), ext: fc.constantFrom('.jpg','.png','.webp') })` to assert key construction
    - **Validates: Requirements 1.5**

  - [x] 2.7 Write property test for upload abort and cleanup on R2 failure (Property 4)
    - **Property 4: Upload aborts and cleans up on R2 failure**
    - Use `fc.integer({min:0,max:2})` (which variant index fails) to confirm no DB row created and `DeleteObjectCommand` attempted for uploaded keys
    - **Validates: Requirements 1.6, 2.9**

  - [x] 2.8 Write property test for polymorphic fields on created MediaAsset (Property 5)
    - **Property 5: Stored MediaAsset has correct polymorphic fields**
    - Use `fc.record({ sourceType: fc.constantFrom('entry','article'), sourceId: fc.uuid() })` to assert `source_type` and `source_id` on the created row
    - **Validates: Requirements 2.1**

  - [x] 2.9 Write property test for entity existence check gating upload (Property 6)
    - **Property 6: Entity existence check gates upload**
    - Use `fc.uuid()` (non-existent IDs) to assert 404 and no Sharp/R2/DB side-effects
    - **Validates: Requirements 2.4, 2.5, 2.6, 2.7**

  - [x] 2.10 Write property test for non-SVG uploads populating all three URL fields (Property 7)
    - **Property 7: Non-SVG upload populates all three URL fields**
    - Use `fc.record({ mime: fc.constantFrom('image/jpeg','image/png'), width: fc.integer({min:1,max:3000}), height: fc.integer({min:1,max:3000}) })` to assert all three URL fields non-empty
    - **Validates: Requirements 3.1, 3.6**

  - [x] 2.11 Write property test for filename preservation (Property 8)
    - **Property 8: Stored filename matches original uploaded filename**
    - Use `fc.string({minLength:1,maxLength:255})` as `originalname`; assert `MediaAsset.filename` equals input (truncated to 255 chars)
    - **Validates: Requirements 3.3**

- [x] 3. Checkpoint — Ensure resizing, R2 upload, and entity association tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement `updateAltText` and `listForEntity` methods in `media.service.ts`

  - [x] 4.1 Implement `updateAltText(assetId, altText)` method
    - Look up `MediaAsset` by `assetId`; throw `NotFoundException` with message `MediaAsset {assetId} not found` if absent
    - Validate `alt_text` ≤ 500 chars; throw `BadRequestException` with message `alt_text must not exceed 500 characters` if violated
    - If `alt_text` key absent from DTO, preserve existing value (no-op update, still return current record)
    - Update and return the full `MediaAssetDto`
    - _Requirements: 4.1–4.5_

  - [x] 4.2 Write property test for alt text valid range (Property 9)
    - **Property 9: Alt text update accepts all values in valid range**
    - Use `fc.option(fc.string({minLength:0,maxLength:500}), {nil:null})` to assert HTTP 200 and persisted value equals submitted value
    - **Validates: Requirements 4.1, 4.2**

  - [x] 4.3 Write property test for alt text > 500 chars rejection (Property 10)
    - **Property 10: Alt text exceeding 500 characters is rejected**
    - Use `fc.string({minLength:501,maxLength:2000})` to assert HTTP 400 without DB modification
    - **Validates: Requirements 4.4**

  - [x] 4.4 Write property test for PATCH on non-existent asset (Property 11)
    - **Property 11: Non-existent asset returns 404 on PATCH**
    - Use `fc.uuid()` (non-existent IDs) to assert HTTP 404
    - **Validates: Requirements 4.3**

  - [x] 4.5 Implement `listForEntity(sourceType, sourceId)` method
    - Query `prisma.mediaAsset.findMany` where `source_type = sourceType AND source_id = sourceId`, ordered by `sort_order ASC, created_at ASC`
    - Return `MediaAssetDto[]`
    - _Requirements: 5.2_

- [x] 5. Update MediaController with new routes and DTOs

  - [x] 5.1 Add `UpdateAltTextDto` class with `@IsOptional() @IsString() @MaxLength(500) alt_text?: string | null`
    - Create `apps/api/src/media/dto/update-alt-text.dto.ts`
    - _Requirements: 4.1, 4.4_

  - [x] 5.2 Add new routes to `MediaController`
    - `POST /api/v1/admin/media/entry/:entryId/upload` → `mediaService.uploadForEntity('entry', entryId, file)`
    - `POST /api/v1/admin/media/article/:articleId/upload` → `mediaService.uploadForEntity('article', articleId, file)`
    - `PATCH /api/v1/admin/media/assets/:assetId` → `mediaService.updateAltText(assetId, dto.alt_text)`
    - `GET /api/v1/admin/media/assets` (query params `source_type`, `source_id`) → `mediaService.listForEntity(...)`
    - Keep the legacy `POST /api/v1/admin/media/:entryId/upload` route for backward compatibility (mark `@ApiOperation` as deprecated)
    - _Requirements: 2.2, 2.3, 4.1, 5.2_

- [x] 6. Implement `deleteAssetsForEntity` and export MediaService

  - [x] 6.1 Implement `deleteAssetsForEntity(sourceType, sourceId)` in `media.service.ts`
    - Query all `MediaAsset` rows for the entity
    - Derive R2 keys by stripping `R2_PUBLIC_URL/` prefix from each non-null URL field
    - Fire `DeleteObjectCommand` for every non-null key using `Promise.allSettled`; log each rejection with key name
    - Always call `prisma.mediaAsset.deleteMany({ where: { source_type, source_id } })` after R2 deletes
    - Return without error when no matching rows exist
    - _Requirements: 6.1–6.5_

  - [x] 6.2 Write property test for cascade delete issuing correct R2 deletes (Property 13)
    - **Property 13: Cascade delete issues R2 delete for all non-null variant URLs**
    - Use `fc.array(fc.record({ url_original: fc.webUrl(), url_medium: fc.option(fc.webUrl(),{nil:null}), url_small: fc.option(fc.webUrl(),{nil:null}) }), {minLength:0,maxLength:10})` to count `DeleteObjectCommand` calls vs non-null URL fields
    - **Validates: Requirements 6.1, 6.2**

  - [x] 6.3 Write property test for R2 key round-trip through URL construction (Property 14)
    - **Property 14: R2 key round-trips through URL construction**
    - Use `fc.string({minLength:1}).filter(k => !k.includes('..'))` to verify `stripPrefix(publicUrl + '/' + key) === key`
    - **Validates: Requirements 6.3**

  - [x] 6.4 Write property test for cascade DB cleanup despite R2 failure (Property 15)
    - **Property 15: Cascade delete removes DB rows regardless of R2 failure**
    - Use `fc.record({ assets: fc.array(...), failingIndices: fc.uniqueArray(fc.nat()) })` to verify `deleteMany` always runs
    - **Validates: Requirements 6.4**

  - [x] 6.5 Export `MediaService` from `MediaModule`
    - Add `exports: [MediaService]` to `apps/api/src/media/media.module.ts`
    - _Requirements: 6.5_

- [x] 7. Integrate cascade delete into AdminEntryService and AdminArticleService

  - [x] 7.1 Inject `MediaService` into `AdminEntryModule` and call `deleteAssetsForEntity` before `prisma.entry.delete`
    - Import `MediaModule` in `apps/api/src/admin/entry/admin-entry.module.ts`
    - Inject `MediaService` into `AdminEntryService` via constructor
    - In `hardDelete`: add `await this.mediaService.deleteAssetsForEntity('entry', id)` before `prisma.entry.delete`
    - _Requirements: 6.1, 6.4, 6.5_

  - [x] 7.2 Inject `MediaService` into `AdminArticleModule` and call `deleteAssetsForEntity` before `prisma.article.delete`
    - Import `MediaModule` in `apps/api/src/admin/article/admin-article.module.ts`
    - Inject `MediaService` into `AdminArticleService` via constructor
    - In `delete`: add `await this.mediaService.deleteAssetsForEntity('article', id)` before `prisma.article.delete`
    - _Requirements: 6.2, 6.4, 6.5_

- [x] 8. Checkpoint — Ensure API layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Update admin API client (`apps/admin/src/lib/api/media.ts`)

  - [x] 9.1 Replace `MediaAsset` interface with the new schema fields
    - Replace `url`, `entry_id`, `cdn_url`, `caption` with `url_original`, `url_medium`, `url_small`, `filename`, `source_id`, `source_type`
    - Keep `id`, `type`, `alt_text`, `sort_order`, `created_at`; add `updated_at`
    - _Requirements: 3.1–3.4_

  - [x] 9.2 Add new `mediaApi` methods
    - `uploadForEntry(entryId, formData)` → `POST .../media/entry/{entryId}/upload`
    - `uploadForArticle(articleId, formData)` → `POST .../media/article/{articleId}/upload`
    - `listForEntity(sourceType, sourceId)` → `GET .../media/assets?source_type=...&source_id=...`
    - `updateAltText(assetId, altText)` → `PATCH .../media/assets/{assetId}`
    - Keep existing `listMedia`, `getMedia`, `uploadMedia`, `deleteMedia` for backward compatibility
    - _Requirements: 2.2, 2.3, 4.1, 5.5, 5.7, 5.8_

- [x] 10. Build `ImagesTab` component and wire into Entry and Article detail pages

  - [x] 10.1 Create `apps/admin/src/components/media/images-tab.tsx`
    - Accept `{ sourceType: 'entry' | 'article', sourceId: string }` props
    - Use TanStack Query (`queryKey: ['media-assets', sourceType, sourceId]`) to fetch `mediaApi.listForEntity`
    - Render empty state message when the asset list is empty (_Requirements: 5.4_)
    - Render an `AssetCard` per `MediaAsset` with: thumbnail (`url_small ?? url_original`), `filename`, `alt_text` (editable inline), click-to-copy buttons for each non-null URL variant
    - Alt text inline editor: on "Save", call `mediaApi.updateAltText`; on success update query cache; on failure show `toast.error` and revert local state (_Requirements: 5.5, 5.6_)
    - Include `EntityUploadDialog` or inline upload control calling the correct endpoint for `sourceType`; on success add the new asset to the list (_Requirements: 5.7, 5.8_)
    - _Requirements: 5.1–5.8_

  - [x] 10.2 Write property test for ImagesTab rendering all returned assets (Property 12)
    - **Property 12: Image gallery renders all returned assets**
    - Use `fc.array(fc.record({ id: fc.uuid(), url_original: fc.webUrl(), url_medium: fc.option(fc.webUrl(),{nil:null}), url_small: fc.option(fc.webUrl(),{nil:null}), filename: fc.string(), alt_text: fc.option(fc.string(),{nil:null}) }), {minLength:0,maxLength:20})` to assert one card per asset with correct fields
    - **Validates: Requirements 5.2, 5.3**

  - [x] 10.3 Replace the Images tab placeholder in `apps/admin/src/components/entries/entry-form.tsx`
    - Import `ImagesTab` and replace the "Images coming soon" placeholder content in `<TabsContent value="images">` with `<ImagesTab sourceType="entry" sourceId={entryId} />` (with unsaved-entry fallback message)
    - _Requirements: 5.1, 5.7_

  - [x] 10.4 Add the Images tab to `apps/admin/src/components/articles/article-editor-form.tsx`
    - Add `<TabsTrigger variant="line" value="images">Images</TabsTrigger>` alongside Details / SEO
    - Add `<TabsContent value="images">` with `<ImagesTab sourceType="article" sourceId={articleId} />` (with unsaved-article fallback message)
    - Thread `articleId` prop from the edit page into `ArticleEditorForm` if not already available
    - _Requirements: 5.1, 5.8_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Run the full test suite for both `apps/api` and `apps/admin`, ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use [fast-check](https://fast-check.dev/) following the project's existing PBT conventions; each runs ≥ 100 iterations and is tagged `Feature: image-multi-size-upload, Property {N}: {title}`
- The legacy `POST /api/v1/admin/media/:entryId/upload` route and the old `MediaAsset.upload()` service method are kept until callers are migrated; they can be removed in a follow-up
- The Prisma migration must be written as three separate additive steps (add nullable → backfill → make non-nullable / drop) to avoid data loss on existing rows
- Sharp's native binary must be verified in the CI environment; the smoke test in task 2.1 guards against this
- The DB-level `onDelete: Cascade` on `Entry → media_assets` is replaced by application-level cascade in `AdminEntryService.hardDelete` once the FK is dropped in the migration

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "5.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4"] },
    { "id": 4, "tasks": ["2.5", "4.5"] },
    { "id": 5, "tasks": ["2.6", "2.7", "2.8", "2.9", "2.10", "2.11", "4.1"] },
    { "id": 6, "tasks": ["4.2", "4.3", "4.4", "5.2"] },
    { "id": 7, "tasks": ["6.1"] },
    { "id": 8, "tasks": ["6.2", "6.3", "6.4", "6.5"] },
    { "id": 9, "tasks": ["7.1", "7.2"] },
    { "id": 10, "tasks": ["9.1"] },
    { "id": 11, "tasks": ["9.2"] },
    { "id": 12, "tasks": ["10.1"] },
    { "id": 13, "tasks": ["10.2", "10.3", "10.4"] }
  ]
}
```
