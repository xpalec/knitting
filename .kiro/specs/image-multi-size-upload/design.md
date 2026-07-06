# Design Document: image-multi-size-upload

## Overview

This feature extends the existing media upload system in the Knitting Encyclopedia admin to:

1. **Multi-size generation** — on upload, produce three image variants (original, medium ≤ 800 px longest edge, small ≤ 300 px longest edge) using Sharp server-side in the NestJS API.
2. **Polymorphic entity association** — `MediaAsset` gains `source_id` / `source_type` fields replacing the hard-coded `entry_id` FK, allowing both Entry and Article (and future types) to own media assets.
3. **Richer metadata** — `MediaAsset` stores `url_original`, `url_medium`, `url_small`, `alt_text`, and `filename`.
4. **Alt text editing** — `PATCH /api/v1/admin/media/assets/{assetId}` allows post-upload accessibility text updates.
5. **Images tab** — the Next.js admin gains an Images tab on both Entry and Article detail pages.
6. **Cascade R2 deletion** — when a parent Entry or Article is hard-deleted, all associated R2 objects are cleaned up automatically.

### Key Design Decisions

- **Sharp for resizing** — Sharp is a battle-tested, high-performance Node.js image processing library backed by libvips. It runs in-process inside the NestJS API, so no additional infrastructure (Cloudflare Worker, resize service) is needed.
- **Polymorphic association over separate FK columns** — adding `source_id`/`source_type` instead of adding an `article_id` column avoids a schema change every time a new content type needs media. The trade-off is that a database-level FK can't be enforced for the polymorphic column; entity existence is validated at the application layer instead.
- **WebP for all non-SVG resize outputs** — WebP provides good quality-to-size ratio and is universally supported by modern browsers. The original variant retains its source format.
- **R2 key derived from public URL** — storing only public URLs (not R2 keys) keeps the DB schema simple. Keys are re-derived on deletion by stripping the `R2_PUBLIC_URL` prefix.
- **Cascade R2 deletion in the AdminEntryService / AdminArticleService** — rather than relying on database triggers, deletion is handled explicitly in the application services before calling `prisma.*.delete`. This is explicit, testable, and avoids hidden database-side side-effects.

---

## Architecture

```mermaid
graph TD
  subgraph Admin (Next.js)
    ImageTab["ImagesTab component<br>(entries & articles)"]
    UploadDialog["EntityUploadDialog<br>(entity-aware)"]
    AltTextEdit["Alt text inline editor"]
  end

  subgraph API (NestJS)
    MC["MediaController\n/api/v1/admin/media"]
    MS["MediaService"]
    Sharp["Sharp (in-process)"]
    S3SDK["@aws-sdk/client-s3"]
    AdminEntryService["AdminEntryService"]
    AdminArticleService["AdminArticleService"]
  end

  subgraph Storage
    R2["Cloudflare R2\n(S3-compatible)"]
    DB["PostgreSQL via Prisma\nmedia_asset table"]
  end

  ImageTab --> |"GET /api/v1/admin/media/assets?source_type=entry&source_id=..."| MC
  UploadDialog --> |"POST .../entry/{id}/upload"| MC
  UploadDialog --> |"POST .../article/{id}/upload"| MC
  AltTextEdit --> |"PATCH .../assets/{assetId}"| MC

  MC --> MS
  MS --> Sharp
  Sharp -->|"3 buffers"| S3SDK
  S3SDK --> R2
  MS --> DB

  AdminEntryService --> |"deleteAssetsForEntity('entry', id)"| MS
  AdminArticleService --> |"deleteAssetsForEntity('article', id)"| MS
  MS --> |"DeleteObjectCommand × N"| R2
  MS --> |"deleteMany(source_type, source_id)"| DB
```

### Request Flow: Upload

1. Admin POSTs a multipart `file` to `/api/v1/admin/media/entry/{entryId}/upload` (or `.../article/{articleId}/upload`).
2. `MediaController` validates file type and size via `FileInterceptor` + service validation (before any DB lookup).
3. `MediaService` verifies entity existence (entry or article must exist in DB).
4. `MediaService` calls Sharp to produce three output buffers (original, medium, small). SVG files skip resizing.
5. Three `PutObjectCommand` calls upload buffers to R2 under `{entity_type}/{entity_id}/{uuid}/{size}.{ext}`.
6. If any upload fails, already-uploaded variants are deleted and a 5xx is returned.
7. `MediaService` creates a single `MediaAsset` row with all three URLs, `source_id`, `source_type`, and `filename`.
8. Returns `{ data: { asset } }` with the full `MediaAsset` record.

