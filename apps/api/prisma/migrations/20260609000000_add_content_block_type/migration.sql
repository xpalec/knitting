-- CreateTable: content_block_type
CREATE TABLE "content_block_type" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "type"        TEXT         NOT NULL,
    "label"       VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMPTZ  NOT NULL,

    CONSTRAINT "content_block_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable: content_block_type_translation
CREATE TABLE "content_block_type_translation" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "block_type_id" UUID         NOT NULL,
    "locale"        TEXT         NOT NULL,
    "heading"       VARCHAR(255) NOT NULL,
    "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMPTZ  NOT NULL,

    CONSTRAINT "content_block_type_translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique type slug
CREATE UNIQUE INDEX "content_block_type_type_key" ON "content_block_type"("type");

-- CreateIndex: unique (block_type_id, locale)
CREATE UNIQUE INDEX "content_block_type_translation_block_type_id_locale_key"
    ON "content_block_type_translation"("block_type_id", "locale");

-- CreateIndex: locale lookup
CREATE INDEX "content_block_type_translation_locale_idx"
    ON "content_block_type_translation"("locale");

-- AddForeignKey
ALTER TABLE "content_block_type_translation"
    ADD CONSTRAINT "content_block_type_translation_block_type_id_fkey"
    FOREIGN KEY ("block_type_id")
    REFERENCES "content_block_type"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
