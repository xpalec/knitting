-- Migration: tag_translation_slug
-- Adds a locale-specific slug to tag_translation, mirroring CategoryTranslation.
-- Existing rows get a temporary slug derived from the tag's canonical slug + locale suffix,
-- which editors can update via the admin UI.

-- Step 1: add nullable column
ALTER TABLE "tag_translation"
  ADD COLUMN "slug" TEXT;

-- Step 2: back-fill existing rows with <tag.slug>-<locale> so the NOT NULL constraint can be applied
UPDATE "tag_translation" tt
SET slug = t.slug || '-' || tt.locale
FROM "tag" t
WHERE t.id = tt.tag_id;

-- Step 3: make it NOT NULL
ALTER TABLE "tag_translation"
  ALTER COLUMN "slug" SET NOT NULL;

-- Step 4: unique constraint (locale, slug) — same pattern as category_translation
ALTER TABLE "tag_translation"
  ADD CONSTRAINT "tag_translation_locale_slug_key" UNIQUE ("locale", "slug");
