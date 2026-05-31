import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { UpsertTagTranslationDto } from './dto/upsert-tag-translation.dto';

@Injectable()
export class AdminTagService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Tag CRUD
  // ---------------------------------------------------------------------------

  async findAll(page: number, limit: number, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? { slug: { contains: search, mode: 'insensitive' as const } }
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
              seo_title: true,
              seo_description: true,
              status: true,
            },
          },
          _count: { select: { entries: true } },
        },
        skip,
        take: limit,
        orderBy: { slug: 'asc' },
      }),
      this.prisma.tag.count({ where }),
    ]);

    return {
      data: tags.map((t) => ({
        id: t.id,
        slug: t.slug,
        type: t.type,
        color_hex: t.color_hex,
        translations: t.translations,
        entry_count: t._count.entries,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(slug: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { slug },
      include: {
        translations: { orderBy: { locale: 'asc' } },
        _count: { select: { entries: true } },
      },
    });
    if (!tag) throw new NotFoundException(`Tag '${slug}' not found`);
    return { data: tag };
  }

  async create(dto: CreateTagDto) {
    const existing = await this.prisma.tag.findUnique({
      where: { slug: dto.slug },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`Tag with slug '${dto.slug}' already exists`);
    }

    const tag = await this.prisma.tag.create({
      data: {
        slug: dto.slug,
        type: dto.type as never ?? null,
        color_hex: dto.color_hex ?? null,
        translations: {
          create: {
            locale: 'en',
            name: dto.name_en,
            status: 'draft',
          },
        },
      },
      include: { translations: true },
    });

    return { data: tag };
  }

  async update(slug: string, dto: UpdateTagDto) {
    await this.assertExists(slug);
    const tag = await this.prisma.tag.update({
      where: { slug },
      data: {
        ...(dto.type !== undefined && { type: dto.type as never }),
        ...(dto.color_hex !== undefined && { color_hex: dto.color_hex }),
      },
    });
    return { data: tag };
  }

  async delete(slug: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { slug },
      include: { _count: { select: { entries: true } } },
    });
    if (!tag) throw new NotFoundException(`Tag '${slug}' not found`);

    if (tag._count.entries > 0) {
      throw new BadRequestException(
        `Cannot delete tag '${slug}' — it is assigned to ${tag._count.entries} entr${tag._count.entries === 1 ? 'y' : 'ies'}. Remove all assignments first.`,
      );
    }

    await this.prisma.tag.delete({ where: { slug } });
    return { data: { slug, deleted: true } };
  }

  // ---------------------------------------------------------------------------
  // TagTranslation upsert
  // ---------------------------------------------------------------------------

  async upsertTranslation(
    slug: string,
    locale: string,
    dto: UpsertTagTranslationDto,
  ) {
    const tag = await this.prisma.tag.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!tag) throw new NotFoundException(`Tag '${slug}' not found`);

    const translation = await this.prisma.tagTranslation.upsert({
      where: { tag_id_locale: { tag_id: tag.id, locale } },
      create: {
        tag_id: tag.id,
        locale,
        name: dto.name,
        description: (dto.description ?? null) as never,
        seo_title: dto.seo_title ?? null,
        seo_description: dto.seo_description ?? null,
        status: (dto.status as never) ?? 'draft',
      },
      update: {
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
  // Entry tag assignment
  // ---------------------------------------------------------------------------

  async assignEntryTags(entryId: string, slugs: string[]) {
    // Verify entry exists
    const entry = await this.prisma.entry.findUnique({
      where: { id: entryId },
      select: { id: true },
    });
    if (!entry) throw new NotFoundException(`Entry '${entryId}' not found`);

    // Resolve slugs → tag IDs, fail fast on unknown slugs
    const tags = await this.prisma.tag.findMany({
      where: { slug: { in: slugs } },
      select: { id: true, slug: true },
    });

    const foundSlugs = new Set(tags.map((t) => t.slug));
    const missing = slugs.filter((s) => !foundSlugs.has(s));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Unknown tag slug(s): ${missing.join(', ')}`,
      );
    }

    // Replace current set atomically
    await this.prisma.$transaction([
      this.prisma.entryTag.deleteMany({ where: { entry_id: entryId } }),
      this.prisma.entryTag.createMany({
        data: tags.map((t) => ({ entry_id: entryId, tag_id: t.id })),
        skipDuplicates: true,
      }),
    ]);

    return {
      data: {
        entry_id: entryId,
        tags: tags.map((t) => t.slug),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async assertExists(slug: string): Promise<void> {
    const exists = await this.prisma.tag.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Tag '${slug}' not found`);
  }
}
