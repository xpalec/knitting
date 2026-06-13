import { Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { EntryListQueryDto } from './dto/entry-list-query.dto';

@Injectable()
export class EntryService {
  private readonly DETAIL_TTL = 60 * 60 * 1000; // 1h

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async findAll(query: EntryListQueryDto) {
    const {
      locale = 'en',
      page = 1,
      limit = 20,
      category,
      tag,
      skillLevel,
      sort = 'alpha',
    } = query;

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { status: 'published' };
    if (category) {
      // category filter uses locale-specific slug via CategoryTranslation
      where['categories'] = {
        some: {
          category: {
            translations: { some: { locale, slug: category } },
          },
        },
      };
    }
    if (tag) {
      // filter by locale-specific TagTranslation slug
      where['tags'] = {
        some: {
          tag: {
            translations: { some: { locale, slug: tag } },
          },
        },
      };
    }
    if (skillLevel) {
      where['metadata'] = { path: ['skill_level'], equals: skillLevel };
    }
    const [entries, total] = await Promise.all([
      this.prisma.entry.findMany({
        where,
        include: {
          translations: {
            where: { locale },
            select: {
              term: true,
              slug: true,
              metadata: true,
              status: true,
            },
          },
          categories: {
            include: {
              category: {
                include: {
                  translations: {
                    where: { locale, status: 'published' },
                    select: { name: true, slug: true, locale: true },
                  },
                },
              },
            },
          },
          tags: {
            include: {
              tag: {
                include: {
                  translations: {
                    where: { locale, status: 'published' },
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
        skip,
        take: limit,
      }),
      this.prisma.entry.count({ where }),
    ]);

    const rows = entries.map((e) => {
      const translation = e.translations[0] ?? null;
      const meta = e.metadata as Record<string, unknown>;
      const tMeta = (translation?.metadata ?? {}) as Record<string, unknown>;
      return {
        origin_language: e.origin_language,
        status: e.status,
        skill_level: meta['skill_level'] ?? null,
        term: translation?.term ?? null,
        slug: translation?.slug ?? null,
        abbreviation: tMeta['abbreviation'] ?? null,
        definition_short: tMeta['definition_short'] ?? null,
        missing_translation: !translation,
        categories: e.categories.map((ec) => {
          const ct =
            ec.category.translations[0] ?? null;
          return {
            name: ct?.name ?? null,
            slug: ct?.slug ?? null,
          };
        }),
        tags: e.tags.map((et) => ({
          id: et.tag.id,
          name: et.tag.translations[0]?.name ?? '',
        })),
      };
    });

    // Locale-aware alphabetical sort
    if (sort === 'alpha') {
      rows.sort((a, b) => {
        const ta = a.term ?? '';
        const tb = b.term ?? '';
        return ta.localeCompare(tb, locale, { sensitivity: 'base' });
      });
    }

    return {
      data: rows,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findBySlug(locale: string, slug: string) {
    const cacheKey = `entry:${locale}:${slug}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const translation = await this.prisma.translation.findUnique({
      where: { locale_slug: { locale, slug } },
      include: {
        entry: {
          include: {
            translations: {
              select: { locale: true, slug: true, term: true },
            },
            media_assets: {
              orderBy: { sort_order: 'asc' },
            },
            pattern_usage: true,
            categories: {
              include: {
                category: {
                  include: {
                    translations: {
                      where: { locale, status: 'published' },
                      select: { name: true, slug: true, locale: true },
                    },
                  },
                },
              },
            },
            tags: {
              include: {
                tag: {
                  include: {
                    translations: {
                      where: { locale, status: 'published' },
                      select: { name: true },
                    },
                  },
                },
              },
            },
            related_from: {
              include: {
                related: {
                  include: {
                    translations: {
                      where: { locale },
                      select: { term: true, slug: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!translation) {
      throw new NotFoundException(`Entry not found: ${locale}/${slug}`);
    }

    const entry = translation.entry;
    const entryMeta = entry.metadata as Record<string, unknown>;
    const tMeta = translation.metadata as Record<string, unknown>;

    const result = {
      data: {
        // Entry.id is intentionally omitted from public response
        origin_language: entry.origin_language,
        status: entry.status,
        skill_level: entryMeta['skill_level'] ?? null,
        content_blocks: entry.content_blocks,
        locale,
        term: translation.term,
        slug: translation.slug,
        abbreviation: tMeta['abbreviation'] ?? null,
        definition_short: tMeta['definition_short'] ?? null,
        blocks: translation.blocks,
        translator_note: translation.translator_note,
        translation_status: translation.status,
        categories: entry.categories.map((ec) => {
          const ct = ec.category.translations[0] ?? null;
          return {
            name: ct?.name ?? null,
            slug: ct?.slug ?? null,
          };
        }),
        tags: entry.tags.map((et) => ({
          id: et.tag.id,
          name: et.tag.translations[0]?.name ?? '',
        })),
        translations: entry.translations.map((t) => ({
          locale: t.locale,
          slug: t.slug,
          term: t.term,
        })),
        media_assets: entry.media_assets.map((m) => ({
          type: m.type,
          url: m.url,
          sort_order: m.sort_order,
        })),
        pattern_usage: entry.pattern_usage.map((p) => ({
          pattern_name: p.pattern_name,
          context_note: p.context_note,
          frequency: p.frequency,
          skill_level: p.skill_level,
        })),
        related_entries: entry.related_from.map((r) => ({
          relation_type: r.relation_type,
          direction: r.direction,
          note: r.note,
          term: r.related.translations[0]?.term ?? null,
          slug: r.related.translations[0]?.slug ?? null,
        })),
      },
    };

    await this.cache.set(cacheKey, result, this.DETAIL_TTL);
    return result;
  }

  async invalidateCache(locale: string, slug: string): Promise<void> {
    await this.cache.del(`entry:${locale}:${slug}`);
  }
}
