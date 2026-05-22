import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LearnService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const paths = await this.prisma.learningPath.findMany({
      where: { published: true },
      include: {
        _count: { select: { entries: true } },
      },
      orderBy: { title: 'asc' },
    });

    return {
      data: paths.map((p) => ({
        slug: p.slug,
        title: p.title,
        description: p.description,
        skill_level_min: p.skill_level_min,
        skill_level_max: p.skill_level_max,
        estimated_minutes: p.estimated_minutes,
        entry_count: p._count.entries,
      })),
    };
  }

  async findBySlug(slug: string, locale = 'en') {
    const path = await this.prisma.learningPath.findUnique({
      where: { slug },
      include: {
        entries: {
          orderBy: { sort_order: 'asc' },
          include: {
            entry: {
              include: {
                translations: {
                  where: { locale },
                  select: { term: true, slug: true, metadata: true },
                },
              },
            },
          },
        },
      },
    });

    if (!path) throw new NotFoundException(`Learning path '${slug}' not found`);

    return {
      data: {
        slug: path.slug,
        title: path.title,
        description: path.description,
        skill_level_min: path.skill_level_min,
        skill_level_max: path.skill_level_max,
        estimated_minutes: path.estimated_minutes,
        entries: path.entries.map((pe) => {
          const t = pe.entry.translations[0] ?? null;
          const meta = pe.entry.metadata as Record<string, unknown>;
          const tMeta = (t?.metadata ?? {}) as Record<string, unknown>;
          return {
            sort_order: pe.sort_order,
            origin_language: pe.entry.origin_language,
            skill_level: meta['skill_level'] ?? null,
            term: t?.term ?? null,
            slug: t?.slug ?? null,
            definition_short: tMeta['definition_short'] ?? null,
            missing_translation: !t,
          };
        }),
      },
    };
  }
}
