-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('draft', 'review', 'published', 'deprecated');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('draft', 'reviewed', 'published');

-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('entry', 'abbreviation', 'article');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('synonym', 'antonym', 'prerequisite', 'variant_regional', 'variant_technique', 'broader', 'narrower');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('image', 'diagram', 'video_clip', 'chart');

-- CreateEnum
CREATE TYPE "ContributionType" AS ENUM ('entry', 'translation', 'correction');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('editor', 'reviewer', 'admin');

-- CreateTable
CREATE TABLE "entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entry_template_id" UUID,
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
    "type" "CategoryType" NOT NULL,
    "parent_id" UUID,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "CategoryStatus" NOT NULL DEFAULT 'draft',
    "entry_count" INTEGER NOT NULL DEFAULT 0,
    "cover_image_url" TEXT,
    "color" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_translation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" JSONB,
    "short_description" TEXT,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'draft',
    "translator_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "category_translation_pkey" PRIMARY KEY ("id")
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

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_translation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tag_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" JSONB,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tag_translation_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "content_block_type" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "content_block_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_block_type_translation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "block_type_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "heading" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "content_block_type_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_template" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "translations" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "entry_template_pkey" PRIMARY KEY ("id")
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
    "category_id" UUID,
    "origin_language" TEXT NOT NULL DEFAULT 'en',
    "cover_image_url" TEXT,
    "author" TEXT,
    "country_code" TEXT,
    "content_blocks" JSONB NOT NULL DEFAULT '[]',
    "status" "EntryStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_translation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "article_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "short_description" TEXT,
    "blocks" JSONB NOT NULL DEFAULT '{}',
    "seo_title" TEXT,
    "seo_description" TEXT,
    "translator_note" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "article_translation_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "entry_entry_template_id_idx" ON "entry"("entry_template_id");

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
CREATE INDEX "category_parent_id_idx" ON "category"("parent_id");

-- CreateIndex
CREATE INDEX "category_type_idx" ON "category"("type");

-- CreateIndex
CREATE INDEX "category_status_idx" ON "category"("status");

-- CreateIndex
CREATE INDEX "category_translation_locale_idx" ON "category_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "category_translation_category_id_locale_key" ON "category_translation"("category_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "category_translation_locale_slug_key" ON "category_translation"("locale", "slug");

-- CreateIndex
CREATE INDEX "tag_translation_locale_idx" ON "tag_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "tag_translation_tag_id_locale_key" ON "tag_translation"("tag_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "tag_translation_locale_slug_key" ON "tag_translation"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "content_block_type_type_key" ON "content_block_type"("type");

-- CreateIndex
CREATE INDEX "content_block_type_translation_locale_idx" ON "content_block_type_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "content_block_type_translation_block_type_id_locale_key" ON "content_block_type_translation"("block_type_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "block_template_entry_type_key" ON "block_template"("entry_type");

-- CreateIndex
CREATE INDEX "article_category_id_idx" ON "article"("category_id");

-- CreateIndex
CREATE INDEX "article_status_idx" ON "article"("status");

-- CreateIndex
CREATE INDEX "article_translation_locale_idx" ON "article_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "article_translation_article_id_locale_key" ON "article_translation"("article_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "article_translation_locale_slug_key" ON "article_translation"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "learning_path_slug_key" ON "learning_path"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- AddForeignKey
ALTER TABLE "entry" ADD CONSTRAINT "entry_entry_template_id_fkey" FOREIGN KEY ("entry_template_id") REFERENCES "entry_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translation" ADD CONSTRAINT "translation_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_translation" ADD CONSTRAINT "category_translation_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_category" ADD CONSTRAINT "entry_category_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_category" ADD CONSTRAINT "entry_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_translation" ADD CONSTRAINT "tag_translation_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "content_block_type_translation" ADD CONSTRAINT "content_block_type_translation_block_type_id_fkey" FOREIGN KEY ("block_type_id") REFERENCES "content_block_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article" ADD CONSTRAINT "article_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_translation" ADD CONSTRAINT "article_translation_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
