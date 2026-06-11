-- Migration: replace Entry.type (String?) with entry_template_id (FK → entry_template)
-- Existing rows get entry_template_id = NULL (the FK is optional).

-- 1. Drop the old type column
ALTER TABLE "entry" DROP COLUMN IF EXISTS "type";

-- 2. Add the new FK column (nullable)
ALTER TABLE "entry"
  ADD COLUMN "entry_template_id" UUID;

-- 3. FK constraint with SET NULL on delete (so deleting a template doesn't cascade-delete entries)
ALTER TABLE "entry"
  ADD CONSTRAINT "entry_entry_template_id_fkey"
  FOREIGN KEY ("entry_template_id")
  REFERENCES "entry_template"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 4. Index for efficient lookups by template
CREATE INDEX "entry_entry_template_id_idx" ON "entry"("entry_template_id");
