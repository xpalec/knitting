import { Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
  children: CategoryNode[];
}

@Injectable()
export class CategoryService {
  private readonly TREE_CACHE_KEY = 'categories:tree';
  private readonly TREE_TTL = 24 * 60 * 60 * 1000; // 24h in ms

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getTree(): Promise<CategoryNode[]> {
    const cached = await this.cache.get<CategoryNode[]>(this.TREE_CACHE_KEY);
    if (cached) return cached;

    const all = await this.prisma.category.findMany({
      orderBy: { sort_order: 'asc' },
    });

    const tree = this.buildTree(all, null);
    await this.cache.set(this.TREE_CACHE_KEY, tree, this.TREE_TTL);
    return tree;
  }

  private buildTree(
    categories: Array<{
      id: string;
      name: string;
      slug: string;
      icon: string | null;
      sort_order: number;
      parent_id: string | null;
    }>,
    parentId: string | null,
  ): CategoryNode[] {
    return categories
      .filter((c) => c.parent_id === parentId)
      .map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        sort_order: c.sort_order,
        children: this.buildTree(categories, c.id),
      }));
  }

  async getEntriesByCategory(
    slug: string,
    locale: string,
    page: number,
    limit: number,
  ) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
    });
    if (!category) return null;

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
      category,
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

  async invalidateCache(): Promise<void> {
    await this.cache.del(this.TREE_CACHE_KEY);
  }
}
