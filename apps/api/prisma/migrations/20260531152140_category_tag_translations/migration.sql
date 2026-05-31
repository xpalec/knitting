-- Migration: category_tag_translations
-- Data model: 03-data-model.md v2.4
--
-- Changes:
--   Category: remove name + slug columns; add status, entry_count, cover_image_url,
--             metadata, created_at, updated_at
--   CategoryTranslation: new table (name, slug, description, status per locale)
--   Tag: remove name column; add slug column
--   TagTranslation: new table (name, status per locale)

-- ---------------------------------------------------------------------------
-- New enum
-- ---------------------------------------------------------------------------

CREATE TYPE "CategoryStatus" AS ENUM ('draft', 'published');

-- ---------------------------------------------------------------------------
-- Category — alter existing table
-- ---------------------------------------------------------------------------

-- Drop the old unique slug index and name column
ALTER TABLE "category" DROP COLUMN IF EXISTS "name";
ALTER TABLE "category" DROP COLUMN IF EXISTS "slug";

-- Add new columns
ALTER TABLE "category"
  ADD COLUMN "status"          "CategoryStatus" NOT NULL DEFAULT 'draft',
  ADD COLUMN "entry_count"     INTEGER          NOT NULL DEFAULT 0,
  ADD COLUMN "cover_image_url" TEXT,
  ADD COLUMN "metadata"        JSONB            NOT NULL DEFAULT '{}',
  ADD COLUMN "created_at"      TIMESTAMPTZ      NOT NULL DEFAULT now(),
  ADD COLUMN "updated_at"      TIMESTAMPTZ      NOT NULL DEFAULT now();

-- Index on parent_id (was missing before)
CREATE INDEX IF NOT EXISTS "category_parent_id_idx" ON "category"("parent_id");

-- GIN index on metadata
CREATE INDEX IF NOT EXISTS "category_metadata_idx" ON "category" USING GIN("metadata");

-- ---------------------------------------------------------------------------
-- CategoryTranslation — new table
-- ---------------------------------------------------------------------------

CREATE TABLE "category_translation" (
  "id"              UUID              NOT NULL DEFAULT gen_random_uuid(),
  "category_id"     UUID              NOT NULL,
  "locale"          TEXT              NOT NULL,
  "slug"            TEXT              NOT NULL,
  "name"            TEXT              NOT NULL,
  "description"     JSONB,
  "status"          "TranslationStatus" NOT NULL DEFAULT 'draft',
  "translator_note" TEXT,
  "created_at"      TIMESTAMPTZ       NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ       NOT NULL DEFAULT now(),

  CONSTRAINT "category_translation_pkey"            PRIMARY KEY ("id"),
  CONSTRAINT "category_translation_category_id_fkey" FOREIGN KEY ("category_id")
    REFERENCES "category"("id") ON DELETE CASCADE,
  CONSTRAINT "category_translation_category_id_locale_key" UNIQUE ("category_id", "locale"),
  CONSTRAINT "category_translation_locale_slug_key"         UNIQUE ("locale", "slug")
);

CREATE INDEX "category_translation_locale_idx" ON "category_translation"("locale");

-- ---------------------------------------------------------------------------
-- entry_count trigger
-- Keeps Category.entry_count in sync when entries are added/removed from a category.
-- Only counts entries with status = 'published'.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION entry_category_count_update() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "category"
       SET "entry_count" = "entry_count" + 1
     WHERE "id" = NEW.category_id
       AND EXISTS (
         SELECT 1 FROM "entry" WHERE "id" = NEW.entry_id AND "status" = 'published'
       );
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "category"
       SET "entry_count" = GREATEST("entry_count" - 1, 0)
     WHERE "id" = OLD.category_id
       AND EXISTS (
         SELECT 1 FROM "entry" WHERE "id" = OLD.entry_id AND "status" = 'published'
       );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "entry_category_count_trigger"
  AFTER INSERT OR DELETE ON "entry_category"
  FOR EACH ROW EXECUTE FUNCTION entry_category_count_update();

-- ---------------------------------------------------------------------------
-- Tag — alter existing table
-- ---------------------------------------------------------------------------

-- Drop old unique name constraint and column
ALTER TABLE "tag" DROP COLUMN IF EXISTS "name";

-- Add slug as canonical identifier
ALTER TABLE "tag"
  ADD COLUMN "slug" TEXT NOT NULL DEFAULT '';

-- Make slug unique (after backfill if needed — in dev this table is empty)
ALTER TABLE "tag" ADD CONSTRAINT "tag_slug_key" UNIQUE ("slug");

-- Remove the DEFAULT now that the constraint is in place
ALTER TABLE "tag" ALTER COLUMN "slug" DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- TagTranslation — new table
-- ---------------------------------------------------------------------------

CREATE TABLE "tag_translation" (
  "id"         UUID                NOT NULL DEFAULT gen_random_uuid(),
  "tag_id"     UUID                NOT NULL,
  "locale"     TEXT                NOT NULL,
  "name"       TEXT                NOT NULL,
  "status"     "TranslationStatus" NOT NULL DEFAULT 'draft',
  "created_at" TIMESTAMPTZ         NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ         NOT NULL DEFAULT now(),

  CONSTRAINT "tag_translation_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "tag_translation_tag_id_fkey"   FOREIGN KEY ("tag_id")
    REFERENCES "tag"("id") ON DELETE CASCADE,
  CONSTRAINT "tag_translation_tag_id_locale_key" UNIQUE ("tag_id", "locale")
);

CREATE INDEX "tag_translation_locale_idx" ON "tag_translation"("locale");
