-- CreateTable: entry_template
CREATE TABLE "entry_template" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "name"        VARCHAR(255) NOT NULL,
    "description" TEXT,
    "entry_type"  TEXT        NOT NULL,
    "blocks"      JSONB       NOT NULL DEFAULT '[]',
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMPTZ NOT NULL,

    CONSTRAINT "entry_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: entry_type lookup
CREATE INDEX "entry_template_entry_type_idx" ON "entry_template"("entry_type");
