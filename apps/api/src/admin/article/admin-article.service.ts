import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { UpsertArticleTranslationDto } from './dto/upsert-article-translation.dto';
import { UpdateArticleBlocksDto } from './dto/update-article-blocks.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ARTICLE_INCLUDE = {
  translations: { orderBy: { locale: 'asc' as const } },
  tags: {
    include: {
      tag: {
        include: {
          translations: {
            orderBy: { locale: 'asc' as const },
            select: { locale: true, name: true, slug: true },
          },
        },
      },
    },
  },
  category: {
    include: {
      translations: {
        where: { locale: 'en' },
        select: { name: true, locale: true },
      },
    },
  },
};

@Injectable()
export class AdminArticleService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Article CRUD
  // ---------------------------------------------------------------------------

  async findAll(
    page: number,
    limit: number,
    search?: string,
    status?: string,
    locale = 'en',
  ) {
    const skip = (page - 1) * limit;

    const where = {
      ...(status !== undefined && { status: status as never }),
      ...(search
        ? {
            translations: {
              some: {
                locale,
                title: { contains: search, mode: 'insensitive' as const },
              },
            },
          }
        : {}),
    };

    const [articles, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        include: ARTICLE_INCLUDE,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      data: articles.map((a) => this.formatArticle(a)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: ARTICLE_INCLUDE,
    });

    if (!article) throw new NotFoundException(`Article '${id}' not found`);
    return this.formatArticle(article);
  }

  async create(dto: CreateArticleDto) {
    const article = await this.prisma.article.create({
      data: {
        category_id: dto.category_id ?? null,
        origin_language: dto.origin_language ?? 'en',
        cover_image_url: dto.cover_image_url ?? null,
        author: dto.author ?? null,
        country_code: dto.country_code ?? null,
        content_blocks: [],
        status: (dto.status as never) ?? 'draft',
      },
      include: ARTICLE_INCLUDE,
    });

    return this.formatArticle(article);
  }

  async update(id: string, dto: UpdateArticleDto) {
    await this.assertArticleExists(id);

    const article = await this.prisma.article.update({
      where: { id },
      data: {
        ...(dto.category_id !== undefined && { category_id: dto.category_id }),
        ...(dto.cover_image_url !== undefined && { cover_image_url: dto.cover_image_url }),
        ...(dto.author !== undefined && { author: dto.author }),
        ...(dto.country_code !== undefined && { country_code: dto.country_code }),
        ...(dto.status !== undefined && {
          status: dto.status as never,
          published_at:
            dto.status === 'published' ? new Date() : undefined,
        }),
      },
      include: ARTICLE_INCLUDE,
    });

    return this.formatArticle(article);
  }

  async delete(id: string) {
    await this.assertArticleExists(id);
    await this.prisma.article.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ---------------------------------------------------------------------------
  // content_blocks layout manifest
  // ---------------------------------------------------------------------------

  async updateBlocks(id: string, dto: UpdateArticleBlocksDto) {
    await this.assertArticleExists(id);

    const article = await this.prisma.article.update({
      where: { id },
      data: { content_blocks: dto.blocks as never },
      include: ARTICLE_INCLUDE,
    });

    return this.formatArticle(article);
  }

  // ---------------------------------------------------------------------------
  // ArticleTranslation upsert
  // ---------------------------------------------------------------------------

  async upsertTranslation(
    id: string,
    locale: string,
    dto: UpsertArticleTranslationDto,
  ) {
    await this.assertArticleExists(id);

    // Enforce slug length cap — slugs over 100 chars are unwieldy and cause unique constraint issues
    const slug = dto.slug.slice(0, 100).replace(/-+$/, '');

    // Slug uniqueness check
    const existing = await this.prisma.articleTranslation.findUnique({
      where: { locale_slug: { locale, slug } },
      select: { article_id: true },
    });
    if (existing && existing.article_id !== id) {
      throw new ConflictException(
        `Slug '${slug}' is already used by another article for locale '${locale}'`,
      );
    }

    const translation = await this.prisma.articleTranslation.upsert({
      where: { article_id_locale: { article_id: id, locale } },
      create: {
        article_id: id,
        locale,
        title: dto.title,
        slug,
        short_description: dto.short_description ?? null,
        blocks: (dto.blocks ?? {}) as never,
        seo_title: dto.seo_title ?? null,
        seo_description: dto.seo_description ?? null,
        translator_note: dto.translator_note ?? null,
        status: (dto.status as never) ?? 'draft',
      },
      update: {
        title: dto.title,
        slug,
        ...(dto.short_description !== undefined && { short_description: dto.short_description }),
        ...(dto.blocks !== undefined && { blocks: dto.blocks as never }),
        ...(dto.seo_title !== undefined && { seo_title: dto.seo_title }),
        ...(dto.seo_description !== undefined && { seo_description: dto.seo_description }),
        ...(dto.translator_note !== undefined && { translator_note: dto.translator_note }),
        ...(dto.status && { status: dto.status as never }),
      },
    });

    return translation;
  }

  // ---------------------------------------------------------------------------
  // Tag assignment (replace current set)
  // ---------------------------------------------------------------------------

  async setTags(id: string, tagIds: string[]) {
    await this.assertArticleExists(id);

    await this.prisma.$transaction([
      this.prisma.articleTag.deleteMany({ where: { article_id: id } }),
      this.prisma.articleTag.createMany({
        data: tagIds.map((tid) => ({ article_id: id, tag_id: tid })),
        skipDuplicates: true,
      }),
    ]);

    return this.findOne(id);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async assertArticleExists(id: string): Promise<void> {
    const exists = await this.prisma.article.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Article '${id}' not found`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatArticle(a: any) {
    return {
      id: a.id,
      category_id: a.category_id,
      category_name:
        a.category?.translations?.[0]?.name ?? null,
      origin_language: a.origin_language,
      cover_image_url: a.cover_image_url,
      author: a.author,
      country_code: a.country_code,
      content_blocks: a.content_blocks,
      status: a.status,
      published_at: a.published_at,
      created_at: a.created_at,
      updated_at: a.updated_at,
      translations: a.translations ?? [],
      tags: (a.tags ?? []).map((at: any) => ({
        id: at.tag.id,
        translations: at.tag.translations,
      })),
    };
  }
}
