import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../../media/media.service';
import { CreateEntryDto } from './dto/create-entry.dto';
import { PatchStatusDto } from './dto/patch-status.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { UpsertTranslationDto } from './dto/upsert-translation.dto';

@Injectable()
export class AdminEntryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async create(dto: CreateEntryDto) {
    // Load the template to seed content_blocks and resolve block structure
    const template = await this.prisma.entryTemplate.findUnique({
      where: { id: dto.entry_template_id },
    });
    if (!template) {
      throw new BadRequestException(`EntryTemplate '${dto.entry_template_id}' not found`);
    }

    const entry = await this.prisma.entry.create({
      data: {
        entry_template_id: dto.entry_template_id,
        origin_language: dto.origin_language,
        status: 'draft',
        metadata: {},
        content_blocks: template.blocks ?? [],
        translations: {
          create: {
            locale: 'en',
            slug: this.slugify(dto.term),
            term: dto.term,
            metadata: { definition_short: dto.definition_short ?? null },
            blocks: {},
            status: 'draft',
          },
        },
        ...(dto.category_id && {
          categories: {
            create: { category_id: dto.category_id },
          },
        }),
      },
      include: {
        translations: true,
        entry_template: { select: { id: true, name: true } },
        categories: { include: { category: true } },
      },
    });

