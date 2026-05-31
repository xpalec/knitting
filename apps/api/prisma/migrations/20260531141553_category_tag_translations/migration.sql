-- DropForeignKey
ALTER TABLE "category_translation" DROP CONSTRAINT "category_translation_category_id_fkey";

-- DropForeignKey
ALTER TABLE "tag_translation" DROP CONSTRAINT "tag_translation_tag_id_fkey";

-- DropIndex
DROP INDEX "category_metadata_idx";

-- DropIndex
DROP INDEX "entry_metadata_idx";

-- AlterTable
ALTER TABLE "category" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "category_translation" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tag_translation" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "category_translation" ADD CONSTRAINT "category_translation_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_translation" ADD CONSTRAINT "tag_translation_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
