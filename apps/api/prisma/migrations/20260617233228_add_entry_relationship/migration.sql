-- CreateEnum
CREATE TYPE "EntryRelationshipType" AS ENUM ('PREREQUISITE', 'VARIANT_OF', 'ALTERNATIVE_TO', 'COMMONLY_CONFUSED_WITH', 'USED_IN', 'PART_OF', 'COUNTERPART_OF', 'RELATED_TO');

-- CreateTable
CREATE TABLE "entry_relationship" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_entry_id" UUID NOT NULL,
    "target_entry_id" UUID NOT NULL,
    "type" "EntryRelationshipType" NOT NULL,
    "note" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entry_relationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entry_relationship_source_entry_id_idx" ON "entry_relationship"("source_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "entry_relationship_source_entry_id_target_entry_id_type_key" ON "entry_relationship"("source_entry_id", "target_entry_id", "type");

-- AddForeignKey
ALTER TABLE "entry_relationship" ADD CONSTRAINT "entry_relationship_source_entry_id_fkey" FOREIGN KEY ("source_entry_id") REFERENCES "entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_relationship" ADD CONSTRAINT "entry_relationship_target_entry_id_fkey" FOREIGN KEY ("target_entry_id") REFERENCES "entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