### Request Flow: Cascade Delete

1. Admin DELETEs `/api/v1/admin/entries/{id}` or `/api/v1/admin/articles/{id}`.
2. `AdminEntryService.hardDelete` / `AdminArticleService.delete` calls `mediaService.deleteAssetsForEntity(sourceType, entityId)` before calling `prisma.*.delete`.
3. `deleteAssetsForEntity` queries all `MediaAsset` rows for the entity, fires `DeleteObjectCommand` for each non-null URL (key derived by stripping public base URL), logs individual failures without aborting, then calls `prisma.mediaAsset.deleteMany`.
4. The parent entity delete proceeds regardless of R2 failures.

---

## Components and Interfaces

### API — MediaController

**File:** `apps/api/src/media/media.controller.ts`

New routes added:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/admin/media/entry/{entryId}/upload` | Upload image for an entry |
| `POST` | `/api/v1/admin/media/article/{articleId}/upload` | Upload image for an article |
| `PATCH` | `/api/v1/admin/media/assets/{assetId}` | Update alt text |
| `GET` | `/api/v1/admin/media/assets` | List assets by source (query params: `source_type`, `source_id`) |

The legacy `POST /api/v1/admin/media/:entryId/upload` route is kept temporarily for backward compatibility with the existing upload dialog, but deprecated in favour of the entity-specific routes.

```typescript
// New DTOs

// UpdateAltTextDto
export class UpdateAltTextDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  alt_text?: string | null;
}
```

### API — MediaService

**File:** `apps/api/src/media/media.service.ts`

New / changed public methods:

```typescript
/** Entity-specific upload: validates entity, resizes via Sharp, uploads 3 variants to R2, persists MediaAsset */
async uploadForEntity(
  sourceType: 'entry' | 'article',
  sourceId: string,
  file: Express.Multer.File,
): Promise<{ data: MediaAssetDto }>

/** Update alt_text on a MediaAsset */
async updateAltText(
  assetId: string,
  altText: string | null | undefined,
): Promise<MediaAssetDto>

/** List assets for a given entity */
async listForEntity(
  sourceType: 'entry' | 'article',
  sourceId: string,
): Promise<MediaAssetDto[]>

/** Called by AdminEntryService and AdminArticleService before parent delete */
async deleteAssetsForEntity(
  sourceType: 'entry' | 'article',
  sourceId: string,
): Promise<void>
```

#### Sharp Integration

```typescript
import sharp from 'sharp';

interface ResizeResult {
  buffer: Buffer;
  contentType: string;
  ext: string;
}

