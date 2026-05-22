import { Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';

interface SearchRow {
  term: string;
  locale: string;
  slug: string;
  definition_short: string | null;
}

@Injectable()
export class SearchService {
  private readonly SEARCH_TTL = 5 * 60 * 1000; // 5 min

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async search(query: SearchQueryDto) {
    const { q, locale = 'en', category } = query;

    if (!q || q.trim().length === 0) {
      return { data: [], meta: { total: 0 } };
    }

    const cacheKey = `search:${locale}:${q}:${category ?? ''}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // Sanitise query: keep word chars and spaces, join with tsquery AND operator
    const tsQuery = q
      .trim()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => `${w}:*`)
      .join(' & ');

    if (!tsQuery) {
      return { data: [], meta: { total: 0 } };
    }

    let results: SearchRow[];

    if (category) {
      results = await this.prisma.$queryRaw<SearchRow[]>`
        SELECT
          t.term,
          t.locale,
          t.slug,
          t.metadata->>'definition_short' AS definition_short
        FROM translation t
        INNER JOIN entry e ON e.id = t.entry_id
        INNER JOIN entry_category ec ON ec.entry_id = e.id
        INNER JOIN category c ON c.id = ec.category_id
        WHERE
          t.search_vector @@ to_tsquery('simple', ${Prisma.raw(`'${tsQuery}'`)})
          AND e.status = 'published'
          AND c.slug = ${category}
        ORDER BY
          CASE WHEN t.locale = ${locale} THEN 0 ELSE 1 END,
          ts_rank(t.search_vector, to_tsquery('simple', ${Prisma.raw(`'${tsQuery}'`)})) DESC
        LIMIT 50
      `;
    } else {
      results = await this.prisma.$queryRaw<SearchRow[]>`
        SELECT
          t.term,
          t.locale,
          t.slug,
          t.metadata->>'definition_short' AS definition_short
        FROM translation t
        INNER JOIN entry e ON e.id = t.entry_id
        WHERE
          t.search_vector @@ to_tsquery('simple', ${Prisma.raw(`'${tsQuery}'`)})
          AND e.status = 'published'
        ORDER BY
          CASE WHEN t.locale = ${locale} THEN 0 ELSE 1 END,
          ts_rank(t.search_vector, to_tsquery('simple', ${Prisma.raw(`'${tsQuery}'`)})) DESC
        LIMIT 50
      `;
    }

    const response = {
      data: results.map((r) => ({
        term: r.term,
        locale: r.locale,
        slug: r.slug,
        definition_short: r.definition_short,
      })),
      meta: { total: results.length },
    };

    await this.cache.set(cacheKey, response, this.SEARCH_TTL);
    return response;
  }
}
