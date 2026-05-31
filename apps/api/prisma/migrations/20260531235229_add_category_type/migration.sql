-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('entry', 'abbreviation', 'article');

-- AlterTable: add type column with a temporary default so existing rows get a value
ALTER TABLE "category" ADD COLUMN "type" "CategoryType" NOT NULL DEFAULT 'entry';

-- Remove the default so future inserts must supply an explicit value
ALTER TABLE "category" ALTER COLUMN "type" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "category_type_idx" ON "category"("type");

-- CreateIndex
CREATE INDEX "category_status_idx" ON "category"("status");
