ALTER TABLE "entry_template"
  ADD COLUMN IF NOT EXISTS "entry_type"    TEXT  NOT NULL DEFAULT 'stitch',
  ADD COLUMN IF NOT EXISTS "translations"  JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "entry_template_entry_type_idx" ON "entry_template" ("entry_type");