private async resizeVariant(
  input: Buffer,
  maxEdge: number,
): Promise<ResizeResult> {
  const resized = await sharp(input)
    .resize(maxEdge, maxEdge, {
      fit: 'inside',        // preserves aspect ratio, no upscaling beyond maxEdge
      withoutEnlargement: true,  // no upscaling if already smaller
    })
    .webp({ quality: 85 })
    .toBuffer();
  return { buffer: resized, contentType: 'image/webp', ext: '.webp' };
}
```

#### R2 Key Pattern

```
{sourceType}/{sourceId}/{uuid}/original.{origExt}
{sourceType}/{sourceId}/{uuid}/medium.webp
{sourceType}/{sourceId}/{uuid}/small.webp
```

For SVG files only the `original` key is written; `medium` and `small` are omitted.

#### Partial Upload Cleanup

If a `PutObjectCommand` fails mid-upload, previously uploaded keys for the same asset UUID are deleted with `DeleteObjectCommand` calls (best-effort), and the operation throws a 500.

```typescript
const uploadedKeys: string[] = [];
try {
  for (const variant of variants) {
    await this.s3.send(new PutObjectCommand({ ... }));
    uploadedKeys.push(variant.key);
  }
} catch (err) {
  // Best-effort cleanup
  await Promise.allSettled(
    uploadedKeys.map(key =>
      this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
    )
  );
  throw new InternalServerErrorException('Upload failed; partial uploads have been cleaned up');
}
```

### API — AdminEntryService (change)

**File:** `apps/api/src/admin/entry/admin-entry.service.ts`

`MediaService` is injected via constructor. The `hardDelete` method is extended:

```typescript
async hardDelete(id: string) {
  await this.assertExists(id);
  await this.invalidateCacheForEntry(id);
  await this.mediaService.deleteAssetsForEntity('entry', id);  // NEW
  await this.prisma.entry.delete({ where: { id } });
  return { data: { id } };
}
```

`MediaModule` must be exported and imported by `AdminEntryModule`. Alternatively, `MediaService` can be referenced directly if both are in the same module scope. The cleanest approach is to export `MediaService` from `MediaModule` and import it where needed.

### API — AdminArticleService (change)

**File:** `apps/api/src/admin/article/admin-article.service.ts`

Same pattern as `AdminEntryService`:

```typescript
async delete(id: string) {
  await this.assertArticleExists(id);
  await this.mediaService.deleteAssetsForEntity('article', id);  // NEW
  await this.prisma.article.delete({ where: { id } });
  return { id, deleted: true };
}
```

### Admin — `mediaApi` client update

**File:** `apps/admin/src/lib/api/media.ts`

```typescript
export interface MediaAsset {
  id: string;
  source_id: string;
  source_type: 'entry' | 'article';
  type: MediaType;
  url_original: string;
  url_medium: string | null;
  url_small: string | null;
  alt_text: string | null;
  filename: string;
  sort_order: number;
  created_at: string;
}

export const mediaApi = {
  // entity-specific upload
  uploadForEntry: (entryId: string, formData: FormData): Promise<MediaAsset> =>
    apiUpload<MediaAsset>(`/api/v1/admin/media/entry/${entryId}/upload`, formData),

  uploadForArticle: (articleId: string, formData: FormData): Promise<MediaAsset> =>
    apiUpload<MediaAsset>(`/api/v1/admin/media/article/${articleId}/upload`, formData),

  // list assets for an entity
  listForEntity: (sourceType: 'entry' | 'article', sourceId: string): Promise<MediaAsset[]> =>
    apiGet<MediaAsset[]>(`/api/v1/admin/media/assets`, { source_type: sourceType, source_id: sourceId }),

  // update alt text
  updateAltText: (assetId: string, altText: string | null): Promise<MediaAsset> =>
    apiPatch<MediaAsset>(`/api/v1/admin/media/assets/${assetId}`, { alt_text: altText }),
};
```

### Admin — `ImagesTab` component

**File (new):** `apps/admin/src/components/media/images-tab.tsx`

Props:

```typescript
interface ImagesTabProps {
  sourceType: 'entry' | 'article';
  sourceId: string;
}
```

Responsibilities:
- Fetches assets via TanStack Query (`queryKey: ['media-assets', sourceType, sourceId]`).
- Renders an `EntityUploadDialog` component that calls the correct upload endpoint based on `sourceType`.
- Renders a grid of `AssetCard` components (one per `MediaAsset`).
- Shows empty state message when no assets exist.

**`AssetCard`** (internal to `images-tab.tsx` or separate file):
- Displays thumbnail using `url_small ?? url_original`.
- Shows `filename` and `alt_text` (editable inline).
- Copy-to-clipboard buttons for each non-null URL variant (`url_original`, `url_medium`, `url_small`).
- "Save" button for alt text that calls `mediaApi.updateAltText`. On success: updates query cache. On failure: shows `toast.error` and reverts local state.

### Admin — Entry detail page integration

**File:** `apps/admin/src/components/entries/entry-form.tsx`

The existing placeholder Images tab content (currently shows "Coming soon" message) is replaced:

```tsx
<TabsContent value="images" className="mt-0 pt-4">
  {entryId ? (
    <ImagesTab sourceType="entry" sourceId={entryId} />
  ) : (
    <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
      Save the entry first to upload images.
    </div>
  )}
</TabsContent>
```

### Admin — Article detail page integration

**File:** `apps/admin/src/components/articles/article-editor-form.tsx`

An Images tab is added to the right-panel tab set alongside the existing Details / SEO tabs:

```tsx
<TabsTrigger variant="line" value="images">Images</TabsTrigger>
...
<TabsContent value="images" className="mt-0 pt-4">
  {articleId ? (
    <ImagesTab sourceType="article" sourceId={articleId} />
  ) : (
    <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
      Save the article first to upload images.
    </div>
  )}
