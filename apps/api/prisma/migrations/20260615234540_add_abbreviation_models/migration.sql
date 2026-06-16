-- CreateTable
CREATE TABLE "abbreviation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(255) NOT NULL,
    "source_language" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "abbreviation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abbreviation_translation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "abbreviation_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "short_meaning" VARCHAR(500),
    "description" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "abbreviation_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_abbreviation" (
    "entry_id" UUID NOT NULL,
    "abbreviation_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "entry_abbreviation_pkey" PRIMARY KEY ("entry_id","abbreviation_id")
);

-- CreateIndex
CREATE INDEX "abbreviation_source_language_idx" ON "abbreviation"("source_language");

-- CreateIndex
CREATE INDEX "abbreviation_translation_locale_idx" ON "abbreviation_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "abbreviation_translation_abbreviation_id_locale_key" ON "abbreviation_translation"("abbreviation_id", "locale");

-- CreateIndex
CREATE INDEX "entry_abbreviation_entry_id_idx" ON "entry_abbreviation"("entry_id");

-- AddForeignKey
ALTER TABLE "abbreviation_translation" ADD CONSTRAINT "abbreviation_translation_abbreviation_id_fkey" FOREIGN KEY ("abbreviation_id") REFERENCES "abbreviation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_abbreviation" ADD CONSTRAINT "entry_abbreviation_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_abbreviation" ADD CONSTRAINT "entry_abbreviation_abbreviation_id_fkey" FOREIGN KEY ("abbreviation_id") REFERENCES "abbreviation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Case-insensitive uniqueness index: lower(code) + source_language
-- Not expressible in Prisma schema syntax; added as raw SQL migration step
CREATE UNIQUE INDEX abbreviation_code_source_language_unique
  ON abbreviation (lower(code), source_language);
