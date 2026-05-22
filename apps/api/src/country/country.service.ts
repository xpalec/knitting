import { Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CountryService {
  private readonly COUNTRY_TTL = 6 * 60 * 60 * 1000; // 6h

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async findByCode(code: string, locale = 'en') {
    const cacheKey = `country:${code}:${locale}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // Verify at least one entry exists for this origin_language
    const count = await this.prisma.entry.count({
      where: { origin_language: code, status: 'published' },
    });

    if (count === 0) {
      throw new NotFoundException(`No entries found for country code '${code}'`);
    }

    const [featuredEntries, articles] = await Promise.all([
      this.prisma.entry.findMany({
        where: { origin_language: code, status: 'published' },
        include: {
          translations: {
            where: { locale },
            select: { term: true, slug: true, metadata: true },
          },
        },
        take: 6,
        orderBy: { published_at: 'desc' },
      }),
      this.prisma.article.findMany({
        where: { country_code: code, status: 'published' },
        select: { slug: true, title: true, reading_time_minutes: true },
        take: 5,
        orderBy: { published_at: 'desc' },
      }),
    ]);

    const result = {
      data: {
        code,
        total_entries: count,
        featured_entries: featuredEntries.map((e) => {
          const t = e.translations[0] ?? null;
          const meta = e.metadata as Record<string, unknown>;
          const tMeta = (t?.metadata ?? {}) as Record<string, unknown>;
          return {
            origin_language: e.origin_language,
            skill_level: meta['skill_level'] ?? null,
            term: t?.term ?? null,
            slug: t?.slug ?? null,
            definition_short: tMeta['definition_short'] ?? null,
            missing_translation: !t,
          };
        }),
        articles,
      },
    };

    await this.cache.set(cacheKey, result, this.COUNTRY_TTL);
    return result;
  }
}
