-- Migration 1 of 3: Add new nullable columns to media_asset
-- This is an additive step — all new columns are nullable to allow existing rows to remain valid.

-- Add polymorphic association columns
ALTER TABLE "media_asset" ADD COLUMN "source_id" UUID;
ALTER TABLE "media_asset" ADD COLUMN "source_type" VARCHAR(50);

-- Add variant URL columns (url_original replaces the legacy url column)
ALTER TABLE "media_asset" ADD COLUMN "url_original" TEXT;
ALTER TABLE "media_asset" ADD COLUMN "url_medium"   TEXT;
ALTER TABLE "media_asset" ADD COLUMN "url_small"    TEXT;

-- Add metadata columns
ALTER TABLE "media_asset" ADD COLUMN "alt_text"  VARCHAR(500);
ALTER TABLE "media_asset" ADD COLUMN "filename"  VARCHAR(255);

-- Add timestamps (nullable first so existing rows don't violate NOT NULL)
ALTER TABLE "media_asset" ADD COLUMN "created_at" TIMESTAMPTZ;
ALTER TABLE "media_asset" ADD COLUMN "updated_at" TIMESTAMPTZ;

-- Create composite index on (source_type, source_id) for polymorphic lookups
CREATE INDEX "media_asset_source_type_source_id_idx" ON "media_asset"("source_type", "source_id");
