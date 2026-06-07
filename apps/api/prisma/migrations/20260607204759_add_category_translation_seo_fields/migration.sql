-- AlterTable: Add short_description, seo_title, seo_description to category_translation
ALTER TABLE "category_translation"
  ADD COLUMN "short_description" TEXT,
  ADD COLUMN "seo_title"         TEXT,
  ADD COLUMN "seo_description"   TEXT;
