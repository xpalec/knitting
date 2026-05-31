-- Migration: tag_translation_description_seo
-- Data model: 03-data-model.md v2.5
--
-- Adds description (TipTap JSON), seo_title, and seo_description
-- to the tag_translation table.

ALTER TABLE "tag_translation"
  ADD COLUMN "description"     JSONB,
  ADD COLUMN "seo_title"       TEXT,
  ADD COLUMN "seo_description" TEXT;
