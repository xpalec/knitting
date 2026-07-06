-- Migration 3 of 3: Finalize media_asset schema
-- Make previously-nullable new columns non-nullable now that all rows are backfilled,
-- then drop the legacy entry_id FK and url columns.

-- 1. Make source_id and source_type non-nullable
ALTER TABLE "media_asset" ALTER COLUMN "source_id"    SET NOT NULL;
ALTER TABLE "media_asset" ALTER COLUMN "source_type"  SET NOT NULL;

-- 2. Make url_original and filename non-nullable
ALTER TABLE "media_asset" ALTER COLUMN "url_original" SET NOT NULL;
ALTER TABLE "media_asset" ALTER COLUMN "filename"     SET NOT NULL;

-- 3. Make timestamps non-nullable with defaults going forward
ALTER TABLE "media_asset" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "media_asset" ALTER COLUMN "created_at" SET DEFAULT NOW();
ALTER TABLE "media_asset" ALTER COLUMN "updated_at" SET NOT NULL;

-- 4. Drop the FK constraint on entry_id (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_name = 'media_asset'
      AND constraint_name = 'media_asset_entry_id_fkey'
  ) THEN
    ALTER TABLE "media_asset" DROP CONSTRAINT "media_asset_entry_id_fkey";
  END IF;
END $$;

-- 5. Drop the legacy columns
ALTER TABLE "media_asset" DROP COLUMN IF EXISTS "entry_id";
ALTER TABLE "media_asset" DROP COLUMN IF EXISTS "url";
