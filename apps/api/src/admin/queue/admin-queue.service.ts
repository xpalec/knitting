import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewContributionDto } from './dto/review-contribution.dto';

@Injectable()
export class AdminQueueService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Entry queue ──────────────────────────────────────────────────────────

  async listEntryQueue(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.contribution.findMany({
        where: { type: 'entry', status: 'pending' },
        skip,
        take: limit,
        orderBy: { submitted_at: 'asc' },
      }),
      this.prisma.contribution.count({ where: { type: 'entry', status: 'pending' } }),
    ]);
    return { data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async reviewEntry(id: string, dto: ReviewContributionDto) {
    const contribution = await this.prisma.contribution.findUnique({ where: { id } });
    if (!contribution) throw new NotFoundException(`Contribution ${id} not found`);
    if (contribution.type !== 'entry') throw new BadRequestException('Not an entry contribution');
    if (contribution.status !== 'pending') throw new BadRequestException('Already reviewed');

    if (dto.action === 'approve') {
      const payload = contribution.payload as Record<string, unknown>;

      // Determine entry type from payload or default to 'stitch'
      const entryType = (payload['entry_type'] as string) ?? 'stitch';

      // Fetch block template
      const template = await this.prisma.blockTemplate.findUnique({
        where: { entry_type: entryType },
      });

      const entry = await this.prisma.entry.create({
        data: {
          origin_language: (payload['origin_language'] as string) ?? 'en',
          status: 'draft',
          metadata: { skill_level: payload['skill_level'] ?? null },
          content_blocks: template?.blocks ?? [],
          translations: {
            create: {
              locale: 'en',
              slug: this.slugify(payload['term'] as string),
              term: payload['term'] as string,
              metadata: {
                definition_short: payload['definition'] ?? null,
                abbreviation: payload['abbreviation'] ?? null,
              },
              blocks: {},
              status: 'draft',
            },
          },
        },
      });

      await this.prisma.contribution.update({
        where: { id },
        data: {
          status: 'approved',
          entry_id: entry.id,
          reviewer_note: dto.reviewer_note ?? null,
          reviewed_at: new Date(),
        },
      });

      return { data: { action: 'approved', entry_id: entry.id } };
    }

    // reject
    await this.prisma.contribution.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewer_note: dto.reviewer_note ?? null,
        reviewed_at: new Date(),
      },
    });
    return { data: { action: 'rejected' } };
  }

  // ── Translation queue ────────────────────────────────────────────────────

  async listTranslationQueue(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.contribution.findMany({
        where: { type: 'translation', status: 'pending' },
        include: {
          entry: {
            include: {
              translations: { where: { locale: 'en' }, select: { term: true } },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { submitted_at: 'asc' },
      }),
      this.prisma.contribution.count({ where: { type: 'translation', status: 'pending' } }),
    ]);
    return { data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async reviewTranslation(id: string, dto: ReviewContributionDto) {
    const contribution = await this.prisma.contribution.findUnique({ where: { id } });
    if (!contribution) throw new NotFoundException(`Contribution ${id} not found`);
    if (contribution.type !== 'translation') throw new BadRequestException('Not a translation contribution');
    if (contribution.status !== 'pending') throw new BadRequestException('Already reviewed');

    if (dto.action === 'approve') {
      const payload = contribution.payload as Record<string, unknown>;
      const entryId = contribution.entry_id;
      if (!entryId) throw new BadRequestException('No entry linked to this contribution');

      const locale = payload['locale'] as string;
      const term = payload['term'] as string;

      await this.prisma.translation.upsert({
        where: { entry_id_locale: { entry_id: entryId, locale } },
        create: {
          entry_id: entryId,
          locale,
          slug: this.slugify(term),
          term,
          metadata: {
            definition_short: payload['definition'] ?? null,
            abbreviation: payload['abbreviation'] ?? null,
          },
          blocks: {},
          status: 'draft',
        },
        update: {
          term,
          metadata: {
            definition_short: payload['definition'] ?? null,
            abbreviation: payload['abbreviation'] ?? null,
          },
        },
      });

      await this.prisma.contribution.update({
        where: { id },
        data: { status: 'approved', reviewer_note: dto.reviewer_note ?? null, reviewed_at: new Date() },
      });
      return { data: { action: 'approved' } };
    }

    await this.prisma.contribution.update({
      where: { id },
      data: { status: 'rejected', reviewer_note: dto.reviewer_note ?? null, reviewed_at: new Date() },
    });
    return { data: { action: 'rejected' } };
  }

  // ── Correction queue ─────────────────────────────────────────────────────

  async listCorrectionQueue(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.contribution.findMany({
        where: { type: 'correction', status: 'pending' },
        skip,
        take: limit,
        orderBy: { submitted_at: 'asc' },
      }),
      this.prisma.contribution.count({ where: { type: 'correction', status: 'pending' } }),
    ]);
    return { data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async reviewCorrection(id: string, dto: ReviewContributionDto) {
    const contribution = await this.prisma.contribution.findUnique({ where: { id } });
    if (!contribution) throw new NotFoundException(`Contribution ${id} not found`);
    if (contribution.type !== 'correction') throw new BadRequestException('Not a correction contribution');

    const newStatus = dto.action === 'approve' ? 'approved' : 'rejected';
    await this.prisma.contribution.update({
      where: { id },
      data: { status: newStatus, reviewer_note: dto.reviewer_note ?? null, reviewed_at: new Date() },
    });
    return { data: { action: newStatus } };
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