    return { data: entry };
  }

  private static readonly VALID_ENTRY_STATUSES = [
    'draft',
    'review',
    'published',
    'deprecated',
  ] as const;

  async findAll(
    page: number,
    limit: number,
    search?: string,
    templateId?: string,
    categoryId?: string,
    status?: string,
  ) {
    if (status !== undefined && !AdminEntryService.VALID_ENTRY_STATUSES.includes(status as never)) {
      throw new BadRequestException(
        `Invalid status '${status}'. Must be one of: ${AdminEntryService.VALID_ENTRY_STATUSES.join(', ')}`,
      );
    }

    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (search) {
      where['translations'] = {
        some: { locale: 'en', term: { contains: search, mode: 'insensitive' } },
      };
    }
    if (templateId) {
      where['entry_template_id'] = templateId;
    }
    if (status) {
      where['status'] = status;
    }
    if (categoryId) {
      where['categories'] = {
        some: { category_id: categoryId },
      };
    }

    const [entries, total] = await Promise.all([
      this.prisma.entry.findMany({
        where,
        include: {
          entry_template: { select: { id: true, name: true } },
          translations: {
            select: { locale: true, term: true, slug: true },
            orderBy: { locale: 'asc' },
          },
          categories: {
            include: {
              category: {
                include: {
                  translations: {
                    where: { locale: 'en' },
                    select: { name: true },
                  },
                },
              },
            },
          },
          tags: {
            include: {
              tag: {
                select: {
                  id: true,
                  translations: {
                    where: { locale: 'en' },
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.entry.count({ where }),
    ]);

    return {
      data: entries.map((e) => {
        const enTranslation = e.translations.find((t) => t.locale === 'en');
        const firstTranslation = e.translations[0];
        const displayTranslation = enTranslation ?? firstTranslation;

        const firstCategory = e.categories[0]?.category ?? null;
        const category_id = firstCategory?.id ?? null;
        const category_name = firstCategory?.translations[0]?.name ?? null;

        const tags = e.tags.map((et) => ({
          id: et.tag.id,
          name: et.tag.translations[0]?.name ?? '',
        }));

        const languages = [...new Set(e.translations.map((t) => t.locale))];

        return {
          id: e.id,
          entry_template_id: e.entry_template_id ?? null,
          entry_template_name: e.entry_template?.name ?? null,
          origin_language: e.origin_language,
          status: e.status,
          metadata: e.metadata,
          term: displayTranslation?.term ?? null,
          slug: displayTranslation?.slug ?? null,
          category_id,
          category_name,
          tags,
          languages,
          created_at: e.created_at,
          updated_at: e.updated_at,
        };
      }),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const entry = await this.prisma.entry.findUnique({
      where: { id },
      include: {
        entry_template: { select: { id: true, name: true, blocks: true, translations: true } },
        translations: true,
        pattern_usage: true,
        categories: { include: { category: true } },
        related_from: {
          include: {
            related: {
              include: {
                translations: { where: { locale: 'en' }, select: { term: true, slug: true } },
              },
            },
          },
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                translations: {
                  where: { locale: 'en' },
                  select: { name: true },
                },
              },
            },
          },
        },
        abbreviations: {
          include: { abbreviation: { include: { translations: true } } },
          orderBy: { sort_order: 'asc' },
        },
      },
    });
    if (!entry) throw new NotFoundException(`Entry ${id} not found`);
    const { abbreviations, tags, ...rest } = entry;
    const category_id = entry.categories[0]?.category?.id ?? null;
    const flatTags = tags.map((et) => ({
      id: et.tag.id,
      name: et.tag.translations[0]?.name ?? '',
    }));
    return { data: { ...rest, category_id, tags: flatTags, entry_abbreviations: abbreviations } };
  }

  async update(id: string, dto: UpdateEntryDto) {
    await this.assertExists(id);
    const entry = await this.prisma.entry.update({
      where: { id },
      data: {
        ...(dto.entry_template_id !== undefined && { entry_template_id: dto.entry_template_id }),
        ...(dto.origin_language && { origin_language: dto.origin_language }),
        ...(dto.status && { status: dto.status as never }),
        ...(dto.metadata && { metadata: dto.metadata as never }),
      },
      include: {
        entry_template: { select: { id: true, name: true } },
      },
    });

    // Handle category update separately (replace the existing category)
    if (dto.category_id !== undefined) {
      await this.prisma.entryCategory.deleteMany({ where: { entry_id: id } });
      if (dto.category_id) {
        await this.prisma.entryCategory.create({
          data: { entry_id: id, category_id: dto.category_id },
        });
      }
    }

    await this.invalidateCacheForEntry(id);
    return { data: entry };
  }

  async updateBlocks(id: string, blocks: unknown[]) {
    await this.assertExists(id);
    const entry = await this.prisma.entry.update({
      where: { id },
      data: { content_blocks: blocks as never },
    });
    await this.invalidateCacheForEntry(id);
    return { data: entry };
  }

  async upsertTranslation(id: string, locale: string, dto: UpsertTranslationDto) {
    await this.assertExists(id);

    const slug = dto.slug ?? this.slugify(dto.term);

    const translation = await this.prisma.translation.upsert({
      where: { entry_id_locale: { entry_id: id, locale } },
      create: {
        entry_id: id,
        locale,
        slug,
        term: dto.term,
        metadata: (dto.metadata ?? {}) as never,
        blocks: (dto.blocks ?? {}) as never,
        status: (dto.status as never) ?? 'draft',
        translator_note: dto.translator_note ?? null,
      },
      update: {
        term: dto.term,
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.metadata && { metadata: dto.metadata as never }),
        ...(dto.blocks && { blocks: dto.blocks as never }),
        ...(dto.status && { status: dto.status as never }),
        ...(dto.translator_note !== undefined && { translator_note: dto.translator_note }),
      },
    });

    await this.invalidateCacheForEntry(id);
    return { data: translation };
  }

  async patchStatus(id: string, dto: PatchStatusDto) {
    await this.assertExists(id);

    const validTransitions: Record<string, string[]> = {
      draft: ['review', 'deprecated'],
      review: ['published', 'draft', 'deprecated'],
      published: ['deprecated'],
      deprecated: [],
    };

    const entry = await this.prisma.entry.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!entry) throw new NotFoundException(`Entry ${id} not found`);

    const allowed = validTransitions[entry.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from '${entry.status}' to '${dto.status}'`,
      );
    }

    const updated = await this.prisma.entry.update({
      where: { id },
      data: {
        status: dto.status as never,
        ...(dto.status === 'published' && { published_at: new Date() }),
      },
    });

    await this.invalidateCacheForEntry(id);
    return { data: updated };
  }

  async softDelete(id: string) {
    await this.assertExists(id);
    const entry = await this.prisma.entry.update({
      where: { id },
      data: { status: 'deprecated' },
    });
    await this.invalidateCacheForEntry(id);
    return { data: entry };
  }

  async hardDelete(id: string) {
    await this.assertExists(id);
    await this.invalidateCacheForEntry(id);
    await this.mediaService.deleteAssetsForEntity('entry', id);
    await this.prisma.entry.delete({ where: { id } });
    return { data: { id } };
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.entry.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Entry ${id} not found`);
  }

  private async invalidateCacheForEntry(id: string): Promise<void> {
    // Invalidate all locale/slug combos for this entry
    const translations = await this.prisma.translation.findMany({
      where: { entry_id: id },
      select: { locale: true, slug: true },
    });
    await Promise.all(
      translations.map((t) => this.cache.del(`entry:${t.locale}:${t.slug}`)),
    );
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
