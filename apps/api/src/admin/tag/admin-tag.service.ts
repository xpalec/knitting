import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { UpsertTagTranslationDto } from './dto/upsert-tag-translation.dto';

/** Auto-derive a kebab-case slug from a display name. */
function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class AdminTagService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Tag CRUD
  // ---------------------------------------------------------------------------

  async findAll(page: number, limit: number, search?: string) {
    const skip = (page - 1) * limit;

    // Search against EN translation name when provided
    const where = search
      ? {
          translations: {
            some: {
              locale: 'en',
              name: { contains: search, mode: 'insensitive' as const },
            },
          },
        }
      : {};

    const [tags, total] = await Promise.all([
      this.prisma.tag.findMany({
        where,
        include: {
          translations: {
            orderBy: { locale: 'asc' },
            select: {
              locale: true,
              name: true,
              slug: true,
              seo_title: true,
              seo_description: true,
              status: true,
              updated_at: true,
            },
          },
          _count: { select: { entries: true } },
        },
        skip,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      this.prisma.tag.count({ where }),
    ]);

    return {
      data: tags.map((t) => {
        // Use the most recently updated translation as the "updated at" for the tag
        const latestUpdated = t.translations.reduce<Date | null>((max, tr) => {
          const d = (tr as unknown as { updated_at?: Date }).updated_at;
          if (!d) return max;
          return max === null || d > max ? d : max;
        }, null);
        return {
          id: t.id,
          translations: t.translations,
          entry_count: t._count.entries,
          updated_at: latestUpdated ?? null,
        };
      }),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: {
        translations: { orderBy: { locale: 'asc' } },
        _count: { select: { entries: true } },
      },
    });
    if (!tag) throw new NotFoundException(`Tag '${id}' not found`);
    return { data: tag };
  }

  async create(dto: CreateTagDto) {
    const enSlug = dto.slug_en ?? toSlug(dto.name_en);

    const tag = await this.prisma.tag.create({
      data: {
        translations: {
          create: {
            locale: 'en',
            slug: enSlug,
            name: dto.name_en,
            status: 'published',
          },
        },
      },
      include: { translations: true },
    });

    return { data: tag };
  }

  async update(id: string, _dto: UpdateTagDto) {
    await this.assertExists(id);
    // No language-independent fields on Tag. Updates go via upsertTranslation.
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    return { data: tag };
  }

  async delete(id: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: { _count: { select: { entries: true } } },
    });
    if (!tag) throw new NotFoundException(`Tag '${id}' not found`);

    if (tag._count.entries > 0) {
      throw new BadRequestException(
        `Cannot delete tag '${id}' — it is assigned to ${tag._count.entries} entr${tag._count.entries === 1 ? 'y' : 'ies'}. Remove all assignments first.`,
      );
    }

    await this.prisma.tag.delete({ where: { id } });
    return { data: { id, deleted: true } };
  }

  // ---------------------------------------------------------------------------
  // TagTranslation upsert
  // ---------------------------------------------------------------------------

  async upsertTranslation(
    id: string,
    locale: string,
    dto: UpsertTagTranslationDto,
  ) {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!tag) throw new NotFoundException(`Tag '${id}' not found`);

    const translation = await this.prisma.tagTranslation.upsert({
      where: { tag_id_locale: { tag_id: id, locale } },
      create: {
        tag_id: id,
        locale,
        slug: dto.slug,
        name: dto.name,
        description: (dto.description ?? null) as never,
        seo_title: dto.seo_title ?? null,
        seo_description: dto.seo_description ?? null,
        status: (dto.status as never) ?? 'draft',
      },
      update: {
        slug: dto.slug,
        name: dto.name,
        ...(dto.description !== undefined && { description: dto.description as never }),
        ...(dto.seo_title !== undefined && { seo_title: dto.seo_title }),
        ...(dto.seo_description !== undefined && { seo_description: dto.seo_description }),
        ...(dto.status && { status: dto.status as never }),
      },
    });

    return { data: translation };
  }

  // ---------------------------------------------------------------------------
  // Entry tag assignment — accepts tag IDs
  // ---------------------------------------------------------------------------

  async assignEntryTags(entryId: string, tagIds: string[]) {
    const entry = await this.prisma.entry.findUnique({
      where: { id: entryId },
      select: { id: true },
    });
    if (!entry) throw new NotFoundException(`Entry '${entryId}' not found`);

    // Verify all IDs exist
    const tags = await this.prisma.tag.findMany({
      where: { id: { in: tagIds } },
      select: { id: true },
    });

    const foundIds = new Set(tags.map((t) => t.id));
    const missing = tagIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown tag ID(s): ${missing.join(', ')}`);
    }

    await this.prisma.$transaction([
      this.prisma.entryTag.deleteMany({ where: { entry_id: entryId } }),
      this.prisma.entryTag.createMany({
        data: tags.map((t) => ({ entry_id: entryId, tag_id: t.id })),
        skipDuplicates: true,
      }),
    ]);

    return { data: { entry_id: entryId, tag_ids: tags.map((t) => t.id) } };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.tag.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Tag '${id}' not found`);
  }
}