</TabsContent>
```

The `articleId` prop is threaded into `ArticleEditorForm` from the edit page (already available via `params.id`).

---

## Data Models

### Prisma schema migration

The `MediaAsset` model is replaced entirely:

```prisma
model MediaAsset {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid

  // Polymorphic association
  source_id    String    @db.Uuid
  source_type  String    @db.VarChar(50)   // "entry" | "article"

  // Variant URLs
  url_original String
  url_medium   String?
  url_small    String?

  // Metadata
  alt_text     String?   @db.VarChar(500)
  filename     String    @db.VarChar(255)

  // Legacy / compatibility
  type         MediaType
  sort_order   Int       @default(0)

  created_at   DateTime  @default(now()) @db.Timestamptz
  updated_at   DateTime  @updatedAt @db.Timestamptz

  @@index([source_type, source_id])
  @@map("media_asset")
}
```

**Migration steps:**

1. Add new columns (`source_id`, `source_type`, `url_original`, `url_medium`, `url_small`, `alt_text`, `filename`, `created_at`, `updated_at`) as nullable initially.
2. Backfill existing rows: set `source_type = 'entry'`, `source_id = entry_id`, `url_original = url`, `filename = ''`.
3. Alter `url_original` and `filename` to non-nullable after backfill.
4. Drop `entry_id` FK column and the legacy `url` column.
5. Add composite index on `(source_type, source_id)`.

> **Note:** The existing Prisma `Entry` → `media_assets` relation (and its `onDelete: Cascade` DB-level cascade) is removed. The `Entry.media_assets` convenience relation can remain as a virtual Prisma relation for convenience but the FK constraint is no longer the deletion mechanism — application-level cascade in `AdminEntryService` takes over.

### Response DTO

```typescript
export interface MediaAssetDto {
  id: string;
  source_id: string;
  source_type: string;
  type: string;
  url_original: string;
  url_medium: string | null;
  url_small: string | null;
  alt_text: string | null;
  filename: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Resize respects longest-edge constraint

*For any* non-SVG image of arbitrary dimensions uploaded to the service, the stored `url_medium` variant's longest edge SHALL be ≤ 800 px and the stored `url_small` variant's longest edge SHALL be ≤ 300 px.

**Validates: Requirements 1.1, 1.4**

### Property 2: Non-SVG variants are WebP encoded

*For any* non-SVG image upload, the content-type of the medium and small buffers written to R2 SHALL be `image/webp`.

**Validates: Requirements 1.2**

### Property 3: R2 key matches entity-type/id/uuid/size pattern

*For any* combination of `(sourceType, sourceId, uuid, originalFilename)`, the R2 keys used for the three variant `PutObjectCommand` calls SHALL match the pattern `{sourceType}/{sourceId}/{uuid}/original.{ext}`, `{sourceType}/{sourceId}/{uuid}/medium.webp`, and `{sourceType}/{sourceId}/{uuid}/small.webp`.

**Validates: Requirements 1.5**

### Property 4: Upload aborts and cleans up on R2 failure

*For any* valid upload where one of the S3 PutObjectCommand calls throws, no `MediaAsset` database row is created and a `DeleteObjectCommand` is attempted for each already-uploaded key.

**Validates: Requirements 1.6, 2.9**

### Property 5: Stored MediaAsset has correct polymorphic fields

*For any* upload targeting entity type `T` and entity id `I`, the created `MediaAsset` row SHALL have `source_type = T` and `source_id = I`.

**Validates: Requirements 2.1**

### Property 6: Entity existence check gates upload

*For any* `sourceId` UUID that does not exist in the database, the upload endpoint SHALL return a 404 response and SHALL NOT perform any Sharp processing, R2 upload, or database write.

**Validates: Requirements 2.4, 2.5, 2.6, 2.7**

### Property 7: Non-SVG upload populates all three URL fields

*For any* non-SVG image upload, the persisted `MediaAsset` SHALL have `url_original`, `url_medium`, and `url_small` all set to non-empty strings.

**Validates: Requirements 3.1, 3.6**

### Property 8: Stored filename matches original uploaded filename

*For any* uploaded file with a given `originalname`, the created `MediaAsset.filename` SHALL equal that original filename (truncated to 255 characters if longer).

**Validates: Requirements 3.3**

### Property 9: Alt text update accepts all values in valid range

*For any* `alt_text` value that is either `null` or a string of length 0–500 characters, a PATCH request to `/api/v1/admin/media/assets/{assetId}` SHALL return HTTP 200 and the stored `alt_text` SHALL equal the submitted value.

**Validates: Requirements 4.1, 4.2**

### Property 10: Alt text exceeding 500 characters is rejected

*For any* `alt_text` string with length > 500 characters, the PATCH endpoint SHALL return HTTP 400 without modifying the stored record.

**Validates: Requirements 4.4**

### Property 11: Non-existent asset returns 404 on PATCH

*For any* UUID that does not correspond to a `MediaAsset` record, the PATCH endpoint SHALL return HTTP 404.

**Validates: Requirements 4.3**

### Property 12: Image gallery renders all returned assets

*For any* list of `MediaAsset` records returned by the API for a given entity, the `ImagesTab` component SHALL render a card for each asset containing the thumbnail, filename, alt text, and copy controls.

**Validates: Requirements 5.2, 5.3**

### Property 13: Cascade delete issues R2 delete for all non-null variant URLs

*For any* entity (entry or article) with N associated `MediaAsset` records, deleting the entity SHALL cause a `DeleteObjectCommand` to be issued for each non-null URL field across all N assets (up to 3 per asset for non-SVG, 1 for SVG).

**Validates: Requirements 6.1, 6.2**

### Property 14: R2 key round-trips through URL construction

*For any* valid R2 key string, constructing the public URL as `{R2_PUBLIC_URL}/{key}` and then stripping the `{R2_PUBLIC_URL}/` prefix SHALL yield the original key unchanged.

**Validates: Requirements 6.3**

### Property 15: Cascade delete removes DB rows regardless of R2 failure

*For any* entity whose R2 deletions partially or fully fail, the associated `MediaAsset` database rows SHALL be deleted and the parent entity delete SHALL proceed without error.

**Validates: Requirements 6.4**

---

## Error Handling

### Upload error scenarios

| Scenario | HTTP status | Behaviour |
|----------|------------|-----------|
| Unsupported MIME type | 400 | Rejected before any DB/S3 call |
| File exceeds size limit (5 MB) | 400 | Rejected before any DB/S3 call |
| Entity not found | 404 | No S3/DB operation performed |
| S3 upload fails (any variant) | 500 | Already-uploaded variants deleted (best-effort); no DB row created |
| Sharp processing error (corrupt image) | 400 | `BadRequestException` with message "Unable to process image" |
| DB insert fails after S3 success | 500 | S3 objects remain (orphaned); logged as critical for manual cleanup |

> The last scenario (S3 succeeds but DB fails) is an inherently hard problem with distributed systems. Since it is rare and the impact is limited (orphaned storage objects, not data loss), it is accepted as a known limitation. A periodic S3/DB reconciliation job can address it if needed in future.

### Alt text PATCH error scenarios

| Scenario | HTTP status | Message |
|----------|------------|---------|
| Asset not found | 404 | `MediaAsset {assetId} not found` |
| `alt_text` > 500 chars | 400 | `alt_text must not exceed 500 characters` |
| DB update fails | 500 | Generic server error |

### Cascade delete error handling

R2 delete failures during cascade are **logged but non-fatal**. The `deleteAssetsForEntity` method uses `Promise.allSettled` to attempt all R2 deletes concurrently, collects rejections, logs each with the affected key, then always proceeds to `prisma.mediaAsset.deleteMany`.

```typescript
const results = await Promise.allSettled(deletePromises);
for (const [i, result] of results.entries()) {
  if (result.status === 'rejected') {
    this.logger.error(
      `Failed to delete R2 object ${keys[i]}: ${result.reason}`,
    );
  }
}
// Always clean up DB rows
await this.prisma.mediaAsset.deleteMany({
  where: { source_type: sourceType, source_id: sourceId },
});
```

### Admin UI error handling

- Upload failure: `toast.error('Upload failed. Please try again.')` — file remains in the pending queue.
- Alt text save failure: `toast.error('Failed to save alt text')` — the inline input is restored to its previous value (local state rollback).
- Asset list fetch failure: TanStack Query's `isError` triggers an inline error message with a "Retry" button.

---

## Testing Strategy

### Unit tests

Focused on pure logic and service-layer behaviour with mocked dependencies:

- **MediaService** — cover each upload path (entry, article, SVG, non-SVG, partial R2 failure, entity not found, file validation).
- **`resizeVariant`** — verify longest-edge constraint satisfied for a range of aspect ratios.
- **`deleteAssetsForEntity`** — verify R2 delete calls + DB cleanup for N assets; verify R2 failure does not prevent DB cleanup.
- **`updateAltText`** — boundary tests at 0, 500, and 501 characters; null; missing key (no change).
- **Admin `ImagesTab`** component — render with 0 and N assets, alt text edit flow, upload button.

### Property-based tests

The property-based test suite uses [fast-check](https://fast-check.dev/) (the project's existing PBT library for TypeScript).

Each property test runs minimum **100 iterations**.

Tag format: `Feature: image-multi-size-upload, Property {N}: {title}`

| # | Property | fast-check generator sketch |
|---|----------|----------------------------|
| 1 | Resize respects longest-edge | `fc.record({ width: fc.integer({min:1,max:5000}), height: fc.integer({min:1,max:5000}) })` |
| 2 | Non-SVG variants are WebP | `fc.constantFrom('image/jpeg','image/png','image/webp')` |
| 3 | R2 key pattern | `fc.record({ sourceType: fc.constantFrom('entry','article'), sourceId: fc.uuid(), uuid: fc.uuid(), ext: fc.constantFrom('.jpg','.png','.webp') })` |
| 4 | Upload aborts on R2 failure | `fc.integer({min:0,max:2})` (which variant index fails) |
| 5 | Polymorphic fields | `fc.record({ sourceType: fc.constantFrom('entry','article'), sourceId: fc.uuid() })` |
| 6 | Entity existence check | `fc.uuid()` (non-existent IDs) |
| 7 | Non-SVG populates all 3 URLs | `fc.record({ mime: fc.constantFrom('image/jpeg','image/png'), width: fc.integer({min:1,max:3000}), height: fc.integer({min:1,max:3000}) })` |
| 8 | Filename preserved | `fc.string({minLength:1,maxLength:255})` |
| 9 | Alt text valid range | `fc.option(fc.string({minLength:0,maxLength:500}), {nil:null})` |
| 10 | Alt text > 500 rejected | `fc.string({minLength:501,maxLength:2000})` |
| 11 | PATCH on missing asset | `fc.uuid()` |
| 12 | Gallery renders all assets | `fc.array(fc.record({ id: fc.uuid(), url_original: fc.webUrl(), url_medium: fc.option(fc.webUrl(),{nil:null}), url_small: fc.option(fc.webUrl(),{nil:null}), filename: fc.string(), alt_text: fc.option(fc.string(),{nil:null}) }), {minLength:0,maxLength:20})` |
| 13 | Cascade delete issues correct R2 calls | `fc.array(fc.record({ url_original: fc.webUrl(), url_medium: fc.option(fc.webUrl(),{nil:null}), url_small: fc.option(fc.webUrl(),{nil:null}) }), {minLength:0,maxLength:10})` |
| 14 | R2 key round-trips through URL | `fc.string({minLength:1}).filter(k => !k.includes('..'))` (valid R2 key characters) |
| 15 | Cascade DB cleanup despite R2 failure | `fc.record({ assets: fc.array(fc.record({...})), failingIndices: fc.uniqueArray(fc.nat()) })` |

### Integration tests

- Full upload flow against a real (or localstack) R2-compatible endpoint (one test each for entry and article).
- `GET /api/v1/admin/media/assets?source_type=entry&source_id=...` returns the correct list.
- `PATCH /api/v1/admin/media/assets/{assetId}` persists changes.
- Cascade delete: create entry + upload → delete entry → verify DB rows gone.

### Smoke tests

- Sharp package is installed and can process a minimal JPEG buffer (guards against native binary issues in CI).
- `deleteAssetsForEntity` method exists and is callable.
- Upload endpoint returns within 30 seconds for a representative 4 MB JPEG.
