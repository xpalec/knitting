import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpsertCategoryTranslationDto } from './dto/upsert-category-translation.dto';

// Locales whose public tree cache must be invalidated on any category change
const SUPPORTED_LOCALES = ['en', 'pl', 'de', 'no', 'fr'];

@Injectable()
export class AdminCategoryService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // ---------------------------------------------------------------------------
  // Category CRUD
  // ---------------------------------------------------------------------------

  async findAll(page: number, limit: number, search?: string) {
    const skip = (page - 1) * limit;

    // Search against English translation name when a query is provided
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

    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include: {
          translations: {
            orderBy: { locale: 'asc' },
            select: { locale: true, name: true, slug: true, status: true },
          },
          _count: { select: { entries: true, children: true } },
        },
        skip,
        take: limit,
        orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
      }),
      this.prisma.category.count({ where }),
    ]);

    return {
      data: categories.map((c) => ({
        id: c.id,
        parent_id: c.parent_id,
        icon: c.icon,
        sort_order: c.sort_order,
        status: c.status,
        entry_count: c.entry_count,
        cover_image_url: c.cover_image_url,
        translations: c.translations,
        children_count: c._count.children,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        translations: { orderBy: { locale: 'asc' } },
        children: {
          include: {
            translations: {
              where: { locale: 'en' },
              select: { name: true, slug: true },
            },
          },
          orderBy: { sort_order: 'asc' },
        },
        _count: { select: { entries: true } },
      },
    });

    if (!category) throw new NotFoundException(`Category '${id}' not found`);
    return { data: category };
  }

  async create(dto: CreateCategoryDto) {
    // Check slug uniqueness for the English translation
    const existingSlug = await this.prisma.categoryTranslation.findUnique({
      where: { locale_slug: { locale: 'en', slug: dto.slug_en } },
      select: { id: true },
    });
    if (existingSlug) {
      throw new ConflictException(
        `A category with English slug '${dto.slug_en}' already exists`,
      );
    }

    // Validate parent exists if provided
    if (dto.parent_id) {
      await this.assertCategoryExists(dto.parent_id);
    }

    const category = await this.prisma.category.create({
      data: {
        parent_id: dto.parent_id ?? null,
        icon: dto.icon ?? null,
        sort_order: dto.sort_order ?? 0,
        cover_image_url: dto.cover_image_url ?? null,
        status: 'draft',
        translations: {
          create: {
            locale: 'en',
            name: dto.name_en,
            slug: dto.slug_en,
            status: 'draft',
          },
        },
      },
      include: { translations: true },
    });

    await this.invalidateCache();
    return { data: category };
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.assertCategoryExists(id);

    // Prevent a category from being its own parent
    if (dto.parent_id === id) {
      throw new BadRequestException('A category cannot be its own parent');
    }

    // Validate new parent exists if provided
    if (dto.parent_id) {
      await this.assertCategoryExists(dto.parent_id);
    }

    const category = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.parent_id !== undefined && { parent_id: dto.parent_id }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.sort_order !== undefined && { sort_order: dto.sort_order }),
        ...(dto.status !== undefined && { status: dto.status as never }),
        ...(dto.cover_image_url !== undefined && { cover_image_url: dto.cover_image_url }),
      },
    });

    await this.invalidateCache();
    return { data: category };
  }

  async delete(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { entries: true, children: true } },
      },
    });

    if (!category) throw new NotFoundException(`Category '${id}' not found`);

    if (category._count.entries > 0) {
      throw new BadRequestException(
        `Cannot delete category '${id}' — it has ${category._count.entries} entr${category._count.entries === 1 ? 'y' : 'ies'} assigned. Remove all assignments first.`,
      );
    }

    if (category._count.children > 0) {
      throw new BadRequestException(
        `Cannot delete category '${id}' — it has ${category._count.children} child categor${category._count.children === 1 ? 'y' : 'ies'}. Delete or re-parent them first.`,
      );
    }

    await this.prisma.category.delete({ where: { id } });
    await this.invalidateCache();
    return { data: { id, deleted: true } };
  }

  // ---------------------------------------------------------------------------
  // CategoryTranslation upsert
  // ---------------------------------------------------------------------------

  async upsertTranslation(
    id: string,
    locale: string,
    dto: UpsertCategoryTranslationDto,
  ) {
    await this.assertCategoryExists(id);

    // Check slug uniqueness — must not collide with another category's translation
    const existingSlug = await this.prisma.categoryTranslation.findUnique({
      where: { locale_slug: { locale, slug: dto.slug } },
      select: { category_id: true },
    });
    if (existingSlug && existingSlug.category_id !== id) {
      throw new ConflictException(
        `Slug '${dto.slug}' is already used by another category for locale '${locale}'`,
      );
    }

    const translation = await this.prisma.categoryTranslation.upsert({
      where: { category_id_locale: { category_id: id, locale } },
      create: {
        category_id: id,
        locale,
        name: dto.name,
        slug: dto.slug,
        description: (dto.description ?? null) as never,
        translator_note: dto.translator_note ?? null,
        status: (dto.status as never) ?? 'draft',
      },
      update: {
        name: dto.name,
        slug: dto.slug,
        ...(dto.description !== undefined && { description: dto.description as never }),
        ...(dto.translator_note !== undefined && { translator_note: dto.translator_note }),
        ...(dto.status && { status: dto.status as never }),
      },
    });

    await this.invalidateCache(locale);
    return { data: translation };
  }

  // ---------------------------------------------------------------------------
  // Entry category assignment
  // ---------------------------------------------------------------------------

  async assignEntryCategories(entryId: string, categoryIds: string[]) {
    // Verify entry exists
    const entry = await this.prisma.entry.findUnique({
      where: { id: entryId },
      select: { id: true },
    });
    if (!entry) throw new NotFoundException(`Entry '${entryId}' not found`);

    // Verify all category IDs exist
    if (categoryIds.length > 0) {
      const found = await this.prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true },
      });
      const foundIds = new Set(found.map((c) => c.id));
      const missing = categoryIds.filter((cid) => !foundIds.has(cid));
      if (missing.length > 0) {
        throw new BadRequestException(
          `Unknown category ID(s): ${missing.join(', ')}`,
        );
      }
    }

    // Replace current set atomically
    await this.prisma.$transaction([
      this.prisma.entryCategory.deleteMany({ where: { entry_id: entryId } }),
      this.prisma.entryCategory.createMany({
        data: categoryIds.map((cid) => ({ entry_id: entryId, category_id: cid })),
        skipDuplicates: true,
      }),
    ]);

    return { data: { entry_id: entryId, category_ids: categoryIds } };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async assertCategoryExists(id: string): Promise<void> {
    const exists = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Category '${id}' not found`);
  }

  private async invalidateCache(locale?: string): Promise<void> {
    const locales = locale ? [locale] : SUPPORTED_LOCALES;
    await Promise.all(
      locales.map((l) => this.cache.del(`categories:tree:${l}`)),
    );
  }
}
