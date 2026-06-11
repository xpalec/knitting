ALTER TABLE "entry_template" DROP COLUMN IF EXISTS "entry_type";
DROP INDEX IF EXISTS "entry_template_entry_type_idx";
