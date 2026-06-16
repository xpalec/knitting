import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAbbreviationDto } from './dto/create-abbreviation.dto';
import { CreateTranslationDto } from './dto/create-translation.dto';
import { LinkEntryAbbreviationDto } from './dto/link-entry-abbreviation.dto';
import { ListAbbreviationsQueryDto } from './dto/list-abbreviations-query.dto';
import { UpdateAbbreviationDto } from './dto/update-abbreviation.dto';
import { UpdateEntryAbbreviationDto } from './dto/update-entry-abbreviation.dto';
import { UpdateTranslationDto } from './dto/update-translation.dto';

@Injectable()
export class AdminAbbreviationService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // findAll — paginated list with optional filters and display_language fallback
  // ---------------------------------------------------------------------------

  async findAll(query: ListAbbreviationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AbbreviationWhereInput = {};

    if (query.q) {
      where.code = { contains: query.q, mode: 'insensitive' };
    }

    if (query.source_language) {
      where.source_language = query.source_language;
    }

    const [abbreviations, total] = await Promise.all([
      this.prisma.abbreviation.findMany({
        where,
        include: {
          translations: true,
        },
        skip,
        take: limit,
        orderBy: { code: 'asc' },
      }),
      this.prisma.abbreviation.count({ where }),
    ]);

    const data = abbreviations.map((abbr) => {
      if (!query.display_language) {
        return abbr;
      }

      // Resolve short_meaning via fallback chain:
      // exact locale → 'en' → first available → null
      const resolved_short_meaning = this.resolveShortMeaning(
        query.display_language,
        abbr.translations,
      );

      return { ...abbr, resolved_short_meaning };
    });

    return {
      data,
      meta: { total, page, limit },
    };
  }

  // ---------------------------------------------------------------------------
  // findOne — single abbreviation with translations and entry_abbreviations
  // ---------------------------------------------------------------------------

  async findOne(id: string) {
    const abbreviation = await this.prisma.abbreviation.findUnique({
      where: { id },
      include: {
        translations: true,
        entry_abbreviations: true,
      },
    });

    if (!abbreviation) {
      throw new NotFoundException(`Abbreviation '${id}' not found`);
    }

    return abbreviation;
  }

  // ---------------------------------------------------------------------------
  // create — trim code, insert, catch P2002 as 409
  // ---------------------------------------------------------------------------

  async create(dto: CreateAbbreviationDto) {
    const code = dto.code.trim();

    try {
      const abbreviation = await this.prisma.abbreviation.create({
        data: {
          code,
          source_language: dto.source_language,
        },
        include: {
          translations: true,
        },
      });

      return abbreviation;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `An abbreviation with code '${code}' and source language '${dto.source_language}' already exists`,
        );
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // update — find-or-404, attempt update, catch P2002 as 409
  // ---------------------------------------------------------------------------

  async update(id: string, dto: UpdateAbbreviationDto) {
    await this.assertExists(id);

    const updateData: Prisma.AbbreviationUpdateInput = {};

    if (dto.code !== undefined) {
      updateData.code = dto.code.trim();
    }
    if (dto.source_language !== undefined) {
      updateData.source_language = dto.source_language;
    }

    try {
      const abbreviation = await this.prisma.abbreviation.update({
        where: { id },
        data: updateData,
        include: {
          translations: true,
        },
      });

      return abbreviation;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `An abbreviation with this code and source language combination already exists`,
        );
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // delete — find-or-404, delete (cascades handled by Prisma)
  // ---------------------------------------------------------------------------

  async delete(id: string) {
    await this.assertExists(id);
    await this.prisma.abbreviation.delete({ where: { id } });
  }

  // ---------------------------------------------------------------------------
  // createTranslation — check parent exists, check locale not already present
  // ---------------------------------------------------------------------------

  async createTranslation(id: string, dto: CreateTranslationDto) {
    await this.assertExists(id);

    try {
      const translation = await this.prisma.abbreviationTranslation.create({
        data: {
          abbreviation_id: id,
          locale: dto.locale,
          short_meaning: dto.short_meaning ?? null,
          description: dto.description != null ? (dto.description as Prisma.InputJsonValue) : Prisma.DbNull,
        },
      });

      return translation;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `A translation for locale '${dto.locale}' already exists for abbreviation '${id}'`,
        );
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // updateTranslation — check parent and locale row both exist, update
  // ---------------------------------------------------------------------------

  async updateTranslation(id: string, locale: string, dto: UpdateTranslationDto) {
    await this.assertExists(id);
    await this.assertTranslationExists(id, locale);

    const translation = await this.prisma.abbreviationTranslation.update({
      where: {
        abbreviation_id_locale: { abbreviation_id: id, locale },
      },
      data: {
        ...(dto.short_meaning !== undefined && { short_meaning: dto.short_meaning }),
        ...(dto.description !== undefined && {
          description: dto.description != null
            ? (dto.description as Prisma.InputJsonValue)
            : Prisma.DbNull,
        }),
      },
    });

    return translation;
  }

  // ---------------------------------------------------------------------------
  // deleteTranslation — check parent and locale row both exist, delete
  // ---------------------------------------------------------------------------

  async deleteTranslation(id: string, locale: string) {
    await this.assertExists(id);
    await this.assertTranslationExists(id, locale);

    await this.prisma.abbreviationTranslation.delete({
      where: {
        abbreviation_id_locale: { abbreviation_id: id, locale },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // linkEntry — check both IDs exist, catch P2002 as 409
  // ---------------------------------------------------------------------------

  async linkEntry(entryId: string, dto: LinkEntryAbbreviationDto) {
    // Verify the entry exists
    const entry = await this.prisma.entry.findUnique({
      where: { id: entryId },
      select: { id: true },
    });
    if (!entry) {
      throw new NotFoundException(`Entry '${entryId}' not found`);
    }

    // Verify the abbreviation exists
    await this.assertExists(dto.abbreviation_id);

    try {
      const link = await this.prisma.entryAbbreviation.create({
        data: {
          entry_id: entryId,
          abbreviation_id: dto.abbreviation_id,
          is_primary: dto.is_primary ?? false,
          sort_order: dto.sort_order ?? 0,
        },
      });

      return link;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `Abbreviation '${dto.abbreviation_id}' is already linked to entry '${entryId}'`,
        );
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // updateLink — verify join row exists, update metadata
  // ---------------------------------------------------------------------------

  async updateLink(
    entryId: string,
    abbreviationId: string,
    dto: UpdateEntryAbbreviationDto,
  ) {
    await this.assertLinkExists(entryId, abbreviationId);

    const link = await this.prisma.entryAbbreviation.update({
      where: {
        entry_id_abbreviation_id: { entry_id: entryId, abbreviation_id: abbreviationId },
      },
      data: {
        ...(dto.is_primary !== undefined && { is_primary: dto.is_primary }),
        ...(dto.sort_order !== undefined && { sort_order: dto.sort_order }),
      },
    });

    return link;
  }

  // ---------------------------------------------------------------------------
  // unlinkEntry — verify join row exists, delete
  // ---------------------------------------------------------------------------

  async unlinkEntry(entryId: string, abbreviationId: string) {
    await this.assertLinkExists(entryId, abbreviationId);

    await this.prisma.entryAbbreviation.delete({
      where: {
        entry_id_abbreviation_id: { entry_id: entryId, abbreviation_id: abbreviationId },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.abbreviation.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Abbreviation '${id}' not found`);
    }
  }

  private async assertTranslationExists(id: string, locale: string): Promise<void> {
    const exists = await this.prisma.abbreviationTranslation.findUnique({
      where: { abbreviation_id_locale: { abbreviation_id: id, locale } },
      select: { abbreviation_id: true },
    });
    if (!exists) {
      throw new NotFoundException(
        `Translation for locale '${locale}' not found on abbreviation '${id}'`,
      );
    }
  }

  private async assertLinkExists(entryId: string, abbreviationId: string): Promise<void> {
    const exists = await this.prisma.entryAbbreviation.findUnique({
      where: {
        entry_id_abbreviation_id: { entry_id: entryId, abbreviation_id: abbreviationId },
      },
      select: { entry_id: true },
    });
    if (!exists) {
      throw new NotFoundException(
        `Link between entry '${entryId}' and abbreviation '${abbreviationId}' not found`,
      );
    }
  }

  /**
   * Resolve the short_meaning for a given display locale using the fallback chain:
   * exact locale → 'en' → first available → null
   */
  private resolveShortMeaning(
    locale: string,
    translations: Array<{ locale: string; short_meaning: string | null }>,
  ): string | null {
    if (translations.length === 0) return null;

    const exact = translations.find((t) => t.locale === locale);
    if (exact) return exact.short_meaning;

    const en = translations.find((t) => t.locale === 'en');
    if (en) return en.short_meaning;

    return translations[0].short_meaning;
  }
}
