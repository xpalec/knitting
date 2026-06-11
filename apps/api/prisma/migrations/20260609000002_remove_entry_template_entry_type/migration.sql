-- AlterTable: drop entry_type column from entry_template
ALTER TABLE "entry_template" DROP COLUMN IF EXISTS "entry_type";

-- DropIndex: entry_type lookup no longer needed
DROP INDEX IF EXISTS "entry_template_entry_type_idx";
