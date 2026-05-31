import { Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface CategoryTranslationNode {
  locale: string;
  slug: string;
  name: string;
  status: string;
}

export interface CategoryNode {
  id: string;
  icon: string | null;
  sort_order: number;
  status: string;
  entry_count: number;
  cover_image_url: string | null;
  /** Translation for the requested locale (falls back to 'en' if not found). */
  translation: CategoryTranslationNode | null;
  children: CategoryNode[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class CategoryService {
  private readonly TREE_TTL = 24 * 60 * 60 * 1000; // 24 h in ms

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // -------------------------------------------------------------------------
  // getTree — full nested category tree for a given locale
  // -------------------------------------------------------------------------

  async getTree(locale = 'en'): Promise<CategoryNode[]> {
    const cacheKey = `categories:tree:${locale}`;
    const cached = await this.cache.get<CategoryNode[]>(cacheKey);
    if (cached) return cached;

    const all = await this.prisma.category.findMany({
      where: { status: 'published' },
      orderBy: { sort_order: 'asc' },
      include: {
        translations: {
          where: { status: 'published' },
        },
      },
    });

    const tree = this.buildTree(all, null, locale);
    await this.cache.set(cacheKey, tree, this.TREE_TTL);
    return tree;
  }

  private buildTree(
    categories: Array<{
      id: string;
      parent_id: string | null;
      icon: string | null;
      sort_order: number;
      status: string;
      entry_count: number;
      cover_image_url: string | null;
      translations: Array<{
        locale: string;
        slug: string;
        name: string;
        status: string;
      }>;
    }>,
    parentId: string | null,
    locale: string,
  ): CategoryNode[] {
    return categories
      .filter((c) => c.parent_id === parentId)
      .map((c) => {
        const translation =
          c.translations.find((t) => t.locale === locale) ??
          c.translations.find((t) => t.locale === 'en') ??
          null;

        return {
          id: c.id,
          icon: c.icon,
          sort_order: c.sort_order,
          status: c.status,
          entry_count: c.entry_count,
          cover_image_url: c.cover_image_url,
          translation: translation
            ? {
                locale: translation.locale,
                slug: translation.slug,
                name: translation.name,
                status: translation.status,
              }
            : null,
          children: this.buildTree(categories, c.id, locale),
        };
      });
  }

  // -------------------------------------------------------------------------
  // getEntriesByCategory — resolve category by locale-specific slug
  // -------------------------------------------------------------------------

  async getEntriesByCategory(
    slug: string,
    locale: string,
    page: number,
    limit: number,
  ) {
    // Resolve category via CategoryTranslation (locale-specific slug)
    const categoryTranslation =
      await this.prisma.categoryTranslation.findUnique({
        where: { locale_slug: { locale, slug } },
        include: { category: true },
      });

    if (!categoryTranslation) return null;

    const category = categoryTranslation.category;
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      this.prisma.entry.findMany({
        where: {
          categories: { some: { category_id: category.id } },
          status: 'published',
        },
        include: {
          translations: {
            where: { locale },
            select: { term: true, slug: true, metadata: true, status: true },
          },
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.entry.count({
        where: {
          categories: { some: { category_id: category.id } },
          status: 'published',
        },
      }),
    ]);

    return {
      category: {
        id: category.id,
        icon: category.icon,
        sort_order: category.sort_order,
        entry_count: category.entry_count,
        cover_image_url: category.cover_image_url,
        translation: {
          locale: categoryTranslation.locale,
          slug: categoryTranslation.slug,
          name: categoryTranslation.name,
          status: categoryTranslation.status,
        },
      },
      entries: entries.map((e) => {
        const translation = e.translations[0] ?? null;
        return {
          origin_language: e.origin_language,
          status: e.status,
          metadata: e.metadata,
          term: translation?.term ?? null,
          slug: translation?.slug ?? null,
          missing_translation: !translation,
        };
      }),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // -------------------------------------------------------------------------
  // invalidateCache — bust all locale variants of the tree cache
  // -------------------------------------------------------------------------

  async invalidateCache(locale?: string): Promise<void> {
    if (locale) {
      await this.cache.del(`categories:tree:${locale}`);
    } else {
      // Bust all known locale variants
      const locales = ['en', 'pl', 'de', 'no', 'fr'];
      await Promise.all(
        locales.map((l) => this.cache.del(`categories:tree:${l}`)),
      );
    }
  }
}
