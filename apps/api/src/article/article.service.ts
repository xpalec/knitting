import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ArticleService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(locale = 'en', tag?: string, countryCode?: string) {
    const where: Record<string, unknown> = { status: 'published' };
    if (countryCode) where['country_code'] = countryCode;
    if (tag) {
      where['tags'] = {
        some: {
          tag: {
            translations: { some: { slug: tag } },
          },
        },
      };
    }

    const articles = await this.prisma.article.findMany({
      where,
      include: {
        translations: {
          where: { locale, status: 'published' },
          select: { title: true, slug: true, short_description: true, locale: true },
        },
        tags: {
          include: {
            tag: {
              include: {
                translations: {
                  where: { locale, status: 'published' },
                  select: { name: true, locale: true },
                },
              },
            },
          },
        },
      },
      orderBy: { published_at: 'desc' },
    });

    return {
      data: articles
        .filter((a) => a.translations.length > 0)
        .map((a) => {
          const t = a.translations[0];
          return {
            slug: t.slug,
            title: t.title,
            short_description: t.short_description,
            cover_image_url: a.cover_image_url,
            author: a.author,
            country_code: a.country_code,
            published_at: a.published_at,
            tags: a.tags.map((at) => ({
              id: at.tag.id,
              name: at.tag.translations[0]?.name ?? '',
            })),
          };
        }),
    };
  }

  async findBySlug(slug: string, locale = 'en') {
    const translation = await this.prisma.articleTranslation.findUnique({
      where: { locale_slug: { locale, slug } },
      include: {
        article: {
          include: {
            tags: {
              include: {
                tag: {
                  include: {
                    translations: {
                      where: { locale, status: 'published' },
                      select: { name: true, locale: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!translation || translation.article.status !== 'published') {
      throw new NotFoundException(`Article '${slug}' not found`);
    }

    const a = translation.article;

    return {
      data: {
        slug: translation.slug,
        title: translation.title,
        short_description: translation.short_description,
        blocks: translation.blocks,
        content_blocks: a.content_blocks,
        seo_title: translation.seo_title,
        seo_description: translation.seo_description,
        cover_image_url: a.cover_image_url,
        author: a.author,
        country_code: a.country_code,
        published_at: a.published_at,
        tags: a.tags.map((at) => ({
          id: at.tag.id,
          name: at.tag.translations[0]?.name ?? '',
        })),
      },
    };
  }
}
