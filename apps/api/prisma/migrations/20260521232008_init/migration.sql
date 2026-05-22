-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('draft', 'review', 'published', 'deprecated');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('draft', 'reviewed', 'published');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('synonym', 'antonym', 'prerequisite', 'variant_regional', 'variant_technique', 'broader', 'narrower');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('image', 'diagram', 'video_clip', 'chart');

-- CreateEnum
CREATE TYPE "TagType" AS ENUM ('fiber_type', 'needle_type', 'garment_part', 'style_tradition');

-- CreateEnum
CREATE TYPE "ContributionType" AS ENUM ('entry', 'translation', 'correction');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('editor', 'reviewer', 'admin');

-- CreateTable
CREATE TABLE "entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "origin_language" TEXT NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'draft',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "content_blocks" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "published_at" TIMESTAMPTZ,

    CONSTRAINT "entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entry_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "blocks" JSONB NOT NULL DEFAULT '{}',
    "translator_note" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'draft',
    "search_vector" tsvector,

    CONSTRAINT "translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_id" UUID,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_category" (
    "entry_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "entry_category_pkey" PRIMARY KEY ("entry_id","category_id")
);

-- CreateTable
CREATE TABLE "tag" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "type" "TagType",
    "color_hex" TEXT,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_tag" (
    "entry_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "entry_tag_pkey" PRIMARY KEY ("entry_id","tag_id")
);

-- CreateTable
CREATE TABLE "related_entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entry_id" UUID NOT NULL,
    "related_id" UUID NOT NULL,
    "relation_type" "RelationType" NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'symmetric',
    "note" TEXT,

    CONSTRAINT "related_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_asset" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entry_id" UUID NOT NULL,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pattern_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entry_id" UUID NOT NULL,
    "pattern_name" TEXT NOT NULL,
    "pattern_id" UUID,
    "context_note" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL,
    "skill_level" "SkillLevel",

    CONSTRAINT "pattern_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "block_template" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entry_type" TEXT NOT NULL,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "block_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "cover_image_url" TEXT,
    "author" TEXT NOT NULL,
    "country_code" TEXT,
    "reading_time_minutes" INTEGER NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_tag" (
    "article_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "article_tag_pkey" PRIMARY KEY ("article_id","tag_id")
);

-- CreateTable
CREATE TABLE "learning_path" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "skill_level_min" "SkillLevel" NOT NULL,
    "skill_level_max" "SkillLevel" NOT NULL,
    "estimated_minutes" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "learning_path_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_path_entry" (
    "path_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "learning_path_entry_pkey" PRIMARY KEY ("path_id","entry_id")
);

-- CreateTable
CREATE TABLE "contribution" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "ContributionType" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "entry_id" UUID,
    "submitter_email" TEXT,
    "reviewer_note" TEXT,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ,

    CONSTRAINT "contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entry_origin_language_idx" ON "entry"("origin_language");

-- CreateIndex
CREATE INDEX "translation_search_vector_idx" ON "translation" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "translation_blocks_idx" ON "translation" USING GIN ("blocks" jsonb_ops);

-- CreateIndex
CREATE INDEX "translation_metadata_idx" ON "translation" USING GIN ("metadata" jsonb_ops);

-- CreateIndex
CREATE UNIQUE INDEX "translation_entry_id_locale_key" ON "translation"("entry_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "translation_locale_slug_key" ON "translation"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "category_slug_key" ON "category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tag_name_key" ON "tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "block_template_entry_type_key" ON "block_template"("entry_type");

-- CreateIndex
CREATE UNIQUE INDEX "article_slug_key" ON "article"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "learning_path_slug_key" ON "learning_path"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- AddForeignKey
ALTER TABLE "translation" ADD CONSTRAINT "translation_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_category" ADD CONSTRAINT "entry_category_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_category" ADD CONSTRAINT "entry_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_tag" ADD CONSTRAINT "entry_tag_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_tag" ADD CONSTRAINT "entry_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "related_entry" ADD CONSTRAINT "related_entry_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "related_entry" ADD CONSTRAINT "related_entry_related_id_fkey" FOREIGN KEY ("related_id") REFERENCES "entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pattern_usage" ADD CONSTRAINT "pattern_usage_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_tag" ADD CONSTRAINT "article_tag_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_tag" ADD CONSTRAINT "article_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_entry" ADD CONSTRAINT "learning_path_entry_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_path"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_entry" ADD CONSTRAINT "learning_path_entry_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution" ADD CONSTRAINT "contribution_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
