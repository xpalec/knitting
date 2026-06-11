import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContentBlockTypeDto } from './dto/create-content-block-type.dto';
import { UpdateContentBlockTypeDto } from './dto/update-content-block-type.dto';
import { UpsertContentBlockTypeTranslationDto } from './dto/upsert-content-block-type-translation.dto';

const SUPPORTED_LOCALES = ['en', 'pl', 'fr', 'de', 'no'];

/** Shape the DB row into the API response shape expected by the frontend. */
function formatBlockType(bt: {
  id: string;
  type: string;
  label: string;
  description: string | null;
  color: string | null;
  created_at: Date;
  updated_at: Date;
  translations: Array<{ locale: string; heading: string }>;
}) {
  const translationsMap: Record<string, { heading: string }> = {};
  for (const t of bt.translations) {
    translationsMap[t.locale] = { heading: t.heading };
  }

  return {
    id: bt.id,
    type: bt.type,
    label: bt.label,
    description: bt.description ?? undefined,
    color: bt.color ?? undefined,
    translations: translationsMap,
    created_at: bt.created_at,
    updated_at: bt.updated_at,
  };
}

@Injectable()
export class AdminContentBlockTypeService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------

  async findAll() {
    const rows = await this.prisma.contentBlockType.findMany({
      include: { translations: { select: { locale: true, heading: true } } },
      orderBy: { created_at: 'asc' },
    });

    return { data: rows.map(formatBlockType) };
  }

  // ---------------------------------------------------------------------------
  // Get by id
  // ---------------------------------------------------------------------------

  async findOne(id: string) {
    const row = await this.prisma.contentBlockType.findUnique({
      where: { id },
      include: { translations: { select: { locale: true, heading: true } } },
    });

    if (!row) throw new NotFoundException(`ContentBlockType '${id}' not found`);
    return { data: formatBlockType(row) };
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(dto: CreateContentBlockTypeDto) {
    // Enforce unique type slug
    const existing = await this.prisma.contentBlockType.findUnique({
      where: { type: dto.type },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `A content block type with slug '${dto.type}' already exists`,
      );
    }

    const row = await this.prisma.contentBlockType.create({
      data: {
        type: dto.type,
        label: dto.label,
        description: dto.description ?? null,
        color: dto.color ?? null,
      },
      include: { translations: { select: { locale: true, heading: true } } },
    });

    return { data: formatBlockType(row) };
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(id: string, dto: UpdateContentBlockTypeDto) {
    const row = await this.prisma.contentBlockType.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) throw new NotFoundException(`ContentBlockType '${id}' not found`);

    const updated = await this.prisma.contentBlockType.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
      include: { translations: { select: { locale: true, heading: true } } },
    });
    return { data: formatBlockType(updated) };
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async delete(id: string) {
    const row = await this.prisma.contentBlockType.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) throw new NotFoundException(`ContentBlockType '${id}' not found`);

    await this.prisma.contentBlockType.delete({ where: { id } });
    return { data: { id, deleted: true } };
  }

  // ---------------------------------------------------------------------------
  // Upsert translation
  // ---------------------------------------------------------------------------

  async upsertTranslation(
    id: string,
    locale: string,
    dto: UpsertContentBlockTypeTranslationDto,
  ) {
    // Validate locale
    if (!SUPPORTED_LOCALES.includes(locale)) {
      throw new UnprocessableEntityException(
        `Locale '${locale}' is not supported. Supported locales: ${SUPPORTED_LOCALES.join(', ')}`,
      );
    }

    // Assert parent exists
    const parent = await this.prisma.contentBlockType.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!parent) throw new NotFoundException(`ContentBlockType '${id}' not found`);

    const translation = await this.prisma.contentBlockTypeTranslation.upsert({
      where: { block_type_id_locale: { block_type_id: id, locale } },
      create: { block_type_id: id, locale, heading: dto.heading },
      update: { heading: dto.heading },
    });

    // Return the full block type (with all translations) so the frontend can
    // update its cache in one shot — matching the existing API client contract.
    const row = await this.prisma.contentBlockType.findUnique({
      where: { id },
      include: { translations: { select: { locale: true, heading: true } } },
    });

    return { data: formatBlockType(row!) };
  }
}
