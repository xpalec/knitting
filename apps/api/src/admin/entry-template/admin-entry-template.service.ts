import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEntryTemplateDto } from './dto/create-entry-template.dto';
import { UpdateEntryTemplateDto } from './dto/update-entry-template.dto';

const SUPPORTED_LOCALES = ['en', 'pl'] as const;

type TemplateTranslations = Record<string, Record<string, Record<string, string>>>;

interface TemplateBlock {
  id: string;
  type: string;
  label?: string;
  order: number;
  required: boolean;
  [key: string]: unknown;
}

interface EntryBlock {
  id: string;
  visible?: boolean;
  [key: string]: unknown;
}

function ensureBlockIds(blocks: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return blocks.map((b) => ({ id: randomUUID(), ...b }));
}

/**
 * Merge new template block definitions into an entry's existing content_blocks snapshot.
 * - Authoritative order and structure come from the template.
 * - Per-entry `visible` flag is preserved for blocks that already exist.
 * - Blocks removed from the template are dropped.
 * - Blocks added to the template are inserted with visible: true.
 */
function mergeEntryBlocks(
  templateBlocks: TemplateBlock[],
  entryBlocks: EntryBlock[],
): TemplateBlock[] {
  return templateBlocks.map((tb) => {
    const existing = entryBlocks.find((eb) => eb.id === tb.id);
    return {
      id: tb.id,
      type: tb.type,
      label: tb.label,
      order: tb.order,
      required: tb.required,
      visible: existing?.visible ?? true,
    };
  });
}

function formatTemplate(t: {
  id: string;
  name: string;
  description: string | null;
  blocks: unknown;
  translations: unknown;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? undefined,
    blocks: Array.isArray(t.blocks) ? t.blocks : [],
    translations: (t.translations && typeof t.translations === 'object' && !Array.isArray(t.translations))
      ? t.translations as TemplateTranslations
      : {},
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

@Injectable()
export class AdminEntryTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const rows = await this.prisma.entryTemplate.findMany({
      orderBy: { created_at: 'asc' },
    });
    return { data: rows.map(formatTemplate) };
  }

  async findOne(id: string) {
    const row = await this.prisma.entryTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`EntryTemplate '${id}' not found`);
    return { data: formatTemplate(row) };
  }

  async create(dto: CreateEntryTemplateDto) {
    const rawBlocks = (dto.blocks ?? []) as unknown as Array<Record<string, unknown>>;
    const blocks = ensureBlockIds(rawBlocks);
    const row = await this.prisma.entryTemplate.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        blocks: blocks as never,
        translations: (dto.translations ?? {}) as never,
      },
    });
    return { data: formatTemplate(row) };
  }

  async update(id: string, dto: UpdateEntryTemplateDto) {
    const existing = await this.prisma.entryTemplate.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`EntryTemplate '${id}' not found`);

    const blocks = dto.blocks !== undefined
      ? ensureBlockIds(dto.blocks as unknown as Array<Record<string, unknown>>)
      : undefined;

    const row = await this.prisma.entryTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(blocks !== undefined && { blocks: blocks as never }),
        ...(dto.translations !== undefined && { translations: dto.translations as never }),
      },
    });

    // Propagate structural block changes to all entries linked to this template.
    // Only runs when the blocks array was part of this update.
    if (blocks !== undefined && blocks.length >= 0) {
      await this.syncLinkedEntryBlocks(id, blocks as unknown as TemplateBlock[]);
    }

    return { data: formatTemplate(row) };
  }

  /**
   * For every entry linked to this template, rewrite content_blocks to match
   * the new template block definitions while preserving per-entry `visible` flags.
   */
  private async syncLinkedEntryBlocks(
    templateId: string,
    newTemplateBlocks: TemplateBlock[],
  ): Promise<void> {
    const linkedEntries = await this.prisma.entry.findMany({
      where: { entry_template_id: templateId },
      select: { id: true, content_blocks: true },
    });

    if (linkedEntries.length === 0) return;

    await this.prisma.$transaction(
      linkedEntries.map((entry) => {
        const currentBlocks = Array.isArray(entry.content_blocks)
          ? (entry.content_blocks as EntryBlock[])
          : [];
        const merged = mergeEntryBlocks(newTemplateBlocks, currentBlocks);
        return this.prisma.entry.update({
          where: { id: entry.id },
          data: { content_blocks: merged as never },
        });
      }),
    );
  }

  async upsertTranslation(
    id: string,
    locale: string,
    blockTranslations: Record<string, Record<string, string>>,
  ) {
    if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
      throw new UnprocessableEntityException(
        `Unsupported locale '${locale}'. Supported locales: ${SUPPORTED_LOCALES.join(', ')}`,
      );
    }

    const existing = await this.prisma.entryTemplate.findUnique({
      where: { id },
      select: { id: true, translations: true },
    });
    if (!existing) throw new NotFoundException(`EntryTemplate '${id}' not found`);

    // Merge locale data into the translations JSON without touching other locales
    const current = (
      existing.translations && typeof existing.translations === 'object' && !Array.isArray(existing.translations)
        ? existing.translations
        : {}
    ) as TemplateTranslations;

    const merged: TemplateTranslations = { ...current };
    for (const [blockId, fields] of Object.entries(blockTranslations)) {
      merged[blockId] = {
        ...(merged[blockId] ?? {}),
        [locale]: {
          ...(merged[blockId]?.[locale] ?? {}),
          ...fields,
        },
      };
    }

    const row = await this.prisma.entryTemplate.update({
      where: { id },
      data: { translations: merged as never },
    });
    return { data: formatTemplate(row) };
  }

  async delete(id: string) {
    const existing = await this.prisma.entryTemplate.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`EntryTemplate '${id}' not found`);

    await this.prisma.entryTemplate.delete({ where: { id } });
    return { data: { id, deleted: true } };
  }
}

