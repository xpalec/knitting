import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ArticleService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(locale = 'en', tag?: string, countryCode?: string) {
    const where: Record<string, unknown> = { status: 'published' };
    if (countryCode) where['country_code'] = countryCode;
    if (tag) {
      // Filter by tag slug (canonical identifier) — locale-independent
      where['tags'] = { some: { tag: { slug: tag } } };
    }

    const articles = await this.prisma.article.findMany({
      where,
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
      orderBy: { published_at: 'desc' },
    });

    return {
      data: articles.map((a) => ({
        slug: a.slug,
        title: a.title,
        cover_image_url: a.cover_image_url,
        author: a.author,
        country_code: a.country_code,
        reading_time_minutes: a.reading_time_minutes,
        published_at: a.published_at,
        tags: a.tags.map((at) => ({
          slug: at.tag.slug,
          type: at.tag.type,
          // Falls back to slug if no translation exists for the locale
          name: at.tag.translations[0]?.name ?? at.tag.slug,
        })),
      })),
    };
  }

  async findBySlug(slug: string, locale = 'en') {
    const article = await this.prisma.article.findUnique({
      where: { slug },
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
    });

    if (!article) throw new NotFoundException(`Article '${slug}' not found`);

    return {
      data: {
        slug: article.slug,
        title: article.title,
        content: article.content,
        cover_image_url: article.cover_image_url,
        author: article.author,
        country_code: article.country_code,
        reading_time_minutes: article.reading_time_minutes,
        published_at: article.published_at,
        tags: article.tags.map((at) => ({
          slug: at.tag.slug,
          type: at.tag.type,
          name: at.tag.translations[0]?.name ?? at.tag.slug,
        })),
      },
    };
  }
}
