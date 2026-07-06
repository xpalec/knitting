-- Migration 2 of 3: Backfill existing media_asset rows with polymorphic and URL data
-- Copies entry_id → source_id, sets source_type = 'entry', copies url → url_original,
-- sets filename = '' as a placeholder (real filenames are unknown for legacy rows),
-- and stamps created_at / updated_at with the current time for any rows missing them.

UPDATE "media_asset"
SET
  "source_type"  = 'entry',
  "source_id"    = "entry_id",
  "url_original" = "url",
  "filename"     = '',
  "created_at"   = COALESCE("created_at", NOW()),
  "updated_at"   = COALESCE("updated_at", NOW())
WHERE "source_id" IS NULL;
