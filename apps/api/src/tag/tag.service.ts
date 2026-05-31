import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TagListItem {
  slug: string;
  type: string | null;
  color_hex: string | null;
  name: string;
  description: unknown | null;
  seo_title: string | null;
  seo_description: string | null;
  entry_count: number;
}

@Injectable()
export class TagService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public list of all tags with translated content for the requested locale.
   * Falls back to 'en' translation when the requested locale has no row.
   * entry_count is the number of published entries tagged with each tag.
   */
  async findAll(locale = 'en'): Promise<TagListItem[]> {
    const tags = await this.prisma.tag.findMany({
      include: {
        translations: {
          where: { status: 'published' },
          select: {
            locale: true,
            name: true,
            description: true,
            seo_title: true,
            seo_description: true,
          },
        },
        _count: {
          select: {
            entries: {
              where: { entry: { status: 'published' } },
            },
          },
        },
      },
      orderBy: { slug: 'asc' },
    });

    return tags.map((tag) => {
      const translation =
        tag.translations.find((t) => t.locale === locale) ??
        tag.translations.find((t) => t.locale === 'en') ??
        null;

      return {
        slug: tag.slug,
        type: tag.type,
        color_hex: tag.color_hex,
        name: translation?.name ?? tag.slug,
        description: translation?.description ?? null,
        seo_title: translation?.seo_title ?? null,
        seo_description: translation?.seo_description ?? null,
        entry_count: tag._count.entries,
      };
    });
  }
}
